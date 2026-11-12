import { lazyPage } from '../shell/lazyPage'

/** The X-Ray Mirror carries three.js and the trackers, so it is its own chunk; the top-bar button warms it on hover. */
export const XrayPage = lazyPage(() => import('./XrayPage'))
