/* ═══════════════════════════════════════════════════════════
   ASTRONAUT — Hero Section + Superman Flight Arc
   File: astronaut.js  (loaded AFTER three.min.js + script.js)

   UPDATE: Head Tracking
   ──────────────────────────────────────────────────────────
   The helmet/visor/neck pieces now live in their own child
   group (#astronaut-head equivalent: window.__astroHeadGroup,
   astroGroup.userData.headGroup, name "astronaut-head") nested
   inside astroGroup. Each frame we:
     1. Project the head's world position to screen space
     2. Math.atan2(mouseY - headScreenY, mouseX - headScreenX)
        to get the direction from head center to cursor
     3. Convert that into target yaw (rotateY) / pitch (rotateX)
     4. Clamp to ±30° yaw / ±20° pitch
     5. Lerp the head's current rotation toward the target at
        a factor of 0.08 every requestAnimationFrame tick
   This is layered ADDITIVELY on top of the existing body
   parallax (astroGroup rotation/position) — the body still
   leans/sways toward the cursor as before, the head simply
   turns further on top of that, like a person glancing further
   than their shoulders turn.                         
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('[Astronaut] three.js not loaded — skipping.');
    return;
  }

  /* Priority-2 §5: this canvas is already display:none under
     prefers-reduced-motion (styles.css), so building and animating
     it would be pure wasted work for those visitors — skip entirely. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── 1. CANVAS ──────────────────────────────────────────── */
  const hero = document.getElementById('hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'astronaut-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.appendChild(canvas);

  /* ── 2. RENDERER ────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  /* ── 3. SCENE & CAMERA ──────────────────────────────────── */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 9);

  function resize() {
    const w = hero.offsetWidth, h = hero.offsetHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ── 4. LIGHTS ──────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x8899cc, 0.55));

  const keyLight = new THREE.DirectionalLight(0xaac8ff, 1.6);
  keyLight.position.set(-3, 5, 4);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xffd580, 1.1);
  rimLight.position.set(4, -1, -3);
  scene.add(rimLight);

  const visorLight = new THREE.PointLight(0xc7d2fe, 1.2, 8);
  visorLight.position.set(0.3, 0.6, 2);
  scene.add(visorLight);

  /* ── 5. MATERIALS ───────────────────────────────────────── */
  const matSuit = new THREE.MeshStandardMaterial({
    color: 0xc8d8ee, roughness: 0.45, metalness: 0.18
  });
  const matVisor = new THREE.MeshStandardMaterial({
    color: 0x1a2a4a, roughness: 0.05, metalness: 0.9
  });
  const matVisorGlow = new THREE.MeshStandardMaterial({
    color: 0x22d3ee, roughness: 0.3, metalness: 0.4,
    emissive: 0x0fd4f0, emissiveIntensity: 1.4
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: 0x2a2d3a, roughness: 0.7, metalness: 0.2
  });
  const matJetpack = new THREE.MeshStandardMaterial({
    color: 0x9ca3af, roughness: 0.4, metalness: 0.55
  });
  const matCyan = new THREE.MeshStandardMaterial({
    color: 0x22d3ee, emissive: 0x0d8fa8, emissiveIntensity: 0.7,
    roughness: 0.3, metalness: 0.4
  });
  const matThruster = new THREE.MeshStandardMaterial({
    color: 0xff6b2b, emissive: 0xff4400, emissiveIntensity: 1.2,
    roughness: 0.2, metalness: 0.3
  });

  /* ── 6. BUILD ASTRONAUT ─────────────────────────────────── */
  const astroGroup = new THREE.Group();
  scene.add(astroGroup);

  /* ── 6a. HEAD GROUP (NEW) ────────────────────────────────
     All helmet/visor/neck parts now live inside this group
     instead of directly on astroGroup. The group's pivot sits
     at the neck (y = 0.72, where the helmet meets the torso)
     so rotation reads as a head turn, not an orbit around the
     world origin. Parts below keep their ORIGINAL world-space
     coordinates — we shift the group's position to the pivot
     and give each child a position relative to that pivot.
  ──────────────────────────────────────────────────────────── */
  const HEAD_PIVOT_Y = 0.72; // neck height — matches old neck ring position

  const headGroup = new THREE.Group();
  headGroup.name = 'astronaut-head'; // CSS-id equivalent target name
  headGroup.position.set(0, HEAD_PIVOT_Y, 0);
  astroGroup.add(headGroup);

  function headPart(geo, mat, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(geo, mat);
    // y is given in original astroGroup-space; convert to head-local space
    mesh.position.set(x || 0, (y || 0) - HEAD_PIVOT_Y, z || 0);
    if (rx) mesh.rotation.x = rx;
    if (ry) mesh.rotation.y = ry;
    if (rz) mesh.rotation.z = rz;
    headGroup.add(mesh);
    return mesh;
  }

  function part(geo, mat, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx) mesh.rotation.x = rx;
    if (ry) mesh.rotation.y = ry;
    if (rz) mesh.rotation.z = rz;
    astroGroup.add(mesh);
    return mesh;
  }

  /* Helmet + visor + neck ring — now built via headPart() so they
     live inside headGroup and rotate independently of the body. */
  headPart(new THREE.SphereGeometry(0.52, 32, 24), matSuit, 0, 1.20, 0);
  headPart(new THREE.CylinderGeometry(0.28, 0.30, 0.12, 24), matDark, 0, 0.72, 0);
  headPart(new THREE.SphereGeometry(0.36, 32, 24), matVisor, 0, 1.22, 0.20);

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.038, 12, 48), matVisorGlow);
  bezel.position.set(0, 1.22 - HEAD_PIVOT_Y, 0.20);
  bezel.rotation.x = Math.PI / 2;
  headGroup.add(bezel);

  const helmetRim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.030, 8, 48), matDark);
  helmetRim.position.set(0, 1.20 - HEAD_PIVOT_Y, 0);
  helmetRim.rotation.x = Math.PI / 2;
  headGroup.add(helmetRim);

  headPart(new THREE.CylinderGeometry(0.02, 0.025, 0.22, 8), matCyan, 0.24, 1.69, 0);

  /* Torso */
  part(new THREE.CylinderGeometry(0.35, 0.30, 0.80, 20), matSuit, 0, 0.22, 0);
  part(new THREE.BoxGeometry(0.22, 0.18, 0.06), matDark, 0.04, 0.30, 0.31);

  const chestLight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), matCyan);
  chestLight.position.set(0.04, 0.18, 0.345);
  astroGroup.add(chestLight);

  /* Jetpack */
  part(new THREE.BoxGeometry(0.36, 0.54, 0.22), matJetpack, 0, 0.22, -0.36);

  const nozzleGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.14, 12);
  const nL = new THREE.Mesh(nozzleGeo, matDark);
  nL.position.set(-0.11, -0.12, -0.50); nL.rotation.x = Math.PI / 2;
  astroGroup.add(nL);
  const nR = new THREE.Mesh(nozzleGeo, matDark);
  nR.position.set(0.11, -0.12, -0.50); nR.rotation.x = Math.PI / 2;
  astroGroup.add(nR);

  [nL, nR].forEach(n => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 24), matThruster);
    ring.position.copy(n.position); ring.position.z -= 0.08;
    ring.rotation.x = Math.PI / 2;
    astroGroup.add(ring);
  });

  /* Arms */
  function buildArm(side) {
    const s = side === 'L' ? -1 : 1;
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), matDark);
    shoulder.position.set(s * 0.49, 0.52, 0); astroGroup.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.40, 16), matSuit);
    upperArm.position.set(s * 0.56, 0.22, 0.04); upperArm.rotation.z = s * 0.22;
    astroGroup.add(upperArm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matDark);
    elbow.position.set(s * 0.63, 0.00, 0.07); astroGroup.add(elbow);

    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 16), matSuit);
    foreArm.position.set(s * 0.68, -0.22, 0.10); foreArm.rotation.z = s * 0.32;
    astroGroup.add(foreArm);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), matDark);
    glove.position.set(s * 0.73, -0.40, 0.12); astroGroup.add(glove);
  }
  buildArm('L'); buildArm('R');

  /* Hips */
  part(new THREE.CylinderGeometry(0.31, 0.32, 0.10, 20), matDark, 0, -0.18, 0);

  /* Legs */
  function buildLeg(side) {
    const s = side === 'L' ? -1 : 1;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.44, 16), matSuit);
    upper.position.set(s * 0.17, -0.52, 0); upper.rotation.z = s * 0.06; astroGroup.add(upper);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), matDark);
    knee.position.set(s * 0.18, -0.76, 0.02); astroGroup.add(knee);

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.40, 16), matSuit);
    lower.position.set(s * 0.18, -0.99, 0.02); lower.rotation.z = s * 0.04; astroGroup.add(lower);

    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.16, 16), matDark);
    boot.position.set(s * 0.18, -1.22, 0.03); astroGroup.add(boot);
  }
  buildLeg('L'); buildLeg('R');

  /* ── 7. FIXED RIGHT-SIDE HOME POSITION ──────────────────── */
  const HOME_X = 3.8;
  const HOME_Y = 0.0;

  astroGroup.position.set(HOME_X, HOME_Y, 0);
  astroGroup.scale.setScalar(1.15);
  astroGroup.rotation.y = -0.35;

  /* ── 8. MOUSE PARALLAX (BODY) ────────────────────────────── */
  const target  = new THREE.Vector3(HOME_X, HOME_Y, 0);
  const current = new THREE.Vector3(HOME_X, HOME_Y, 0);

  const ROAM_Y = 2.0;
  const LERP   = 0.028;

  /* ── 8b. MOUSE TRACKING (HEAD) — NEW ─────────────────────
     Raw mouse position in CSS pixels, tracked globally via a
     single document-level mousemove listener. Used every frame
     to compute the head's look-at direction. */
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };

  document.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    const t = e.touches[0];
    if (!t) return;
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    mouse.active = true;
  }, { passive: true });

  window.addEventListener('mousemove', function (e) {
    const rect = hero.getBoundingClientRect();
    if (e.clientY > rect.bottom || e.clientY < rect.top) return;
    const nx = (e.clientX / window.innerWidth)  * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    target.x = Math.max(HOME_X - 0.2, HOME_X + nx * 0.3);
    target.y = -ny * ROAM_Y;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    const t = e.touches[0];
    const nx = (t.clientX / window.innerWidth)  * 2 - 1;
    const ny = (t.clientY / window.innerHeight) * 2 - 1;
    target.x = Math.max(HOME_X - 0.2, HOME_X + nx * 0.3);
    target.y = -ny * ROAM_Y;
  }, { passive: true });

  /* ── 9. HELPERS ─────────────────────────────────────────── */
  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* ── 9b. HEAD LOOK-AT CONFIG — NEW ───────────────────────
     Rotation limits converted from degrees (as specced) to
     radians (Three.js native unit). */
  const HEAD_MAX_YAW_DEG   = 30; // rotateY equivalent
  const HEAD_MAX_PITCH_DEG = 20; // rotateX equivalent
  const HEAD_MAX_YAW   = THREE.MathUtils.degToRad(HEAD_MAX_YAW_DEG);
  const HEAD_MAX_PITCH = THREE.MathUtils.degToRad(HEAD_MAX_PITCH_DEG);
  const HEAD_LERP = 0.08;

  /* Reused scratch objects so we don't allocate every frame */
  const headWorldPos = new THREE.Vector3();
  const headScreenPos = new THREE.Vector3();
  let headYaw   = 0; // current eased rotation.y offset for the head
  let headPitch = 0; // current eased rotation.x offset for the head

  /* Projects a world-space point to CSS pixel coordinates for
     the given camera + renderer canvas size. */
  function worldToScreen(worldPos, camera, width, height) {
    const v = headScreenPos.copy(worldPos).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (1 - (v.y * 0.5 + 0.5)) * height
    };
  }

  /* ── 10. RENDER LOOP ────────────────────────────────────── */
  let running = true;
  const clock = new THREE.Clock();

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);

    const elapsed = clock.getElapsedTime();

    const p = (typeof window.__aboutScrollProgress === 'number')
      ? window.__aboutScrollProgress : 0;

    current.lerp(target, LERP);

    const mouseWeight = 1 - smoothstep(0, 0.15, p);

    /* dx/dy declared first so rotation lines can use them */
    const dx = target.x - current.x;
    const dy = target.y - current.y;

    astroGroup.position.x = lerp(current.x, HOME_X, smoothstep(0, 0.15, p));

    astroGroup.position.y = lerp(current.y, HOME_Y, smoothstep(0, 0.15, p))
                          + Math.sin(elapsed * 0.55) * 0.28
                          + Math.sin(elapsed * 1.3)  * 0.06;
    astroGroup.position.z = 0;

    astroGroup.rotation.z = -dx * 0.06 * mouseWeight
                           + Math.sin(elapsed * 0.55) * 0.035;
    astroGroup.rotation.x =  dy * 0.04 * mouseWeight;
    astroGroup.rotation.y = -0.35 + dx * 0.08 * mouseWeight
                           + Math.sin(elapsed * 0.28) * 0.12
                           + Math.sin(elapsed * 0.71) * 0.04;

    const fadeOut = 1 - smoothstep(0.08, 0.32, p);
    astroGroup.scale.setScalar(1.15 * fadeOut);
    canvas.style.opacity = fadeOut.toFixed(3);

    visorLight.intensity = 1.1 + Math.sin(elapsed * 0.7) * 0.45;

    /* ── HEAD LOOK-AT — NEW ────────────────────────────────
       Runs AFTER body transforms above so headWorldPos reflects
       the body's current (already-updated) position/rotation
       this frame — the head tracks relative to where the body
       actually is right now, then adds its own extra turn. */
    if (mouse.active && fadeOut > 0.01) {
      headGroup.getWorldPosition(headWorldPos);
      const screen = worldToScreen(headWorldPos, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight);

      /* Angle from head center to cursor, per the spec's atan2 formula */
      const angle = Math.atan2(mouse.y - screen.y, mouse.x - screen.x);

      /* Map the angle to yaw/pitch targets.
         cos(angle) ~ horizontal component -> yaw (rotateY)
         sin(angle) ~ vertical component   -> pitch (rotateX)
         Scaled by the max rotation so a cursor far to the side
         saturates at the clamp instead of spinning past it. */
      const targetYaw   = clamp(Math.cos(angle) * HEAD_MAX_YAW,   -HEAD_MAX_YAW,   HEAD_MAX_YAW);
      const targetPitch = clamp(Math.sin(angle) * HEAD_MAX_PITCH, -HEAD_MAX_PITCH, HEAD_MAX_PITCH);

      /* Smooth follow via lerp, factor 0.08, every rAF tick */
      headYaw   = lerp(headYaw,   targetYaw,   HEAD_LERP);
      headPitch = lerp(headPitch, targetPitch, HEAD_LERP);

      /* Additive on top of any body rotation already applied
         to astroGroup — the head turns further than the body. */
      headGroup.rotation.y = headYaw;
      headGroup.rotation.x = headPitch;
    }

    renderer.render(scene, camera);
  }

  /* ── 11. EXPOSE FOR NEBULA SCENE ────────────────────────── */
  window.__astroHeroGroup = astroGroup;
  window.__astroHeroScene = scene;
  window.__astroHeroMats  = { matSuit, matVisor, matVisorGlow, matDark, matJetpack, matCyan };
  window.__astroHeadGroup = headGroup; // exposed for debugging / future use

  /* ── 12. INTERSECTION OBSERVER ──────────────────────────── */
  const obs = new IntersectionObserver(function (entries) {
    const visible = entries[0].isIntersecting;
    if (visible && !running) { running = true; clock.start(); tick(); }
    else if (!visible)       { running = false; }
  }, { threshold: 0.05 });
  obs.observe(hero);

  /* ── 13. RESIZE + START ─────────────────────────────────── */
  window.addEventListener('resize', resize, { passive: true });
  resize();
  tick();

})();