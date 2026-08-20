// Tooltip line shared by the dashboard charts: swatch, series name, formatted value.
import type { ReactNode } from 'react'

type ChartTooltipRowProps = {
  color?: string
  label: ReactNode
  value: string
}

export function ChartTooltipRow({ color, label, value }: ChartTooltipRowProps) {
  return (
    <div className="flex w-full items-center gap-2">
      {color ? (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}
