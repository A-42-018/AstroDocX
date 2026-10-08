/*
 * Tour mode for the project video: open the page with ?tour=1 and it scrolls itself top to bottom at a
 * steady, eased pace, so a screen recording is smooth (no shaky wheel). Nothing runs without the flag.
 *
 *   ?tour=1            start after a short lead-in
 *   &speed=1.25        faster (default 1; 0.8 is slower)
 *   &delay=4           lead-in seconds before the first move (default 3)
 *
 * Keys: Space pause/resume · Esc stop and give the page back · R restart from the top.
 * The cursor and the back-to-top button are hidden while touring. Edit PLAN to change pacing.
 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (q.get('tour') !== '1') return;

  var speed = Math.max(0.25, parseFloat(q.get('speed')) || 1);
  var lead = Math.max(0, isNaN(parseFloat(q.get('delay'))) ? 3 : parseFloat(q.get('delay')));

  /* One entry per section: how long to hold when the section's top reaches the screen (s), then the scroll
     speed through the section (px/s) until the next section's top.
     Pinned sections are tall because of their pin spacer, so their speed sets the pace of the story. */
  var PLAN = [
    { id: 'universe', hold: 0,  pps: 320 },
    { id: 'about',     hold: 1,  pps: 260 },
    { id: 'nebula-offset', hold: 0, pps: 300 },
    { id: 'twin',      hold: 1,  pps: 230 },
    { id: 'sim',       hold: 27, pps: 300, action: 'sim' } /* "Play scenario" runs about 25 s, only while on screen */,
    { id: 'education', hold: 1,  pps: 280 },
    { id: 'built',     hold: 2,  pps: 300 },
    { id: 'contact',   hold: 6,  pps: 300 }
  ];

  var style = document.createElement('style');
  style.textContent = 'html.touring, html.touring * { cursor: none !important; } html.touring #back-to-top { display: none !important; }';
  document.head.appendChild(style);

  var paused = false, stopped = false, raf = 0, timers = [];
  function later(fn, s) { var t = setTimeout(fn, s * 1000); timers.push(t); }
  function maxScroll() { return document.documentElement.scrollHeight - innerHeight; }
  function topOf(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    // A pinned section sits inside a pin-spacer; its spacer's top is the true position in the document.
    var box = (el.parentElement && /pin-spacer/.test(el.parentElement.className)) ? el.parentElement : el;
    return Math.max(0, Math.round(box.getBoundingClientRect().top + scrollY));
  }

  function run() {
    stopped = false;
    scrollTo(0, 0);
    var i = 0;
    function section() {
      if (stopped) return;
      if (i >= PLAN.length) return finish();
      var s = PLAN[i], start = topOf(s.id);
      if (start === null) { i++; return section(); }
      var next = PLAN[i + 1] && topOf(PLAN[i + 1].id);
      var end = next !== null && next !== undefined ? next : maxScroll();
      end = Math.min(end, maxScroll());
      if (s.id === 'universe' && window.ADX_UNIVERSE && ADX_UNIVERSE.yAt(0) !== undefined && ADX_UNIVERSE.stops) {
        /* the particle intro: stop at each scene's hold (dwell per scene in scenes.js `tour`), slow glides between so the morphs read */
        var stops = ADX_UNIVERSE.stops();
        (function step(k) {
          if (stopped) return;
          if (k >= stops.length) return glide(scrollY, end, s.pps * speed, function () { i++; section(); });
          glide(scrollY, ADX_UNIVERSE.yAt(stops[k].p), 330 * speed, function () { later(function () { step(k + 1); }, stops[k].hold / speed); });
        })(0);
        return;
      }
      if (s.action === 'sim') later(function () { var b = document.getElementById('simPlay'); if (b) b.click(); }, 1 / speed);
      later(function () { glide(scrollY, end, s.pps * speed, function () { i++; section(); }); }, s.hold / speed);
    }
    section();
  }

  /* Trapezoid velocity: ease in over the first 5%, steady, ease out over the last 5%. Position 0..1 for progress 0..1. */
  function ease(p) {
    var a = 0.05;
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    if (p < a) return p * p / (2 * a * (1 - a));
    if (p > 1 - a) return 1 - (1 - p) * (1 - p) / (2 * a * (1 - a));
    return (p - a / 2) / (1 - a);
  }

  /* Move from `from` to `to` at about `pps` px/s with a short ease-in and ease-out at the ends. */
  function glide(from, to, pps, done) {
    if (!pps || to <= from) return done();
    var dist = to - from, dur = dist / pps, t0 = performance.now(), lost = 0, last = t0;
    cancelAnimationFrame(raf);
    (function frame(now) {
      if (stopped) return;
      if (paused) { lost += now - last; last = now; raf = requestAnimationFrame(frame); return; }
      last = now;
      var p = Math.min(1, (now - t0 - lost) / 1000 / dur);
      scrollTo(0, from + dist * ease(p));
      if (p < 1) raf = requestAnimationFrame(frame); else done();
    })(t0);
  }

  function finish() { document.documentElement.classList.remove('touring'); document.title += ' (tour finished)'; }
  function stop() { stopped = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; finish(); }

  addEventListener('keydown', function (e) {
    if (e.key === ' ') { paused = !paused; e.preventDefault(); }
    else if (e.key === 'Escape') stop();
    else if (e.key === 'r' || e.key === 'R') { stop(); document.documentElement.classList.add('touring'); run(); }
  });
  // Any manual wheel or touch input hands control back.
  ['wheel', 'touchstart'].forEach(function (ev) { addEventListener(ev, function () { if (!stopped) stop(); }, { passive: true }); });

  addEventListener('load', function () {
    document.documentElement.classList.add('touring');
    scrollTo(0, 0);
    later(run, lead);
  });
})();
