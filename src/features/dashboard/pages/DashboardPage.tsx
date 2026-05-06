// Displays top-level dashboard metrics and quick status cards.
import { Activity, Building2, CarFront, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/shared/components/PageHeader'

const dashboardStats = [
  { title: 'Total Agencies', value: '24', icon: Building2 },
  { title: 'Active Users', value: '153', icon: Users },
  { title: 'Vehicles Assigned', value: '82', icon: CarFront },
  { title: 'Open Requests', value: '11', icon: Activity },
]

export function DashboardPage() {
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
    </section>
  )
}
