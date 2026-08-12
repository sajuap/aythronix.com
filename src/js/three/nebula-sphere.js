/**
 * NebulaSphere — the hero's interactive particle sphere.
 *
 * 3,500 points distributed over a sphere by Fibonacci spiral, rotated about Y,
 * projected with a simple perspective divide and drawn to a 2D canvas. Not
 * WebGL: at this point count a 2D context with plain arcs outperforms a
 * per-point WebGL setup and matches the reference exactly, which is what we are
 * reproducing.
 *
 * Two behaviours sit on top of the projection:
 *  - Pointer tilt. The cursor's offset from the sphere centre rotates the whole
 *    field by a fraction of a degree per pixel.
 *  - Local warp. Points within `interactionRadius` of the cursor are pushed
 *    radially away from it and slightly toward the viewer.
 *
 * Both feed a spring/friction integrator, so points ease back rather than snap.
 *
 * Beyond the reference: the loop parks itself when the canvas scrolls out of
 * view or the tab is hidden, and `destroy()` releases everything. Without that,
 * a 3,500-point loop keeps burning frames behind the fold.
 */

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (1 + Math.sqrt(5));

export default class NebulaSphere {
  constructor(canvasOrId, options = {}) {
    this.canvas =
      typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
    if (!this.canvas) return;

    this.config = {
      particleCount: 3500,
      baseRadius: 650,
      interactionRadius: 120,
      warpStrength: 40,
      rotationSpeed: 0.2,
      disableInteractions: false,
      // 'hero' anchors the sphere below the canvas so only its upper arc shows;
      // 'center' keeps it centred, which is what the preloader wants.
      anchor: 'hero',
      // Brand blue as an "r,g,b" triplet — the per-point alpha is appended in
      // the draw loop, so this is a bare triplet rather than a colour string.
      color: '7,101,235',
      // `false` builds the field but withholds the loop until `start()`. Same
      // contract as GlassSlabs: it lets the caller pay for construction behind
      // the preloader and still keep the ticker off until the panel has gone.
      autoStart: true,
      ...options,
    };

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.particles = [];
    this.mouse = { x: 0, y: 0, isActive: false };

    // Integrator constants. FRICTION is intentionally severe — it makes the
    // springs near-critically damped, so warped points return without ringing.
    this.SPRING = 0.05;
    this.FRICTION = 0.01;
    this.Z_PERSPECTIVE = 800;

    // 0 → fully scattered, 1 → fully assembled. The hero starts assembled; the
    // preloader animates this from 0.
    this.gather = this.config.gather ?? 1;

    // Radial breath, independent of `gather`. 1 is the authored radius.
    this.radiusScale = this.config.radiusScale ?? 1;

    // Travelling wave riding on top of that breath. Amplitude 0 disables it
    // entirely, which is the default, so the hero is unaffected.
    this.waveAmp = this.config.waveAmp ?? 0;
    this.wavePhase = 0;

    this._isReady = false;
    this._running = false;
    this._held = this.config.autoStart === false;
    this._rafId = null;
    this._tick = this._tick.bind(this);
    this._listeners = [];

    this._bindEvents();
    this._safeInit();
  }

  /**
   * Size the backing store to the parent box at up to 2x DPR.
   * Returns false while the parent still has no layout — on a cold load the
   * canvas is measured before CSS has settled.
   */
  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return false;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return false;

    // Capping DPR at 2 keeps the fill-rate sane on 3x phone screens.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    return true;
  }

  /** Retry until the parent has a measurable box, then build and start. */
  _safeInit() {
    if (!this.resize()) {
      this._initTimer = setTimeout(() => this._safeInit(), 100);
      return;
    }
    this._isReady = true;
    this.initParticles();
    this._observe();
    // Not `start()` — that would lift a hold the caller has not lifted yet.
    this._maybeStart();
    // Held: put the resting frame on screen anyway, so there is something to
    // hand the ticker to rather than something to reveal.
    if (this._held) this.paintStill();
  }

  /**
   * Fibonacci-spiral distribution: even coverage with no clustering at the
   * poles, which a naive lat/long grid would give.
   */
  initParticles() {
    const { particleCount, baseRadius } = this.config;
    this.particles = new Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const theta = GOLDEN_ANGLE * i;

      const sinPhi = Math.sin(phi);
      const x = baseRadius * sinPhi * Math.cos(theta);
      const y = baseRadius * sinPhi * Math.sin(theta);
      const z = baseRadius * Math.cos(phi);

      this.particles[i] = {
        baseX: x,
        baseY: y,
        baseZ: z,
        // Where this point sits when fully scattered, for the preloader's
        // assemble animation.
        scatterX: (Math.random() - 0.5) * baseRadius * 4,
        scatterY: (Math.random() - 0.5) * baseRadius * 4,
        scatterZ: (Math.random() - 0.5) * baseRadius * 4,
        // Where this point sits in the travelling wave, 0 at the bottom of the
        // sphere and 1 at the top. Giving each point its own offset is what
        // turns a simultaneous contraction into something that sweeps through.
        wavePhase: (y / baseRadius + 1) * 0.5,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.5,
      };
    }
  }

  _on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this._listeners.push([target, type, handler, opts]);
  }

  _bindEvents() {
    this._on(
      window,
      'resize',
      () => {
        if (!this._isReady) return;
        this.resize();
      },
      { passive: true }
    );

    const onMove = (e) => {
      if (!this._isReady) return;
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      this.mouse.x = clientX - rect.left;
      this.mouse.y = clientY - rect.top;
      this.mouse.isActive = true;
    };

    const onLeave = () => {
      this.mouse.isActive = false;
    };

    this._on(this.canvas, 'mousemove', onMove, { passive: true });
    this._on(this.canvas, 'touchmove', onMove, { passive: true });
    this._on(this.canvas, 'mouseleave', onLeave);
    this._on(this.canvas, 'touchend', onLeave);

    // Stop burning frames in a background tab.
    this._on(document, 'visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (this._inView !== false) this._maybeStart();
    });
  }

  /** Park the loop whenever the canvas is fully off-screen. */
  _observe() {
    if (typeof IntersectionObserver === 'undefined') {
      this._inView = true;
      return;
    }
    this._io = new IntersectionObserver(
      ([entry]) => {
        this._inView = entry.isIntersecting;
        if (entry.isIntersecting && !document.hidden) this._maybeStart();
        else this.stop();
      },
      { rootMargin: '120px' }
    );
    this._io.observe(this.canvas);
  }

  /**
   * Begin animating, and lift the hold if the field was built with
   * `autoStart: false`.
   *
   * That hold is what lets the 3,500-point build happen behind the preloader
   * without the loop then running flat out behind an opaque panel. The field is
   * assembled and sitting still until the caller says the panel has gone.
   */
  start() {
    this._held = false;
    this._maybeStart();
  }

  /**
   * The internal resumes — scrolling back into view, returning to the tab — all
   * route through here, so none of them can start the loop out from under a hold.
   */
  _maybeStart() {
    if (this._held || this._running || !this._isReady) return;
    this._running = true;
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /** Where the sphere's centre sits, in backing-store pixels. */
  _centreY(height) {
    if (this.config.anchor === 'center') return height / 2;

    // Push the centre below the canvas so only the top of the sphere is visible.
    // The thresholds are against the backing-store height, so they already
    // account for DPR — a taller canvas needs proportionally less push.
    if (height > 900) return height * 1.1;
    if (height > 750) return height * 1.5;
    return height * 1.8;
  }

  _tick() {
    // `_drawOnce` is how a held field paints its resting frame — see
    // `paintStill()`. Without it a held sphere is an empty canvas until the
    // ticker starts, and 3,500 points appear from nothing on the frame the
    // preloader lifts.
    if (!this._isReady) return;
    if (!this._running && !this._drawOnce) return;

    const { width, height } = this.canvas;
    const cx = width / 2;
    const cy = this._centreY(height);
    const ctx = this.ctx;
    const {
      rotationSpeed,
      interactionRadius,
      warpStrength,
      disableInteractions,
      color,
    } = this.config;

    ctx.clearRect(0, 0, width, height);

    const time = Date.now() * 0.001 * rotationSpeed;
    const cosT = Math.cos(time);
    const sinT = Math.sin(time);

    const interactive = this.mouse.isActive && !disableInteractions;
    // Backing-store scale, so pointer coords (CSS px) match particle coords.
    const scaleX = width / this.canvas.offsetWidth;
    const scaleY = height / this.canvas.offsetHeight;
    const mouseX = this.mouse.x * scaleX;
    const mouseY = this.mouse.y * scaleY;

    let rotX = 0;
    let rotY = 0;
    let cosRX = 1;
    let sinRX = 0;
    let cosRY = 1;
    let sinRY = 0;

    if (interactive) {
      // A very small coefficient: the field leans toward the cursor rather than
      // tracking it.
      rotX = (mouseY - cy) * 0.0001;
      rotY = (mouseX - cx) * 0.0001;
      cosRX = Math.cos(rotX);
      sinRX = Math.sin(rotX);
      cosRY = Math.cos(rotY);
      sinRY = Math.sin(rotY);
    }

    const g = this.gather;
    const scattered = g < 1;
    const radiusScale = this.radiusScale;
    const waveAmp = this.waveAmp;
    const wavePhase = this.wavePhase;
    const waveSpread = this.config.waveSpread ?? Math.PI * 2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Rest position for this frame: the base sphere point, optionally lerped
      // out toward its scatter position while assembling.
      let bx = p.baseX;
      let by = p.baseY;
      let bz = p.baseZ;

      if (scattered) {
        bx = p.scatterX + (p.baseX - p.scatterX) * g;
        by = p.scatterY + (p.baseY - p.scatterY) * g;
        bz = p.scatterZ + (p.baseZ - p.scatterZ) * g;
      }

      // Breathe. Every point is pulled along its own radius from the centre, so
      // the field contracts and expands as a body rather than each point
      // drifting somewhere unrelated — which is what `gather` does, and why the
      // two are separate controls.
      //
      // The wave rides on top: each point carries its own phase, so the same
      // contraction reaches the bottom of the sphere before the top and sweeps
      // through rather than happening everywhere at once. Amplitude 0 skips it,
      // and a scale of exactly 1 skips the multiply, so the hero pays nothing.
      // Named `radial` rather than `scale`: the perspective divide further down
      // this same block already owns that name.
      let radial = radiusScale;
      if (waveAmp !== 0) {
        radial += waveAmp * Math.sin(wavePhase - p.wavePhase * waveSpread);
      }

      if (radial !== 1) {
        bx *= radial;
        by *= radial;
        bz *= radial;
      }

      // Spin about Y.
      let tx = bx * cosT - bz * sinT;
      let tz = bx * sinT + bz * cosT;
      let ty = by;

      if (interactive) {
        // Yaw, then pitch.
        const mx = tx * cosRY - tz * sinRY;
        tz = tx * sinRY + tz * cosRY;
        tx = mx;

        const my = ty * cosRX - tz * sinRX;
        tz = ty * sinRX + tz * cosRX;
        ty = my;
      }

      // Spring the point toward its target.
      p.vx += (tx - p.x) * this.SPRING;
      p.vy += (ty - p.y) * this.SPRING;
      p.vz += (tz - p.z) * this.SPRING;

      // Projected screen position, using the pre-integration depth. This is the
      // reference's ordering and it is what gives the field its slight
      // trailing feel — recomputing after integration tightens it visibly.
      const scale = this.Z_PERSPECTIVE / (this.Z_PERSPECTIVE + p.z);
      const sx = cx + p.x * scale;
      const sy = cy + p.y * scale;

      if (interactive) {
        const dx = sx - mouseX;
        const dy = sy - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < interactionRadius) {
          const force = (interactionRadius - dist) / interactionRadius;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * warpStrength;
          p.vy += Math.sin(angle) * force * warpStrength;
          p.vz -= force * warpStrength * 0.5;
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      p.vx *= this.FRICTION;
      p.vy *= this.FRICTION;
      p.vz *= this.FRICTION;

      const finalScale = this.Z_PERSPECTIVE / (this.Z_PERSPECTIVE + p.z);
      if (finalScale > 0) {
        const alpha = Math.min(1, Math.max(0.1, finalScale * p.alpha));
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * finalScale, 0, TAU);
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.fill();
      }
    }

    // Only the running loop schedules another frame. A one-off still does not.
    if (this._running) this._rafId = requestAnimationFrame(this._tick);
  }

  /**
   * Draw the field once, without starting the loop.
   *
   * For a sphere built with `autoStart: false`: it is assembled and sitting on
   * screen behind whatever is covering it, so when the ticker is finally handed
   * over the field is already there and simply begins to move. Nothing appears.
   */
  paintStill() {
    if (!this._isReady || this._running) return;
    this._drawOnce = true;
    this._tick();
    this._drawOnce = false;
  }

  /** Set assembly progress, 0 → 1. Used by the preloader. */
  /** Pull the whole field in toward its centre, or push it out. 1 is rest. */
  setRadiusScale(value) {
    this.radiusScale = value;
  }

  /** Advance the travelling wave. Radians; wraps naturally through the sine. */
  setWave(phase) {
    this.wavePhase = phase;
  }

  setGather(value) {
    this.gather = Math.max(0, Math.min(1, value));
  }

  destroy() {
    this.stop();
    clearTimeout(this._initTimer);
    if (this._io) this._io.disconnect();
    this._listeners.forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    this._listeners.length = 0;
    this.particles.length = 0;
    this._isReady = false;
  }
}
