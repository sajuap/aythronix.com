/**
 * GlassSlabs — the hero backdrop, as a two-layer Three.js scene.
 *
 * Layer 1, at the back: one full-screen plane carrying a procedural gradient.
 * Domain-warped value noise, so it morphs rather than merely drifting, plus a
 * pool of light that tracks the cursor. This is the only thing in the scene that
 * moves.
 *
 * Layer 2, in front: a wall of vertical glass panels. Real boxes with real
 * thickness, flat faces, bevelled arrises and a micro-texture over the lot,
 * shaded with MeshPhysicalMaterial at full transmission — so the blur behind
 * them is three.js resolving actual light transport through the material. The
 * renderer draws the opaque scene into a mip chain, the material samples it at a
 * mip chosen by surface roughness (that is the frost) and offsets the sample by
 * the refraction vector computed from IOR and thickness (that is the bend).
 * Volume attenuation tints what passes through by distance travelled, which is
 * where the blue inside the panels comes from — the material is very nearly
 * colourless face-on, and goes blue with depth. None of it is a CSS
 * approximation.
 *
 * Worth knowing before adjusting any of it: the material can only ever be seen
 * doing something to what is behind it. Frost, refraction and face curvature are
 * all modulations of the light field, and against a smooth wash they resolve to
 * the wash — clear glass and heavily frosted glass come out identical pixels.
 * The fine structure in the light pool (see the gradient shader) is what makes
 * the glass legible as glass, and roughness is tuned against it: too much and it
 * blurs that structure back out of existence and the panels flatten again.
 *
 * The wall is engineered, not grown. Every panel is identical — same width,
 * height, depth and z — and the row is laid out from a single pitch, so position
 * is nothing but `pitch * index`. The only thing that varies is a few percent of
 * tint on the light each panel passes, and that variation is in light, never in
 * form.
 *
 * The panels never move. The cursor drives the gradient's light pool and nudges
 * the key light, which changes how the glass catches it — a torch moving behind
 * the wall, not the wall moving.
 *
 * The whole wall is one InstancedMesh: one geometry, one material, one draw call
 * however many panels there are. Three per frame in total, counting the gradient
 * in the frame and again in the transmission buffer. Layout changes rewrite the
 * instance matrices rather than building anything, and the scene sizes itself
 * down if the machine cannot afford it (QUALITY_STEPS).
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DirectionalLight,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { gsap } from '../core/gsap.js';
import { isTouch, prefersReducedMotion } from '../utils/env.js';

// --- Scene constants -------------------------------------------------------

const FOV = 30;
const CAMERA_Z = 7;
const SLAB_Z = 0;
const GRADIENT_Z = -6;

// --- The light -------------------------------------------------------------
//
// Two states, blended rather than switched.
//
//   Cursor follow — the pointer moves, and the light is under its control on a
//   short leash.
//   Idle ambient  — the pointer has been still for IDLE_DELAY, and the light
//   goes back to drifting on its own.
//
// Nothing ever hands over abruptly: the blend is eased at both ends, and both
// states are smooth curves, so the light has no way to change direction sharply
// or arrive anywhere at speed.

/** Where the light sits with no cursor and no drift. */
const LIGHT_HOME_X = 0.36;
const LIGHT_HOME_Y = 0.3;

/** How far from home the cursor may carry it, as a fraction of the frame. */
const CURSOR_REACH_X = 0.3;
const CURSOR_REACH_Y = 0.24;

/** Seconds of pointer stillness before the light drifts off on its own. */
const IDLE_DELAY = 1.4;

/** Taking the cursor is quick; letting go of it is not. */
const ENGAGE_TAU = 0.18;
const RELEASE_TAU = 1.5;

/** Follow latency in each state — tight under the cursor, loose when drifting. */
const CURSOR_TAU = 0.13;
const IDLE_TAU = 0.55;

/** Pool radius, and how much of it the ambient breath takes. */
const LAMP_RADIUS = 0.66;
const LAMP_BREATH = 0.07;

/**
 * The idle path.
 *
 * Three sinusoids per axis, with frequencies stepped by the golden ratio. The
 * ratios being irrational is the whole point: the sum is quasi-periodic, so it
 * never closes back on itself and there is no loop for anyone to notice, no
 * matter how long they watch. And because it is a sum of sines it is smooth in
 * every derivative — the light physically cannot jump, stall or turn a corner.
 *
 * Slow term for the wander, middle term for shape, fast term so the motion is
 * perceptible inside ten seconds rather than only over a minute.
 *
 * The amplitudes are what keep it subtle and the frequencies are what keep it
 * alive, and they are tuned against different things. Amplitude is bounded by
 * composition — the pool has to stay below the copy and off the particle sphere,
 * which caps the excursion at roughly a sixth of the frame. Speed is bounded by
 * perception, and the number that matters there is velocity, not travel: three
 * sinusoids at assorted phases spend most of their time partly cancelling, so
 * the distance covered in any ten-second window is far less than the amplitudes
 * suggest. These frequencies put the pool centre at about 23px/s — visible if
 * you watch it, invisible if you are reading.
 */
const PHI = 1.618033988749;

const IDLE_X = [
  { f: 0.153, a: 0.09, p: 0.0 },
  { f: 0.153 * PHI, a: 0.052, p: 2.3 },
  { f: 0.153 * PHI * PHI, a: 0.03, p: 5.1 },
];

const IDLE_Y = [
  { f: 0.13, a: 0.065, p: 1.1 },
  { f: 0.13 * PHI, a: 0.038, p: 3.7 },
  { f: 0.13 * PHI * PHI, a: 0.022, p: 0.4 },
];

function wave(parts, t) {
  let v = 0;
  for (let i = 0; i < parts.length; i++) {
    v += parts[i].a * Math.sin(t * parts[i].f + parts[i].p);
  }
  return v;
}

// --- The wall --------------------------------------------------------------
//
// Every panel is identical and the row is laid out from a single pitch, so the
// only numbers the composition needs are these three.

/** Panel thickness in world units. Identical for every panel. */
const PANEL_DEPTH = 0.4;

/**
 * Seam width as a fraction of the pitch: pitch = panelWidth + gap.
 *
 * Kept to a hairline deliberately. What sits behind the wall is the raw light
 * field, unrefracted and unfrosted, so a wide gap does not read as a shadow line
 * between panels — it reads as a hard bright slit wherever the light behind
 * happens to be, which is the one thing that breaks the illusion of glass.
 */
const PANEL_GAP_RATIO = 0.035;

/** How far the per-panel tint may stray from neutral. Light only, never form. */
const PANEL_GLOW_VARIANCE = 0.05;

/**
 * Quality governor.
 *
 * Transmission is the most expensive thing three.js does per frame, and the cost
 * is almost entirely resolution-bound: the transmission buffer is sized to the
 * drawing buffer, multisampled, and re-mipped every frame. Rather than pick a
 * pixel ratio low enough to be safe on the worst GPU a visitor might arrive
 * with — and make it look soft for everyone else — the scene opens at full
 * quality, times itself, and steps down if it cannot hold the frame.
 *
 * It only ever steps down. A governor that could climb back up would sit on the
 * boundary and hunt between two settings for the length of the visit.
 */
const QUALITY_STEPS = [
  // Opens at 0.82 rather than 1. Every pixel here is paid for three times over —
  // in the frame, in the multisampled transmission buffer sized to match it, and
  // in the mip chain rebuilt over that buffer every frame — so the top step was
  // the most expensive thing on the page by a wide margin. Nothing in this scene
  // has an edge sharp enough to show the difference: it is a soft light field
  // behind frosted panels. What it does show is roughly a third off the fill.
  { dprScale: 0.82, slabScale: 1 },
  { dprScale: 0.66, slabScale: 1 },
  { dprScale: 0.5, slabScale: 1.6 },
  // A floor for the machines that cannot hold even that. Soft, but running.
  { dprScale: 0.38, slabScale: 2.2 },
];

/** Roughly 45fps. Above this the scene is costing the page real frames. */
const FRAME_BUDGET_MS = 22;

/** Ignored after start and after each step down — shader compiles land here. */
const WARMUP_MS = 500;

/**
 * A verdict needs either enough frames for a stable median or enough wall clock,
 * whichever lands first. Frames alone would mean the slowest devices — the ones
 * that actually need the governor — wait longest to hear from it.
 *
 * Short windows on purpose. Every millisecond before the first verdict is a
 * millisecond of the stutter the governor exists to end, and on a machine that
 * needs two steps down the old windows meant three seconds of it. A median of
 * six frames is coarse, but it only has to answer "is this obviously too slow".
 */
const MIN_SAMPLES = 6;
const SAMPLE_FRAMES = 40;
const SAMPLE_MS = 700;

// --- Layer 1: the gradient -------------------------------------------------

const GRADIENT_VERT = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GRADIENT_FRAG = /* glsl */ `
uniform vec3  uVoid;
uniform vec3  uMidnight;
uniform vec3  uNavy;
uniform vec3  uRoyal;
uniform vec3  uGlow;
uniform float uTime;
uniform vec2  uLight;
uniform float uLampRadius;
uniform float uAspect;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise. Smooth by construction, so the field never needs a blur pass to
// look soft — and never bands, because it is evaluated rather than sampled.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv;

  // Domain warp: the field is read through a slowly turning offset of itself.
  // That is the difference between a gradient that morphs and one that slides.
  //
  // The offset is single-octave — a warp only needs to be smooth, and this shader
  // runs twice a frame (once for the frame, once into the transmission buffer),
  // so it is five noise evaluations here instead of nine. The detail that matters
  // is in the field itself: flatten that and the slabs have nothing to refract,
  // which is the one saving in this scene that shows.
  vec2 warp = vec2(
    noise(p * 2.1 + vec2(0.0, uTime * 0.020)),
    noise(p * 2.1 + vec2(4.7, 2.3) - uTime * 0.017)
  );
  float f = fbm(p * 2.4 + warp * 0.85 + uTime * 0.012);

  // The field itself sits entirely inside the near-black end of the palette. It
  // is not meant to be seen as a gradient — it is there to give the glass in
  // front of it something with structure to refract.
  vec3 col = mix(uVoid, uMidnight, smoothstep(0.18, 0.62, f));
  col = mix(col, uNavy, smoothstep(0.52, 0.96, f) * 0.85);

  // The top of the frame falls away to nothing, so the copy has a bed to sit on.
  col = mix(col, uVoid, smoothstep(0.40, 1.0, p.y) * 0.85);

  // The light behind the wall.
  //
  // It is a genuine source, so it is brighter than anything in the background
  // palette — but it is tightly contained, and it is the only thing that is. The
  // darkness of the frame comes from the falloff, not from dimming the lamp:
  // outside its radius everything sits at background level, so blue only ever
  // reaches the eye after crossing a panel.
  // Correcting x by the aspect keeps the pool round on screen, which puts its
  // radius in units of frame height. On a phone the frame is only about half as
  // wide as it is tall, so a radius that is contained on a desktop covers the
  // entire width there — hence the short side, not the height, sets the size.
  float d = length((p - uLight) * vec2(uAspect, 1.0));
  float lamp = 1.0 - smoothstep(0.0, uLampRadius * min(uAspect, 1.0), d);

  // Fine structure inside the light.
  //
  // This is what makes the glass in front read as glass. Frost is only ever
  // visible as frost when it is softening something: put a featureless wash
  // behind a panel and clear glass and heavily frosted glass resolve to exactly
  // the same pixels, because blurring a smooth gradient returns the gradient.
  // Everything the material does — roughness, refraction, the curvature of the
  // face — is a modulation of what is behind it, and a modulation of nothing is
  // nothing. Two octaves at a scale the frost can actually chew on, confined to
  // the lit region so the dark frame stays clean.
  float fine = noise(p * 11.0 + vec2(uTime * 0.03, uTime * -0.02)) * 0.6
             + noise(p * 23.0 - vec2(uTime * 0.02, uTime * 0.025)) * 0.4;
  lamp *= 0.82 + 0.36 * fine;

  col += uRoyal * lamp * 1.45;
  col += uGlow * pow(lamp, 2.4) * 0.9;

  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.55 * dot(v, v);

  // Static dither. Long dark ramps are exactly where 8-bit banding shows, and
  // animated noise would read as grain.
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.006;

  gl_FragColor = vec4(max(col, 0.0), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// --- Environment (for the reflections the slabs pick up) --------------------

const ENV_VERT = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Deliberately not tone-mapped or colour-converted: PMREM works in linear space
// and a second conversion here would wash every reflection out.
const ENV_FRAG = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uKey;

varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float y = d.y * 0.5 + 0.5;

  vec3 col = mix(uGround, uSky, smoothstep(0.12, 0.88, y));

  // One soft bank of light above the horizon, off to the left. It is what the
  // slab edges catch, so it is the whole reason there is an environment at all.
  float key = pow(max(0.0, d.y * 0.55 + 0.45), 2.5) * max(0.0, -d.x * 0.5 + 0.6);
  col += uKey * key * 0.55;

  // A soft strip above it, standing in for the cove or clerestory a real glass
  // wall would be reflecting.
  //
  // This is what keeps the bevels from going black. An edge tilts away from the
  // viewer, so Fresnel there favours reflection over transmission — correct, and
  // the reason glass reads as glass — but with nothing overhead to reflect, the
  // arris just turns dark. Give it a source and the same physics draws a lit
  // edge instead. It is also the only thing in the scene that varies fast enough
  // for the curvature across a panel face to sweep it, which is what stops the
  // faces reading as flat fill.
  float strip = exp(-pow((d.y - 0.5) * 5.0, 2.0)) * max(0.0, 0.55 - d.x * 0.45);
  col += uKey * strip * 1.3;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default class GlassSlabs {
  constructor(canvas, options = {}) {
    /**
     * Settles once there is a real frame on screen, or immediately with `false`
     * if the scene can never come up.
     *
     * The preloader waits on this, which is the whole reason it exists: bringing
     * this scene up is not cheap — a chunk download, a PMREM prefilter, a
     * procedural normal map, and the longest shader on the site to link — and
     * every millisecond of it used to land *after* the panel had gone. The
     * visitor watched the CSS gradient sit there and then swap. Built behind the
     * loader and announced here, none of it is ever seen.
     *
     * It has to settle on every path out of this constructor, or the loader
     * would sit on its cap waiting for a promise that was never going to come.
     */
    this.ready = new Promise((resolve) => {
      this._settleReady = resolve;
    });

    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas) {
      this._settleReady(false);
      return;
    }

    this.config = {
      // Held at 1. Transmission makes the pixel ratio expensive twice over: three
      // sizes its transmission buffer to the drawing buffer and gives it 4x MSAA
      // and a fresh mip chain every frame, so every pixel here is paid for in the
      // frame, in that buffer, and in the chain above it. Nothing in this scene
      // is sharp enough to notice the difference.
      maxDpr: 1,
      // One slab per this many CSS pixels, clamped below. Slabs, not reeds —
      // wide enough to read as architectural panels.
      slabWidth: 92,
      minSlabs: 5,
      maxSlabs: 16,
      // Built and warmed but not animated. The hero comes up this way so the
      // scene is not competing with the preloader for the same frames while the
      // panel is still on screen — see `start()`.
      autoStart: true,
      ...options,
    };

    this.time = 0;
    // Raw normalised cursor, -1..1. Undamped: the smoothing all happens on the
    // light's own position, downstream of the blend, so one leash governs both
    // states instead of two competing ones.
    this.cursor = { x: 0, y: 0 };

    // Where the light actually is, in UV. Started on the idle path rather than
    // at home, so the first frame does not slide into position.
    this.light = {
      x: LIGHT_HOME_X + wave(IDLE_X, 0),
      y: LIGHT_HOME_Y + wave(IDLE_Y, 0),
    };

    /** 0 = drifting on its own, 1 = fully under the cursor. */
    this._influence = 0;
    this._idleFor = IDLE_DELAY;
    this._lampRadius = LAMP_RADIUS;

    this._static = prefersReducedMotion();
    this._running = false;
    this._held = this.config.autoStart === false;
    this._inView = true;
    this._listeners = [];
    this._tick = this._tick.bind(this);

    this._qualityLevel = 0;
    this._samples = [];
    this._warmupMs = 0;
    this._windowMs = 0;

    if (!this._build()) {
      this._settleReady(false);
      return;
    }

    this._bindEvents();
    this.resize();
    this._observe();
    this._warmUp();
    this._maybeStart();
  }

  /**
   * Get every program linked and one real frame presented, then report ready.
   *
   * `compileAsync` rather than `compile`: where the driver supports
   * KHR_parallel_shader_compile it links off the main thread and this only polls
   * for the result, so the several hundred milliseconds the transmission shader
   * costs are not a stall in the middle of whatever else is on screen. Where it
   * does not, three falls back to the same synchronous work — moved off the
   * first frame either way, which is the part that mattered.
   *
   * The rAF afterwards is not superstition. `render()` returning means the draw
   * calls are queued, not that anything has been composited; waiting a frame is
   * what makes "ready" mean the visitor would actually see the scene.
   */
  _warmUp() {
    const compiled =
      typeof this.renderer.compileAsync === 'function'
        ? this.renderer.compileAsync(this.scene, this.camera)
        : Promise.resolve().then(() => this.renderer.compile(this.scene, this.camera));

    compiled
      .catch(() => {
        /* A failed link still leaves a drawable scene; let the frame decide. */
      })
      .then(() => {
        if (!this.renderer) return; // destroyed mid-compile; destroy() settled it
        this._render();

        requestAnimationFrame(() => {
          if (!this.renderer) return;
          // The CSS gradient underneath only steps aside once there is a real
          // frame, and the hero is only worth uncovering once there is one.
          this.canvas.parentElement?.classList.add('is-live');
          this._settleReady(true);
        });
      });
  }

  /** True when the scene is live — the caller falls back to CSS if not. */
  get isRunning() {
    return Boolean(this.renderer);
  }

  _build() {
    try {
      this.renderer = new WebGLRenderer({
        canvas: this.canvas,
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        powerPreference: 'default',
      });
    } catch (e) {
      this.renderer = null;
      return false;
    }

    // ACES rolls the highlights off where the light pool meets the glass. Without
    // it the core of the pool clips to a flat disc.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
    this.camera.position.set(0, 0, CAMERA_Z);

    this._buildGradient();
    this._buildLights();
    this._buildSlabs();

    return true;
  }

  _buildGradient() {
    this.gradientMaterial = new ShaderMaterial({
      vertexShader: GRADIENT_VERT,
      fragmentShader: GRADIENT_FRAG,
      depthWrite: true,
      uniforms: {
        // Colours go in as THREE.Color, which converts them out of sRGB into the
        // renderer's working space for us — writing the hex straight into the
        // shader would light the scene a stop and a half too bright.
        uVoid: { value: new Color(0x02040b) },
        uMidnight: { value: new Color(0x040814) },
        uNavy: { value: new Color(0x050d1f) },
        uRoyal: { value: new Color(0x071428) },
        // The one value above the background palette. It is confined to the core
        // of the light pool, and by the time it reaches the frame it has crossed
        // 8mm of frosted glass.
        uGlow: { value: new Color(0x6d94cf) },
        uTime: { value: 0 },
        uLight: { value: new Vector2(LIGHT_HOME_X, LIGHT_HOME_Y) },
        uLampRadius: { value: LAMP_RADIUS },
        uAspect: { value: 1 },
      },
    });

    this.gradientGeometry = new PlaneGeometry(1, 1);
    this.gradient = new Mesh(this.gradientGeometry, this.gradientMaterial);
    this.gradient.position.z = GRADIENT_Z;
    this.scene.add(this.gradient);
  }

  _buildLights() {
    // All of this is dialled well down from a conventional studio rig. The panels
    // are transmissive, so lights barely touch the body of the glass and mostly
    // set the tone of the edges — and edges lit any harder than this read as
    // neon piping rather than as cut glass.
    this.scene.add(new AmbientLight(0x0f1d3a, 0.95));
    this.scene.add(new HemisphereLight(0x33538f, 0x01030a, 0.75));

    // The key. It is the only light the cursor moves, and it moves a fraction of
    // what the cursor does.
    this.keyLight = new DirectionalLight(0x9fb6dc, 1.35);
    this.keyLight.position.set(-3, 3.5, 6);
    this.scene.add(this.keyLight);

    // A cool rim from below and behind, to pick out the bottom edges.
    this.rimLight = new DirectionalLight(0x2b4d94, 0.75);
    this.rimLight.position.set(4, -2.5, 2.5);
    this.scene.add(this.rimLight);
  }

  /**
   * The panel surface: a bevel at each edge, a flat face between them, and a
   * micro-texture over the whole thing.
   *
   * The bevel is the important part. The previous profile curved the entire face
   * into a cylinder, which turns every panel into a cylindrical mirror — it
   * sweeps the environment across the full width and lands a bright specular
   * streak down the middle of each one. That is precisely what reads as a
   * reflective strip rather than as a slab. A real laminated panel is flat across
   * its face and only turns over the last few millimetres at the arris, so the
   * face stays frosted and quiet and only the edges catch anything.
   *
   * The micro-texture is the second half of it. Glass drawn or rolled flat keeps
   * fine striations along the direction it was pulled, which is why real
   * architectural glass never looks as clean as CG glass. The texture is taller
   * than it is wide, and the panels are far taller than they are wide, so the
   * noise comes out slightly drawn out vertically — which is the direction an
   * extruded panel would actually carry its striations.
   */
  _buildNormalMap() {
    const width = 128;
    const height = 512;
    const data = new Uint8Array(width * height * 4);

    // Fraction of the width each edge bevel occupies, and the steepest tilt it
    // reaches at the arris. Gentle: a bevel steep enough to be obvious refracts
    // from far outside the lit area and comes back as a black border, which
    // reads as corrugation rather than as a softened edge.
    const BEVEL = 0.13;
    const BEVEL_TILT = 0.26;

    // A whisper of curvature across the face between the bevels. Dead flat, every
    // panel transmits one evenly blurred sample and comes out a plain rectangle;
    // this is enough to give each face an internal gradient without turning it
    // back into a lens.
    const FACE_CURVE = 0.16;

    // Micro-surface. This has to sit at the threshold of visibility: enough to
    // stop the face reading as a perfect plane, not enough to see as texture.
    const MICRO = 0.045;

    const hash = (x, y) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    // Value noise rather than white noise: white noise on a normal map is a
    // field of unrelated facets, which scatters light into sparkle instead of
    // into a soft sheen.
    const noise = (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi);
      const b = hash(xi + 1, yi);
      const c = hash(xi, yi + 1);
      const d = hash(xi + 1, yi + 1);
      const top = a + (b - a) * u;
      return top + (c + (d - c) * u - top) * v;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width;

        // How far into a bevel this column is: 0 across the flat face, ±1 at
        // the arris.
        let edge = 0;
        if (u < BEVEL) edge = -(1 - u / BEVEL);
        else if (u > 1 - BEVEL) edge = 1 - (1 - u) / BEVEL;

        // Smootherstep the ramp, so the bevel meets the flat face with no crease
        // for a highlight to catch on.
        const sign = Math.sign(edge);
        const a = Math.abs(edge);
        const eased = sign * a * a * a * (a * (a * 6 - 15) + 10);

        let nx = -Math.sin((u * 2 - 1) * Math.PI * 0.5) * FACE_CURVE - eased * BEVEL_TILT;
        let ny = 0;

        // Two octaves, on cells stretched vertically to match the panel.
        nx += ((noise(x / 2.5, y / 7) - 0.5) * 0.65 + (noise(x / 9, y / 26) - 0.5) * 0.35) * MICRO;
        // The vertical component is kept to a third of the horizontal one on
        // purpose — see the note on modelScale where the material is built.
        ny += (noise(x / 3 + 37, y / 8 + 11) - 0.5) * MICRO * 0.33;

        const nz = Math.sqrt(Math.max(1e-4, 1 - nx * nx - ny * ny));

        const i = (y * width + x) * 4;
        data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }

    const texture = new DataTexture(data, width, height, RGBAFormat);
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;

    // Mipmapped: the micro-texture is finer than a pixel across the panel width,
    // and without a mip chain that turns into aliasing rather than into sheen.
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * A prefiltered environment for the slabs to reflect. Built once from a tiny
   * procedural sky and thrown away — without it the glass has nothing to mirror
   * and the edges go dead.
   */
  _buildEnvironment() {
    const pmrem = new PMREMGenerator(this.renderer);

    const geometry = new SphereGeometry(20, 24, 16);
    const material = new ShaderMaterial({
      side: BackSide,
      vertexShader: ENV_VERT,
      fragmentShader: ENV_FRAG,
      uniforms: {
        uSky: { value: new Color(0x1b3560) },
        uGround: { value: new Color(0x02040b) },
        uKey: { value: new Color(0x6b8cc4) },
      },
    });

    const envScene = new Scene();
    envScene.add(new Mesh(geometry, material));

    // No extra sigma: PMREM's own roughness prefilter is what the material reads,
    // and anything above ~0.03 here asks for more samples than it allows.
    this.envTarget = pmrem.fromScene(envScene);

    geometry.dispose();
    material.dispose();
    pmrem.dispose();

    return this.envTarget.texture;
  }

  _buildSlabs() {
    this.normalMap = this._buildNormalMap();
    const envMap = this._buildEnvironment();

    // One unit box. Every panel is this same buffer, scaled by its instance
    // matrix — a box rather than a plane because the thickness is what gives the
    // row its cut edges, and a plane has none.
    this.slabGeometry = new BoxGeometry(1, 1, 1);

    // Per-instance colour is the only thing allowed to vary, and three only
    // carries it into diffuseColor when USE_COLOR is defined — which needs
    // `vertexColors` *and* a real colour attribute. Without the attribute the
    // shader reads an unbound one as black and the whole wall goes out.
    const vertexCount = this.slabGeometry.attributes.position.count;
    this.slabGeometry.setAttribute(
      'color',
      new BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3)
    );

    // One material for the whole wall: identical frost, identical transparency,
    // identical edge softness on every panel.
    //
    // No dispersion. Three implements it by running the whole refraction — ray,
    // reprojection and a mip lookup — once per channel, so it triples the most
    // expensive term in the shader, and at a strength subtle enough not to read
    // as a rainbow it is paying three times for something nobody can see.
    //
    // No clearcoat either. It adds a second specular lobe for a gloss the base
    // specular and the environment already give, and the brief is soft highlights
    // rather than lacquer.
    this.slabMaterial = new MeshPhysicalMaterial({
      // Near-white, barely cool. The blue deliberately does *not* live here: this
      // value is a flat filter over whatever the panel transmits, and tinting it
      // paints the glass blue rather than letting blue light come through glass.
      // A sheet of architectural glass is almost colourless face-on; the colour
      // appears with depth, which is the attenuation below.
      color: 0xe9eef6,
      metalness: 0,
      transmission: 1,

      // Frost. Roughness picks the mip of the transmission buffer the panel
      // reads, so it is the entire blur — no post pass, no second render — and
      // it widens the specular lobe at the same time. Both are wanted: at 0.26
      // this face was clear enough to mirror, at 0.44 it scatters.
      roughness: 0.34,

      // Thickness drives how far refraction pushes the sample and how much
      // attenuation the light picks up crossing the panel. This is where the
      // weight comes from.
      thickness: 1.9,
      ior: 1.5,

      // What the glass takes out of the light on the way through, by distance
      // travelled. Beer-Lambert, so it is depth that makes it blue — the same
      // reason a glass sheet looks green down its edge and clear through its
      // face.
      //
      // Note on the ray length: three scales the transmission ray by the model's
      // scale per axis, and these instances are scaled ~8x taller than they are
      // deep. Any vertical component in the surface normal therefore buys a
      // disproportionately long path and a dark patch with it, which is why the
      // micro-texture's ny is kept to a third of its nx.
      attenuationColor: new Color(0x4a70ad),
      attenuationDistance: 1.9,

      normalMap: this.normalMap,
      // Bevels want to be read; the micro-texture rides the same map, so this
      // scales both. Past about 1.0 the micro starts to register as texture.
      normalScale: new Vector2(0.7, 0.7),

      // Dim, and blurred further by the roughness above. specularIntensity is
      // deliberately left at 1: dropping it would kill the Fresnel brightening
      // along the edges along with the mirror, and the edges are the one place
      // a reflection belongs.
      envMap,
      envMapIntensity: 0.5,

      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });

    // The whole wall in one draw call. Allocated at the maximum the layout can
    // ask for; `count` is what actually renders.
    this.slabs = new InstancedMesh(
      this.slabGeometry,
      this.slabMaterial,
      this.config.maxSlabs
    );
    this.slabs.frustumCulled = false; // it is the frame, it is never off-screen
    this.slabs.instanceColor = new InstancedBufferAttribute(
      new Float32Array(this.config.maxSlabs * 3),
      3
    );
    this.scene.add(this.slabs);

    this._matrix = new Matrix4();
    this._position = new Vector3();
    this._scale = new Vector3();
    this._quaternion = new Quaternion();
    this._tint = new Color();
  }

  /** Half-height of the frustum at a given z. */
  _visibleHeight(z) {
    return 2 * Math.tan((FOV * Math.PI) / 360) * (CAMERA_Z - z);
  }

  _layout() {
    const aspect = this.camera.aspect;

    // Layer 1 covers the frame at its own depth, with a little margin.
    const gradientHeight = this._visibleHeight(GRADIENT_Z) * 1.04;
    this.gradient.scale.set(gradientHeight * aspect * 1.04, gradientHeight, 1);
    this.gradientMaterial.uniforms.uAspect.value = aspect;

    // --- The wall --------------------------------------------------------
    //
    // One pitch, derived once, and every panel steps along it. Nothing here is
    // sampled or jittered: identical width, identical height, identical depth,
    // identical z, spaced identically. The row is described entirely by the
    // pitch and the index.
    const spanWidth = this._visibleHeight(SLAB_Z) * aspect * 1.02;
    const spanHeight = this._visibleHeight(SLAB_Z) * 1.25;

    const count = this._slabCount;
    const pitch = spanWidth / count;
    const gap = pitch * PANEL_GAP_RATIO;
    const panelWidth = pitch - gap;

    // Half a pitch in from the left edge puts the row's centre on the frame's.
    const firstX = -spanWidth / 2 + pitch / 2;

    this._scale.set(panelWidth, spanHeight, PANEL_DEPTH);

    for (let i = 0; i < count; i++) {
      this._position.set(firstX + pitch * i, 0, SLAB_Z);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.slabs.setMatrixAt(i, this._matrix);

      // The one permitted variation, and it is in light rather than in form: a
      // few percent on the tint each panel gives what passes through it, on a
      // long period across the row so no two neighbours match exactly and no
      // panel stands out. The geometry stays identical.
      const glow = 1 + Math.sin(i * 1.7) * PANEL_GLOW_VARIANCE;
      this._tint.setRGB(glow, glow, glow);
      this.slabs.setColorAt(i, this._tint);
    }

    this.slabs.count = count;
    this.slabs.instanceMatrix.needsUpdate = true;
    this.slabs.instanceColor.needsUpdate = true;
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent || !this.renderer) return false;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return false;

    const step = QUALITY_STEPS[this._qualityLevel];
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.maxDpr) * step.dprScale;
    const count = Math.max(
      this.config.minSlabs,
      Math.min(
        this.config.maxSlabs,
        Math.round(width / (this.config.slabWidth * step.slabScale))
      )
    );

    if (width === this._w && height === this._h && count === this._slabCount) return true;

    this._w = width;
    this._h = height;
    this._slabCount = count;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this._layout();
    return true;
  }

  _on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this._listeners.push([target, type, handler, opts]);
  }

  _bindEvents() {
    const onResize = () => {
      if (!this.renderer) return;
      this.resize();
      if (this._static) this._render();
    };

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this._ro = new ResizeObserver(onResize);
      this._ro.observe(this.canvas.parentElement);
    } else {
      this._on(window, 'resize', onResize, { passive: true });
    }

    // Nothing to track on a touch screen, and the listener would only cost
    // battery. The light keeps its own drift there.
    if (!isTouch() && !this._static) {
      this._on(
        window,
        'pointermove',
        (e) => {
          const x = (e.clientX / window.innerWidth) * 2 - 1;
          const y = (e.clientY / window.innerHeight) * 2 - 1;

          // Browsers emit pointermove for a stationary cursor — during a scroll,
          // for instance. Those must not count as activity, or a cursor parked
          // over the page would hold the light out of idle indefinitely.
          if (Math.abs(x - this.cursor.x) + Math.abs(y - this.cursor.y) < 1e-4) return;

          this.cursor.x = x;
          this.cursor.y = y;
          this._idleFor = 0;
        },
        { passive: true }
      );
    }

    this._on(document, 'visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (this._inView) this._maybeStart();
    });

    this._on(this.canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
      this.canvas.parentElement?.classList.remove('is-live');
    });

    this._on(this.canvas, 'webglcontextrestored', () => {
      this._w = 0;
      this.resize();
      this._render();
      this.canvas.parentElement?.classList.add('is-live');
      this._maybeStart();
    });
  }

  _observe() {
    if (typeof IntersectionObserver === 'undefined') return;

    this._io = new IntersectionObserver(
      ([entry]) => {
        this._inView = entry.isIntersecting;
        if (entry.isIntersecting && !document.hidden) this._maybeStart();
        else this.stop();
      },
      { rootMargin: '80px' }
    );
    this._io.observe(this.canvas);
  }

  /**
   * Begin animating, and lift the hold if the scene was built with
   * `autoStart: false`.
   *
   * That hold is what keeps the warm-up honest. The scene is built, linked and
   * drawn while the preloader is still on screen — but if it also took the
   * ticker there, the most expensive per-frame work on the site would be running
   * flat out behind an opaque panel, competing with the one animation the
   * visitor is actually watching. So it sits on its finished first frame until
   * the caller says the panel has gone.
   */
  start() {
    this._held = false;
    this._maybeStart();
  }

  /**
   * The internal resumes — coming back into view, back to the tab, back from a
   * lost context — all route through here, so none of them can start the ticker
   * out from under a hold.
   */
  _maybeStart() {
    // Reduced motion gets the composition, held still — one frame, no ticker.
    if (this._held || this._running || this._static || !this.renderer) return;
    this._running = true;
    gsap.ticker.add(this._tick);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    gsap.ticker.remove(this._tick);
  }

  _tick(_time, delta) {
    // Clamp the step: a long task or a backgrounded tab must not teleport the
    // field forward the moment it resumes.
    const dt = Math.min(delta, 50) * 0.001;
    this.time += dt;

    this._updateLight(dt);
    this._render();
    this._govern(delta);
  }

  /**
   * Move the light. Six sines and two exponentials per frame, on the CPU — the
   * shader is untouched by any of this and does not get any more expensive when
   * the light is busy.
   */
  _updateLight(dt) {
    this._idleFor += dt;

    // The cursor takes control the instant it moves and keeps it until it has
    // been still for IDLE_DELAY. Taking is quick, releasing is slow, so the
    // handover is felt in one direction and not in the other.
    const wants = this._idleFor < IDLE_DELAY ? 1 : 0;
    const blendTau = wants > this._influence ? ENGAGE_TAU : RELEASE_TAU;
    this._influence += (wants - this._influence) * (1 - Math.exp(-dt / blendTau));

    // Smoothstep the blend before using it. An exponential settles onto its
    // target gently but *leaves* at full speed, and that departure is exactly
    // the moment a state change becomes visible. Eased at both ends, the
    // handover starts and finishes at zero velocity.
    const w = this._influence * this._influence * (3 - 2 * this._influence);

    const t = this.time;

    const idleX = LIGHT_HOME_X + wave(IDLE_X, t);
    const idleY = LIGHT_HOME_Y + wave(IDLE_Y, t);

    const cursorX = LIGHT_HOME_X + this.cursor.x * CURSOR_REACH_X;
    const cursorY = LIGHT_HOME_Y - this.cursor.y * CURSOR_REACH_Y;

    const targetX = idleX + (cursorX - idleX) * w;
    const targetY = idleY + (cursorY - idleY) * w;

    // Latency follows the state too: short enough under the cursor to feel
    // connected, long enough when drifting that the motion never looks driven.
    const tau = IDLE_TAU + (CURSOR_TAU - IDLE_TAU) * w;
    const k = 1 - Math.exp(-dt / tau);

    this.light.x += (targetX - this.light.x) * k;
    this.light.y += (targetY - this.light.y) * k;

    // The breath. Independent of both states and of the drift — the pool widens
    // and narrows a few percent on its own period, which is what stops a light
    // holding still under a motionless cursor from reading as a frozen frame.
    this._lampRadius = LAMP_RADIUS * (1 + LAMP_BREATH * Math.sin(t * 0.16 + 0.9));
  }

  /** See QUALITY_STEPS. Runs until the scene is inside budget or out of steps. */
  _govern(delta) {
    if (this._samples === null) return;

    // Shader compiles, texture uploads and the first mip build all land in the
    // opening frames, and none of them happen again.
    if (this._warmupMs < WARMUP_MS) {
      this._warmupMs += delta;
      return;
    }

    this._samples.push(delta);
    this._windowMs += delta;

    if (this._samples.length < MIN_SAMPLES) return;
    if (this._samples.length < SAMPLE_FRAMES && this._windowMs < SAMPLE_MS) return;

    const sorted = this._samples.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];

    if (median <= FRAME_BUDGET_MS || this._qualityLevel >= QUALITY_STEPS.length - 1) {
      // Either the scene is affordable here or there is nothing left to give up.
      this._samples = null;
      return;
    }

    this._qualityLevel++;
    this._w = 0; // force resize() past its no-op guard
    this.resize();

    this._samples.length = 0;
    this._windowMs = 0;
    this._warmupMs = 0;
  }

  /** Pure upload and draw — where the light is was decided in _updateLight. */
  _render() {
    if (!this.renderer) return;

    const uniforms = this.gradientMaterial.uniforms;

    uniforms.uTime.value = this.time;
    uniforms.uLight.value.set(this.light.x, this.light.y);
    uniforms.uLampRadius.value = this._lampRadius;

    // The key light leans wherever the pool has gone, a fraction as far. It is
    // driven off the light's settled position rather than off the cursor, so it
    // keeps drifting through idle and never picks up raw pointer jitter — and it
    // is what carries the movement onto the faces of the glass while the glass
    // itself stays exactly where it was placed.
    this.keyLight.position.set(
      -3 + (this.light.x - 0.5) * 3.2,
      3.5 + (this.light.y - 0.5) * 2.4,
      6
    );

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.stop();
    // Anything still waiting on the scene has to be let go, or a caller that
    // gates on `ready` would sit there until its own timeout.
    this._settleReady?.(false);
    this._io?.disconnect();
    this._ro?.disconnect();
    this._listeners.forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    this._listeners.length = 0;

    this.slabs?.dispose(); // releases the instance matrix and colour buffers
    this.slabGeometry?.dispose();
    this.slabMaterial?.dispose();
    this.gradientGeometry?.dispose();
    this.gradientMaterial?.dispose();
    this.normalMap?.dispose();
    this.envTarget?.dispose();

    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;

    this.canvas?.parentElement?.classList.remove('is-live');
  }
}
