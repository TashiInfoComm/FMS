import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MobileListCardProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function MobileListCard({ children, className, onClick }: MobileListCardProps) {
  if (onClick) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'w-full cursor-pointer rounded-lg border border-[var(--fms-strokes)] bg-white p-3 text-left transition-colors hover:bg-[#fafafa]',
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--fms-strokes)] bg-white p-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MobileListField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-sm text-[var(--fms-text-subheading)]', className)}>
      <span className="font-medium text-[var(--fms-text-header)]">{label}:</span>{' '}
      {children}
    </p>
  )
}

export function ListPanelMessage({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <p
      className={cn(
        'py-6 text-center text-sm',
        tone === 'error'
          ? 'text-[var(--fms-delete)]'
          : 'text-[var(--fms-text-subheading)]',
      )}
    >
      {children}
    </p>
  )
}
