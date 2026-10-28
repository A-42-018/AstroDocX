import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass'

/**
 * v3 button: primary is the orange chamfered action (one per panel), ghost is cyan-edged, danger is red-edged.
 * Heights 38 / 42 / 46. While `busy` it shows a spinner, sets aria-busy and ignores clicks.
 */
export function Button({ variant, size, busy, disabled, className, children, type = 'button', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; busy?: boolean }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && <span className="hbtn-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
