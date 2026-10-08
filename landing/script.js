/* ═══════════════════════════════════════════════════════════
   ASTRODOCX — LANDING MAIN SCRIPT
   The page is one particle journey (#journey: #universe intro →
   #twin Health Twin → #astrodocx) → footer. The journey and the
   tour have their own files; this one holds the shared bits: nav,
   typewriter, back-to-top.
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {

gsap.registerPlugin(ScrollTrigger);
window.addEventListener('load', () => ScrollTrigger.refresh());

/* single source of truth for "does this visitor want reduced motion" */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let navVisible = true;

/* ── Navbar: solid after 44px, hides on scroll down, shows on scroll up, active link from live positions ── */
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
      if (window.scrollY < 120) {
        if (!navVisible) { gsap.to(navbar, { yPercent: 0, duration: 0.4, ease: 'power2.out' }); navVisible = true; }
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
  const ids = Array.from(links).map(a => a.getAttribute('href').slice(1)).filter(Boolean);
  let last;
  function sync() {
    const probe = window.innerHeight * 0.45;
    let cur = null;
    if (window.ADX_JOURNEY && ADX_JOURNEY.live) cur = ADX_JOURNEY.section();       // the three sections are layers of one pin
    else if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) cur = ids[ids.length - 1] || null;
    else ids.forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= probe) cur = id; });
    if (cur === last) return;
    last = cur;
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
  }
  let tick = false;
  window.addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; sync(); }); }, { passive: true });
  ScrollTrigger.addEventListener('refresh', sync);
  window.addEventListener('load', () => setTimeout(sync, 300));
})();

/* ── Mobile nav toggle ── */
(function () {
  const navbar   = document.getElementById('navbar');
  const toggle   = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    if (open && !navVisible) { gsap.to(navbar, { yPercent: 0, duration: 0.3 }); navVisible = true; }
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => { navLinks.classList.remove('open'); toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', false); });
  });
})();

/* ── Back to top ── */
(function () {
  const btn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => { btn.classList.toggle('visible', window.scrollY > 400); }, { passive: true });
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();

/* ── Footer year ── */
document.getElementById('footer-year').textContent = new Date().getFullYear();

/* ── Typewriter on the AstroDocX reveal ── */
(function () {
  const phrases = ['detecting drift…', 'explaining the change…', 'acting on the card…', 'syncing to Earth…'];
  let pi = 0, ci = 0, deleting = false, wait = 0;
  const el = document.getElementById('hero-typed');
  if (!el) return;
  const cursor = document.querySelector('.hero-cursor');
  /* retrigger the CSS "key hit" animation on every character (skipped under reduced motion) */
  function keyHit() {
    if (REDUCE_MOTION) return;
    [el, cursor].forEach(function (node) {
      if (!node) return;
      node.classList.remove('key-hit');
      void node.offsetWidth;
      node.classList.add('key-hit');
    });
  }
  function type() {
    if (wait > 0) { wait--; setTimeout(type, 50); return; }
    const cur = phrases[pi];
    if (!deleting) {
      if (ci <= cur.length) { el.textContent = cur.slice(0, ci++); keyHit(); setTimeout(type, ci === 1 ? 800 : 60); }
      else { deleting = true; wait = 42; setTimeout(type, 50); }
    } else {
      if (ci > 0) { el.textContent = cur.slice(0, --ci); keyHit(); setTimeout(type, 32); }
      else { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(type, 180); }
    }
  }
  if (REDUCE_MOTION) { el.textContent = phrases[0]; return; }
  setTimeout(type, 1200);
})();

});
