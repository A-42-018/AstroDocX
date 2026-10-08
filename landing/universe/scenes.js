/* ============================================================
   ASTRODOCX — UNIVERSE INTRO · scene config (plan §12.2 / §12.3)
   The only place to tune copy and timing. Progress p runs 0..1
   over the whole pinned section; every other module reads this.

   hold  [a,b]  shape is stable and the text is readable
   The gap between one scene's hold end and the next one's hold
   start is the morph window (P1+).
============================================================ */
window.ADX_SCENES = [
  { id: 'dust',      name: 'Beginning',   tour: 2, hold: [0.00, 0.08], pos: 'center',
    head: ['EXPLORE', 'BEYOND'],                       sub: 'A new experience is taking shape.' },
  { id: 'planet',    name: 'Destination', tour: 3, hold: [0.16, 0.30], pos: 'left',
    head: ['BUILD THE', 'FUTURE'],                     sub: 'The next crews will travel months from home.' },
  { id: 'astronaut', name: 'Crew',        tour: 4.5, hold: [0.38, 0.52], pos: 'right',
    head: ['HUMAN', 'BEYOND LIMITS'],                  sub: 'Every heartbeat matters out here.' },
  { id: 'orion',     name: 'Journey',     tour: 3, hold: [0.60, 0.70], pos: 'left',
    head: ['GO', 'FURTHER'],                           sub: 'When Earth is up to 22 minutes away, the crew is the clinic.' },
  { id: 'relay',     name: 'Link',        tour: 3.5, hold: [0.77, 0.87], pos: 'right',
    head: ['CONNECT THE', 'UNKNOWN'],                  sub: 'Health logs sync home whenever the link allows.' },
  { id: 'earth',     name: 'Home',        tour: 3, hold: [0.93, 1.00], pos: 'top',
    head: ['ONE PLANET.', 'INFINITE POSSIBILITIES.'],  sub: 'Built for the crew, readable by flight surgeons on the ground.' }
];
/* Pin length in % of the viewport height (plan §12.3: 800%, 600% on phones) */
window.ADX_PIN = { desktop: 700, mobile: 550 };
