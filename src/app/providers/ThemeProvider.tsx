// Wraps children with the app theme provider boundary.
import type { PropsWithChildren } from 'react'

export function ThemeProvider({ children }: PropsWithChildren) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>
}
