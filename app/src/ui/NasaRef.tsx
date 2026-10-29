import { Link } from 'react-router-dom'

/**
 * A small source tag naming the NASA basis of a number: `NASA · STD-3001 V2 6004`. External sources open in a new
 * tab; `to` links within the console instead (the NASA Data page). Styles: components/nasa-ref.css.
 */
export function NasaRef({ label, href, to, title }: { label: string; href?: string; to?: string; title?: string }) {
  const body = <><span className="nref-n" aria-hidden="true">NASA</span><span className="nref-l">{label}</span></>
  const name = `NASA source: ${title ?? label}`
  if (to) return <Link className="nref" to={to} title={title} aria-label={name}>{body}</Link>
  return (
    <a className="nref" href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={`${name} (opens in a new tab)`}>{body}</a>
  )
}
