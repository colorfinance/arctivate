import Link from 'next/link'

// Three buttons, and one of them can glow.
//
// The accent gradient used to be on everything: SIGN IN, I'M IN, CHALLENGE
// SOMEONE, Post, Allow notifications, six Follow pills in one viewport. When
// everything glows, nothing does. So `primary` is flat accent, and only
// `hero` -- at most one per screen -- gets the gradient and the glow.

const BASE = 'inline-flex items-center justify-center gap-2 font-bold rounded-control transition-all duration-fast ease-arc active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 select-none'

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[16px]',
}

const VARIANTS = {
  hero: 'bg-accent-gradient text-white shadow-glow-accent font-black italic uppercase tracking-wide',
  primary: 'bg-arc-accent text-white',
  secondary: 'bg-arc-surface2 text-white border border-white/[0.08] hover:border-white/20',
  tertiary: 'bg-transparent text-arc-muted hover:text-white',
  danger: 'bg-arc-danger/10 text-arc-danger hover:bg-arc-danger/20',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  href,
  className = '',
  children,
  ...rest
}) {
  const cls = `${BASE} ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${block ? 'w-full' : ''} ${className}`
  if (href) return <Link href={href} className={cls} {...rest}>{children}</Link>
  return <button className={cls} {...rest}>{children}</button>
}
