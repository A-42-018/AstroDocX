import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cabinSeen, markCabinSeen } from './cabinSeen'

/** Once per browser: a small callout under the top bar's 3D Cabin button, so a first-time visitor knows the cabin is there. */
const SHOW_AFTER = 1800, HIDE_AFTER = 9000

export function CabinHint() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (cabinSeen()) return
    let t = 0
    const arm = () => { t = window.setTimeout(() => { setShow(true); markCabinSeen() }, SHOW_AFTER) }
    // wait for the launch screen (public/splash.js) to close, so the hint is not shown underneath it
    const launching = !!(window as Window & { adxSplash?: unknown }).adxSplash
    if (launching) window.addEventListener('adx:launched', arm, { once: true }); else arm()
    return () => { window.removeEventListener('adx:launched', arm); clearTimeout(t) }
  }, [])
  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => setShow(false), HIDE_AFTER)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="cabin-hint" role="status">
      <Link to="/cabin" className="cabin-hint-go" onClick={() => setShow(false)}>
        <b>New · 3D Cabin</b>
        <span>Walk through the crew module and see every screen live.</span>
      </Link>
      <button type="button" className="cabin-hint-x" aria-label="Dismiss" onClick={() => setShow(false)}><X size={14} aria-hidden="true" /></button>
    </div>
  )
}
