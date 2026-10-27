/* Mockup helpers: the real baked Health Twin body (landing/universe/targets/body.bin) drawn as a glowing point cloud,
   leader lines to callout chips, ECG / breathing traces, and a few chart drawers. Mockup only, not app code. */
(function () {
  const STC = { act: [255, 77, 106], watch: [255, 197, 61], ok: [61, 220, 151] };

  function decodeBody() {
    const bin = atob(window.BODY_B64), buf = new ArrayBuffer(bin.length), u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const n = buf.byteLength / 13, dv = new DataView(buf);
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), reg = new Uint8Array(n);
    for (let i = 0; i < n * 3; i++) { pos[i] = dv.getInt16(i * 2, true) / 8192; nrm[i] = dv.getInt16(n * 6 + i * 2, true) / 4096; }
    for (let i = 0; i < n; i++) reg[i] = dv.getUint8(n * 12 + i);
    return { n, pos, nrm, reg };
  }

  /* opts: { canvas, overlay, chips: [{el, anchor:'I'|..., status, side}], statuses: {brain:'act',...}, scale, yMid, swing } */
  window.mountTwin = function (opts) {
    const B = decodeBody(), rig = window.BODY_RIG;
    const lung = rig.at[1];
    const anchors = { I: rig.at[0], E: [-lung[0], lung[1], lung[2]], R: rig.at[2], D: rig.at[4], G: rig.at[5] };
    const cv = opts.canvas, ov = opts.overlay, ctx = cv.getContext('2d'), octx = ov.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    function size() {
      const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      for (const c of [cv, ov]) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size(); addEventListener('resize', size);
    const brainSt = opts.brain || 'ok';
    const t0 = performance.now();
    const proj = (p, a, s, cx, cy) => { const c = Math.cos(a), sn = Math.sin(a); const x = c * p[0] + sn * p[2], z = -sn * p[0] + c * p[2]; return [cx + x * s, cy - p[1] * s, z]; };

    function frame(now) {
      const t = (now - t0) / 1000;
      const a = opts.spin ? t * 0.35 : Math.sin(t * 0.22) * 0.55 + 0.15;
      const s = H / (opts.span || 3.55), cx = W / 2, cy = H * (opts.yMid || 0.55);
      const beat = (t * (opts.hr || 59) / 60) % 1, pump = Math.exp(-beat * 8);
      const c = Math.cos(a), sn = Math.sin(a);
      ctx.clearRect(0, 0, W, H);
      // haze behind the body
      const g = ctx.createRadialGradient(cx, cy - s * 0.2, 0, cx, cy - s * 0.2, s * 1.6);
      g.addColorStop(0, 'rgba(40,190,230,0.16)'); g.addColorStop(1, 'rgba(40,190,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const { n, pos, nrm, reg } = B;
      const scanY = cy - ((1 - ((t * 0.18) % 1)) * 3.3 - 1.25) * s;
      for (let i = 0; i < n; i++) {
        const r = reg[i], o = i * 3;
        let px = pos[o], py = pos[o + 1], pz = pos[o + 2];
        if (r === 2) { const k = 1 + 0.18 * pump; px = rig.heart[0] + (px - rig.heart[0]) * k; py = rig.heart[1] + (py - rig.heart[1]) * k; pz = rig.heart[2] + (pz - rig.heart[2]) * k; }
        const x = c * px + sn * pz, z = -sn * px + c * pz;
        const X = cx + x * s, Y = cy - py * s;
        let col, al, sz = 1.25;
        if (r === 0 || r === 5) {
          const nz = -sn * nrm[o] + c * nrm[o + 2];
          const rim = 1 - Math.abs(nz);
          al = 0.05 + rim * rim * 0.5; col = '70,215,250';
          if (r === 5 && opts.legs) { col = opts.legs; al += 0.08; }
        } else if (r === 1) { const k = STC[brainSt]; col = k.join(','); al = 0.55 + 0.25 * Math.sin(t * 4); sz = 1.5; }
        else if (r === 2) { col = '255,90,110'; al = 0.55 + 0.4 * pump; sz = 1.6; }
        else if (r === 3) { col = '120,235,255'; al = 0.32; }
        else if (r === 4) { col = '80,180,210'; al = 0.12; }
        else if (r === 6) { col = '215,240,255'; al = 0.28; }
        else if (r === 7) { col = '255,150,70'; al = 0.5; sz = 1.4; }
        else if (r === 8) { const d = nrm[o]; const w = Math.exp(-Math.pow((beat * 2.4 - d) * 4, 2)); col = '255,70,95'; al = 0.25 + w * 0.7; sz = 1.3 + w; }
        else if (r === 9) { col = '54,226,245'; al = 0.35; }
        else { col = '70,215,250'; al = 0.1; }
        if (Math.abs(Y - scanY) < 5 && r !== 9) { al += 0.45; col = '190,250,255'; }
        al *= 0.85 + 0.15 * (z + 1);
        ctx.fillStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')';
        ctx.fillRect(X, Y, sz, sz);
      }
      ctx.globalCompositeOperation = 'source-over';
      // scan beam
      const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 2);
      sg.addColorStop(0, 'rgba(54,226,245,0)'); sg.addColorStop(1, 'rgba(54,226,245,0.10)');
      ctx.fillStyle = sg; ctx.fillRect(cx - s * 1.1, scanY - 40, s * 2.2, 42);
      ctx.fillStyle = 'rgba(160,245,255,0.55)'; ctx.fillRect(cx - s * 1.1, scanY, s * 2.2, 1);

      // leader lines + ringed markers
      octx.clearRect(0, 0, W, H);
      const ovR = ov.getBoundingClientRect();
      for (const ch of opts.chips || []) {
        const p = proj(anchors[ch.anchor], a, s, cx, cy);
        const k = STC[ch.status].join(','), hot = ch.status !== 'ok';
        const er = ch.el.getBoundingClientRect();
        const ex = ch.side === 'l' ? er.right - ovR.left : er.left - ovR.left, ey = er.top + er.height / 2 - ovR.top;
        const mx = ch.side === 'l' ? ex + 26 : ex - 26;
        octx.strokeStyle = 'rgba(' + k + ',' + (hot ? 0.9 : 0.55) + ')'; octx.lineWidth = 1;
        octx.setLineDash(hot ? [] : [3, 4]);
        octx.beginPath(); octx.moveTo(ex, ey); octx.lineTo(mx, ey); octx.lineTo(p[0], p[1]); octx.stroke(); octx.setLineDash([]);
        octx.fillStyle = 'rgba(' + k + ',1)'; octx.beginPath(); octx.arc(ex, ey, 2.2, 0, 7); octx.fill();
        octx.shadowColor = 'rgba(' + k + ',1)'; octx.shadowBlur = 10;
        octx.beginPath(); octx.arc(p[0], p[1], 3.2, 0, 7); octx.fill();
        octx.lineWidth = 1.2; octx.beginPath(); octx.arc(p[0], p[1], 9, 0, 7); octx.stroke();
        if (hot) { const pr = (t * 0.9) % 1; octx.strokeStyle = 'rgba(' + k + ',' + (1 - pr) + ')'; octx.beginPath(); octx.arc(p[0], p[1], 9 + pr * 18, 0, 7); octx.stroke(); }
        octx.shadowBlur = 0;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* Scrolling ECG trace */
  window.mountECG = function (cv, color, bpm) {
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height, per = 60 / bpm;
    const ecg = (ph) => { // ph 0..1 within a beat
      if (ph < 0.1) return Math.sin(ph / 0.1 * Math.PI) * 0.08;
      if (ph < 0.16) return 0; if (ph < 0.18) return -0.12; if (ph < 0.21) return 1; if (ph < 0.24) return -0.3; if (ph < 0.3) return 0;
      if (ph < 0.45) return Math.sin((ph - 0.3) / 0.15 * Math.PI) * 0.18; return 0; };
    function f(now) {
      const t = now / 1000; ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(54,226,245,0.08)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.beginPath();
      const secs = 3.2;
      for (let x = 0; x <= W; x++) { const tt = t - secs + (x / W) * secs; const v = ecg(((tt / per) % 1 + 1) % 1); const y = H * 0.62 - v * H * 0.5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 14; ctx.fillStyle = '#fff';
      const v = ecg(((t / per) % 1 + 1) % 1); ctx.beginPath(); ctx.arc(W - 2, H * 0.62 - v * H * 0.5, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  };

  /* Smooth periodic wave (breathing, pleth) */
  window.mountWave = function (cv, color, hz, shape) {
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    function f(now) {
      const t = now / 1000; ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.beginPath();
      for (let x = 0; x <= W; x++) { const ph = (t - 4 + x / W * 4) * hz * Math.PI * 2; let v = Math.sin(ph); if (shape === 'pleth') v = Math.max(Math.sin(ph), 0) ** 0.7 + 0.25 * Math.max(Math.sin(ph * 2 - 1.5), 0) - 0.5; const y = H / 2 - v * H * 0.36; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0; requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  };
})();

window.renderTop = function (active, alerts) {
  const el = document.getElementById('top'); if (!el) return;
  el.outerHTML = '  <header class="top">\n    <div class="brand"><span class="logo" style="font:800 22px/1 var(--disp)">+</span><div><b>ASTRODOCX</b><br><span>CREW CONSOLE</span></div></div>\n    <nav class="tabs">\n      <a class="on"><i data-lucide="layout-dashboard"></i>Board</a>\n      <a><i data-lucide="siren"></i>Alerts <span class="n">3</span></a>\n      <a><i data-lucide="chart-line"></i>Trends</a>\n      <a><i data-lucide="clipboard-check"></i>Check-in</a>\n      <span class="sep"></span>\n      <a><i data-lucide="rocket"></i>Simulator</a>\n      <a><i data-lucide="radio"></i>Sync</a>\n      <a><i data-lucide="globe"></i>Ground</a>\n    </nav>\n    <div class="strip">\n      <div><span class="eb" style="letter-spacing:.1em">MET</span><b class="cy" style="font-size:14px;text-shadow:0 0 10px var(--cy-glow)">D29 23:00</b></div>\n      <div class="wt"><span class="lamp"></span>LINK · 1H 00M</div>\n      <div class="t2">3 QUEUED</div>\n    </div>\n    <div class="crew">\n      <span class="av" style="--st:var(--ok)">CO</span><span class="av" style="--st:var(--act)">FE</span><span class="av" style="--st:var(--ok)">MO</span><span class="av on" style="--st:var(--act)">PI</span>\n    </div>\n    <span class="bell"><i data-lucide="bell" style="width:20px;height:20px"></i><i>3</i></span>\n    <i data-lucide="ellipsis-vertical" style="color:var(--t3)"></i>\n  </header>'.replace('<a class="on">', '<a>').replace('>' + active + '<', ' data-on>' + active + '<');
  document.querySelectorAll('.tabs a').forEach((a) => { if (a.textContent.trim().startsWith(active)) a.classList.add('on'); });
  if (window.lucide) lucide.createIcons({ attrs: { 'stroke-width': 1.9 } });
};
