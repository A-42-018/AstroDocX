#!/usr/bin/env node
/* ============================================================
   AstroDocX — decode a Draco-compressed .glb (NASA 3D Resources
   ships them that way) into a plain .glb the bakers can read.
   Textures are dropped: the bakers only need geometry.

   This is the one tool with dependencies; install them somewhere
   outside the repo and point NODE_PATH there, e.g.
     npm i --prefix /tmp/glbtools @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 draco3dgltf@1.5.7
     NODE_PATH=/tmp/glbtools/node_modules node tools/undraco.mjs in.glb out.glb
============================================================ */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: undraco.mjs in.glb out.glb'); process.exit(1); }
const base = process.env.NODE_PATH ? join(process.env.NODE_PATH.split(':')[0], 'x.js') : import.meta.url;
const req = createRequire(base);
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRDracoMeshCompression } = req('@gltf-transform/extensions');
const draco3d = req('draco3dgltf');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(src);
doc.getRoot().listExtensionsUsed().forEach(e => { if (e instanceof KHRDracoMeshCompression) e.dispose(); });
doc.getRoot().listTextures().forEach(t => t.dispose());
await io.write(out, doc);
console.log('wrote', out);
