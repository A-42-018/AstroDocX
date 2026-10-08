/* ============================================================
   ASTRODOCX — HEALTH TWIN chapter (#twin)
   No canvas of its own: the page's one particle system (engine.js,
   shape 6 = body) is the twin. This module drives the body's regions
   and the DOM around it from the chapter's progress p (0..1):

     0.00-0.20  the Earth's particles gather into the body (the morph
                itself is the 'toTwin' chapter; p runs 0..0.20 there)
     0.20-0.31  a scan line sweeps head to feet; each region lights
     0.30-0.84  six systems, one every 0.09: the region glows, its label
                and leader line appear
     0.86-1.00  crew readiness and the action card

   Numbers are the demo mission snapshot (Pilot).
============================================================ */
(function () {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const small = () => window.innerWidth <= 900;
  const READY = 83;                                              // Pilot, demo mission end state

  /* label order = reveal order. reg = body region to glow, at = body-space anchor of the leader line */
  const STAGES = [
    { reg: 1, at: [0, 1.58, 0.02] },        // brain  - Isolation
    { reg: 3, at: [-0.24, 0.82, 0.08] },    // lungs  - Environment
    { reg: 0, at: [-0.5, 0.25, 0.05] },     // whole body - Radiation
    { reg: 2, at: [0.10, 0.70, 0.14] },     // heart  - Gravity
    { reg: 7, at: [0.80, 0.02, 0.06] },     // forearm transmitter - Distance
    { reg: 5, at: [0.22, -1.25, 0.04] }     // legs   - Gravity
  ];
  const T0 = 0.30, STEP = 0.09, FINAL_AT = 0.86;
  const CENTERS = { 0: 9, 1: 1.58, 2: 0.70, 3: 0.80, 4: 0.15, 5: -1.2, 6: 0.5, 7: 0.05, 8: 0, 9: -9 };

  function create(root) {
    const labels = Array.from(root.querySelectorAll('.tw-label'));
    const final = root.querySelector('.tw-final');
    const linesSvg = root.querySelector('.tw-lines');
    const readyEl = root.querySelector('#twReadyVal');
    const SVGNS = 'http://www.w3.org/2000/svg';
    const lines = labels.map(() => { const l = document.createElementNS(SVGNS, 'polyline'); l.setAttribute('class', 'tw-line'); linesSvg.appendChild(l); return l; });
    const dots = labels.map(() => { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', 3.2); c.setAttribute('class', 'tw-dot'); linesSvg.appendChild(c); return c; });
    const tmp = new THREE.Vector3();

    /* body regions (engine uniforms) for chapter progress p */
    function body(U, p) {
      const morph = clamp(p / 0.20, 0, 1);
      const scan = p < 0.20 ? 3 : p > 0.31 ? -3 : 2.3 - (p - 0.20) / 0.11 * 4.6;           // sweeps 2.3 -> -2.3
      U.uScan.value = scan;
      const lit = U.uLit.value, foc = U.uFocus.value;
      for (let r = 0; r < 10; r++) lit[r] = r === 0 || r === 9 ? clamp(morph * 1.6 - 0.2, 0, 1) : clamp((CENTERS[r] - scan) / 0.5 + 0.5, 0, 1) * (p > 0.20 ? 1 : 0);
      let cur = -1;
      for (let i = 0; i < STAGES.length; i++) if (p >= T0 + i * STEP) cur = i;
      for (let r = 0; r < 10; r++) foc[r] = 0;
      if (cur >= 0 && p < FINAL_AT) foc[STAGES[cur].reg] = 1;
      U.uAlert.value = lit[1];
      return cur;
    }

    /* labels and the readiness card: fade in at their stage; phones show only the current one */
    function dom(p, cur) {
      const fv = clamp((p - FINAL_AT) / 0.05, 0, 1);
      labels.forEach((el, i) => {
        const v = clamp((p - (T0 + i * STEP)) / 0.04, 0, 1);
        el.style.opacity = (small() ? (i === cur && p < FINAL_AT ? v : 0) : v * (1 - 0.7 * fv)).toFixed(3);
        el.classList.toggle('is-current', i === cur && p < FINAL_AT);
        el.style.translate = '0 ' + ((1 - v) * 16).toFixed(1) + 'px';
      });
      if (final) {
        final.style.opacity = fv.toFixed(3); final.style.translate = '0 ' + ((1 - fv) * 16).toFixed(1) + 'px';
        if (readyEl) readyEl.textContent = Math.round(READY * clamp((p - FINAL_AT) / 0.1, 0, 1));
      }
    }

    /* leader lines: from each label's inner edge to its organ's projected screen position */
    function drawLines(camera, ang) {
      const box = root.getBoundingClientRect(), W = box.width, H = box.height, c = Math.cos(ang), s = Math.sin(ang);
      labels.forEach((el, i) => {
        const v = parseFloat(el.style.opacity) || 0, ln = lines[i], dt = dots[i];
        if (small() || v < 0.02) { ln.style.opacity = 0; dt.style.opacity = 0; return; }
        const a = STAGES[i].at;
        tmp.set(c * a[0] + s * a[2], a[1], -s * a[0] + c * a[2]).project(camera);
        const ax = (tmp.x * 0.5 + 0.5) * W, ay = (-tmp.y * 0.5 + 0.5) * H;
        const r = el.getBoundingClientRect(), left = el.dataset.side === 'left';
        const sx = (left ? r.right : r.left) - box.left + (left ? 10 : -10), sy = r.top - box.top + 10;
        ln.setAttribute('points', sx + ',' + sy + ' ' + (sx + (ax - sx) * 0.45) + ',' + ay + ' ' + ax + ',' + ay);
        dt.setAttribute('cx', ax); dt.setAttribute('cy', ay);
        ln.style.opacity = (v * 0.9).toFixed(2); dt.style.opacity = v.toFixed(2);
        ln.classList.toggle('is-act', el.dataset.state === 'act'); dt.classList.toggle('is-act', el.dataset.state === 'act');
      });
    }

    return {
      /* p: chapter progress (0..1). Returns the current stage. */
      update: function (engine, camera, p, time) {
        const cur = body(engine.uniforms, p);
        dom(p, cur);
        drawLines(camera, engine.bodyAngle(time));
        return cur;
      },
      makeStatic: function () {
        root.classList.add('is-static');
        if (readyEl) readyEl.textContent = READY;
        labels.forEach(l => { l.style.cssText = ''; l.style.opacity = 1; });
        if (final) { final.style.cssText = ''; final.style.opacity = 1; }
      },
      stages: STAGES.length, T0: T0, STEP: STEP, FINAL_AT: FINAL_AT
    };
  }
  window.ADX_TWIN_UI = { create: create };
})();
