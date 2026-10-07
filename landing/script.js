/* ═══════════════════════════════════════════════════════════
   ASTRODOCX — LANDING MASTER SCRIPT
   (built on the Portfolio V32 template; pin / nebula / camera
    logic intentionally unchanged)
   Includes: GSAP animations + ONE shared Three.js nebula
             (fixed #nebulaStage behind About → Contact)
             + About pin timeline, Projects showcase,
             Education timeline + Contact form handler

   Nebula consolidation (N1–N7): the separate Skills/Projects,
   Education and Contact WebGL scenes were removed; the About
   nebula is the single background, camera driven by scroll.
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

gsap.registerPlugin(ScrollTrigger, TextPlugin);
window.addEventListener('load', () => ScrollTrigger.refresh());

/* Priority-2 §5: single source of truth for "does this visitor want
   reduced motion". Ambient/idle animation loops check this and skip
   their non-essential motion; scroll-scrubbed effects still update
   (they're a direct result of the user's own scrolling, not
   autoplaying motion) but no longer add extra idle animation on top. */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let navVisible = true;

/* ═══════════════════════════════════════════════════════════
   PROJECTS — data + card rendering
   Single source of truth for the showcase. Add / remove / reorder
   an entry here and the cards, the 0X/0N indices and the pagination
   dots all follow automatically — index.html holds only the empty
   #projectsRail / #projectDots containers.

   Card shape is deliberately two stacked siblings:
       .project-thumb    (image only, fixed 16/9 box)
       .project-content  (number, title, role, copy, tech, link)
   so nothing can ever render on top of a screenshot.
═══════════════════════════════════════════════════════════ */
const REPO_URL = 'https://github.com/A-42-018/AstroDocX';

/* FEATURES — rendered into the template's carousel (#projects).
   Every entry is a working screen of the Crew Console (/app/). `live` opens
   it; `badge` shows in the ribbon; thumbnails in assets/features/ are
   illustrations, not screenshots. */
const CONSOLE = '/app/';
const PROJECTS = [
  {
    id: 1,
    title: 'Health Status Board',
    thumbnail: 'assets/features/status-board.svg',
    alt: 'Illustration: health status board with five hazard tiles',
    role: 'Covers: all 5 hazards',
    description: 'One glance at each crew member: five RIDGE hazard tiles, each Nominal, Watch or Act against that person\'s own baseline, a readiness ring, the mission clock and the ground-link status.',
    technologies: ['Personal baseline', 'EWMA z-score', 'Offline PWA'],
    link: REPO_URL,
    live: CONSOLE + 'board',
    badge: 'Live'
  },
  {
    id: 2,
    title: 'Explainable Alerts',
    thumbnail: 'assets/features/explainable-alerts.svg',
    alt: 'Illustration: alert explaining a change against the personal baseline',
    role: 'Covers: all 5 hazards',
    description: 'Every alert says what changed, by how much, against whose baseline and since when, for example "Reaction time 411 ms is 4.3σ above Pilot\'s baseline (317 ms). Started at D27 07:00 MET." NASA limits for CO₂ and radiation dose are applied too.',
    technologies: ['Rules engine', 'NASA-STD-3001 limits', 'Plain language'],
    link: REPO_URL,
    live: CONSOLE + 'alerts',
    badge: 'Live'
  },
  {
    id: 3,
    title: 'Action Cards',
    thumbnail: 'assets/features/action-cards.svg',
    alt: 'Illustration: step-by-step action card for radiation shelter',
    role: 'Covers: Distance from Earth',
    description: 'Each alert carries a step-by-step card the crew can follow on their own. Tick the steps, press Done and it goes to the on-board log; the engine keeps watching and clears the alert when values recover.',
    technologies: ['Countermeasures', 'Action log', 'Crew autonomy'],
    link: REPO_URL,
    live: CONSOLE + 'alerts',
    badge: 'Live'
  },
  {
    id: 4,
    title: 'Daily Check-in',
    thumbnail: 'assets/features/daily-check-in.svg',
    alt: 'Illustration: daily check-in with reaction test',
    role: 'Covers: Isolation & Confinement',
    description: 'Mood, sleep and symptoms plus a five-tap reaction test modelled on the PVT used on the ISS. Answers join the personal baseline; lasting symptoms, poor sleep or blurred vision (SANS) raise their own alerts.',
    technologies: ['PVT reaction test', 'Symptoms', 'Sleep quality'],
    link: REPO_URL,
    live: CONSOLE + 'checkin',
    badge: 'Live'
  },
  {
    id: 5,
    title: 'Trend Charts',
    thumbnail: 'assets/features/trend-charts.svg',
    alt: 'Illustration: trend chart with personal baseline band',
    role: 'Covers: all 5 hazards',
    description: 'Eleven indicators over 24 hours, 7 days or 30 days, drawn against the astronaut\'s own baseline band with alert markers, so slow drift such as deconditioning stands out.',
    technologies: ['Baseline band', 'Alert markers', 'Recharts'],
    link: REPO_URL,
    live: CONSOLE + 'trends',
    badge: 'Live'
  },
  {
    id: 6,
    title: 'Mission Simulator',
    thumbnail: 'assets/features/mission-simulator.svg',
    alt: 'Illustration: mission simulator with event triggers',
    role: 'Demo & testing',
    description: 'A seeded 30-day, four-person synthetic mission. Inject a solar particle event, a CO₂ scrubber fault, an insomnia streak or deconditioning, fast-forward time and watch every screen respond.',
    technologies: ['Synthetic data', 'Scenarios', 'Fast-forward'],
    link: REPO_URL,
    live: CONSOLE + 'simulator',
    badge: 'Live'
  },
  {
    id: 7,
    title: 'Ground Sync',
    thumbnail: 'assets/features/ground-sync.svg',
    alt: 'Illustration: delay-tolerant sync queue to Earth',
    role: 'Covers: Distance from Earth',
    description: 'The log queues on board and goes to Earth only in link windows, with blackouts you can simulate. A flight-surgeon Ground View shows only what has arrived. Optional real upload to Supabase.',
    technologies: ['Delay-tolerant', 'Outbox', 'Flight surgeon view'],
    link: REPO_URL,
    live: CONSOLE + 'sync',
    badge: 'Live'
  }
];

(function () {
  'use strict';

  const rail = document.getElementById('projectsRail');
  const dots = document.getElementById('projectDots');
  if (!rail || !dots) return;

  const total = PROJECTS.length;
  const pad   = function (n) { return n < 10 ? '0' + n : String(n); };
  const esc   = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* Reusable "ProjectCard" — one function, called per entry. */
  function projectCard(p, i) {
    const n = i + 1;
    return '' +
      '<article class="project-card" data-project="' + n + '" tabindex="-1" ' +
        'aria-roledescription="slide" aria-label="Feature ' + n + ' of ' + total + ': ' + esc(p.title) + '">' +
        '<div class="project-thumb">' +
          '<img class="project-thumb-img" src="' + esc(p.thumbnail) + '" alt="' + esc(p.alt || p.title) + '" ' +
            'loading="' + (i === 0 ? 'eager' : 'lazy') + '" decoding="async">' +
        '</div>' +
        '<div class="project-content">' +
          '<div class="project-meta-row">' +
            '<span class="project-index">' + pad(n) + '<b>/' + pad(total) + '</b></span>' +
            (p.badge ? '<span class="featured-ribbon">' + esc(p.badge) + '</span>' : (p.featured ? '<span class="featured-ribbon">&#9733; Featured</span>' : '')) +
          '</div>' +
          '<h3 class="project-title">' + esc(p.title) + '</h3>' +
          (p.role ? '<p class="project-role">' + esc(p.role) + '</p>' : '') +
          (p.description ? '<p class="project-description">' + esc(p.description) + '</p>' : '') +
          '<ul class="project-tech">' +
            (p.technologies || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
          '</ul>' +
          '<div class="project-links">' +
            (p.live ? '<a class="project-live-btn" href="' + esc(p.live) + '" ' +
              'aria-label="Open ' + esc(p.title) + ' in the Crew Console">Open in Console &rarr;</a>' : '') +
            '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">View on GitHub &rarr;</a>' +
            '<button type="button" class="project-copy-btn" data-repo="' + esc(p.link) + '" ' +
              'aria-label="Copy link to ' + esc(p.title) + '">Copy Link</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function dotButton(p, i) {
    const n = i + 1;
    return '<button type="button" class="project-dot' + (i === 0 ? ' is-current' : '') + '" ' +
      'data-goto="' + n + '" aria-current="' + (i === 0 ? 'true' : 'false') + '" ' +
      'aria-label="Go to feature ' + n + ': ' + esc(p.title) + '"></button>';
  }

  rail.innerHTML = PROJECTS.map(projectCard).join('');
  dots.innerHTML = PROJECTS.map(dotButton).join('');
})();

/* ── G1. HERO ENTRANCE ──────────────────────────────────── */
(function () {
  gsap.fromTo('.hero-inner > *',
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, stagger: 0.18, duration: 0.85, ease: 'power3.out', delay: 0.25,
      clearProps: 'transform' }
  );
  gsap.to('.hero-scroll-hint', { opacity: 1, duration: 0.6, delay: 2.2, ease: 'power2.out' });
  gsap.fromTo('#hero-terminal',
    { opacity: 0, y: 22, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1, duration: 0.9, delay: 1.7, ease: 'power3.out' }
  );
})();

/* ── G2. NAVBAR ─────────────────────────────────────────── */
(function () {
  const navbar   = document.getElementById('navbar');
  const navLinks = document.getElementById('nav-links');

  ScrollTrigger.create({
    start:       'top -44px',
    onEnter:     () => navbar.classList.add('scrolled'),
    onLeaveBack: () => navbar.classList.remove('scrolled')
  });

  ScrollTrigger.create({
    onUpdate: self => {
      if (navLinks.classList.contains('open')) return;
      const atTop = window.scrollY < 120;
      if (atTop) {
        if (!navVisible) {
          gsap.to(navbar, { yPercent: 0, duration: 0.4, ease: 'power2.out' });
          navVisible = true;
        }
        return;
      }
      if (self.direction === 1 && navVisible) {
        gsap.to(navbar, { yPercent: -110, duration: 0.35, ease: 'power2.in' });
        navVisible = false;
      } else if (self.direction === -1 && !navVisible) {
        gsap.to(navbar, { yPercent: 0, duration: 0.45, ease: 'power2.out' });
        navVisible = true;
      }
    }
  });

  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  function setActive(id) {
    links.forEach(l => l.classList.remove('active'));
    const a = document.querySelector('.nav-links a[href="#' + id + '"]');
    if (a) a.classList.add('active');
  }
  /* AstroDocX fix: the template created one ScrollTrigger per nav
     target here, BEFORE the About and Skills/Projects pins existed, so
     their start/end ignored the pin spacing and the highlight drifted
     (e.g. "Team" lit up while viewing Hazards). Now the active link is
     derived from live positions on every scroll update instead:
       • inside the horizontal pin → Hazards for the Skills→Projects
         hand-off, Features after it (same split the carousel uses)
       • everywhere else → last section whose top passed 45% of the
         viewport (rects already include pin spacers). */
  const navTargetIds = Array.from(links)
    .map(a => a.getAttribute('href'))
    .filter(href => href && href.startsWith('#') && href.length > 1)
    .map(href => href.slice(1));
  function hscrollPin() {
    return ScrollTrigger.getAll().find(t => t.pin && t.trigger && t.trigger.id === 'nebula-offset');
  }
  function currentNavId() {
    const probe = window.innerHeight * 0.45;
    const hz = hscrollPin();
    if (hz && window.scrollY >= hz.start - probe && window.scrollY <= hz.end) {
      const n = document.querySelectorAll('.project-card').length || 1;
      const intro = 1 / (1 + 0.62 * (n - 1));           // carousel's introFrac()
      const p = (window.scrollY - hz.start) / Math.max(1, hz.end - hz.start);
      return p < intro * 0.5 ? 'skills' : 'projects';
    }
    /* At the very bottom the last section can't reach the probe line. */
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
      return navTargetIds[navTargetIds.length - 1] || null;
    }
    let cur = null;
    navTargetIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= probe) cur = id;
    });
    return cur;
  }
  let lastNavId;
  function syncNav() {
    const id = currentNavId();
    if (id === lastNavId) return;
    lastNavId = id;
    if (id) setActive(id); else links.forEach(l => l.classList.remove('active'));
  }
  let navTick = false;
  window.addEventListener('scroll', () => {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(() => { navTick = false; syncNav(); });
  }, { passive: true });
  ScrollTrigger.addEventListener('refresh', syncNav);
  window.addEventListener('load', () => setTimeout(syncNav, 300));
})();

/* ── G3. SCROLL REVEALS ─────────────────────────────────── */
(function () {
  /* — Generic section eyebrows / titles / subtitles — */
  gsap.utils.toArray('.section-eyebrow').forEach(el => {
    /* Skip nebula-offset children — handled by About IIFE early bleed-in */
    if (el.closest('#nebula-offset')) return;
    gsap.fromTo(el, { opacity: 0, y: 14 }, {
      scrollTrigger: { trigger: el, start: 'top 90%' },
      opacity: 1, y: 0, duration: 0.5, ease: 'power2.out'
    });
  });

  gsap.utils.toArray('.section-title').forEach(el => {
    if (el.closest('#nebula-offset')) return;
    gsap.fromTo(el, { opacity: 0, y: 28 }, {
      scrollTrigger: { trigger: el, start: 'top 88%' },
      opacity: 1, y: 0, duration: 0.7, ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.section-subtitle').forEach(el => {
    if (el.closest('#nebula-offset')) return;
    gsap.fromTo(el, { opacity: 0, y: 14 }, {
      scrollTrigger: { trigger: el, start: 'top 90%' },
      opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power2.out'
    });
  });

  /* — Education-specific reveals — */
  gsap.fromTo('.edu-eyebrow', { opacity: 0, y: 14 }, {
    scrollTrigger: { trigger: '.edu-eyebrow', start: 'top 90%' },
    opacity: 1, y: 0, duration: 0.5, ease: 'power2.out'
  });

  gsap.fromTo('.edu-title', { opacity: 0, y: 28 }, {
    scrollTrigger: { trigger: '.edu-title', start: 'top 88%' },
    opacity: 1, y: 0, duration: 0.7, ease: 'power3.out'
  });

  /* — Contact-specific reveals — */
  gsap.fromTo('.contact-title', { opacity: 0, y: 28 }, {
    scrollTrigger: { trigger: '.contact-title', start: 'top 88%' },
    opacity: 1, y: 0, duration: 0.7, ease: 'power3.out'
  });

  gsap.fromTo('.contact-subtitle', { opacity: 0, y: 14 }, {
    scrollTrigger: { trigger: '.contact-subtitle', start: 'top 90%' },
    opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power2.out'
  });

  /* — Skills + Projects —
     NOTE: .skill-category and .project-card batch reveals are
     now owned by the About IIFE's post-seam ScrollTrigger (Plan §3)
     so cards don't pop before the gradient bridge has resolved.
     Only the timeline items remain here. */

  gsap.utils.toArray('.timeline-item').forEach(item => {
    gsap.from(item, {
      scrollTrigger: { trigger: item, start: 'top 82%' },
      opacity: 0, x: -40, duration: 0.7, ease: 'power3.out'
    });
  });

  /* — Contact form area + info — */
  gsap.fromTo('.contact-form-area', {
    opacity: 0, x: -30, y: 20
  }, {
    scrollTrigger: { trigger: '#contact', start: 'top 78%' },
    opacity: 1, x: 0, y: 0, duration: 0.8, ease: 'power3.out'
  });
  gsap.fromTo('.contact-info', {
    opacity: 0, x: 30, y: 20
  }, {
    scrollTrigger: { trigger: '#contact', start: 'top 78%' },
    opacity: 1, x: 0, y: 0, duration: 0.8, delay: 0.2, ease: 'power3.out'
  });
})();

/* ── G4. STAT COUNTERS ──────────────────────────────────── */
(function () {
  document.querySelectorAll('.stat-number').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const obj    = { val: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: target, duration: 1.4, ease: 'power2.out',
          onUpdate:   () => { el.textContent = Math.floor(obj.val) + '+'; },
          onComplete: () => { el.textContent = target + '+'; }
        });
      }
    });
  });
})();

/* ── G5. TICKER MARQUEE ─────────────────────────────────── */
(function () {
  const band  = document.querySelector('.marquee-band');
  if (!band) return;
  const wrap  = band.querySelector('.marquee-wrap');
  const group = wrap.querySelector('.marquee-group');

  requestAnimationFrame(() => {
    const gw = group.offsetWidth;
    if (!gw) return;
    const tween = gsap.to(wrap, { x: -gw, duration: 24, ease: 'none', repeat: -1 });
    band.addEventListener('mouseenter', () => gsap.to(tween, { timeScale: 0.15, duration: 0.5 }));
    band.addEventListener('mouseleave', () => gsap.to(tween, { timeScale: 1,    duration: 0.8 }));
  });
})();

/* ── G5b. HERO→MARQUEE CANVAS CROSS-FADE (Plan §5, optional polish) ──
   Fades #hero-canvas out as the marquee band scrolls into view, instead
   of it cutting hard against About's canvas at the seam.
   FIX: was an IntersectionObserver flipping opacity 0/1 the instant the
   marquee was just 15% visible — on a quick scroll this looked like the
   starfield background vanishing abruptly while the hero text/robot were
   still fully on screen. Replaced with a scroll-scrubbed GSAP tween so
   the starfield fades out gradually, in step with how far the marquee
   has actually scrolled into view, instead of snapping off early. */
(function () {
  if (REDUCE_MOTION) return;
  const band       = document.querySelector('.marquee-band');
  const heroCanvas = document.getElementById('hero-canvas');
  if (!band || !heroCanvas || typeof gsap === 'undefined') return;
  gsap.to(heroCanvas, {
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: band,
      start: 'top bottom',
      end: 'bottom center',
      scrub: true
    }
  });
})();

/* ── G6. CODE TERMINAL ──────────────────────────────────── */
(function () {
  const el = document.getElementById('gsap-code');
  if (!el) return;
  const code = [
    '// astrodocx.ts',
    'const crew = await AstroDocX.scan();',
    'crew.forEach(a => {',
    '  const drift = a.compareToBaseline();',
    '  if (drift.flag) a.showActionCard();',
    '});',
    '// detect → explain → act \uD83D\uDE80'
  ].join('\n');
  gsap.to(el, {
    delay: 2.6, duration: code.length * 0.038,
    text: { value: code, delimiter: '' }, ease: 'none'
  });
})();

/* ── G7. HOVER MICRO-INTERACTIONS ───────────────────────── */
(function () {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width  / 2) * 0.22;
      const y = (e.clientY - r.top  - r.height / 2) * 0.22;
      gsap.to(btn, { x, y, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
    });
  });

  document.querySelectorAll('.skill-list li').forEach(li => {
    li.addEventListener('mouseenter', () => gsap.to(li, { x: 7,  duration: 0.2, ease: 'power2.out' }));
    li.addEventListener('mouseleave', () => gsap.to(li, { x: 0,  duration: 0.4, ease: 'elastic.out(1, 0.5)' }));
  });

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('mouseenter', () => gsap.to(a, { scale: 1.07, duration: 0.2, ease: 'power2.out' }));
    a.addEventListener('mouseleave', () => gsap.to(a, { scale: 1,    duration: 0.4, ease: 'elastic.out(1, 0.5)' }));
  });

  document.querySelectorAll('.social-pill, .footer-links a').forEach(el => {
    el.addEventListener('mouseenter', () => gsap.to(el, { y: -3, duration: 0.2, ease: 'power2.out' }));
    el.addEventListener('mouseleave', () => gsap.to(el, { y:  0, duration: 0.4, ease: 'elastic.out(1, 0.5)' }));
  });

  document.querySelectorAll('.timeline-item').forEach(item => {
    const dot = item.querySelector('.timeline-marker');
    item.addEventListener('mouseenter', () => gsap.to(dot, {
      scale: 1.6, backgroundColor: 'var(--cyan)',
      boxShadow: '0 0 0 5px rgba(34,211,238,0.22)',
      duration: 0.25, ease: 'power2.out'
    }));
    item.addEventListener('mouseleave', () => gsap.to(dot, {
      scale: 1, backgroundColor: 'var(--indigo)',
      boxShadow: '0 0 0 2px var(--indigo)',
      duration: 0.4, ease: 'elastic.out(1, 0.5)'
    }));
  });

  document.querySelectorAll('.project-links a').forEach(a => {
    a.addEventListener('mouseenter', () => gsap.to(a, { x: 5, duration: 0.2, ease: 'power2.out' }));
    a.addEventListener('mouseleave', () => gsap.to(a, { x: 0, duration: 0.35, ease: 'power2.inOut' }));
  });
})();

/* ── Card tilt ───────────────────────────────────────────── */
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const TILT = 10, SHINE = true;
  document.querySelectorAll('.tilt-card').forEach(card => {
    if (SHINE) { const s = document.createElement('div'); s.className = 'tilt-shine'; card.appendChild(s); }
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      const dx = (e.clientX-cx)/(rect.width/2), dy = (e.clientY-cy)/(rect.height/2);
      card.style.transform = `perspective(700px) rotateX(${-dy*TILT}deg) rotateY(${dx*TILT}deg) scale3d(1.03,1.03,1.03)`;
      if (SHINE) card.querySelector('.tilt-shine').style.background =
        `radial-gradient(circle at ${dx*50+50}% ${dy*50+50}%, rgba(255,255,255,0.12) 0%, transparent 65%)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      if (SHINE) card.querySelector('.tilt-shine').style.background = '';
    });
  });
})();

/* ── Back-to-top ─────────────────────────────────────────── */
(function () {
  const btn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => { btn.classList.toggle('visible', window.scrollY > 400); }, { passive: true });
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();

/* ── Nav mobile toggle ──────────────────────────────────── */
(function () {
  const navbar   = document.getElementById('navbar');
  const toggle   = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    if (open && !navVisible) {
      gsap.to(navbar, { yPercent: 0, duration: 0.3 });
      navVisible = true;
    }
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => { navLinks.classList.remove('open'); toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', false); });
  });
})();

/* ── Footer year ─────────────────────────────────────────── */
document.getElementById('footer-year').textContent = new Date().getFullYear();

/* ── 3D Warp Particle Field (Hero) ──────────────────────── */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  if (REDUCE_MOTION) { canvas.style.display = 'none'; return; }
  const ctx    = canvas.getContext('2d');
  function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
  resize(); window.addEventListener('resize', resize, { passive: true });
  const NUM_STARS=280,DEPTH=1000,SPEED_BASE=2.2,FOV=320;
  let mouseX=0,mouseY=0;
  window.addEventListener('mousemove',e=>{mouseX=(e.clientX/window.innerWidth-0.5)*2;mouseY=(e.clientY/window.innerHeight-0.5)*2;},{passive:true});
  function mkStar(){return{x:(Math.random()-.5)*canvas.width*2.5,y:(Math.random()-.5)*canvas.height*2.5,z:Math.random()*DEPTH,pz:0,hue:Math.random()<0.7?245:Math.random()<0.5?185:270};}
  const stars=Array.from({length:NUM_STARS},mkStar);stars.forEach(s=>{s.z=Math.random()*DEPTH;s.pz=s.z;});
  let speed=SPEED_BASE;
  window.addEventListener('scroll',()=>{const r=Math.min(window.scrollY/(window.innerHeight*0.5),1);speed=SPEED_BASE+r*3;},{passive:true});
  function project(s,W,H){const cx=W/2+mouseX*30,cy=H/2+mouseY*20,sc=FOV/(FOV+s.z);return{sx:cx+s.x*sc,sy:cy+s.y*sc,psx:cx+s.x*(FOV/(FOV+s.pz)),psy:cy+s.y*(FOV/(FOV+s.pz)),scale:sc};}
  function drawDotGrid(W,H){ctx.fillStyle='rgba(79,70,229,0.12)';const gs=36;for(let x=0;x<W;x+=gs)for(let y=0;y<H;y+=gs){ctx.beginPath();ctx.arc(x,y,0.7,0,Math.PI*2);ctx.fill();}}
  function drawGlow(W,H){const g1=ctx.createRadialGradient(W*0.75,H*0.2,0,W*0.75,H*0.2,300);g1.addColorStop(0,'rgba(79,70,229,0.13)');g1.addColorStop(1,'rgba(79,70,229,0)');ctx.fillStyle=g1;ctx.fillRect(0,0,W,H);const g2=ctx.createRadialGradient(W*0.1,H*0.85,0,W*0.1,H*0.85,200);g2.addColorStop(0,'rgba(34,211,238,0.08)');g2.addColorStop(1,'rgba(34,211,238,0)');ctx.fillStyle=g2;ctx.fillRect(0,0,W,H);}
  function frame(){const W=canvas.width,H=canvas.height;ctx.fillStyle='rgba(5,4,12,0.55)';ctx.fillRect(0,0,W,H);drawDotGrid(W,H);
    for(const s of stars){s.pz=s.z;s.z-=speed;if(s.z<=0){s.x=(Math.random()-.5)*W*2.5;s.y=(Math.random()-.5)*H*2.5;s.z=DEPTH;s.pz=DEPTH;}
      const{sx,sy,psx,psy,scale}=project(s,W,H);if(sx<-200||sx>W+200||sy<-200||sy>H+200)continue;
      const br=Math.min(1,(1-s.z/DEPTH)*1.6),r=Math.max(0.3,scale*2.2),tl=Math.hypot(sx-psx,sy-psy);
      if(tl>0.5){ctx.beginPath();ctx.moveTo(psx,psy);ctx.lineTo(sx,sy);ctx.strokeStyle=`hsla(${s.hue},90%,72%,${br*0.85})`;ctx.lineWidth=r*0.9;ctx.stroke();}
      ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fillStyle=`hsla(${s.hue},90%,85%,${br})`;ctx.fill();
      if(br>0.55){const g=ctx.createRadialGradient(sx,sy,0,sx,sy,r*3.5);g.addColorStop(0,`hsla(${s.hue},80%,70%,${br*0.35})`);g.addColorStop(1,`hsla(${s.hue},80%,70%,0)`);ctx.beginPath();ctx.arc(sx,sy,r*3.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}}
    requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();

/* ── Rotating Wireframe Orb (Hero) ──────────────────────── */
(function () {
  const canvas=document.getElementById('orb-canvas');
  if (!canvas) return;
  const ctx=canvas.getContext('2d');
  const SIZE=260;canvas.width=SIZE;canvas.height=SIZE;
  const PHI=(1+Math.sqrt(5))/2,R=90;
  function norm(v){const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l*R,v[1]/l*R,v[2]/l*R];}
  const VR=[[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]].map(norm);
  const ED=[[0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],[2,3],[2,6],[2,10],[2,11],[2,4],[3,4],[3,6],[3,8],[3,9],[4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],[7,8],[7,10],[8,9],[10,11]];
  let rX=0.3,rY=0.1;const vX=0.003,vY=0.007;let mox=0,moy=0;
  window.addEventListener('mousemove',e=>{const h=document.getElementById('hero').getBoundingClientRect();if(e.clientY<h.bottom){mox=(e.clientX/window.innerWidth-.5)*0.012;moy=(e.clientY/window.innerHeight-.5)*0.012;}},{passive:true});
  function rx(v,a){const c=Math.cos(a),s=Math.sin(a);return[v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c];}
  function ry(v,a){const c=Math.cos(a),s=Math.sin(a);return[v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c];}
  const F=340,CX=SIZE/2,CY=SIZE/2;
  function proj(v){const sc=F/(F+v[2]);return[CX+v[0]*sc,CY+v[1]*sc,sc];}
  function frame(){ctx.clearRect(0,0,SIZE,SIZE);rX+=vX+moy;rY+=vY+mox;
    const v2=VR.map(v=>{let t=rx(v,rX);t=ry(t,rY);return proj(t);});
    for(const[a,b]of ED){const[ax,ay,as_]=v2[a],[bx,by,bs]=v2[b];const al=((as_+bs)/2)*0.55;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.strokeStyle=`rgba(129,140,248,${al.toFixed(3)})`;ctx.lineWidth=0.9;ctx.stroke();}
    for(const[vx,vy,vs]of v2){const al=vs*0.9,r=vs*3.5;const g=ctx.createRadialGradient(vx,vy,0,vx,vy,r*2.8);g.addColorStop(0,`rgba(99,102,241,${(al*0.6).toFixed(3)})`);g.addColorStop(1,'rgba(99,102,241,0)');ctx.beginPath();ctx.arc(vx,vy,r*2.8,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(vx,vy,Math.max(0.5,r*0.55),0,Math.PI*2);ctx.fillStyle=`rgba(199,210,254,${al.toFixed(3)})`;ctx.fill();}
    const rg=ctx.createRadialGradient(CX,CY,R*0.75,CX,CY,R*1.35);rg.addColorStop(0,'rgba(79,70,229,0.0)');rg.addColorStop(0.7,'rgba(79,70,229,0.07)');rg.addColorStop(1,'rgba(79,70,229,0.0)');ctx.beginPath();ctx.arc(CX,CY,R*1.35,0,Math.PI*2);ctx.fillStyle=rg;ctx.fill();
    /* Priority-2 §5: reduced motion gets one static frame, no ongoing rotation */
    if (!REDUCE_MOTION) requestAnimationFrame(frame);}
  frame();
})();

/* ── Typewriter ──────────────────────────────────────────── */
(function () {
  const phrases=['monitoring radiation dose.','tracking bone & muscle loss.','spotting isolation stress.','checking cabin CO\u2082.','acting without waiting for Earth.'];
  let pi=0,ci=0,deleting=false,wait=0;
  const el=document.getElementById('hero-typed');
  if (!el) return;
  const cursor=document.querySelector('.hero-cursor');
  /* Retriggers the CSS "key hit" animation (typeKeyHit / cursorAdvance)
     on every character typed or deleted — a tiny jump + glow flash to
     sell the typewriter feel. Skipped under reduced motion, where the
     CSS rules for these classes are no-ops anyway. */
  function keyHit(){
    if (REDUCE_MOTION) return;
    [el, cursor].forEach(function(node){
      if(!node) return;
      node.classList.remove('key-hit');
      void node.offsetWidth; /* force reflow so the animation restarts */
      node.classList.add('key-hit');
    });
  }
  function type(){
    if(wait>0){wait--;setTimeout(type,50);return;}
    const cur=phrases[pi];
    if(!deleting){
      if(ci<=cur.length){el.textContent=cur.slice(0,ci++);keyHit();setTimeout(type,ci===1?800:60);}
      else{deleting=true;wait=42;setTimeout(type,50);}
    }else{
      if(ci>0){el.textContent=cur.slice(0,--ci);keyHit();setTimeout(type,32);}
      else{deleting=false;pi=(pi+1)%phrases.length;setTimeout(type,180);}
    }
  }
  setTimeout(type,1700);
})();

/* ═══════════════════════════════════════════════════════════
   SHARED NEBULA — ONE fixed WebGL scene behind About → Skills →
   Projects → Education → Contact  (+ About's GSAP pin timeline)

   • #nebulaStage is a direct child of <body> (fixed, 100lvh) so no
     pinned / transformed ancestor can displace it.
   • Renders only while the viewport is between the top of #about
     and the bottom of #contact; hidden + loop stopped elsewhere.
   • Each section drives the shared camera `target` off ITS OWN
     scrubbed ScrollTrigger progress (no absolute-pixel measuring):
       A  About pin (tl.onUpdate)   z 30 → 280   (unchanged from before)
       B  #nebula-offset            z 280 → 60   (fly back in, drift)
       C  #education                z 60 → 45    (slow drift + tiny roll)
       D  #contact                  z 45 → 32    (settles)
     GSAP resolves each trigger's start/end against its current DOM
     position (pin-spacer included) on every refresh, so this stays
     correct as pin lengths change — a hand-measured global scroll
     offset is exactly what caused the camera to run away (and the
     nebula to go black) past About in the previous build.
   • One persistent .nebula-grade veil is mapped to the same scroll
     progress (replaces exit veil, seam bridge, .offset-grade).
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('[Nebula] three.js not found — nebula skipped.');
    return;
  }

  const section  = document.getElementById('about');
  const stage    = document.getElementById('nebulaStage');
  const canvas   = document.getElementById('threeCanvas');
  const vignette = stage && stage.querySelector('.nebula-vignette');
  const grade    = stage && stage.querySelector('.nebula-grade');
  if (!section || !stage || !canvas) return;

  /* ── Quality tier (N6) ───────────────────────────────────── */
  const LOW_END = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                  (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                  window.innerWidth <= 900;
  const Q = LOW_END ? 0.6 : 1;
  let   dprCap = Math.min(window.devicePixelRatio || 1, 1.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dprCap);
  renderer.setClearColor(0x000008, 1);

  let vw = stage.clientWidth  || window.innerWidth;
  let vh = stage.clientHeight || window.innerHeight;
  renderer.setSize(vw, vh, false);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, vw / vh, 0.1, 1000);
  camera.position.set(8, 2, 30);
  camera.lookAt(0, 0, 0);

  function makeSprite(r, g, b) {
    const sz = 128, c = document.createElement('canvas');
    c.width = c.height = sz;
    const ctx2 = c.getContext('2d');
    const grd  = ctx2.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz/2);
    grd.addColorStop(0,   'rgba('+r+','+g+','+b+',1)');
    grd.addColorStop(0.38,'rgba('+r+','+g+','+b+',0.5)');
    grd.addColorStop(1,   'rgba('+r+','+g+','+b+',0)');
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
  }

  function makeCloud(N,r,g,b,avgSize,ox,oy,oz) {
    const pos = new Float32Array(N*3);
    for (let i = 0; i < N; i++) {
      let px=0,py=0,pz=0;
      for (let j=0;j<4;j++){px+=Math.random()-.5;py+=Math.random()-.5;pz+=Math.random()-.5;}
      pos[i*3]=px*52+ox; pos[i*3+1]=py*34+oy; pos[i*3+2]=pz*42+oz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size:avgSize, map:makeSprite(r,g,b),
      transparent:true, opacity:0.16,
      blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true
    }));
  }

  let nebulaA = null, nebulaB = null, built = false;

  /* Scene construction is deferred to idle time (N6) — or forced the
     first time the stage becomes visible, whichever comes first. */
  function buildScene() {
    if (built) return;
    built = true;

    /* Stars */
    (function () {
      const N = Math.round(4500 * Q), pos = new Float32Array(N*3), colors = new Float32Array(N*3);
      const palette = [[1,1,1],[0.88,0.91,1],[0.73,0.90,0.99]];
      for (let i = 0; i < N; i++) {
        const r = 600 * Math.cbrt(Math.random());
        const θ = Math.random() * Math.PI * 2;
        const φ = Math.acos(2 * Math.random() - 1);
        pos[i*3]   = r*Math.sin(φ)*Math.cos(θ);
        pos[i*3+1] = r*Math.sin(φ)*Math.sin(θ);
        pos[i*3+2] = r*Math.cos(φ);
        const c = palette[Math.floor(Math.random()*palette.length)];
        colors[i*3]=c[0]; colors[i*3+1]=c[1]; colors[i*3+2]=c[2];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size:1.6, vertexColors:true, sizeAttenuation:true,
        transparent:true, opacity:0.9
      })));
    })();

    /* Nebula clouds */
    /* Offsets kept close enough to origin that the clouds stay inside
       the camera frustum across the whole shared-nebula z range
       (280 down to ~95) — not just About's own far view. Size/count
       trimmed vs. the original per-section values, and opacity above
       lowered, because tightening the spread packs points much
       denser — additive blending stacks that density into a blown-
       out white patch rather than a soft colored cloud otherwise. */
    nebulaA = makeCloud(Math.round(2000*Q), 99,102,241, 14, -90, 30, -25);
    nebulaB = makeCloud(Math.round(1200*Q), 34,211,238, 10,  95,-40, -10);
    scene.add(nebulaA, nebulaB);

    /* Dust */
    (function () {
      const N=Math.round(2000*Q), pos=new Float32Array(N*3), colors=new Float32Array(N*3);
      for (let i=0;i<N;i++){
        pos[i*3]=(Math.random()-.5)*400;
        pos[i*3+1]=(Math.random()-.5)*200;
        pos[i*3+2]=(Math.random()-.5)*300;
        const t=Math.random();
        colors[i*3]=(0.51+t*(0.13-0.51))*0.28;
        colors[i*3+1]=(0.55+t*(0.83-0.55))*0.28;
        colors[i*3+2]=(0.98+t*(0.93-0.98))*0.28;
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      geo.setAttribute('color',   new THREE.BufferAttribute(colors,3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size:0.6,vertexColors:true,sizeAttenuation:true,
        transparent:true,opacity:0.3,
        blending:THREE.AdditiveBlending,depthWrite:false
      })));
    })();
  }

  /* buildScene() is called synchronously below (setActive(true)) so
     the nebula is guaranteed present from the first frame — see the
     always-on render loop rationale further down. */

  function smoothstep(e0,e1,x){
    const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));
    return t*t*(3-2*t);
  }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  /* ── Resize: viewport-sized; ignore mobile address-bar jitter ── */
  window.addEventListener('resize', function () {
    const w = stage.clientWidth  || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    if (w === vw && Math.abs(h - vh) < 150) return;
    vw = w; vh = h;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }, { passive:true });

  /* ── Camera target + veil levels ─────────────────────────────
     Each section drives the shared `target` object off ITS OWN
     scrubbed ScrollTrigger progress (self.progress, always 0..1).
     No absolute-pixel measuring: GSAP resolves start/end against
     each trigger's current DOM position (pin-spacer included) on
     every refresh, so this stays correct as pin lengths change —
     unlike a hand-measured global scroll offset, which is exactly
     what produced the runaway camera / black nebula past About. */
  const target = { z:30, x:8, y:2, roll:0, grade:0, vig:1 };

  /* Segment A — About: set directly inside its own tl.onUpdate below
     (keeps the exact original identical-to-before motion). */

  /* Segment B — Skills + Projects: fly back in from About's far view.
     Floor kept at 150 (not all the way to 60) — the shared clouds
     sit off-axis and go out of frame if the camera gets much closer;
     see the cloud-offset comment above. */
  ScrollTrigger.create({
    trigger: '#nebula-offset',
    start:   'top top',
    end:     'bottom top',
    scrub:   1,
    onUpdate: function (self) {
      const t = self.progress;
      const e = t * t * (3 - 2 * t);
      target.z     = lerp(280, 150, e);
      target.x     = 14 * Math.sin(Math.PI * t);
      target.y     = 2 * Math.sin(2 * Math.PI * t);
      target.roll  = 0;
      target.grade = lerp(0.85, 0.48, smoothstep(0, 0.3, t));
      target.vig   = 0;
    }
  });

  /* Segment C — Education: slow drift + tiny roll */
  ScrollTrigger.create({
    trigger: '#education',
    start:   'top top',
    end:     'bottom top',
    scrub:   1.2,
    onUpdate: function (self) {
      const t = self.progress;
      target.z     = lerp(150, 125, t);
      target.x     = -10 * t;
      target.y     = 2 * Math.sin(Math.PI * t);
      target.roll  = 0.05 * Math.sin(Math.PI * t);
      target.grade = 0.48;
      target.vig   = 0;
    }
  });

  /* Segment D — Contact: settles */
  ScrollTrigger.create({
    trigger: '#contact',
    start:   'top top',
    end:     'bottom top',
    scrub:   1.2,
    onUpdate: function (self) {
      const t = self.progress;
      target.z     = lerp(125, 105, t);
      target.x     = -10 * (1 - t);
      target.y     = 0;
      target.roll  = 0;
      target.grade = 0.48;
      target.vig   = 0;
    }
  });

  /* ── Render loop ─────────────────────────────────────────── */
  let active = false, snap = true;
  let lastGrade = -1, lastVig = -1;
  let frames = 0, acc = 0, lastT = 0;

  function tick(now) {
    if (!active) return;
    requestAnimationFrame(tick);

    /* Light damping so the camera never steps; reduced-motion /
       first frame snaps straight to the target. */
    const k = (snap || REDUCE_MOTION) ? 1 : 0.14;
    snap = false;
    camera.position.z += (target.z - camera.position.z) * k;
    camera.position.x += (target.x - camera.position.x) * k;
    camera.position.y += (target.y - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
    if (target.roll) camera.rotateZ(target.roll);

    if (Math.abs(target.grade - lastGrade) > 0.002 && grade) {
      lastGrade = target.grade; grade.style.opacity = target.grade.toFixed(3);
    }
    if (Math.abs(target.vig - lastVig) > 0.002 && vignette) {
      lastVig = target.vig; vignette.style.opacity = target.vig.toFixed(3);
    }

    /* Idle ambient rotation is non-essential motion (Priority-2 §5) */
    if (!REDUCE_MOTION && nebulaA) {
      nebulaA.rotation.y += 0.0002;
      nebulaB.rotation.y -= 0.0001;
    }
    renderer.render(scene, camera);

    /* Adaptive DPR: if frames run slow for ~1s, step resolution down */
    if (lastT) {
      acc += now - lastT; frames++;
      if (frames >= 60) {
        if (acc / frames > 24 && dprCap > 1) {
          dprCap = Math.max(1, dprCap - 0.25);
          renderer.setPixelRatio(dprCap);
          renderer.setSize(vw, vh, false);
        }
        frames = 0; acc = 0;
      }
    }
    lastT = now;
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) {
      snap = true; lastT = 0; frames = 0; acc = 0;
      requestAnimationFrame(tick);
    }
  }

  /* Render continuously from load, same as the original per-section
     scenes did (each started its own RAF loop immediately on page
     load). A prior version tried to pause/hide the stage outside an
     About→Contact scroll range via a single ScrollTrigger onToggle;
     that toggle is exactly what could (and did) leave the stage
     stuck invisible/paused past Skills — a correctness bug far
     worse than the small perf cost of rendering while covered by
     the opaque Hero/Footer. Always-on removes that failure mode
     outright. #nebulaStage itself is always visibility:visible
     (see CSS) — Hero/Footer simply paint over it where it isn't
     wanted, exactly as before. */
  buildScene();
  setActive(true);

  let countersRun = false;
  function runCounters() {
    document.querySelectorAll('.about-stat-num[data-target]').forEach(function(el){
      var target=parseInt(el.dataset.target,10), obj={v:0};
      var suffix=(el.dataset.suffix!==undefined)?el.dataset.suffix:'+';
      gsap.to(obj,{v:target,duration:1.3,ease:'power2.out',
        onUpdate:function(){el.textContent=Math.floor(obj.v)+suffix;},
        onComplete:function(){el.textContent=target+suffix;}
      });
    });
  }

  /* §3 Pre-set Skills/Projects elements to hidden so the
     G3 generic reveals (now skipped for nebula-offset children)
     don't show them before About resolves. */
  gsap.set('.skill-category', { opacity: 0, y: 55 });
  gsap.set(
    '#nebula-offset .section-eyebrow, #nebula-offset .section-title, #nebula-offset .section-subtitle',
    { opacity: 0, y: 18 }
  );

  /* ── ABOUT SCROLL PIN TIMELINE ───────────────────────────
     scrub: 2.5  (was 2) for slower, more dramatic feel §2
     NEW zones in onUpdate:
       p 0.82–0.96 → exit veil desaturates About canvas (§2)
       p 0.86–1.00 → seam bridge gradient fades in (§1)
       p 0.88+     → Skills eyebrow/title bleed in early (§2)
  ─────────────────────────────────────────────────────────── */
  var tl = gsap.timeline({
    scrollTrigger: {
      trigger:       '#about',
      start:         'top top',
      end:           '+=150%',
      pin:           true,
      scrub:         2.5,
      anticipatePin: 1,
      onLeaveBack: function() {
        /* Scrolling back up past About: re-hide Skills headers so
           the bleed-in can replay */
        gsap.set(
          '#nebula-offset .section-eyebrow, #nebula-offset .section-title, #nebula-offset .section-subtitle',
          { opacity: 0, y: 18 }
        );
      },

      onUpdate: function(self) {
        var p = self.progress;
        window.__aboutScrollProgress = p;   /* read by astronaut.js — About-local 0–1 */

        /* Camera (segment A — identical to the original single-scene motion) */
        target.z     = 30 + 250 * p;
        target.x     = 8 * (1 - p);
        target.y     = 2 * (1 - p);
        target.roll  = 0;
        target.grade = smoothstep(0.82, 0.96, p) * 0.85;
        target.vig   = 1 - smoothstep(0.75, 1.0, p);

        /* SKILLS EARLY BLEED-IN — headers dissolve in from p=0.88 */
        if (p >= 0.88) {
          var hdrAlpha = smoothstep(0.88, 1.0, p);
          var hdrY     = (1 - hdrAlpha) * 18;
          document.querySelectorAll(
            '#nebula-offset .section-eyebrow, #nebula-offset .section-title, #nebula-offset .section-subtitle'
          ).forEach(function(el) {
            el.style.opacity   = hdrAlpha.toFixed(3);
            el.style.transform = 'translateY(' + hdrY.toFixed(1) + 'px)';
          });
        }

        /* Stat counters */
        if (!countersRun && p >= 0.91) { countersRun = true; runCounters(); }
      }
    }
  });

  tl
    .to('.about-left-col',  { opacity:1, duration:0.15 }, 0.65)
    .to('.about-right-col', { opacity:1, duration:0.15 }, 0.65)
    .to('.about-eyebrow',   { opacity:1, y:0, duration:0.10 }, 0.72)
    .to('.about-heading',   { opacity:1, y:0, duration:0.12 }, 0.78)
    .to('.about-body',      { opacity:1, y:0, duration:0.10 }, 0.85)
    .to('.about-chips',     { opacity:1, y:0, duration:0.08 }, 0.91)
    .to('.about-cta-row',   { opacity:1, y:0, duration:0.08 }, 0.96);

  /* ── §3  POST-SEAM CARD REVEAL ───────────────────────────
     Replaces the old G3 ScrollTrigger.batch for .skill-category
     and .project-card. Fires when #nebula-offset enters the
     viewport (after About unpins), with delays relative to
     the bridge fade so cards never appear before the seam
     gradient has resolved.

     Timing rationale:
       0.15s  → bridge is ~60% faded in; headers are already visible
       0.30s  → bridge fully settled; safe to reveal skill cards
     (Project cards are no longer part of this batch — the whole
     showcase now fades in once, on first entry, from the
     "PROJECTS SHOWCASE" block further down; individual cards are
     positioned/scaled by the scroll-scrubbed carousel, not revealed
     one-by-one.) */
  ScrollTrigger.create({
    trigger: '#nebula-offset',
    start:   'top 80%',
    once:    true,
    onEnter: function() {
      gsap.to('.skill-category', {
        opacity: 1, y: 0,
        stagger:  0.13,
        duration: 0.85,
        ease:     'power3.out',
        delay:    0.30
      });
    }
  });

})();

/* ═══════════════════════════════════════════════════════════
   PROJECTS SHOWCASE — pinned zone + centred card carousel
   Sits strictly between About (ends) and Education (starts).

   #nebula-offset is pinned while a single scrubbed timeline drives
   two consecutive phases off one progress value:

     phase A  (0 → introFrac)   #hscrollTrack slides left exactly one
                                panel-width: Skills out, Projects in.
     phase B  (introFrac → 1)   the track holds still — only the cards
                                inside .projects-stage move, one
                                project per "step" of scroll.

   Because the track stops moving in phase B, the Projects header
   (which lives in the pinned panel, above the stage) stays exactly
   where it is for the whole horizontal exploration, and leaves the
   viewport naturally when the pin releases into Education. No
   position:fixed is used anywhere.

   Everything written per frame is transform / opacity / a CSS custom
   property — never a layout property — so scrubbing never reflows.
   Card classes and tabindex are only touched when the active index
   actually changes, not every frame.

   Desktop/tablet only (≥901px, no prefers-reduced-motion).
   gsap.matchMedia() creates the pin only in that media state and
   reverts it the moment the query stops matching, so mobile /
   reduced-motion always gets the native swipe carousel below and
   never a half-applied transform.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const section = document.getElementById('nebula-offset');
  const track   = document.getElementById('hscrollTrack');
  const stage   = document.getElementById('projectsStage');
  const rail    = document.getElementById('projectsRail');
  if (!section || !track || !stage || !rail) return;

  const cards = Array.prototype.slice.call(rail.querySelectorAll('.project-card'));
  const dots  = Array.prototype.slice.call(document.querySelectorAll('#projectDots .project-dot'));
  const N     = cards.length;
  if (!N) return;

  const panelCount = gsap.utils.toArray('.hscroll-panel', track).length; // 2: Skills + Projects

  /* ── Active-project bookkeeping (shared by both breakpoints) ──
     Only runs on an actual change of index — never per frame. */
  let activeIndex = -1;
  function setActive(i) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === activeIndex) return;
    activeIndex = i;
    cards.forEach(function (c, k) {
      const on = (k === i);
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-current', on ? 'true' : 'false');
      /* keyboard focus must not land inside a dimmed side card */
      c.querySelectorAll('a, button').forEach(function (el) {
        el.setAttribute('tabindex', on ? '0' : '-1');
      });
    });
    dots.forEach(function (d, k) {
      const on = (k === i);
      d.classList.toggle('is-current', on);
      d.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }
  setActive(0);

  /* Safety net for the section header. The Skills/Projects headings are
     normally faded in by the About pin's scrub (it sets inline opacity
     from p >= 0.88), but that whole block bails out early if three.js
     fails to load — which would leave the Projects heading stuck at
     opacity:0, i.e. exactly the thing this section must never do.
     Fires once, at a point where About has already finished its own
     fade to 1, so it can't fight the scrub. */
  ScrollTrigger.create({
    trigger: section,
    start:   'top 60%',
    once:    true,
    onEnter: function () {
      document.querySelectorAll(
        '#nebula-offset .section-eyebrow, #nebula-offset .section-title, #nebula-offset .section-subtitle'
      ).forEach(function (el) {
        if (parseFloat(getComputedStyle(el).opacity) < 1) {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
        }
      });
    }
  });

  const mm = gsap.matchMedia();

  /* ═══ DESKTOP / TABLET — pinned scroll-scrubbed carousel ═══ */
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', function () {

    /* One panel = 100vw = (100 / panelCount)% of the track's own width,
       so the handoff is expressed as a percentage and stays correct
       through a resize without re-measuring. Written straight to
       style.transform rather than through GSAP: it's one string per
       frame on one element, and it keeps the track out of GSAP's
       transform cache so nothing can fight over it. */
    const HANDOFF = 100 * (panelCount - 1) / panelCount;   // 50 for 2 panels
    function setTrackX(pct) {
      track.style.transform = 'translate3d(' + pct.toFixed(3) + '%,0,0)';
    }

    let cardW = 340, spacing = 330;
    function measure() {
      cardW   = cards[0].offsetWidth || 340;
      /* active half-width + neighbour half-width (at 0.81 scale) + a
         small gap: the immediate neighbours sit clear of the active
         card without drifting off into empty space. */
      spacing = cardW * 0.94 + 18;
    }

    /* Coverflow-style compression: the first step out from centre is
       full width, the ones beyond it are progressively squeezed, so
       cards 3+ still peek in at the edges of the stage instead of
       being pushed clean out of view. */
    function xFor(off) {
      const a = Math.abs(off);
      const s = off < 0 ? -1 : 1;
      const a1 = Math.min(a, 1);
      const a2 = Math.min(a, 2) - a1;
      const a3 = Math.min(a, 3.4) - Math.min(a, 2);
      return s * spacing * (a1 + a2 * 0.74 + a3 * 0.5);
    }

    /* Scroll budget: one viewport-width for the Skills→Projects
       handoff, then a shorter step per project so stepping through six
       projects doesn't feel like an endless corridor. */
    function introLen()  { return window.innerWidth; }
    function stepLen()   { return window.innerWidth * 0.62; }
    function pinLen()    { return introLen() + (N - 1) * stepLen(); }
    function introFrac() { return introLen() / pinLen(); }

    /* pos is a continuous float index (2.4 = 40% of the way from card
       3 to card 4), so every card lands on a smooth interpolated
       transform rather than snapping between states. */
    function layout(pos) {
      for (let i = 0; i < N; i++) {
        const off = i - pos;
        const a   = Math.abs(off);
        const s   = Math.max(0.42, 1 - Math.min(a, 3) * 0.19);
        const o   = a > 2.9 ? 0 : Math.max(0, 1 - a * 0.33);
        const st  = cards[i].style;
        st.transform = 'translate(-50%,-50%) translate3d(' +
                       xFor(off).toFixed(1) + 'px,0,0) scale(' + s.toFixed(3) + ')';
        st.opacity = o.toFixed(3);
        st.zIndex  = String(120 - Math.round(a * 10));
        /* information area: subtle fade + translateY as focus moves */
        st.setProperty('--content-op', Math.max(0, 1 - Math.min(a, 1) * 0.62).toFixed(3));
        st.setProperty('--content-y', (Math.min(a, 1) * 14).toFixed(1) + 'px');
      }
      setActive(Math.round(pos));
    }

    let stageShown = false;
    function showStage(animate) {
      if (stageShown) return;
      stageShown = true;
      if (animate) {
        gsap.to(stage, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
      } else {
        gsap.set(stage, { opacity: 1, y: 0 });
      }
    }

    function render(p, animate) {
      const f = introFrac();
      let handoff, pos;
      if (p < f) { handoff = p / f;                       pos = 0; }
      else       { handoff = 1; pos = (N > 1 ? (p - f) / (1 - f) * (N - 1) : 0); }
      setTrackX(-HANDOFF * handoff);
      layout(pos);
      if (handoff > 0.3) showStage(animate !== false);
    }

    measure();
    render(0, false);

    /* The timeline tweens a plain object; ScrollTrigger's `scrub`
       smooths that object's value, and we render from the *tween's*
       onUpdate (not the trigger's) so what's drawn is the eased value
       rather than the raw scroll position — that's where the "no
       stutter, no sudden jump" feel comes from. */
    const state = { p: 0 };
    const tween = gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: function () { render(state.p, true); },
      scrollTrigger: {
        trigger:             section,
        start:               'top top',
        end:                 function () { return '+=' + pinLen(); },
        pin:                 true,
        scrub:               1,
        anticipatePin:       1,
        invalidateOnRefresh: true,
        /* Covers a hard refresh or a direct #projects anchor jump that
           lands the scrub already mid-section: re-measure for the new
           viewport and draw the correct end-state immediately. */
        onRefresh: function (self) {
          measure();
          render(self.progress, false);
        }
      }
    });

    /* Programmatic navigation (dots / side-card clicks / arrow keys)
       moves the *page* to the scroll position that centres project n,
       so the pin's own scrub draws the move exactly as if the user had
       scrolled there by hand — one scroll mechanism, not two. */
    window.__projectsPinned = true;
    window.__projectsGoTo = function (n) {
      const st = tween.scrollTrigger;
      if (!st) return;
      const i = Math.max(0, Math.min(N - 1, n - 1));
      const f = introFrac();
      const p = (N > 1) ? f + (i / (N - 1)) * (1 - f) : 1;
      window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: 'smooth' });
    };

    return function () {
      window.__projectsGoTo = null;
      window.__projectsPinned = false;
      tween.scrollTrigger && tween.scrollTrigger.kill();
      tween.kill();
      track.style.transform = '';
      gsap.set(stage, { clearProps: 'opacity,transform' });
      cards.forEach(function (c) { c.style.cssText = ''; });
    };
  });

  /* ═══ MOBILE (≤900px) / REDUCED MOTION — native swipe carousel ═══
     No pin, no scrubbed transform: .projects-stage is a real
     scroll-snap scroller, so the browser owns the momentum and the
     card still keeps thumbnail-above-information. We only listen in
     order to keep the dots and the active state in sync. */
  mm.add('(max-width: 900px), (prefers-reduced-motion: reduce)', function () {
    gsap.set(stage, { clearProps: 'opacity,transform' });
    cards.forEach(function (c) { c.style.cssText = ''; });

    let frame = 0;
    function sync() {
      frame = 0;
      const mid = stage.scrollLeft + stage.clientWidth / 2;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < N; i++) {
        const d = Math.abs((cards[i].offsetLeft + cards[i].offsetWidth / 2) - mid);
        if (d < bestD) { bestD = d; best = i; }
      }
      setActive(best);
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(sync); }

    stage.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(sync);

    window.__projectsPinned = false;
    window.__projectsGoTo = function (n) {
      const c = cards[Math.max(0, Math.min(N - 1, n - 1))];
      if (!c) return;
      stage.scrollTo({
        left: c.offsetLeft - (stage.clientWidth - c.offsetWidth) / 2,
        behavior: REDUCE_MOTION ? 'auto' : 'smooth'
      });
    };

    return function () {
      stage.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      window.__projectsGoTo = null;
    };
  });

})();

/* ═══════════════════════════════════════════════════════════
   PROJECTS — pagination / side-card / keyboard navigation
   One delegated listener. Whichever breakpoint is live has published
   its own window.__projectsGoTo (pinned-scrub on desktop, scroll-snap
   on mobile), so there is never a second competing scroll mechanism;
   scrollIntoView is only a last-resort fallback if neither exists.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const zone = document.getElementById('nebula-offset');
  if (!zone) return;

  function goTo(n) {
    if (typeof window.__projectsGoTo === 'function') { window.__projectsGoTo(n); return; }
    const card = document.querySelector('.project-card[data-project="' + n + '"]');
    if (card) card.scrollIntoView({
      behavior: REDUCE_MOTION ? 'auto' : 'smooth', block: 'center', inline: 'center'
    });
  }

  zone.addEventListener('click', function (e) {
    const dot = e.target.closest('.project-dot');
    if (dot) {
      const n = parseInt(dot.getAttribute('data-goto'), 10);
      if (n) goTo(n);
      return;
    }
    /* Clicking a dimmed side card brings it to the centre rather than
       following its (deliberately disabled) link. */
    const card = e.target.closest('.project-card');
    if (card && !card.classList.contains('is-active')) {
      const n = parseInt(card.getAttribute('data-project'), 10);
      if (n) { e.preventDefault(); goTo(n); }
    }
  });

  /* The navbar's "Projects" link points at #projects, which lives
     inside the pinned panel — a native anchor jump there lands on the
     pin's start, i.e. still on Skills. Route it through the showcase's
     own navigation so it lands on project 01 instead. */
  const navLink = document.querySelector('.nav-links a[href="#projects"]');
  if (navLink) {
    navLink.addEventListener('click', function (e) {
      /* Mobile/reduced-motion has no pin — there the link should do
         its normal vertical jump to the section, and __projectsGoTo
         only moves the swipe rail sideways. */
      if (!window.__projectsPinned || typeof window.__projectsGoTo !== 'function') return;
      e.preventDefault();
      window.__projectsGoTo(1);
    });
  }

  /* Left/Right arrows step through projects from the pagination row. */
  const dotsWrap = document.getElementById('projectDots');
  if (dotsWrap) {
    dotsWrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const list = Array.prototype.slice.call(dotsWrap.querySelectorAll('.project-dot'));
      let cur = -1;
      list.forEach(function (d, i) { if (d.classList.contains('is-current')) cur = i; });
      if (cur < 0) return;
      const next = Math.max(0, Math.min(list.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      if (next === cur) return;
      e.preventDefault();
      goTo(next + 1);
      list[next].focus();
    });
  }
})();

/* ═══════════════════════════════════════════════════════════
   EDUCATION — GSAP Scroll-Driven Horizontal Timeline
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const section = document.getElementById('education');
  const wrap    = document.getElementById('edu-timeline-wrap');
  if (!section || !wrap) return;

  if (window.innerWidth <= 680) return;

  const svgEl    = document.getElementById('edu-svg');
  const track    = document.getElementById('edu-track');
  const line     = document.getElementById('edu-line');
  const gradEl   = document.getElementById('edu-line-grad');
  /* AstroDocX: node count comes from the DOM (was hard-coded to 2). */
  const circles = Array.prototype.slice.call(svgEl.querySelectorAll('.edu-circle'));
  const cards   = Array.prototype.slice.call(wrap.querySelectorAll('.edu-card'));

  function measureNodes() {
    const wrapRect = wrap.getBoundingClientRect();
    const slots    = wrap.querySelectorAll('.edu-card-slot');
    const cx = [];
    slots.forEach(function(slot) {
      const r = slot.getBoundingClientRect();
      cx.push(r.left + r.width / 2 - wrapRect.left);
    });
    return cx;
  }

  function setupSVG() {
    const wrapRect = wrap.getBoundingClientRect();
    const cx = measureNodes();
    const svgH = 80;

    gradEl.setAttribute('x1', cx[0]);
    gradEl.setAttribute('x2', cx[cx.length - 1]);

    track.setAttribute('x1', cx[0]);
    track.setAttribute('y1', svgH / 2);
    track.setAttribute('x2', cx[cx.length - 1]);
    track.setAttribute('y2', svgH / 2);

    const lineLen = cx[cx.length - 1] - cx[0];
    line.setAttribute('x1', cx[0]);
    line.setAttribute('y1', svgH / 2);
    line.setAttribute('x2', cx[cx.length - 1]);
    line.setAttribute('y2', svgH / 2);
    line.style.strokeDasharray  = lineLen;
    line.style.strokeDashoffset = lineLen;

    circles.forEach(function(circle, idx) {
      circle.setAttribute('cx', cx[idx] || cx[0]);
      circle.setAttribute('cy', svgH / 2);
    });

    return { cx, lineLen, svgH };
  }

  requestAnimationFrame(function () {
    const { cx, lineLen } = setupSVG();
    if (lineLen <= 0) return;

    const nodeT = cx.map(function(x) {
      return (x - cx[0]) / lineLen;
    });

    /* Each node reveals once the line reaches it. Later nodes trigger a
       little early (×0.78, as the template did for its last node) so the
       final card is fully revealed before the section scrolls away. */
    const flipped = cards.map(function () { return false; });
    const thresholds = nodeT.map(function (t, i) { return i === 0 ? 0 : t * 0.78; });

    ScrollTrigger.create({
      trigger: section,
      start:   'top 60%',
      end:     'bottom 70%',
      scrub:   1.4,
      onUpdate: function (self) {
        const p = self.progress;
        line.style.strokeDashoffset = lineLen * (1 - p);
        for (let i = 0; i < cards.length; i++) {
          if (!flipped[i] && p >= thresholds[i]) {
            flipped[i] = true;
            if (circles[i]) gsap.to(circles[i], { opacity: 1, duration: 0.35, ease: 'power2.out' });
            gsap.to(cards[i], {
              rotateX: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.4)',
              transformOrigin: 'top center'
            });
          }
        }
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth <= 680) return;
      setupSVG();
    }, { passive: true });
  });

})();

/* ═══════════════════════════════════════════════════════════
   CONTACT — Form Handler + Signal-Sent Animation
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const form      = document.getElementById('contact-form');
  const statusEl  = document.getElementById('form-status');
  const submitBtn = document.getElementById('contact-submit-btn');
  if (!form || !submitBtn) return;

  const formArea = form.closest('.contact-form-area') || form.parentElement;
  const flashEl  = document.createElement('div');
  flashEl.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:inherit',
    'background:radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.18) 0%, transparent 70%)',
    'pointer-events:none',
    'opacity:0',
    'z-index:10',
    'transition:opacity 0.15s ease'
  ].join(';');
  formArea.style.position = 'relative';
  formArea.appendChild(flashEl);

  function setBtnLoading() {
    submitBtn.disabled   = true;
    submitBtn.textContent = 'Sending…';
    gsap.to(submitBtn, { opacity: 0.70, scale: 0.97, duration: 0.2 });
  }

  function setBtnSuccess() {
    submitBtn.textContent = '✓ Sent!';
    gsap.to(submitBtn, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.6)' });
    gsap.fromTo(submitBtn,
      { boxShadow: '0 0 0 0 rgba(34,211,238,0.55)' },
      { boxShadow: '0 0 0 12px rgba(34,211,238,0)', duration: 0.9, ease: 'power2.out' }
    );
  }

  function setBtnError() {
    submitBtn.disabled   = false;
    submitBtn.textContent = 'Send Message';
    gsap.to(submitBtn, { opacity: 1, scale: 1, duration: 0.2 });
    gsap.fromTo(submitBtn,
      { x: 0 },
      { x: 8, duration: 0.07, ease: 'power2.out', yoyo: true, repeat: 5,
        onComplete: () => gsap.set(submitBtn, { x: 0 }) }
    );
  }

  function resetBtn() {
    setTimeout(function () {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send Message';
      gsap.to(submitBtn, { opacity: 1, scale: 1, duration: 0.3 });
    }, 3200);
  }

  function flashSuccess() {
    flashEl.style.opacity = '1';
    setTimeout(function () { flashEl.style.opacity = '0'; }, 220);
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className   = 'form-status ' + type;
    gsap.fromTo(statusEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  }

  function clearStatus() {
    gsap.to(statusEl, { opacity: 0, duration: 0.2, onComplete: () => { statusEl.textContent = ''; statusEl.className = 'form-status'; } });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearStatus();
    setBtnLoading();

    try {
      const fd = new FormData(form);
      if (!String(fd.get('subject') || '').trim()) {
        fd.set('subject', 'AstroDocX message from ' + (fd.get('name') || 'a visitor'));
      }
      const res = await fetch(form.action, {
        method:  'POST',
        body:    fd,
        headers: { 'Accept': 'application/json' }
      });
      let data = {};
      try { data = await res.json(); } catch (_e) {}

      if (res.ok && data.success) {
        flashSuccess();
        setBtnSuccess();
        showStatus('✓ Message sent! We\'ll get back to you soon.', 'success');
        gsap.to(form.querySelectorAll('.form-group'), {
          opacity: 0.4, duration: 0.4, stagger: 0.06, ease: 'power2.out',
          onComplete: function () {
            form.reset();
            gsap.to(form.querySelectorAll('.form-group'), {
              opacity: 1, duration: 0.5, stagger: 0.06, delay: 0.5
            });
          }
        });
        resetBtn();
      } else {
        throw new Error('Server error');
      }
    } catch (_err) {
      setBtnError();
      showStatus('✗ Something went wrong. Please reach us on GitHub.', 'error');
    }
  });

  form.querySelectorAll('input, textarea').forEach(function (field) {
    field.addEventListener('focus', function () {
      gsap.to(field, { scale: 1.008, duration: 0.2, ease: 'power2.out' });
    });
    field.addEventListener('blur', function () {
      gsap.to(field, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
    });
  });

})();

/* ─── COPY EMAIL BUTTON ──────────────────────────────────── */
(function () {
  'use strict';
  const btn = document.getElementById('copy-email-btn');
  if (!btn) return;
  /* AstroDocX: the Team section's Copy button copies the repo URL. */
  const email = REPO_URL;
  btn.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(email);
    } catch (_err) {
      const ta = document.createElement('textarea');
      ta.value = email;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1800);
  });
})();

/* ─── PROJECT CARD QUICK ACTION: COPY REPO LINK ─────────────
   Priority-3 §10 micro-interaction polish. */
(function () {
  'use strict';
  const buttons = document.querySelectorAll('.project-copy-btn');
  if (!buttons.length) return;
  buttons.forEach(function (btn) {
    const url = btn.dataset.repo;
    if (!url) return;
    btn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(url);
      } catch (_err) {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1800);
    });
  });
})();

}); /* end DOMContentLoaded */