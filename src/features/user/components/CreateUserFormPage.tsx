/**
 * Route: `/users/add`. Delegates to shared directory registration form (admin mode).
 */
import { DirectoryUserRegistrationForm } from '@/features/user/components/DirectoryUserRegistrationForm'

export function CreateUserFormPage() {
  return (
    <section className="space-y-5">
      <DirectoryUserRegistrationForm mode="admin" />
    </section>
  )
}
