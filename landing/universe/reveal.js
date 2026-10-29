/* ============================================================
   ASTRODOCX — the AstroDocX chapter (#astrodocx)
   No canvas of its own: the body's particles have just become the
   ASTRODOCX wordmark (engine shape 7, the 'toAdx' chapter). Here the
   wordmark rises and shrinks and the pitch, steps and buttons fade
   in below it. Chapter progress p (0..1), a pure function:
     0.00-0.08  hold the wordmark
     0.08-0.45  wordmark rises and shrinks
     0.15-0.60  content fades in
     0.60-1.00  hold
   Static mode (reduced motion / no WebGL): a normal section with the
   CSS wordmark (the same <h1>) and a plain fade-in.
============================================================ */
(function () {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const small = () => window.innerWidth <= 900;

  /* The wordmark's glyph box at scale 1, in engine units (engine.js genWordmark draws it the same way:
     a 1400 x 260 canvas, 190px type centred 8px low, 700px = 1.55 units). */
  function glyphBox() {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '800 190px "Space Grotesk", sans-serif'; if (c.letterSpacing !== undefined) c.letterSpacing = '14px';
    c.textBaseline = 'middle';
    const m = c.measureText('ASTRODOCX'), u = 1.55 / 700;
    return { top: (m.actualBoundingBoxAscent - 8) * u, bottom: -(m.actualBoundingBoxDescent + 8) * u, half: m.width / 2 * u };
  }

  function create(root) {
    const items = Array.from(root.querySelectorAll('.adx-reveal')).filter(el => !el.classList.contains('adx-wordmark'));
    const inner = root.querySelector('.adx-inner'), first = items[0];
    /* Where the risen wordmark goes. The copy under it is laid out by CSS from the bottom of the screen, and
       reaches higher on a short screen (a laptop with the browser bars), so the wordmark is placed from the
       copy: it sits a fixed gap above the eyebrow and, if it has to, shrinks to stay under the nav. The camera here
       is universe.js camAdx: z = 9 (pulled back on portrait), looking at y = 0.2, fov 50. */
    let fit = null, fitKey = '';
    /* re-measured whenever the screen or the copy's position changes (a resize, the fonts arriving); a resize
       event alone fires before the pin and the copy have settled */
    function measure() {
      const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
      const top = inner && first ? inner.offsetTop + first.offsetTop : 0, key = w + 'x' + h + ':' + top;
      if (fit && key === fitKey) return;
      fitKey = key;
      const sc0 = small() ? 1.9 : 2.1;
      if (!inner || !first || !h) { fit = { sc: sc0, off: small() ? 2.6 : 2.1 }; return; }
      const aspect = w / h, pull = aspect < 1.2 ? Math.min(2.4, 1.2 / aspect) : 1;
      const ppu = (h / 2) / (9 * pull * Math.tan(25 * Math.PI / 180));        // pixels per engine unit at the wordmark
      const toY = px => 0.2 + (h / 2 - px) / ppu;                              // screen px (from the top) -> world y
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
      const g = glyphBox(), gap = Math.max(30, h * 0.045);             // the particles' glow spreads past the glyphs
      const floor = toY(top - gap), ceil = toY(nav + 16);
      const sc = Math.min(sc0, (ceil - floor) / (g.top - g.bottom), (w * 0.46) / ppu / g.half);
      fit = { sc: sc, off: floor - sc * g.bottom };
    }
    return {
      /* the wordmark's scale / offset for chapter progress p (fed to engine.set as the override) */
      word: function (p) {
        measure();
        const rise = sm(clamp((p - 0.08) / 0.37, 0, 1));
        return { sc: lerp(3.2, fit.sc, rise), off: [0, lerp(0, fit.off, rise), 0] };
      },
      update: function (p) {
        const show = clamp((p - 0.15) / 0.45, 0, 1);
        items.forEach((el, i) => {
          const v = clamp((show - i * 0.09) / 0.5, 0, 1);
          el.style.opacity = v.toFixed(3);
          el.style.translate = '0 ' + ((1 - v) * 24).toFixed(1) + 'px';
          el.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
        });
      },
      makeStatic: function (reduce) {
        root.classList.remove('is-particle');
        const all = root.querySelectorAll('.adx-reveal');
        all.forEach(el => { el.style.cssText = ''; });
        if (reduce) { gsap.set(all, { opacity: 1 }); return; }
        gsap.fromTo(all, { opacity: 0, y: 28 }, {
          scrollTrigger: { trigger: root, start: 'top 70%' }, opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out'
        });
      }
    };
  }
  window.ADX_REVEAL_UI = { create: create };
})();
