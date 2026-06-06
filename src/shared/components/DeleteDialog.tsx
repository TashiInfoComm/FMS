// Renders a confirmation dialog for destructive delete actions.
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type DeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmLabel?: string
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Delete Record',
  description = 'Are you sure you want to delete this record? This action cannot be undone.',
  confirmLabel = 'Delete',
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-[var(--fms-error-fill)] p-2.5">
            <AlertTriangle className="h-5 w-5 text-[var(--fms-delete)]" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-center sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[var(--fms-delete)] text-white hover:bg-[#c70009]"
            onClick={() => {
              // Confirm action first, then close to keep calling sites simple.
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
