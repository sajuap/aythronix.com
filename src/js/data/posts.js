/**
 * The blog's posts, in one place.
 *
 * blog.html links to `blog-post.html?post=<slug>` and
 * js/components/blog-post.js renders whichever one the query names. Everything a
 * post needs is here — the card on the listing, the cover on the article, the
 * meta line, the author and the body — so adding a post is one entry rather than
 * a page, and editing one is one place rather than three.
 *
 * `body` is authored HTML rather than a structure, because that is what it is:
 * prose with headings, and the article's own stylesheet already knows what to do
 * with `h2`, `p`, `ul` and `.article-pullquote`. It is written here, by us, and
 * never comes from anywhere a visitor can reach — which is the only reason
 * setting it with `innerHTML` is a reasonable thing to do.
 *
 * Order matters: the first entry is the featured post on the listing, and it is
 * what the article page falls back to when the query names nothing it knows.
 */

/**
 * Real, hashed URLs for the cover art.
 *
 * The same trap js/components/lottie-icons.js documents: the HTML pipeline
 * rewrites a `src` attribute it can see in the markup, but a path written as a
 * string inside a module is only a string. Left as `/src/assets/...` these build
 * without complaint and then 404 in production the moment the renderer swaps an
 * image in — which is exactly what happened here, and it only showed once the
 * page was built rather than served from source. Globbed, the data carries a
 * file name and Vite supplies the address.
 */
const IMAGES = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/images/blog/*.jpg', {
      eager: true,
      query: '?url',
      import: 'default',
    })
  ).map(([path, url]) => [path.split('/').pop(), url])
);

/** The people who write here. Referenced by key so a bio is corrected once. */
const AUTHORS = {
  priya: {
    name: 'Priya Raman',
    role: 'Principal Architect',
    bio: 'Principal architect at Aythronix. Spends most of her time on systems that were built by someone else, under constraints nobody wrote down.',
  },
  daniel: {
    name: 'Daniel Okafor',
    role: 'Engineering Lead',
    bio: 'Engineering lead at Aythronix. Writes about the parts of delivery that do not fit in a ticket.',
  },
  mara: {
    name: 'Mara Lindqvist',
    role: 'Head of Delivery',
    bio: 'Head of delivery at Aythronix. Interested in why estimates go wrong and what to do about it other than adding a multiplier.',
  },
  sam: {
    name: 'Sam Whitfield',
    role: 'Data & Platform',
    bio: 'Data and platform engineer at Aythronix. Responsible for the dashboards, and for deleting the ones nobody reads.',
  },
};

export const POSTS = [
  {
    slug: 'migration',
    title: 'Rebuilding a system while it is still serving traffic',
    lead: 'The migration nobody notices is the one planned backwards from the cutover.',
    excerpt: 'Standing a new service beside the old one, and keeping a way back.',
    category: 'Architecture',
    date: '12 August 2026',
    dateISO: '2026-08-12',
    readTime: '8 min',
    author: AUTHORS.priya,
    card: {
      src: IMAGES['migration.jpg'],
      alt: 'Two engineers reviewing code together in a data centre',
    },
    cover: {
      src: IMAGES['migration-cover.jpg'],
      alt: 'Two engineers reviewing code together in a data centre',
    },
    body: `
      <h2>Start from the cutover, not from the code</h2>
      <p>
        Most rewrites are planned forwards. Someone lists what the old system does, sizes
        the work, and starts at the first item. The trouble is that the list is finished
        long before the question that actually decides the project gets asked: on the day
        this goes live, what exactly changes, and what happens if it goes wrong at nine in
        the morning rather than nine at night?
      </p>
      <p>
        Planning backwards from that day tends to produce a different shape of work. It
        puts the boring things first — the seams, the switches, the ability to run both
        systems at once — and it usually reveals that a third of the original list did not
        need rebuilding at all.
      </p>

      <div class="article-pullquote">
        A migration is not a rewrite that happens to end in a deployment. It is a sequence
        of reversible steps that happens to end with the old system unused.
      </div>

      <h2>Put a seam in before you put anything behind it</h2>
      <p>
        The first change is rarely to the system being replaced. It is to everything that
        calls it. Consumers that reach directly into a database, or import a shared
        library, or know the shape of an internal response, are consumers that cannot be
        moved one at a time — and moving them one at a time is the entire trick.
      </p>
      <p>
        So the first piece of work is a façade: one place every caller goes through, still
        serving the old behaviour exactly, changing nothing a consumer can observe. It
        looks like an expensive way to achieve nothing. What it buys is the ability to
        change the answer behind it without changing the question, which is what every
        later step depends on.
      </p>

      <h2>Move consumers, not features</h2>
      <p>
        With a seam in place, the unit of progress stops being "the new system supports X"
        and becomes "this consumer now reads from the new system". That is a much better
        unit. It is small, it is individually reversible, and it produces real evidence —
        the new path is serving live traffic for somebody, under real load, with real data.
      </p>
      <ul>
        <li>Run both paths and compare, before either one is authoritative.</li>
        <li>Move read traffic first — it is the half you can undo cheaply.</li>
        <li>Keep the old path warm until the last consumer has been off it for longer than
          your worst incident took to surface.</li>
      </ul>

      <h2>What the quiet version looks like</h2>
      <p>
        The end state of all this is anticlimactic, which is the point. There is no launch.
        There is a week where the last consumer moves across, a period where the old system
        serves nothing, and a change that deletes it. Nobody outside the team can tell you
        which day it happened.
      </p>
      <p>
        That is worth saying out loud at the start, because a migration run this way looks
        slower for the first third of it and then finishes without drama. The version that
        looks faster early is usually the one that ends with a launch night, and launch
        nights are how systems get replaced twice.
      </p>
    `,
  },

  {
    slug: 'scale',
    title: 'Designing for the day the traffic triples',
    lead: 'Knowing when to rearchitect instead of tune — and how to tell the difference before the day arrives.',
    excerpt: 'When to rearchitect instead of tune.',
    category: 'Architecture',
    date: '29 July 2026',
    dateISO: '2026-07-29',
    readTime: '6 min',
    author: AUTHORS.priya,
    card: {
      src: IMAGES['scale.jpg'],
      alt: 'Racks of servers in a data centre aisle',
    },
    cover: {
      src: IMAGES['scale.jpg'],
      alt: 'Racks of servers in a data centre aisle',
    },
    body: `
      <h2>Most systems do not fail gradually</h2>
      <p>
        A system under rising load tends to look fine, then look fine, then stop looking
        fine very suddenly. That is not bad luck. Almost every component has a point where
        a queue stops draining as fast as it fills, and past that point the numbers do not
        degrade — they diverge. Response times do not go from 200ms to 400ms. They go from
        200ms to whatever your timeout is.
      </p>
      <p>
        Which means the useful question is never "how fast is it now". It is "how much
        headroom is there before something stops keeping up", and that is a different
        measurement entirely.
      </p>

      <h2>Tuning buys time; architecture buys headroom</h2>
      <p>
        An index, a cache, a bigger instance — these are real fixes and they are often the
        right first move. What they have in common is that they move the cliff further out
        without changing its shape. If a component can only ever do one thing at a time,
        making it faster raises the ceiling; it does not remove it.
      </p>
      <p>
        The signal that tuning has run out is usually not performance at all. It is that
        every improvement now requires knowing something about every other part of the
        system. When the cheap fixes stop being local, the constraint has moved into the
        architecture and that is where it has to be answered.
      </p>

      <div class="article-pullquote">
        Rearchitecting because a graph looks bad is expensive. Rearchitecting because you
        can name the component that cannot be split is a decision.
      </div>

      <h2>Find the thing that cannot be split</h2>
      <p>
        Under load, throughput is set by whatever cannot be done twice at once. A single
        writer, a lock, a job that has to run in order, a third party with a rate limit.
        Everything else is detail. Two hours spent identifying that component honestly is
        worth more than a quarter of speculative optimisation.
      </p>
      <ul>
        <li>Load-test the path, not the endpoint — a checkout is six services, not one.</li>
        <li>Test past the point of failure, so you learn how it fails and not just when.</li>
        <li>Measure at the percentile your customers actually feel, which is not the mean.</li>
      </ul>

      <h2>Then decide on purpose</h2>
      <p>
        With the constraint named, the choice becomes small and specific: split this table,
        make this job idempotent so it can run in parallel, put a queue in front of this
        third party and accept the latency. Those are decisions a team can make in an
        afternoon and reverse in a week.
      </p>
      <p>
        That is the difference worth protecting. Not whether you rearchitect, but whether
        you do it as a considered change to one component or as a rewrite that starts on the
        morning after the day the traffic tripled.
      </p>
    `,
  },

  {
    slug: 'estimates',
    title: 'Estimates that survive contact with the codebase',
    lead: 'Why we read the repository before quoting, and what that half-day usually finds.',
    excerpt: 'Why we read the repo before quoting.',
    category: 'Delivery',
    date: '15 July 2026',
    dateISO: '2026-07-15',
    readTime: '6 min',
    author: AUTHORS.mara,
    card: {
      src: IMAGES['estimates.jpg'],
      alt: 'Two colleagues reading through work on a shared screen',
    },
    cover: {
      src: IMAGES['estimates.jpg'],
      alt: 'Two colleagues reading through work on a shared screen',
    },
    body: `
      <h2>Estimates are not wrong because they are optimistic</h2>
      <p>
        The usual explanation for a blown estimate is optimism, and the usual remedy is a
        multiplier. Both are wrong often enough to be worth arguing with. An estimate given
        against a feature list is not an optimistic measurement — it is a measurement of a
        different thing. It sizes the work as described, and the overrun comes from the
        work as it exists.
      </p>
      <p>
        The gap between those two is almost never in the feature. It is in what the feature
        touches: the auth model that has three special cases, the shared table two other
        teams also write to, the test suite that takes forty minutes and fails twice a week
        for reasons nobody has looked into.
      </p>

      <h2>What a half-day in the repository buys</h2>
      <p>
        Before quoting anything we read the code. Not all of it — the paths the work would
        actually cross. That is usually half a day, and it changes the number more than any
        estimation technique we have tried.
      </p>
      <ul>
        <li>How long the test suite takes, and how much of it anyone trusts.</li>
        <li>How a change gets to production, and who is allowed to send it.</li>
        <li>Whether the thing being changed has one caller or eleven.</li>
        <li>What the last three people to touch this file had to do to get it merged.</li>
      </ul>

      <div class="article-pullquote">
        The estimate is not the hard part. Knowing which of the twenty things in front of
        you is going to be the expensive one — that is the part worth paying for.
      </div>

      <h2>Estimate the risk separately from the work</h2>
      <p>
        A single number hides the thing the client most needs to see. We split it: the work
        we can size because we have read it, and the work we cannot size yet because it
        depends on something unknown. The first gets a number. The second gets a named
        question and a cost to answer it, usually a day or two.
      </p>
      <p>
        That is a more useful conversation than a range. A range says "somewhere between
        these". A named unknown says "this specific thing decides it, and here is what it
        costs to find out" — and it can be bought separately, before anyone commits to the
        rest.
      </p>

      <h2>Then hold the number</h2>
      <p>
        Having done that, the estimate is ours to carry. If we misjudged the work we have
        read, that is our risk and not a change request. What is a change request is a
        change in what was asked for — and because the two were separated at the start,
        that conversation stays short and stays civil.
      </p>
    `,
  },

  {
    slug: 'latency',
    title: 'Treating latency as a business metric',
    lead: 'What happens when response time stops being an engineering concern and starts appearing next to revenue.',
    excerpt: 'Three seconds to under one.',
    category: 'Performance',
    date: '30 June 2026',
    dateISO: '2026-06-30',
    readTime: '5 min',
    author: AUTHORS.daniel,
    card: {
      src: IMAGES['latency.jpg'],
      alt: 'Abstract blue technology visualisation',
    },
    cover: {
      src: IMAGES['latency.jpg'],
      alt: 'Abstract blue technology visualisation',
    },
    body: `
      <h2>Nobody funds a graph</h2>
      <p>
        Latency work is chronically underfunded, and the reason is presentational. It gets
        reported as a chart with a line on it, in a review where everything else is
        reported in money. A line that moves from 2.8s to 1.1s is an achievement to the
        team that did it and an abstraction to everybody else in the room.
      </p>
      <p>
        The fix is not better charts. It is measuring the thing next to the number it
        moves, in the same view, from the start — so the argument for doing the work is
        made by the data rather than by the engineer.
      </p>

      <h2>Pick the step, not the page</h2>
      <p>
        "The site is slow" cannot be funded because it cannot be finished. A step can:
        the search that runs before a customer can filter, the address lookup in the middle
        of checkout, the report that people open every Monday. Each of those has a
        completion rate attached to it already.
      </p>
      <p>
        Once the pair is on one axis — time to respond, and proportion of people who went
        on to finish — the conversation changes shape. It stops being about whether speed
        matters in principle and becomes about which of four steps to buy first.
      </p>

      <div class="article-pullquote">
        Averages are a way of not seeing the customers you are losing. The people who leave
        are, by definition, in the tail.
      </div>

      <h2>Measure where the customer is</h2>
      <p>
        Server timings describe the part of the journey you own, which is rarely the part
        that hurts. Field measurement — real sessions, real devices, real networks —
        routinely comes in at two or three times the number from the synthetic run, and the
        difference is where the abandonment lives.
      </p>
      <ul>
        <li>Report the 75th and 95th percentile; the mean is the number that flatters.</li>
        <li>Segment by device and connection before concluding anything.</li>
        <li>Keep one number per step, not a dashboard nobody opens.</li>
      </ul>

      <h2>Then defend it</h2>
      <p>
        Latency is not won once. It regresses with every feature, and it regresses quietly,
        because nothing breaks. The only durable answer we have found is a budget checked
        automatically on the way to production — a number that fails a build the same way a
        broken test does, so the regression is a decision somebody makes rather than one
        that happens.
      </p>
    `,
  },

  {
    slug: 'observability',
    title: 'Observability you will still use in a year',
    lead: 'The dashboards a team actually keeps, and why most of the ones built during an incident do not survive it.',
    excerpt: 'The dashboards a team actually keeps.',
    category: 'Platform',
    date: '11 June 2026',
    dateISO: '2026-06-11',
    readTime: '6 min',
    author: AUTHORS.sam,
    card: {
      src: IMAGES['observability.jpg'],
      alt: 'A collage of source code and interface panels',
    },
    cover: {
      src: IMAGES['observability.jpg'],
      alt: 'A collage of source code and interface panels',
    },
    body: `
      <h2>Most dashboards are built at the worst possible moment</h2>
      <p>
        The typical dashboard is created during an incident, by someone who needs one
        specific answer, at two in the morning. It answers that question well and then
        stays on the wall forever, gradually becoming furniture. A year later the team has
        forty panels and checks three.
      </p>
      <p>
        That is not a tooling problem. It is that the panels were never given a job beyond
        the night they were made, and nothing in the process ever asks whether they still
        have one.
      </p>

      <h2>Alert on symptoms, investigate with everything else</h2>
      <p>
        The single most useful division we make is between the handful of signals that are
        allowed to wake someone and everything else. The first group describes what a
        customer would notice: requests failing, work not completing, a queue that is not
        draining. It is deliberately short, and it does not include CPU.
      </p>
      <p>
        Everything else exists to answer "why", and it is fine for that material to be
        broad, noisy and mostly unread. The mistake is letting it page anyone. A team that
        is woken by a cause rather than a symptom learns, correctly, to ignore the pager.
      </p>

      <div class="article-pullquote">
        If an alert has never once been the first thing to tell you about a real problem,
        it is not an alert. It is a habit.
      </div>

      <h2>Give every panel an owner and a question</h2>
      <p>
        The dashboards that survive have two things written on them: whose they are, and
        what question they answer. It sounds bureaucratic and it takes about ten seconds
        per panel. What it buys is the ability to delete things, because a panel whose
        question nobody asks any more is now visibly obsolete rather than merely old.
      </p>
      <ul>
        <li>One overview per service, readable in fifteen seconds, on a screen nobody has
          to scroll.</li>
        <li>Deep panels grouped by the question, not by the metric type.</li>
        <li>A review after every incident that adds what was missing and removes what did
          not help.</li>
      </ul>

      <h2>The test is a year later</h2>
      <p>
        Good observability is not the setup that looks most complete on the day it ships.
        It is the one a new engineer can use in twelve months to answer a question nobody
        anticipated — which mostly means it is small enough to be read, honest about what
        it does not cover, and pruned by someone who was allowed to delete things.
      </p>
    `,
  },

  {
    slug: 'automation',
    title: 'Automation that removes work, not adds it',
    lead: 'Which workflows are worth automating, and the test that separates them from the ones that will need a maintainer.',
    excerpt: 'Which workflows are worth automating.',
    category: 'Platform',
    date: '22 May 2026',
    dateISO: '2026-05-22',
    readTime: '5 min',
    author: AUTHORS.sam,
    card: {
      src: IMAGES['automation.jpg'],
      alt: 'A single developer at a laptop late at night',
    },
    cover: {
      src: IMAGES['automation.jpg'],
      alt: 'A single developer at a laptop late at night',
    },
    body: `
      <h2>Automation is a transfer, not a deletion</h2>
      <p>
        Automating a task does not remove the work. It converts a recurring manual cost
        into a fixed build cost plus an ongoing maintenance cost, and hopes the arithmetic
        comes out ahead. Often it does. The cases where it does not are predictable, and
        they are predictable before you start.
      </p>
      <p>
        The failure mode is familiar: a script that saves twenty minutes a week and breaks
        every time an upstream format changes, so it costs an hour a month to keep alive
        and only one person understands it. That is not automation. That is a new system
        with one maintainer and no owner.
      </p>

      <h2>Three questions before writing anything</h2>
      <ul>
        <li><strong>Is the process stable?</strong> Automating something that is still
          changing shape means rewriting the automation every time it changes.</li>
        <li><strong>Is it deterministic?</strong> If a human is applying judgement at
          any step, that step is not the one to automate — the ones either side of it are.</li>
        <li><strong>Does it fail loudly?</strong> Silent automation is worse than manual
          work, because nobody notices the day it quietly stops.</li>
      </ul>

      <div class="article-pullquote">
        The best candidate is rarely the most tedious task. It is the most repetitive one
        that nobody has to think about — those are the same thing surprisingly seldom.
      </div>

      <h2>Automate the boring middle</h2>
      <p>
        Most valuable processes are a judgement, then a lot of mechanical steps, then
        another judgement. The mechanical middle is where automation pays: gathering the
        inputs, transforming them, putting the result where a person can look at it and
        decide.
      </p>
      <p>
        Trying to automate the judgement produces a system that is right most of the time
        and wrong in a way nobody can predict, which is the most expensive kind of wrong.
        Leaving the judgement in place and removing everything around it produces something
        that saves real hours and is comprehensible when it breaks.
      </p>

      <h2>Keep a human check where it matters</h2>
      <p>
        Where the output of a pipeline is consequential — money moving, a customer being
        emailed, something being deleted — the version we build routes the uncertain cases
        to a person rather than guessing. It handles the ninety per cent that is obvious
        and asks about the rest.
      </p>
      <p>
        That is a less impressive demo and a much better system. The measure of automation
        is not how much of the process it covers. It is how many hours came back, and
        whether anyone has had to go and fix it since.
      </p>
    `,
  },

  {
    slug: 'handover',
    title: 'Writing for whoever inherits the system',
    lead: 'Documentation and tests aimed at the team who arrives after you, not the one that built it.',
    excerpt: 'Docs and tests for the next team.',
    category: 'Delivery',
    date: '6 May 2026',
    dateISO: '2026-05-06',
    readTime: '5 min',
    author: AUTHORS.daniel,
    card: {
      src: IMAGES['handover.jpg'],
      alt: 'Close-up of hands writing code on a laptop',
    },
    cover: {
      src: IMAGES['handover.jpg'],
      alt: 'Close-up of hands writing code on a laptop',
    },
    body: `
      <h2>The reader is not you</h2>
      <p>
        Almost all internal documentation is written by someone at the peak of their
        understanding, for a reader who has none. That mismatch explains most of what is
        wrong with it: it records the shape of the solution and omits the reason, because
        the reason was obvious at the time and will never be obvious again.
      </p>
      <p>
        The useful discipline is to write for the person who arrives eighteen months later
        with a bug, no context, and no access to anyone who was there. That person does not
        need a tour. They need to know why this is like this.
      </p>

      <div class="article-pullquote">
        Code says what happens. Tests say what is supposed to happen. Only a comment can
        say what was rejected, and why — which is the question that actually costs an
        afternoon.
      </div>

      <h2>Document decisions, not structure</h2>
      <p>
        A description of the folder layout goes stale in a month and could have been
        obtained by looking. A short record of a decision does not go stale, because it
        describes a moment: what was chosen, what else was considered, what constraint
        settled it.
      </p>
      <ul>
        <li>The constraint that is not visible in the code — a contract, a rate limit, a
          regulator.</li>
        <li>The alternative that looks better than it is, and the reason it was not taken.</li>
        <li>The thing that will look like a mistake and is not, with one line about why.</li>
      </ul>

      <h2>Tests are the documentation people trust</h2>
      <p>
        Prose can be wrong for a year without anybody noticing. A test cannot — it fails.
        That makes the test suite the only documentation with a mechanism for staying
        honest, and it is worth writing some of it with a reader rather than a machine in
        mind: named for the behaviour, not the function; arranged so the setup reads as the
        precondition it is.
      </p>
      <p>
        A new engineer who can read one test and understand what the system guarantees is
        further along than one who has read the whole of a wiki.
      </p>

      <h2>Hand over before you have to</h2>
      <p>
        The real test of all this is cheap to run and almost never run: have somebody who
        did not build it do the next piece of work, while the people who did are still
        there to be asked. Every question they have to ask is a gap, and it is a gap you
        can close in an afternoon instead of discovering it after everyone has moved on.
      </p>
    `,
  },
];

/** The post a slug names, or the featured one when it names nothing we have. */
export function findPost(slug) {
  return POSTS.find((post) => post.slug === slug) || POSTS[0];
}
