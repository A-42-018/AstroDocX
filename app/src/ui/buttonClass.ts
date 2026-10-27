export type ButtonVariant = 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/** Class names for the v3 button, for links and other elements that look like a button. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return ['hbtn', variant !== 'primary' && variant, size !== 'md' && size, extra].filter(Boolean).join(' ')
}
