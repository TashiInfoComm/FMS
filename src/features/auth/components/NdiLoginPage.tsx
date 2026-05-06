// Presents the NDI-based login entry and provider actions.
import { Mail, Phone, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NdiQrCodePanel } from '@/features/auth/components/NdiQrCodePanel'

const GOOGLE_PLAY_URL =
  'https://play.google.com/store/search?q=bhutan%20ndi&c=apps&hl=en_IN&gl=US'
const APP_STORE_URL = 'https://apps.apple.com/in/app/bhutan-ndi/id1645493166'

const GOOGLE_PLAY_BADGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg'
const APP_STORE_BADGE_URL =
  'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'

export function NdiLoginPage() {
  // Opens the official NDI tutorial resource in a new tab.
  const handleOpenVideoGuide = () => {
    window.open("https://www.youtube.com/@BhutanNDI", "_blank")
  }

  return (
    <main className="max-h-screen overflow-y-auto bg-[var(--fms-background)] px-4 py-8">
      <section className="mx-auto max-h-screen flex w-full max-w-4xl flex-col items-center gap-6">
        <h1 className="text-center text-lg font-semibold tracking-wide text-[var(--fms-accent-purple)]">
          ROYAL GOVERNMENT OF BHUTAN - In Pursuit of Improving Public Service
          Delivery
        </h1>

        <Card className="w-full max-w-3xl rounded-xl border border-[var(--fms-strokes)] bg-white py-6 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-lg font-medium">
              Scan with{" "}
              <span className="text-[var(--fms-ndi-text)]">Bhutan NDI</span>{" "}
              Wallet.
            </p>
            <NdiQrCodePanel intent="login" />
            <ol className="max-w-sm list-decimal space-y-2 text-sm text-[var(--fms-text-subheading)]">
              <li>Open Bhutan NDI Wallet on your phone</li>
              <li>
                Tap the Scan button located on the menu bar and scan the QR code
              </li>
            </ol>

            <Button
              variant="secondary"
              className="h-9 cursor-pointer rounded-full border-[var(--fms-ndi-text)] px-4 text-[var(--fms-ndi-text)]"
              onClick={handleOpenVideoGuide}
            >
              Watch video guide
              <PlayCircle className="mr-2 h-5 w-5 text-[var(--fms-ndi-text)]" />
            </Button>

            <p className="text-sm text-[var(--fms-text-subheading)]">
              Don&apos;t have the Bhutan NDI Wallet?{" "}
              <a
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--fms-ndi-text)]"
              >
                Download Now!
              </a>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Bhutan NDI from Google Play"
              >
                <img
                  src={GOOGLE_PLAY_BADGE_URL}
                  alt="Get it on Google Play"
                  className="h-9 w-auto"
                />
              </a>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Bhutan NDI from App Store"
              >
                <img
                  src={APP_STORE_BADGE_URL}
                  alt="Download on the App Store"
                  className="h-9 w-auto"
                />
              </a>
            </div>

            <div className="space-y-2 text-center">
              <p className="font-medium text-[var(--fms-ndi-text)]">
                Get Support
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--fms-text-subheading)]">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--fms-ndi-text)]" />
                  ndifeedback@dhi.bt
                </span>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[var(--fms-ndi-text)]" />
                  1199
                </span>
              </div>
            </div>

            <div className="flex w-full max-w-sm items-center gap-4 text-sm text-[var(--fms-text-subheading)]">
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
              OR
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
            </div>

            {/* <label className="inline-flex items-center gap-2 text-base font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--fms-strokes)]"
              />
              Login without Bhutan NDI Wallet
            </label> */}

            <Button
              variant="link"
              asChild
              className="text-sm text-[var(--fms-neutral-text)]"
            >
              <Link to="/login">Login without Bhutan NDI Wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
