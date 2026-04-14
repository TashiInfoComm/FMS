import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

type AppButtonProps = ComponentProps<typeof Button>

export function AppButton(props: AppButtonProps) {
  return <Button {...props} />
}
