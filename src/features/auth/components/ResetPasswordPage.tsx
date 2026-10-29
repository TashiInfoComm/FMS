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

const resetPasswordSchema = z.object({
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: '',
    },
  })

  const resetMutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) =>
      resetPassword({
        token,
        new_password: values.new_password,
      }),
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      showErrorToast('This reset link is missing a token. Request a new link from sign in.')
      return
    }

    try {
      const response = await resetMutation.mutateAsync(values)
      showSuccessToast(response.message ?? 'Password reset successful. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      showErrorToast(error, 'Could not reset password. The link may have expired.')
    }
  }

  return (
    <main className="min-h-screen bg-[var(--fms-background)] px-4 py-10">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <img src={logoImage} alt="FMS Logo" className="h-25 w-25 object-contain" />

        <Card className="w-full rounded-xl border border-[var(--fms-strokes)] bg-white py-10 shadow-sm">
          <CardContent className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold text-[var(--fms-text-header)]">Reset password</h1>
              <p className="text-sm text-[var(--fms-text-subheading)]">
                Enter a new password for your account.
              </p>
            </div>

            {token ? null : (
              <p className="text-sm text-red-600">
                Open the reset link from your email. It includes the token needed to set a new password.
              </p>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="new password"
                    autoComplete="new-password"
                    className="pr-10"
                    {...register('new_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-[var(--fms-text-subheading)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
                {errors.new_password ? (
                  <p className="text-sm text-red-600">{errors.new_password.message}</p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-md bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={!token || resetMutation.isPending}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Reset password'}
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
