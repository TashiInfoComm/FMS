import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

const backToListClassName =
  'inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-[#d1d5db] bg-[#f3f4f6] px-2.5 py-1 text-sm font-semibold text-[var(--fms-text-header)] no-underline shadow-none transition-colors hover:bg-[#e5e7eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fms-button)]/40'

type BackToListButtonProps = {
  to?: string
  state?: unknown
  onClick?: () => void
  label?: string
  className?: string
}

export function BackToListButton({
  to,
  state,
  onClick,
  label = 'Back to list',
  className,
}: BackToListButtonProps) {
  const content = (
    <>
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </>
  )

  if (to) {
    return (
      <Link to={to} state={state} className={cn(backToListClassName, className)}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cn(backToListClassName, className)}>
      {content}
    </button>
  )
}
