import './header.css'
import { ScanFace } from 'lucide-react'
import { Link } from 'react-router-dom'
import { XrayPage } from './lazy'

/** The top bar's "X-Ray" button: opens the X-Ray Mirror (and fetches its page on hover, so it opens at once). */
export function XrayButton() {
  return (
    <span className="tb-xr">
      <Link to="/xray" className="tb-cabin tb-xray" aria-label="X-Ray Mirror: see your skull and bones through the camera" title="X-Ray Mirror: see inside your head with the camera"
        onPointerEnter={() => XrayPage.preload()} onFocus={() => XrayPage.preload()}>
        <ScanFace size={16} strokeWidth={2} aria-hidden="true" /><span className="tb-cabin-l">X-Ray</span>
      </Link>
    </span>
  )
}
