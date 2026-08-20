import { Mail, Phone } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { NdiQrCodePanel } from '@/features/auth/components/NdiQrCodePanel'
import { NdiVideoGuideButton } from '@/features/auth/components/NdiVideoGuideButton'
import {
  NDI_APP_STORE_BADGE_URL,
  NDI_APP_STORE_URL,
  NDI_GOOGLE_PLAY_BADGE_URL,
  NDI_GOOGLE_PLAY_URL,
  NDI_SUPPORT_EMAIL,
  NDI_SUPPORT_PHONE,
} from '@/features/auth/lib/ndi-wallet-links'
import type { NdiProofIntent } from '@/features/auth/lib/ndi-proof-request-api'

type NdiWalletScanCardProps = {
  intent: NdiProofIntent
  heading: ReactNode
  footer: ReactNode
}

export function NdiWalletScanCard({ intent, heading, footer }: NdiWalletScanCardProps) {
  return (
    <Card className="flex h-full min-h-0 w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-xl border border-[var(--fms-strokes)] bg-white py-0 shadow-sm">
      <CardContent className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-y-contain px-6 py-[30px]">
        <p className="text-center text-lg font-medium text-[var(--fms-text-header)]">{heading}</p>

        <div className="mt-[30px]">
          <NdiQrCodePanel intent={intent} />
        </div>

        <ol className="mt-[30px] max-w-sm list-decimal space-y-2 pl-5 text-sm text-[var(--fms-text-subheading)]">
          <li>Open Bhutan NDI Wallet on your phone</li>
          <li>Tap the Scan button located on the menu bar and scan the QR code</li>
        </ol>

        <div className="mt-[30px]">
          <NdiVideoGuideButton />
        </div>

        <p className="mt-[30px] text-center text-sm text-[var(--fms-text-subheading)]">
          Don&apos;t have the Bhutan NDI Wallet?{' '}
          <a
            href={NDI_GOOGLE_PLAY_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--fms-ndi-text)]"
          >
            Download Now!
          </a>
        </p>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={NDI_GOOGLE_PLAY_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Download Bhutan NDI from Google Play"
          >
            <img
              src={NDI_GOOGLE_PLAY_BADGE_URL}
              alt="Get it on Google Play"
              className="h-9 w-auto"
            />
          </a>
          <a
            href={NDI_APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Download Bhutan NDI from App Store"
          >
            <img
              src={NDI_APP_STORE_BADGE_URL}
              alt="Download on the App Store"
              className="h-9 w-auto"
            />
          </a>
        </div>

        <div className="mt-[30px] space-y-2.5 text-center">
          <p className="font-medium text-[var(--fms-ndi-text)]">Get Support</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--fms-text-subheading)]">
            <a
              href={`mailto:${NDI_SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 hover:text-[var(--fms-text-header)]"
            >
              <Mail className="h-4 w-4 text-[var(--fms-ndi-text)]" />
              {NDI_SUPPORT_EMAIL}
            </a>
            <a
              href={`tel:${NDI_SUPPORT_PHONE}`}
              className="inline-flex items-center gap-2 hover:text-[var(--fms-text-header)]"
            >
              <Phone className="h-4 w-4 text-[var(--fms-ndi-text)]" />
              {NDI_SUPPORT_PHONE}
            </a>
          </div>
        </div>

        <div className="mt-[30px] w-full">{footer}</div>
      </CardContent>
    </Card>
  )
}
