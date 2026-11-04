/*
 * The tours of the landing site. Loaded by both the Mission Briefing homepage (index.html, body[data-page=briefing])
 * and the scroll story (story.html, body[data-page=story]).
 *
 * 1-click tour (for judges): any [data-tour-start] button, or opening / with ?tour=full. A control bar shows the
 * chapter, a caption and progress (Pause · Skip · Exit). On the homepage, chapter 1 is the briefing room: VITA plays
 * her 4-step intro (window.ADX_BRIEFING, briefing/briefing.js). On the story page it scrolls the particle journey.
 * Either way it then opens the Crew Console with ?tour=1, which carries on through the console and the 3D cabin
 * (app/src/tour). About two minutes in all. A scroll or tap pauses it; Space pauses, Esc exits.
 *
 * Video mode (for the project video): ?tour=1 scrolls the story by itself with no controls, so a screen recording is
 * smooth (/?tour=1 forwards to /story.html?tour=1).
 *   &speed=1.25   faster (default 1; 0.8 is slower)
 *   &delay=4      lead-in seconds before the first move (default 3)
 * Keys: Space pause/resume · Esc stop and give the page back · R restart from the top.
 * The cursor and the back-to-top button are hidden while recording. Edit PLAN to change pacing.
 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var mode = q.get('tour');                    // '1' video, 'full' 1-click from a link
  /* Which tour: 'quick' (about two minutes) or 'full' (the whole project, VITA narrating every screen). /?tour=full&mode=full
     starts the full one from a link; the chat's "give me the full tour" and the dock in the console ask for it too. */
  var guide = q.get('mode') === 'full' ? 'full' : 'quick';
  function consoleUrl() { return '/app/?tour=1' + (guide === 'full' ? '&mode=full' : ''); }
  var BRIEF = !!document.body && document.body.getAttribute('data-page') === 'briefing';
  /* the video mode scrolls the particle story, which now lives on its own page */
  if (BRIEF && mode === '1') { location.replace('/story.html' + location.search + location.hash); return; }

  /* One entry per section: how long to hold when the section's top reaches the screen (s), then the scroll
     speed through the section (px/s) until the next section's top.
     Pinned sections are tall because of their pin spacer, so their speed sets the pace of the story. */
  var PLAN = [
    { id: 'journey', hold: 0,  pps: 320 },
    { id: 'footer',  hold: 3,  pps: 300 }
  ];

  /* Pacing per tour: `speed` scales the glides, `holdScale` the dwell at each stop (video mode: both by &speed).
     The 1-click tour glides at 0.8 screen heights a second and halves the dwells, so the page takes about 40 s. */
  var cfg = { speed: 1, holdScale: 1, oneClick: false };

  var style = document.createElement('style');
  style.textContent =
    'html.touring, html.touring * { cursor: none !important; } html.touring #back-to-top { display: none !important; }' +
    '.adx-tourbar{position:fixed;z-index:200;left:50%;bottom:24px;transform:translateX(-50%);width:min(620px,calc(100% - 24px));padding:10px 14px 0;' +
      'background:rgba(6,16,30,.86);border:1px solid rgba(34,211,238,.45);border-radius:12px;color:#E0FBFF;font:500 13px/1.45 Inter,system-ui,sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);overflow:hidden;animation:adxTourIn .4s ease}' +
    '@keyframes adxTourIn{from{opacity:0;translate:0 12px}}' +
    '.adx-tourbar .tb-row{display:flex;align-items:center;justify-content:space-between;gap:12px}' +
    '.adx-tourbar ol{display:flex;gap:12px;margin:0;padding:0;list-style:none;font:600 12px Inter,system-ui,sans-serif;color:rgba(170,214,232,.74)}' +
    '.adx-tourbar li{display:flex;align-items:center;gap:6px;white-space:nowrap}' +
    '.adx-tourbar li b{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;border:1px solid rgba(150,200,220,.32);font:600 10px "JetBrains Mono",monospace}' +
    '.adx-tourbar li.on{color:#9ff4ff}.adx-tourbar li.on b{background:#22D3EE;border-color:#22D3EE;color:#02131a;box-shadow:0 0 10px rgba(34,211,238,.55)}' +
    '.adx-tourbar .tb-ctl{display:flex;gap:4px}' +
    '.adx-tourbar button{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:7px;cursor:var(--cur-pointer,pointer);font:600 12px Inter,system-ui,sans-serif;color:rgba(214,238,250,.88);background:none;border:1px solid transparent}' +
    '.adx-tourbar button:hover{background:rgba(34,211,238,.12);color:#9ff4ff}.adx-tourbar button:focus-visible{outline:2px solid #22D3EE}' +
    '.adx-tourbar p{margin:8px 0 0;color:#eef8ff}' +
    '.adx-tourbar .tb-prog{height:3px;margin:10px -14px 0;background:rgba(255,255,255,.06)}' +
    '.adx-tourbar .tb-prog i{display:block;height:100%;background:linear-gradient(90deg,#22D3EE,#F59E0B);transform-origin:left;transform:scaleX(0)}' +
    'html.tour-1click #back-to-top,html.tour-1click .uni-skip,html.tour-1click .uni-hint,html.tour-1click .tour-start{visibility:hidden}' +
    '@media (max-width:767px){.adx-tourbar ol li:not(.on){font-size:0;gap:0}.adx-tourbar button span{display:none}.adx-tourbar{bottom:14px}}';
  document.head.appendChild(style);

  var paused = false, stopped = true, raf = 0, timers = [];

  /* A dwell of `s` seconds that does not count paused time. */
  function later(fn, s) {
    var left = s * 1000, last = performance.now();
    var t = setInterval(function () {
      var now = performance.now(), dt = now - last; last = now;
      if (stopped) { clearInterval(t); return; }
      if (paused) return;
      left -= dt;
      if (left <= 0) { clearInterval(t); fn(); }
    }, 50);
    timers.push(t);
  }
  function maxScroll() { return document.documentElement.scrollHeight - innerHeight; }
  function topOf(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    // A pinned section sits inside a pin-spacer; its spacer's top is the true position in the document.
    var box = (el.parentElement && /pin-spacer/.test(el.parentElement.className)) ? el.parentElement : el;
    return Math.max(0, Math.round(box.getBoundingClientRect().top + scrollY));
  }

  /* ── the 1-click bar ── */
  var bar = null, capEl = null, progEl = null, pauseBtn = null, lastCap = '';
  var CAPTIONS = {
    briefing: 'Mission briefing: VITA, our guide, explains why a crew far from Earth has to be its own clinic.',
    intro: 'The story: on missions months from home, the crew has to be its own clinic.',
    twin: 'Health Twin: one scan across six body systems gives one readiness score and a clear action card.',
    adx: 'AstroDocX: detect, explain, act, log, sync later. Next stop: the real Crew Console.'
  };
  function caption(id) {
    var text = CAPTIONS[id] || CAPTIONS.intro;
    if (!capEl || text === lastCap) return;
    lastCap = text; capEl.textContent = text;
  }
  function makeBar() {
    bar = document.createElement('div');
    bar.className = 'adx-tourbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', '1-click tour');
    bar.innerHTML =
      '<div class="tb-row"><ol aria-label="Tour chapters"><li class="on" aria-current="step"><b>1</b>' + (BRIEF ? 'Briefing' : 'Story') + '</li><li><b>2</b>Console</li><li><b>3</b>3D Cabin</li></ol>' +
      '<div class="tb-ctl"><button type="button" data-a="pause" aria-label="Pause the tour">&#10073;&#10073;<span>Pause</span></button>' +
      '<button type="button" data-a="skip" aria-label="Skip to the console">&#9197;<span>Skip</span></button>' +
      '<button type="button" data-a="exit" aria-label="Exit the tour">&#10005;</button></div></div>' +
      '<p aria-live="polite"></p><div class="tb-prog" aria-hidden="true"><i></i></div>';
    capEl = bar.querySelector('p'); progEl = bar.querySelector('.tb-prog i'); pauseBtn = bar.querySelector('[data-a="pause"]');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'pause') setPaused(!paused);
      else if (a === 'skip') toConsole();
      else if (a === 'exit') stop();
    });
    document.body.appendChild(bar);
  }
  function setPaused(v) {
    paused = v;
    if (BRIEF && window.ADX_BRIEFING) ADX_BRIEFING.setPaused(v);
    if (pauseBtn) {
      pauseBtn.innerHTML = v ? '&#9654;<span>Resume</span>' : '&#10073;&#10073;<span>Pause</span>';
      pauseBtn.setAttribute('aria-label', v ? 'Resume the tour' : 'Pause the tour');
    }
  }
  function showProgress() {
    if (!progEl || stopped) return;
    if (BRIEF) { progEl.style.transform = 'scaleX(' + ((window.ADX_BRIEFING ? ADX_BRIEFING.progress() : 0) / 3) + ')'; return; }
    var end = (window.ADX_JOURNEY && ADX_JOURNEY.live) ? ADX_JOURNEY.end : maxScroll();
    // the landing is the first of three chapters: a third of the bar
    progEl.style.transform = 'scaleX(' + (Math.min(1, scrollY / Math.max(1, end)) / 3) + ')';
  }
  /* The console is a PWA: its service worker answers from the copy it cached on an earlier visit, so a returning
     visitor could be handed an old build (one from before this tour, even). The update check starts with the tour and
     the hand-off waits for a new worker to take over (it skips waiting, vite.config.ts), up to a few seconds. */
  var swCheck = null;
  function checkConsole() {
    var sw = navigator.serviceWorker;
    if (swCheck || !sw || !sw.getRegistration) return swCheck;
    swCheck = sw.getRegistration('/app/').then(function (reg) {
      return reg ? reg.update().then(function () { return reg; }) : null;
    }).catch(function () { return null; });
    return swCheck;
  }
  function freshConsole(go) {
    var left = false;
    function once() { if (!left) { left = true; go(); } }
    setTimeout(once, 6000);
    var check = checkConsole();
    if (!check) return once();
    check.then(function (reg) {
      var w = reg && (reg.installing || reg.waiting);
      if (!w || w.state === 'activated') return once();
      w.addEventListener('statechange', function () { if (w.state === 'activated' || w.state === 'redundant') once(); });
    }, once);
  }
  /* VITA carries on in the console: tell it which tour was asked for (sound and chat are left by briefing.js as the page closes). */
  function handOff() {
    window.ADX_TOUR_MODE = guide;
    try {
      var old = JSON.parse(sessionStorage.getItem('adx-vita') || 'null') || {};
      old.tour = guide;
      sessionStorage.setItem('adx-vita', JSON.stringify(old));
    } catch (e) { /* private mode: the address says it too */ }
  }
  function toConsole() {
    stopped = true; cancelAnimationFrame(raf);
    if (capEl) capEl.textContent = 'Opening the Crew Console…';
    handOff();
    freshConsole(function () { location.href = consoleUrl(); });
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
      if (s.id === 'journey' && window.ADX_JOURNEY && ADX_JOURNEY.live) {
        /* the particle journey: stop at each intro scene, each Health Twin system and the AstroDocX reveal
           (dwell in universe.js `stops`), slow glides between so the morphs read */
        var stops = ADX_JOURNEY.stops();
        end = ADX_JOURNEY.end;
        (function step(k) {
          if (stopped) return;
          if (k >= stops.length) {
            // the 1-click tour is done with the page once the reveal has been read: on to the console
            if (cfg.oneClick) return later(toConsole, 1);
            return glide(scrollY, end, s.pps * cfg.speed, function () { i++; section(); });
          }
          caption(stops[k].id);
          glide(scrollY, ADX_JOURNEY.yAt(stops[k].id, stops[k].q), 330 * cfg.speed, function () { later(function () { step(k + 1); }, stops[k].hold * cfg.holdScale); });
        })(0);
        return;
      }
      if (cfg.oneClick && s.id === 'footer') return later(toConsole, 1);
      later(function () { glide(scrollY, end, s.pps * cfg.speed, function () { i++; section(); }); }, s.hold * cfg.holdScale);
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
      showProgress();
      if (p < 1) raf = requestAnimationFrame(frame); else done();
    })(t0);
  }

  function finish() {
    document.documentElement.classList.remove('touring', 'tour-1click');
    if (bar) { bar.remove(); bar = null; }
    if (!cfg.oneClick) document.title += ' (tour finished)';
  }
  function stop() {
    var was = !stopped;
    stopped = true; paused = false; cancelAnimationFrame(raf); timers.forEach(clearInterval); timers = []; finish();
    if (BRIEF && was && window.ADX_BRIEFING) ADX_BRIEFING.endTour();
  }

  var wired = false;
  function wire() {
    if (wired) return; wired = true;
    addEventListener('keydown', function (e) {
      if (stopped) return;
      var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
      if (e.key === ' ' && typing) return;
      if (e.key === ' ') { setPaused(!paused); e.preventDefault(); }
      else if (e.key === 'Escape') stop();
      else if (!cfg.oneClick && (e.key === 'r' || e.key === 'R')) { stop(); document.documentElement.classList.add('touring'); run(); }
    });
    // Manual wheel or touch input: the 1-click tour pauses so the visitor can look; the video tour hands control back.
    ['wheel', 'touchstart'].forEach(function (ev) {
      addEventListener(ev, function (e) {
        if (stopped || (bar && bar.contains(e.target))) return;
        if (cfg.oneClick) setPaused(true); else stop();
      }, { passive: true });
    });
  }

  /* The 1-click tour: from a button (a click, so the browser also allows the soundtrack) or ?tour=full. */
  /* Chapter 1 on the homepage: VITA's briefing, then on to the console. */
  function runBriefing() {
    stopped = false;
    var tick = setInterval(function () { if (stopped) clearInterval(tick); else showProgress(); }, 200);
    timers.push(tick);
    ADX_BRIEFING.runTour().then(function (ok) {
      if (stopped || !ok) return;
      showProgress();
      later(toConsole, 0.5);
    });
  }

  function startOneClick(opts) {
    if (!stopped) return;
    if (opts && opts.mode) guide = opts.mode === 'full' ? 'full' : 'quick';
    if (BRIEF) {
      if (!window.ADX_BRIEFING) { setTimeout(function () { startOneClick(opts); }, 150); return; }   // briefing.js is a module: give it a moment
      cfg = { speed: 1, holdScale: 0.5, oneClick: true };
      document.documentElement.classList.add('tour-1click');
      if (!bar) makeBar();
      setPaused(false); lastCap = ''; caption('briefing'); showProgress();
      checkConsole();
      wire();
      runBriefing();
      return;
    }
    if (window.ADX_JOURNEY && !ADX_JOURNEY.live) { handOff(); freshConsole(function () { location.href = consoleUrl(); }); return; }   // no particle journey (reduced motion, no WebGL): straight to the console
    cfg = { speed: Math.max(1, innerHeight * 0.8 / 330), holdScale: 0.5, oneClick: true };
    stop();
    document.documentElement.classList.add('tour-1click');
    if (!bar) makeBar();
    setPaused(false); lastCap = ''; caption('intro'); showProgress();
    checkConsole();
    wire();
    run();
  }
  window.ADX_TOUR = { start: function (opts) { startOneClick(opts); } };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-tour-start]');
    if (!b) return;
    e.preventDefault();
    startOneClick();
  });

  if (mode === 'full') {
    addEventListener('load', function () { setTimeout(startOneClick, 1200); });
  } else if (mode === '1') {
    cfg.speed = Math.max(0.25, parseFloat(q.get('speed')) || 1);
    cfg.holdScale = 1 / cfg.speed;
    var lead = Math.max(0, isNaN(parseFloat(q.get('delay'))) ? 3 : parseFloat(q.get('delay')));
    wire();
    addEventListener('load', function () {
      document.documentElement.classList.add('touring');
      scrollTo(0, 0);
      stopped = false;
      later(run, lead);
    });
  }
})();
