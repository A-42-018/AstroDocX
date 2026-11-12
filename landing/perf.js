/* ============================================================
   ASTRODOCX — how much this device can draw (the landing pages' copy
   of app/src/shell/perf.ts; keep the two guesses in step).

   Cores and RAM say little about the GPU: a 16 GB laptop on Intel UHD
   graphics draws far slower than its core count suggests, so the guess
   reads the GPU's name and only gives "high" to a discrete or Apple GPU.
   The pages step down while running if frames stay slow, and remember
   it (localStorage), so the next visit starts smooth.

   Sets window.ADX_PERF = { tier, learn(t), fps } and <html data-perf>.
   Overrides: ?quality=low|mid|high (kept for the session), ?quality=auto.
============================================================ */
(function () {
  var KEY = 'adx.perf.tier', LEARNED = 'adx.perf.learned.landing', TIERS = ['low', 'mid', 'high'];
  function isTier(v) { return TIERS.indexOf(v) >= 0; }
  function rank(t) { return TIERS.indexOf(t); }

  function gpu() {
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return '';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '').toLowerCase();
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return name;
    } catch (e) { return ''; }
  }

  function guess() {
    var cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    var coarse = matchMedia('(pointer: coarse)').matches, g = gpu();
    if (/swiftshader|llvmpipe|software|basic render|mali|adreno|powervr/.test(g)) return 'low';
    if (innerWidth < 768 || coarse || cores <= 4 || mem <= 4) return 'low';
    if (/intel/.test(g) && !/arc/.test(g)) return /iris.*xe|xe graphics/.test(g) ? 'mid' : 'low';
    if (/radeon(\(tm\))? (graphics|vega)|amd radeon\(tm\) graphics/.test(g)) return 'mid';
    if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m\d|apple gpu|arc/.test(g)) return devicePixelRatio > 1.5 && cores < 8 ? 'mid' : 'high';
    return 'mid';
  }

  var forced = null;
  try {
    var q = new URLSearchParams(location.search).get('quality');
    if (q === 'auto') { sessionStorage.removeItem(KEY); localStorage.removeItem(LEARNED); }
    else if (isTier(q)) sessionStorage.setItem(KEY, q);
    var s = sessionStorage.getItem(KEY); if (isTier(s)) forced = s;
  } catch (e) { /* storage blocked */ }

  var tier = forced;
  if (!tier) {
    tier = guess();
    try { var l = localStorage.getItem(LEARNED); if (isTier(l) && rank(l) < rank(tier)) tier = l; } catch (e) { /* private mode */ }
  }
  document.documentElement.dataset.perf = tier;

  window.ADX_PERF = {
    tier: tier,
    /** frames a second the canvases aim for: 60 (a 120/144 Hz screen would otherwise draw two or more times as many), 30 on low */
    fps: tier === 'low' ? 30 : 60,
    /** remember that this device could only hold `t` (never raises it; ignored while a tier is forced) */
    learn: function (t) {
      if (forced || !isTier(t)) return;
      document.documentElement.dataset.perf = t;
      try { var p = localStorage.getItem(LEARNED); if (!isTier(p) || rank(t) < rank(p)) localStorage.setItem(LEARNED, t); } catch (e) { /* private mode */ }
    },
  };
})();
