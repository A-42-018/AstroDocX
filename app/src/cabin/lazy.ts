import { preloadLoaderArt } from './CabinLoader'
import { lazyPage } from '../shell/lazyPage'

/** 3D mode carries three.js and the cabin models, so it is its own chunk; the top-bar button warms it on hover. */
const page = lazyPage(() => import('./CabinPage'))
const warmChunk = page.preload
/** The warm-up also fetches the loading screen's art. */
export const CabinPage = Object.assign(page, { preload: () => { preloadLoaderArt(); warmChunk() } })
