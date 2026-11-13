# AstroDocX Crew Console

Offline-first PWA (React + TypeScript + Vite). Concept prototype, not a medical device.

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build (generates the service worker)
npm run preview  # serve the build to test install / offline
npm test         # unit, component and DB tests
npm run demo:snapshot   # after changing the engine or the data generator: regenerate the demo's precomputed output
```

Source layout and the full feature tour are in the [root README](../README.md). The demo mission seeds on first run; all data is synthetic unless you record it yourself with the face scan or a connected watch.

Needs Node 22. Not a medical device.
