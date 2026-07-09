import { cn } from '@/lib/utils'

export function VehicleCategoryBadges({
  categories,
  className,
}: {
  categories: string[]
  className?: string
}) {
  if (categories.length === 0) {
    return <span className="text-[var(--fms-text-subheading)]">—</span>
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {categories.map((category) => (
        <span
          key={category}
          className="inline-flex rounded-full border border-[var(--fms-strokes)] bg-[#f6f6f7] px-2.5 py-0.5 text-xs font-medium text-[var(--fms-text-header)]"
        >
          {category}
        </span>
      ))}
    </div>
  )
}
