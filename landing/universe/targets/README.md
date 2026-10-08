# Baked particle targets

Drop `astronaut.bin`, `orion.bin`, `relay.bin`, `earth.bin` here (24,000 points each, 144,000 bytes).
Missing or wrong-size files are ignored and the procedural shape in `engine.js` stays.

Make them with `tools/bake-particles.mjs` (no dependencies):

    node tools/bake-particles.mjs --glb ~/models/orion.glb --out landing/universe/targets/orion.bin --axis y
    sips -s format bmp landmask.png --out landmask.bmp
    node tools/bake-particles.mjs --earth-mask landmask.bmp --out landing/universe/targets/earth.bin

The .glb source files never ship. Record each model's source and licence below (README credits, plan risk table).

## Credits / licences
| Shape | Source URL | Licence | Checked by |
|---|---|---|---|
| astronaut | _todo_ | _todo_ | |
| orion | _todo_ | _todo_ | |
| relay (TDRS) | _todo_ | _todo_ | |
| earth land mask | _todo_ | _todo_ | |
