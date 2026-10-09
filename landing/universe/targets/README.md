# Baked particle targets

Drop `astronaut.bin`, `orion.bin`, `relay.bin`, `earth.bin` here (24,000 points each, 144,000 bytes).
Missing or wrong-size files are ignored and the procedural shape in `engine.js` stays.

`astronaut.bin` is the whole Crew scene (saluting astronaut, Apollo-style flag, lunar ground, small Earth),
24,000 points plus one tag byte per point (168,000 bytes). Rebuild it from the NASA Z2 spacesuit:

    NODE_PATH=/tmp/glbtools/node_modules node tools/undraco.mjs "Z2 Spacesuit.glb" /tmp/z2.glb   # see undraco.mjs for the npm line
    node tools/bake-moon.mjs --suit /tmp/z2.glb --out landing/universe/targets/astronaut.bin

Make the others with `tools/bake-particles.mjs` (no dependencies):

    node tools/bake-particles.mjs --glb ~/models/orion.glb --out landing/universe/targets/orion.bin --axis y
    sips -s format bmp landmask.png --out landmask.bmp
    node tools/bake-particles.mjs --earth-mask landmask.bmp --out landing/universe/targets/earth.bin

The .glb source files never ship. Record each model's source and licence below (README credits, plan risk table).

## Credits / licences
| Shape | Source URL | Licence | Checked by |
|---|---|---|---|
| astronaut (Z2 spacesuit) | NASA 3D Resources, "Z2 Spacesuit" (_add exact URL_) | NASA media, no copyright (NASA usage guidelines) | |
| orion | _todo_ | _todo_ | |
| relay (TDRS) | _todo_ | _todo_ | |
| earth land mask | _todo_ | _todo_ | |
