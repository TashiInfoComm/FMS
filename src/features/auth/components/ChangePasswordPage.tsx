import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import logoImage from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/features/auth/lib/reset-password-api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const changePasswordSchema = z
  .object({
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

type PasswordFieldProps = {
  id: string
  label: string
  autoComplete: string
  placeholder: string
  error?: string
  registration: ReturnType<typeof useForm<ChangePasswordFormValues>>['register']
  name: keyof ChangePasswordFormValues
}

function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
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
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
          {...registration(name)}
        />
        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
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

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  })

  const changeMutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      resetPassword({
        token,
        new_password: values.new_password,
      }),
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    if (!token) {
      showErrorToast('This link is missing a token. Open the link from your email.')
      return
    }

    try {
      const response = await changeMutation.mutateAsync(values)
      showSuccessToast(response.message ?? 'Password changed. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      showErrorToast(error, 'Could not change password. The link may have expired.')
    }
  }

  return (
    <main className="min-h-screen bg-[var(--fms-background)] px-4 py-10">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <img src={logoImage} alt="FMS Logo" className="h-25 w-25 object-contain" />

        <Card className="w-full rounded-xl border border-[var(--fms-strokes)] bg-white py-10 shadow-sm">
          <CardContent className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold text-[var(--fms-text-header)]">Change password</h1>
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Choose a new password for your account.
              </p>
            </div>

            {token ? null : (
              <p className="text-sm text-red-600">
                Open the link from your email. It includes the token needed to change your password.
              </p>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <PasswordField
                id="new_password"
                label="New password"
                autoComplete="new-password"
                placeholder="new password"
                name="new_password"
                registration={register}
                error={errors.new_password?.message}
              />
              <PasswordField
                id="confirm_password"
                label="Confirm password"
                autoComplete="new-password"
                placeholder="confirm password"
                name="confirm_password"
                registration={register}
                error={errors.confirm_password?.message}
              />

              <Button
                type="submit"
                className="h-11 w-full rounded-md bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={!token || changeMutation.isPending}
              >
                {changeMutation.isPending ? 'Saving…' : 'Change password'}
              </Button>
            </form>

            <p className="text-center text-sm text-[var(--fms-text-subheading)]">
              <Link to="/login" className="font-medium text-[var(--fms-accent-purple)]">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
