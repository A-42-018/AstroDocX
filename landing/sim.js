/* ============================================================
   ASTRODOCX — LIVE MISSION SIMULATOR (#sim)
   Isolated module. Synthetic data only.

   Engine (a mini version of the Crew Console engine):
     value = baseline + direction * (shift + noise) * sd
     z     = EWMA-smoothed distance from the personal baseline,
             measured in the "bad" direction
     status: z >= 3.0 → ACT · z >= 1.8 → WATCH · else NOMINAL
             (hysteresis 0.4 so tiles don't flicker)
   readiness: same formula as the console Status Board: mean of five
             hazard scores, score = min(cap(status), 100 - 40*clamp(z/3,0,1)),
             cap = 100 / 80 / 55 for Nominal / Watch / Act.
   Alert → explainable text → action card → logged on board →
   pending until the next ground link window.
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  const root = document.getElementById('sim');
  if (!root) return;

  const $ = id => document.getElementById(id);
  const tilesEl = $('simTiles'), alertEl = $('simAlert'), logEl = $('simLog');
  const pendingEl = $('simPending'), linkText = $('simLinkText'), linkWrap = $('simLink');
  const readyRing = $('simReadyRing'), readyVal = $('simReadyVal'), readyStatus = $('simReadyStatus'), readyBox = $('simReady');
  const clockEl = $('simClock');
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ── Config ─────────────────────────────────────────────── */
  const METRICS = [
    { id:'R', name:'Radiation',   label:'Dose rate',          unit:'µSv/h', mean:25,  sd:3.5, bad:+1, dec:1,
      event:5.0, steps:['Move the whole crew to the storm shelter','Cancel all EVA and log the time of exposure','Report the event to the ground at the next link window'], clears:true,
      done:'Shelter protocol completed' },
    { id:'I', name:'Isolation',   label:'Sleep last night',   unit:'h',    mean:7.1, sd:0.6, bad:-1, dec:1,
      event:3.4, steps:['Swap safety-critical tasks to a rested crewmate','Take a scheduled rest period and a 20-minute nap','Notify the commander and the flight surgeon'], clears:true,
      done:'Rest block scheduled' },
    { id:'D', name:'Distance',    label:'Since ground sync',  unit:'h',    mean:6,   sd:2,   bad:+1, dec:1,
      event:4.6, steps:['Keep logging on board; nothing is lost','Follow the offline action cards','Sync when the next link window opens'], clears:false,
      done:'Offline protocol acknowledged' },
    { id:'G', name:'Gravity',     label:'Exercise load',      unit:'min',  mean:120, sd:14,  bad:-1, dec:0,
      event:3.8, steps:['Schedule a full exercise block with the commander today','Check the exercise hardware for faults','Review the plan with the flight surgeon at the next link window'], clears:true,
      done:'Make-up exercise completed' },
    { id:'E', name:'Environment', label:'Cabin CO₂',     unit:'mmHg', mean:2.4, sd:0.28, bad:+1, dec:2,
      event:5.2, steps:['Switch to the backup scrubber and notify the commander','Stop strenuous activity; move to the lowest-CO₂ module','Request ground support at the next link window'], clears:true,
      done:'Backup scrubber online' }
  ];
  const ORDER = { ok:0, watch:1, act:2 };
  const LABEL = { ok:'Nominal', watch:'Watch', act:'Act' };
  const WATCH_Z = 1.8, ACT_Z = 3.0, HYST = 0.4, HIST = 40;
  const LINK_WINDOW = 60;

  /* ── State ──────────────────────────────────────────────── */
  const S = METRICS.map(c => ({ c, shift:0, target:0, z:0, status:'ok', hist:[], alert:null, dom:{} }));
  const byId = {}; S.forEach(m => byId[m.c.id] = m);
  let selected = null, log = [], linkDown = false, countdown = LINK_WINDOW;
  let met = 142 * 86400 + 3 * 3600 + 12 * 60;
  let cardKey = '', timers = [], onScreen = false, iv = null;

  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => (n < 10 ? '0' : '') + n;
  const metStr = s => 'D' + Math.floor(s / 86400) + ' ' + pad(Math.floor(s % 86400 / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  const hhmmss = s => pad(Math.floor(s % 86400 / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  const valueOf = m => m.c.mean + m.c.bad * m.z * m.c.sd;

  /* ── Build tiles ────────────────────────────────────────── */
  S.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sim-tile is-ok'; b.dataset.id = m.c.id;
    b.innerHTML =
      '<span class="st-badge" aria-hidden="true">' + m.c.id + '</span>' +
      '<span class="st-main"><span class="st-name">' + m.c.name + '</span><span class="st-label">' + m.c.label + '</span></span>' +
      '<svg class="st-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">' +
        '<rect class="st-band" x="0" y="' + yFor(WATCH_Z) + '" width="120" height="' + (yFor(-WATCH_Z) - yFor(WATCH_Z)) + '"/>' +
        '<polyline class="st-line" points=""/></svg>' +
      '<span class="st-val"><b class="st-num">--</b><small>' + m.c.unit + '</small></span>' +
      '<span class="st-chip">Nominal</span>';
    tilesEl.appendChild(b);
    m.dom = { el:b, num:b.querySelector('.st-num'), chip:b.querySelector('.st-chip'), line:b.querySelector('.st-line') };
    b.addEventListener('click', () => { if (m.alert) { selected = m.c.id; cardKey = ''; renderCard(); } });
  });
  function yFor(z) { return 36 - ((clamp(z, -2.5, 6.5) + 2.5) / 9) * 36; }

  /* ── Engine tick (1 Hz while visible) ───────────────────── */
  function seed() {
    S.forEach(m => { for (let i = 0; i < HIST; i++) m.hist.push(m.z = m.z * .5 + gauss() * .3 * .5); });
    S.forEach(m => paintTile(m));
  }
  function tick() {
    met++;
    S.forEach(m => {
      const up = m.target > m.shift;
      m.shift += clamp(m.target - m.shift, up ? -1.0 : -0.8, up ? 1.0 : 0.8);
      const raw = m.shift + gauss() * 0.3;
      m.z = m.z * 0.5 + raw * 0.5;
      m.hist.push(m.z); if (m.hist.length > HIST) m.hist.shift();
      updateStatus(m);
      paintTile(m);
    });
    if (!linkDown) {
      countdown--;
      if (countdown <= 0) { if (log.some(e => !e.synced)) doSync(true); else countdown = LINK_WINDOW; }
    }
    paintMeta();
  }

  function updateStatus(m) {
    const cur = ORDER[m.status];
    let next = m.z >= ACT_Z ? 'act' : m.z >= WATCH_Z ? 'watch' : 'ok';
    /* hysteresis on the way down */
    if (ORDER[next] < cur) {
      const hold = cur === 2 ? ACT_Z - HYST : WATCH_Z - HYST;
      if (m.z > hold) next = m.status;
    }
    if (next === m.status) return;
    const up = ORDER[next] > cur;
    m.status = next;
    if (next === 'ok') { resolveAlert(m); }
    else if (up) { raiseAlert(m); }
    else if (m.alert) { m.alert.level = next; cardKey = ''; renderCard(); }
  }

  /* ── Alerts + action card ───────────────────────────────── */
  function raiseAlert(m) {
    const first = !m.alert;
    if (first) m.alert = { level:m.status, since:met, checked:[false, false, false], logged:false };
    m.alert.level = m.status;
    m.alert.text = explain(m);
    if (first && (!selected || !byId[selected] || !byId[selected].alert)) selected = m.c.id;
    cardKey = ''; renderCard();
  }
  function explain(m) {
    const c = m.c, v = valueOf(m), s = Math.abs(m.z);
    return c.label + ' ' + v.toFixed(c.dec) + ' ' + c.unit + ' is ' + s.toFixed(1) + 'σ ' + (c.bad > 0 ? 'above' : 'below') +
           ' this crew member’s baseline (' + c.mean.toFixed(c.dec) + ' ' + c.unit + '). Started at ' + hhmmss(m.alert ? m.alert.since : met) + ' MET.';
  }
  function resolveAlert(m) {
    if (!m.alert) return;
    addLog(m.c.name + ' back to nominal', true);
    m.alert = null;
    if (selected === m.c.id) selected = (S.find(x => x.alert) || {}).c ? S.find(x => x.alert).c.id : null;
    cardKey = ''; renderCard();
  }
  function topAlert() {
    if (selected && byId[selected] && byId[selected].alert) return byId[selected];
    const a = S.filter(m => m.alert).sort((x, y) => ORDER[y.alert.level] - ORDER[x.alert.level] || x.alert.since - y.alert.since)[0];
    selected = a ? a.c.id : null; return a || null;
  }
  function renderCard() {
    const m = topAlert();
    const others = S.filter(x => x.alert && x !== m).length;
    const key = m ? m.c.id + m.alert.level + m.alert.logged + others : 'none';
    if (key === cardKey) return;
    cardKey = key;
    S.forEach(x => x.dom.el.classList.toggle('is-selected', !!m && x === m));
    if (!m) {
      alertEl.className = 'sim-card sim-alert is-empty';
      alertEl.innerHTML = '<p class="sa-kicker">All systems nominal</p><p class="sa-empty">No alerts. Inject a fault on the left to see detect &rarr; explain &rarr; act.</p>';
      return;
    }
    const a = m.alert, c = m.c;
    alertEl.className = 'sim-card sim-alert is-' + a.level;
    let h = '<header class="sa-head"><p class="sa-kicker">Action card &middot; ' + c.name + '</p><span class="sa-chip">' + LABEL[a.level] + '</span></header>' +
            '<p class="sa-why" id="simWhy">' + a.text + '</p><ol class="sa-steps">';
    c.steps.forEach((s, i) => {
      h += '<li><label><input type="checkbox" data-step="' + i + '"' + (a.checked[i] || a.logged ? ' checked' : '') + (a.logged ? ' disabled' : '') + '><span>' + s + '</span></label></li>';
    });
    h += '</ol>';
    if (a.logged) h += '<p class="sa-done">' + (c.clears ? 'Logged on board. Recovering…' : 'Logged on board. Resolves when the link window opens.') + '</p>';
    else h += '<button type="button" class="sim-btn sim-btn-act" id="simDo"' + (a.checked.every(Boolean) ? '' : ' disabled') + '>Carry out &amp; log</button>';
    if (others) h += '<p class="sa-more">+' + others + ' more active alert' + (others > 1 ? 's' : '') + ' &middot; tap a tile to switch</p>';
    alertEl.innerHTML = h;
    alertEl.querySelectorAll('input[data-step]').forEach(inp => inp.addEventListener('change', () => {
      a.checked[+inp.dataset.step] = inp.checked;
      const btn = $('simDo'); if (btn) btn.disabled = !a.checked.every(Boolean);
    }));
    const doBtn = $('simDo');
    if (doBtn) doBtn.addEventListener('click', () => {
      a.logged = true;
      addLog(c.name + ': ' + c.done, false);
      if (c.clears) m.target = 0;
      cardKey = ''; renderCard();
    });
  }

  /* ── Log + ground sync ──────────────────────────────────── */
  function addLog(text, auto) {
    log.unshift({ t:met, text:text, synced:false, auto:auto });
    log = log.slice(0, 40);
    renderLog();
  }
  function renderLog() {
    logEl.innerHTML = '';
    log.slice(0, 5).forEach(e => {
      const li = document.createElement('li');
      li.className = e.synced ? 'is-synced' : '';
      li.innerHTML = '<time>' + hhmmss(e.t) + '</time><span></span><em>' + (e.synced ? 'synced' : 'pending') + '</em>';
      li.children[1].textContent = e.text;
      logEl.appendChild(li);
    });
    if (!log.length) logEl.innerHTML = '<li class="is-empty"><span>No entries yet.</span></li>';
    const p = log.filter(e => !e.synced).length;
    pendingEl.textContent = p + ' pending sync';
    pendingEl.classList.toggle('has-pending', p > 0);
  }
  function doSync(auto) {
    const n = log.filter(e => !e.synced).length;
    log.forEach(e => e.synced = true);
    linkDown = false; countdown = LINK_WINDOW;
    const d = byId.D; d.target = 0;
    renderLog(); paintMeta();
    linkText.textContent = n ? 'Synced ' + n + ' entr' + (n === 1 ? 'y' : 'ies') + ' to ground' : 'Link open, nothing to sync';
    clearTimeout(doSync._t); doSync._t = setTimeout(paintMeta, 2200);
    doSync._hold = true; setTimeout(() => { doSync._hold = false; }, 2200);
  }

  /* ── Painting ───────────────────────────────────────────── */
  function paintTile(m) {
    const d = m.dom, v = valueOf(m);
    d.num.textContent = v.toFixed(m.c.dec);
    d.chip.textContent = LABEL[m.status];
    d.el.className = 'sim-tile is-' + m.status + (m.alert && selected === m.c.id ? ' is-selected' : '') + (m.alert ? ' has-alert' : '');
    d.el.setAttribute('aria-label', m.c.name + ': ' + m.c.label + ' ' + v.toFixed(m.c.dec) + ' ' + m.c.unit + ', ' + LABEL[m.status]);
    const n = m.hist.length;
    let pts = '';
    for (let i = 0; i < n; i++) pts += ((i / (HIST - 1)) * 120).toFixed(1) + ',' + yFor(m.hist[i]).toFixed(1) + ' ';
    d.line.setAttribute('points', pts);
  }
  let lastRing = -1;
  function paintMeta() {
    clockEl.textContent = metStr(met);
    const CAP = { ok:100, watch:80, act:55 };
    let sum = 0, worst = 'ok';
    S.forEach(m => {
      sum += Math.round(Math.min(CAP[m.status], 100 - 40 * clamp(Math.max(0, m.z) / 3, 0, 1)));
      if (ORDER[m.status] > ORDER[worst]) worst = m.status;
    });
    const r = Math.round(sum / S.length);
    if ((r + worst) !== lastRing) {
      lastRing = r + worst;
      readyVal.textContent = r;
      readyRing.style.strokeDasharray = r + ' 100';
      const st = worst;
      readyBox.className = 'sim-card sim-ready is-' + st;
      readyStatus.innerHTML = '<i></i>' + LABEL[st];
    }
    if (doSync._hold) return;
    linkWrap.classList.toggle('is-down', linkDown);
    if (linkDown) linkText.textContent = 'LINK DOWN · no window';
    else linkText.textContent = 'Next link window ' + Math.floor(countdown / 60) + ':' + pad(countdown % 60);
  }

  /* ── Controls ───────────────────────────────────────────── */
  function inject(id) {
    const m = byId[id]; if (!m) return;
    m.target = m.c.event;
    if (id === 'D') { linkDown = true; paintMeta(); }
    const btn = root.querySelector('.sim-btn[data-event="' + id + '"]');
    if (btn) { btn.classList.add('is-fired'); setTimeout(() => btn.classList.remove('is-fired'), 700); }
  }
  root.querySelectorAll('.sim-btn[data-event]').forEach(b => b.addEventListener('click', () => { inject(b.dataset.event); kick(); }));
  $('simSync').addEventListener('click', () => doSync(false));
  $('simReset').addEventListener('click', reset);
  $('simPlay').addEventListener('click', () => {
    reset(); kick();
    [['E', 600], ['R', 7500], ['D', 14500], ['I', 21500]].forEach(p => timers.push(setTimeout(() => inject(p[0]), p[1])));
    $('simPlay').blur();
  });
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    S.forEach(m => { m.shift = m.target = 0; m.alert = null; m.status = 'ok'; });
    log = []; linkDown = false; countdown = LINK_WINDOW; selected = null; cardKey = '';
    renderLog(); renderCard(); S.forEach(paintTile); lastRing = -1; paintMeta();
  }

  /* ── Lifecycle: run only while on screen ────────────────── */
  function kick() { if (!iv && onScreen) iv = setInterval(tick, 1000); }
  new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen) { if (!iv) iv = setInterval(tick, 1000); }
    else { clearInterval(iv); iv = null; }
  }, { rootMargin: '80px 0px' }).observe(root);

  /* Reveal on scroll (no GSAP dependency) */
  const rv = root.querySelectorAll('.sim-header, .sim-left, .sim-right');
  rv.forEach(e => e.classList.add('sim-reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    rv.forEach(e => io.observe(e));
  } else rv.forEach(e => e.classList.add('in'));

  seed(); renderLog(); renderCard(); paintMeta();
});

/* Built On (#built) reveal: separate, tiny, no GSAP */
document.addEventListener('DOMContentLoaded', function () {
  const els = document.querySelectorAll('#built .built-header, #built .built-card');
  if (!els.length) return;
  els.forEach((e, i) => { e.classList.add('built-reveal'); e.style.transitionDelay = (Math.min(i, 5) * 70) + 'ms'; });
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  els.forEach(e => io.observe(e));
});

/* Proof strip (#proof): count up once when it scrolls into view; static numbers stay in the markup */
document.addEventListener('DOMContentLoaded', function () {
  const nums = document.querySelectorAll('#proof .proof-num[data-target]');
  if (!nums.length || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, to = +el.dataset.target, t0 = performance.now(), dur = 1100;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: .6 });
  nums.forEach(n => io.observe(n));
});
