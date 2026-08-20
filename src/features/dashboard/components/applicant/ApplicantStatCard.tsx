// Applicant metric tile: label and value on the left, a tinted icon tile on the right.
import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

export type ApplicantStatTone = 'blue' | 'amber' | 'green' | 'rose'

const TONE_STYLES: Record<ApplicantStatTone, { tile: string; icon: string; badge: string }> = {
  blue: {
    tile: 'bg-[#eff6ff]',
    icon: 'text-[#1d4ed8]',
    badge: 'bg-[#eff6ff] text-[#1d4ed8]',
  },
  amber: {
    tile: 'bg-[#fffbeb]',
    icon: 'text-[#bb4d00]',
    badge: 'bg-[#fffbeb] text-[#bb4d00]',
  },
  green: {
    tile: 'bg-[#f0fdf4]',
    icon: 'text-[#008236]',
    badge: 'bg-[#f0fdf4] text-[#008236]',
  },
  rose: {
    tile: 'bg-[#fff1f2]',
    icon: 'text-[#e11d48]',
    badge: 'bg-[#fff1f2] text-[#e11d48]',
  },
}

type ApplicantStatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  tone: ApplicantStatTone
  /** Pill under the value, e.g. `Awaiting approval`. */
  caption?: string
}

export function ApplicantStatCard({
  label,
  value,
  icon: Icon,
  tone,
  caption,
}: ApplicantStatCardProps) {
  const styles = TONE_STYLES[tone]

  return (
    <Card className="gap-0 rounded-2xl border border-[var(--fms-strokes)] p-5 ring-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="truncate text-sm font-medium text-[var(--fms-text-subheading)]" title={label}>
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-[var(--fms-text-header)]">
            {value}
          </p>
          {caption ? (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}
            >
              {caption}
            </span>
          ) : null}
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.tile}`}
        >
          <Icon className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
        </span>
      </div>
    </Card>
  )
}
