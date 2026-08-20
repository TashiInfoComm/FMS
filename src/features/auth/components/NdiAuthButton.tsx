import type { ReactNode } from 'react'

import ndiLogo from '@/assets/ndi_login.png'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NdiAuthButtonProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}

/** Bhutan NDI brand button — logo + label, centered, elevated on hover. */
export function NdiAuthButton({
  children,
  className,
  onClick,
  type = 'button',
  disabled,
}: NdiAuthButtonProps) {
  return (
    <Button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'mx-auto flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border-0 bg-[var(--fms-ndi-button)] px-6 text-sm font-medium text-white shadow-none transition-all hover:-translate-y-0.5 hover:bg-[var(--fms-ndi-button)] hover:shadow-[0_6px_16px_rgba(18,65,67,0.35)]',
        className,
      )}
    >
      <img src={ndiLogo} alt="" aria-hidden className="h-5 w-5 shrink-0 object-contain" />
      <span>{children}</span>
    </Button>
  )
}
