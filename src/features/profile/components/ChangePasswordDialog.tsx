import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword } from '@/features/auth/lib/change-password-api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
})

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

type PasswordFieldProps = {
  id: string
  label: string
  autoComplete: string
  error?: string
  registration: ReturnType<typeof useForm<ChangePasswordFormValues>>['register']
  name: keyof ChangePasswordFormValues
}

function PasswordField({
  id,
  label,
  autoComplete,
  error,
  registration,
  name,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="pr-10"
          {...registration(name)}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-[var(--fms-text-subheading)]"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

type ChangePasswordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
    },
    mode: 'onSubmit',
  })

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (response) => {
      showSuccessToast(response.message ?? 'Password changed successfully')
      reset()
      onOpenChange(false)
    },
    onError: (error) => {
      showErrorToast(error, 'Failed to change password')
    },
  })

  const closeDialog = () => {
    if (mutation.isPending) return
    reset()
    onOpenChange(false)
  }

  const onSubmit = (values: ChangePasswordFormValues) => {
    mutation.mutate({
      current_password: values.current_password,
      new_password: values.new_password,
    })
  }

  const onInvalid = (fieldErrors: typeof errors) => {
    const firstError =
      fieldErrors.current_password?.message ?? fieldErrors.new_password?.message
    if (firstError) {
      showErrorToast(new Error(firstError), firstError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit, onInvalid)}>
          <PasswordField
            id="current_password"
            label="Current password"
            autoComplete="current-password"
            name="current_password"
            registration={register}
            error={errors.current_password?.message}
          />
          <PasswordField
            id="new_password"
            label="New password"
            autoComplete="new-password"
            name="new_password"
            registration={register}
            error={errors.new_password?.message}
          />

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
