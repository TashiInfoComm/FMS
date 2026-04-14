import { Eye } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import logoImage from '@/assets/logo.png'
import ndiImage from '@/assets/ndi.png'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-[var(--fms-background)] px-4 py-10">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <img src={logoImage} alt="FMS Logo" className="h-20 w-20 object-contain" />

        <Card className="w-full rounded-xl border border-[var(--fms-strokes)] bg-white py-10 shadow-sm">
          <CardContent className="space-y-5">
            <p className="text-center text-sm text-[var(--fms-text-subheading)]">Click to login as citizen to avail the service</p>

            <Button
              className="h-11 w-full rounded-full bg-[var(--fms-ndi-button)] hover:bg-[var(--fms-button-hover)]"
              onClick={() => navigate('/login/ndi')}
            >
              <img src={ndiImage} alt="" className="mr-2 h-4 w-4" />
              Login with Bhutan NDI
            </Button>

            <div className="flex items-center gap-4 text-sm text-[var(--fms-text-subheading)]">
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
              OR
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input id="user-id" placeholder="your.email@fms.bt" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type="password" defaultValue="********" className="pr-10" />
                <Eye className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-[var(--fms-text-subheading)]">
                <input type="checkbox" className="h-4 w-4 rounded border-[var(--fms-strokes)]" />
                Remember me
              </label>
              <button type="button" className="font-medium text-[var(--fms-accent-purple)]">
                Forgot password?
              </button>
            </div>

            <Button className="h-11 w-full rounded-md bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]" asChild>
              <Link to="/dashboard">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
