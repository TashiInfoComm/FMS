// Manual self-registration: same directory lookup + org tiers as admin create; roles are assigned on the server.
import { useLocation } from 'react-router-dom'

import type { NdiManualSignupPrefillState } from '@/features/auth/lib/ndi-proof-request-api'
import { DirectoryUserRegistrationForm } from '@/features/user/components/DirectoryUserRegistrationForm'

export function SignupPage() {
  const location = useLocation()
  const ndiBootstrap =
    (location.state as NdiManualSignupPrefillState | null)?.ndiPrefill ?? null

  return (
    <main className="min-h-screen bg-[var(--fms-background)] px-4 py-12">
      <section className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-center text-lg font-semibold tracking-wide text-[var(--fms-accent-purple)]">
          ROYAL GOVERNMENT OF BHUTAN - In Pursuit of Improving Public Service Delivery
        </h1>
        <DirectoryUserRegistrationForm mode="signup" ndiBootstrap={ndiBootstrap} />
      </section>
    </main>
  )
}
