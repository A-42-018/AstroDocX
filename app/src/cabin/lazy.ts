import { lazyPage } from '../shell/lazyPage'

/** 3D mode carries three.js and the cabin models, so it is its own chunk; the top-bar button warms it on hover. */
export const CabinPage = lazyPage(() => import('./CabinPage'))
