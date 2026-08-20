// Picks the dashboard composition for the active realm role; each layout owns its own fetches.
import { AgencyAdminDashboard } from '@/features/dashboard/components/layouts/AgencyAdminDashboard'
import { ApplicantDashboard } from '@/features/dashboard/components/layouts/ApplicantDashboard'
import { DispatchDashboard } from '@/features/dashboard/components/layouts/DispatchDashboard'
import { DriverDashboard } from '@/features/dashboard/components/layouts/DriverDashboard'
import { FinanceDashboard } from '@/features/dashboard/components/layouts/FinanceDashboard'
import { NationwideDashboard } from '@/features/dashboard/components/layouts/NationwideDashboard'
import { resolveDashboardLayout } from '@/features/dashboard/lib/dashboard-role-layout'
import { useAccessControl } from '@/shared/hooks/useAccessControl'

export function DashboardPage() {
  const { role } = useAccessControl()

  switch (resolveDashboardLayout(String(role))) {
    case 'nationwide':
      return <NationwideDashboard />
    case 'dispatch':
      return <DispatchDashboard />
    case 'finance':
      return <FinanceDashboard />
    case 'driver':
      return <DriverDashboard />
    case 'applicant':
      return <ApplicantDashboard />
    default:
      return <AgencyAdminDashboard />
  }
}
