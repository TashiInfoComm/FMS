// Displays top-level dashboard metrics and quick status cards.
import { Activity, Building2, CarFront, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import { getMappedRolesFromUserProfile } from '@/shared/lib/realm-role-mapping'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { apiPost } from '@/services/apiClient'

const dashboardStats = [
  { title: 'Total Agencies', value: '24', icon: Building2 },
  { title: 'Active Users', value: '153', icon: Users },
  { title: 'Vehicles Assigned', value: '82', icon: CarFront },
  { title: 'Open Requests', value: '11', icon: Activity },
]

export function DashboardPage() {
  const user = useUserStore((state) => state.user)
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')

  const isSuperAdmin = useMemo(() => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return false
    return getMappedRolesFromUserProfile(user as Record<string, unknown>).includes('fms-super-admin')
  }, [user])

  const consolidateMutation = useMutation({
    mutationFn: async () => {
      const monthNumber = Number(month.trim())
      const yearNumber = Number(year.trim())
      if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        throw new Error('Month must be a number from 1 to 12.')
      }
      if (!Number.isInteger(yearNumber) || yearNumber < 1) {
        throw new Error('Year must be a valid number.')
      }

      return apiPost<
        unknown,
        { month: number; year: number }
      >('/parking/claims/consolidate', {
        month: monthNumber,
        year: yearNumber,
      })
    },
    onSuccess: () => {
      showSuccessToast('Parking claims consolidation submitted.')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not consolidate parking claims.')
    },
  })

  return (
    <section className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Overview of fleet and admin operations." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Static placeholder metrics until dashboard API aggregates exist */}
        {dashboardStats.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--fms-text-subheading)]">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-3xl font-semibold text-[var(--fms-text-header)]">{item.value}</p>
                <div className="rounded-full bg-[var(--fms-info-fill)] p-2">
                  <Icon className="h-5 w-5 text-[var(--fms-button)]" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="pt-6 text-sm text-[var(--fms-text-subheading)]">
          Welcome to Fleet Management dashboard. Use the menu to manage Agency, Master Management, and User Management modules.
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parking Claims Consolidation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="consolidate-month">Month</Label>
                <Input
                  id="consolidate-month"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter month (1-12)"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consolidate-year">Year</Label>
                <Input
                  id="consolidate-year"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter year (e.g. 2026)"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              disabled={consolidateMutation.isPending}
              onClick={() => consolidateMutation.mutate()}
            >
              {consolidateMutation.isPending ? 'Consolidating…' : 'Consolidate'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
