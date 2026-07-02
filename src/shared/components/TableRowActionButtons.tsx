/** Outlined row actions using :root --fms-* tokens (index.css / globals.css). */
import { Pencil, Trash2, BookmarkX, CheckCircle, Undo2, EyeIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const rowActionsContainerClassName = 'flex flex-wrap items-center justify-center gap-4'

export const detailRowActionButtonClassName =
  'h-8 gap-1 cursor-pointer rounded-lg border border-[var(--fms-neutral-border)] bg-[var(--fms-neutral-fill)] text-[var(--fms-neutral-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-warning-border)]/55 dark:bg-[var(--fms-warning-fill)]/30 dark:text-[var(--fms-warning-text)] dark:hover:bg-[var(--fms-warning-fill)]/45'

export const editRowActionButtonClassName =
  'h-8 gap-1 cursor-pointer rounded-lg border border-[var(--fms-info-border)] bg-[var(--fms-info-fill)] text-[var(--fms-info-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-info-border)]/50 dark:bg-[var(--fms-info-fill)]/30 dark:text-[var(--fms-info-border)] dark:hover:bg-[var(--fms-info-fill)]/45'

export const deleteRowActionButtonClassName =
  'h-8 gap-1 cursor-pointer rounded-lg border border-[var(--fms-error-border)] bg-[var(--fms-error-fill)] text-[var(--fms-error-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-error-border)]/45 dark:bg-[var(--fms-error-fill)]/30 dark:text-[var(--fms-error-border)] dark:hover:bg-[var(--fms-error-fill)]/45'

export const cancelRowActionButtonClassName =
  'h-8 gap-1 cursor-pointer rounded-lg border border-[var(--fms-error-border)] bg-[var(--fms-error-fill)] text-[var(--fms-error-text)] shadow-none hover:brightness-[0.98] [&_svg]:size-3.5 dark:border-[var(--fms-error-border)]/45 dark:bg-[var(--fms-error-fill)]/30 dark:text-[var(--fms-error-border)] dark:hover:bg-[var(--fms-error-fill)]/45'

type RowActionButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'children'> & {
  children?: ReactNode
}

type RowActionTooltipProps = {
  /** Tooltip text; for detail actions, falls back to `name` then "View details". */
  tooltip?: ReactNode
}

export function DetailRowActionButton({ className, name, tooltip, ...props }: RowActionButtonProps & RowActionTooltipProps) {
  const label = tooltip ?? name ?? 'View details'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(detailRowActionButtonClassName, className)}
          {...props}
        >
          <EyeIcon aria-hidden size={24}/>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function EditRowActionButton({
  className,
  tooltip = 'Edit',
  ...props
}: RowActionButtonProps & RowActionTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn(editRowActionButtonClassName, className)} {...props}>
          <Pencil aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function DeleteRowActionButton({
  className,
  tooltip = 'Delete',
  ...props
}: RowActionButtonProps & RowActionTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn(deleteRowActionButtonClassName, className)} {...props}>
          <Trash2 aria-hidden size={24}/>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function CancelRowActionButton({ 
  className,
  tooltip = 'Cancel',
  ...props
}: RowActionButtonProps & RowActionTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn(cancelRowActionButtonClassName, className)} {...props}>
          <BookmarkX aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }


  export function ApproveLineItemActionButton({ 
    className,
    tooltip = 'Approve line item',
    ...props
  }: RowActionButtonProps & RowActionTooltipProps) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="sm" className={cn(editRowActionButtonClassName, className)} {...props}>
            <CheckCircle aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      )
    }


    export function ReturnLineItemActionButton({ 
      className,
      tooltip = 'Return',
      ...props
    }: RowActionButtonProps & RowActionTooltipProps) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="sm" className={cn(cancelRowActionButtonClassName, className)} {...props}>
              <Undo2 aria-hidden size={24}/>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )
      }