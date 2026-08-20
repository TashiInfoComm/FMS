// Presents the NDI-based login entry and provider actions.
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { NdiWalletScanCard } from '@/features/auth/components/NdiWalletScanCard'

export function NdiLoginPage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[var(--fms-background)] px-4 py-6">
      <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center gap-4">
        <h1 className="shrink-0 text-center text-lg font-semibold tracking-wide text-[var(--fms-accent-purple)]">
          ROYAL GOVERNMENT OF BHUTAN - In Pursuit of Improving Public Service Delivery
        </h1>

        <div className="flex min-h-0 w-full flex-1 justify-center">
          <NdiWalletScanCard
            intent="login"
            heading={
              <>
                Scan with <span className="text-[var(--fms-ndi-text)]">Bhutan NDI</span> Wallet
              </>
            }
            footer={
              <>
                <div className="mx-auto flex w-full max-w-sm items-center gap-4 text-sm text-[var(--fms-text-subheading)]">
                  <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
                  OR
                  <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
                </div>

                <Button
                  variant="link"
                  asChild
                  className="mt-4 w-full text-sm text-[var(--fms-neutral-text)]"
                >
                  <Link to="/login">Login without Bhutan NDI Wallet</Link>
                </Button>
              </>
            }
          />
        </div>
      </section>
    </main>
  )
}
