import { useQuery } from '@tanstack/react-query'
import { Bell, ClipboardList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DesignatedTypeListFilter } from '@/features/fuel/components/DesignatedTypeListFilter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  fetchRenewalApplications,
  fetchRenewalDocumentTypes,
  formatRenewalStatusLabel,
  isSecretariatDesignationType,
  normalizeRenewalStatus,
  RENEWAL_PENDING_DRIVER_STATUS,
  renewalStatusBadgeClass,
  type RenewalApplication,
} from '@/features/maintenance/lib/renewal-applications-api'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import {
  canFilterDesignatedVehicleLists,
  canShowDesignatedFuelLogCreate,
  canShowMaintenanceRenewalMenu,
} from '@/shared/lib/designated-mto-access'
import {
  DetailRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { mapApiRoleValue } from '@/shared/lib/realm-role-mapping'

const ALL_DOCUMENT_TYPES = 'all'

function renewalTypeLabel(row: RenewalApplication): string {
  return row.renewalTypeLabels.length > 0 ? row.renewalTypeLabels.join(', ') : '—'
}

function queryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function activeRoleSlug(role: string | null | undefined, apiRoleName: string | null | undefined): string {
  const mapped = mapApiRoleValue(apiRoleName) ?? mapApiRoleValue(role)
  return String(mapped ?? apiRoleName ?? role ?? '')
    .trim()
    .toLowerCase()
}

function notificationDetail(row: RenewalApplication, isDriver: boolean): string {
  if (isDriver) {
    return `Submit the renewal documents for ${renewalTypeLabel(row)}.`
  }
  return `Waiting for the driver to submit ${renewalTypeLabel(row)}.`
}

export default function PreventiveMaintenance() {
  const navigate = useNavigate()
  const crud = useRouteCrudPermissions('/maintenance/renewal')
  const { role, apiRoleName } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const normalizedRole = `${role ?? ''} ${apiRoleName ?? ''}`.toLowerCase()
  const roleSlug = activeRoleSlug(role, apiRoleName)
  const isDriverRole = roleSlug === 'fms-driver' || normalizedRole.includes('driver')
  const isMtoRole = roleSlug === 'fms-mto'
  const showNotificationCard = isDriverRole || isMtoRole
  const designatedMtoRenewal = canShowMaintenanceRenewalMenu(apiRoleName)
  const canSubmitSecretariatRenewal =
    canShowDesignatedFuelLogCreate(apiRoleName, user) ||
    canShowDesignatedFuelLogCreate(role, user)
  const showDesignatedTypeFilter =
    canFilterDesignatedVehicleLists(apiRoleName, user) ||
    canFilterDesignatedVehicleLists(role, user)
  const canViewRenewals = designatedMtoRenewal || !crud.isResolved || crud.canRead
  const renewalViewDenied = crud.isResolved && !crud.canRead && !designatedMtoRenewal
  const [documentTypeCode, setDocumentTypeCode] = useState(ALL_DOCUMENT_TYPES)
  const [designationType, setDesignationType] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const canLoad = canViewRenewals

  const typesQuery = useQuery({
    queryKey: ['renewal-document-types'],
    queryFn: fetchRenewalDocumentTypes,
    staleTime: 60_000,
  })

  const notificationsQuery = useQuery({
    queryKey: ['renewal-applications', RENEWAL_PENDING_DRIVER_STATUS],
    queryFn: () => fetchRenewalApplications({ status: RENEWAL_PENDING_DRIVER_STATUS }),
    enabled: canLoad && showNotificationCard,
    staleTime: 30_000,
  })

  const designationTypeParam = showDesignatedTypeFilter ? designationType.trim() : ''

  const listQuery = useQuery({
    queryKey: ['renewal-applications', 'document', documentTypeCode, designationTypeParam],
    queryFn: () =>
      fetchRenewalApplications({
        ...(documentTypeCode === ALL_DOCUMENT_TYPES ? {} : { code: documentTypeCode }),
        ...(designationTypeParam ? { designationType: designationTypeParam } : {}),
      }),
    enabled: canLoad,
    staleTime: 30_000,
  })

  const documentTypes = typesQuery.data ?? []
  const documentTabs = useMemo(
    () => [
      { id: ALL_DOCUMENT_TYPES, name: 'All' },
      ...documentTypes
        .filter((type) => type.code.trim())
        .map((type) => ({ id: type.code, name: type.name })),
    ],
    [documentTypes],
  )
  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data])
  const rows = useMemo(() => listQuery.data ?? [], [listQuery.data])

  const totalCount = rows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))
  const pageStart = Math.max(0, (page - 1) * pageSize)
  const pageRows = rows.slice(pageStart, pageStart + pageSize)
  const columnCount = 5

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const showSecretariatSubmit = (row: RenewalApplication) =>
    canSubmitSecretariatRenewal &&
    isSecretariatDesignationType(row.designationType) &&
    normalizeRenewalStatus(row.status) === RENEWAL_PENDING_DRIVER_STATUS

  const openSubmitForm = (id: string) => {
    navigate(`/maintenance/renewal/${encodeURIComponent(id)}`)
  }

  const openApplicationDetail = (id: string) => {
    navigate(`/maintenance/renewal/${encodeURIComponent(id)}/details`)
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Preventive Maintenance & Renewals"
        subtitle="System-generated renewal triggers raised one week before document expiry."
      />

      {showNotificationCard ? (
        <Card className="rounded-2xl border border-[var(--fms-strokes)] bg-white ring-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--fms-text-header)]" aria-hidden />
                <h2 className="text-base font-semibold text-[var(--fms-text-header)]">Notifications</h2>
              </div>
              {canLoad && !notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length > 0 ? (
                <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-medium text-[#1d4ed8]">
                  {notifications.length} new
                </span>
              ) : null}
            </div>

            {renewalViewDenied ? (
              <p className="py-2 text-sm text-[var(--fms-text-subheading)]">
                You do not have permission to view renewal applications.
              </p>
            ) : notificationsQuery.isLoading ? (
              <p className="py-2 text-sm text-[var(--fms-text-subheading)]">Loading notifications…</p>
            ) : notificationsQuery.isError ? (
              <p className="py-2 text-sm text-[var(--fms-delete)]">
                {queryErrorMessage(notificationsQuery.error, 'Could not load renewal notifications.')}
              </p>
            ) : notifications.length === 0 ? (
              <p className="py-2 text-sm text-[var(--fms-text-subheading)]">
                {isDriverRole
                  ? 'No renewal applications are waiting for your response.'
                  : 'No renewal applications are waiting for a driver response.'}
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {notifications.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openSubmitForm(row.id)}
                      className="flex w-full items-start gap-3 rounded-xl bg-[rgba(239,246,255,0.4)] p-2.5 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fffbeb]">
                        <ClipboardList className="h-4 w-4 text-[#bb4d00]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--fms-text-header)]">
                            {row.vehicleNumber}
                          </span>
                          <span
                            aria-label="Unread"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fms-button)]"
                          />
                        </span>
                        <span className="block text-xs text-[var(--fms-text-subheading)]">
                          {notificationDetail(row, isDriverRole)}
                        </span>
                        <span className="block pt-0.5 text-[11px] text-[var(--fms-text-subheading)] opacity-80">
                          {row.applicationNumber}
                        </span>
                      </span>
                      <Badge className={renewalStatusBadgeClass(row.status)}>
                        {formatRenewalStatusLabel(row.status)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showDesignatedTypeFilter ? (
        <DesignatedTypeListFilter
          value={designationType}
          onChange={(next) => {
            setDesignationType(next)
            setPage(1)
          }}
        />
      ) : null}

      <div className="overflow-x-auto">
        <div
          role="tablist"
          aria-label="Document type"
          className="flex min-w-max items-center gap-6 border-b border-[var(--fms-strokes)]"
        >
          {documentTabs.map((tab) => {
            const active = tab.id === documentTypeCode
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setDocumentTypeCode(tab.id)
                  setPage(1)
                }}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--fms-button)] text-[var(--fms-button)]'
                    : 'border-transparent text-[var(--fms-text-subheading)] hover:text-[var(--fms-text-header)]',
                )}
              >
                {tab.name}
              </button>
            )
          })}
        </div>
      </div>
      {typesQuery.isLoading ? (
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading document types…</p>
      ) : null}
      {typesQuery.isError ? (
        <p className="text-sm text-[var(--fms-delete)]">
          {queryErrorMessage(typesQuery.error, 'Could not load document types.')}
        </p>
      ) : null}

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex items-center gap-2 px-1">
            <ClipboardList className="h-4 w-4 text-[var(--fms-text-header)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--fms-text-header)]">
              My Renewal Applications
            </h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Application ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                    <th className="px-4 py-3 text-left font-semibold">Renewal Type(s)</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {renewalViewDenied ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={columnCount}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        You do not have permission to view renewal applications.
                      </td>
                    </tr>
                  ) : listQuery.isLoading ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={columnCount}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        Loading renewal applications…
                      </td>
                    </tr>
                  ) : listQuery.isError ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={columnCount}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {queryErrorMessage(listQuery.error, 'Could not load renewal applications.')}
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr className="border-t border-[var(--fms-strokes)]">
                      <td
                        colSpan={columnCount}
                        className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                      >
                        {documentTypeCode === ALL_DOCUMENT_TYPES && !designationTypeParam
                          ? 'No renewal applications found.'
                          : 'No renewal applications match this filter.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--fms-strokes)]">
                        <td className="px-4 py-4 font-medium text-[var(--fms-text-header)]">
                          {row.applicationNumber}
                        </td>
                        <td className="px-4 py-4 text-[var(--fms-text-header)]">
                          {row.vehicleNumber}
                        </td>
                        <td className="px-4 py-4 text-[var(--fms-text-subheading)]">
                          {renewalTypeLabel(row)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={renewalStatusBadgeClass(row.status)}>
                            {formatRenewalStatusLabel(row.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`${rowActionsContainerClassName} justify-end`}>
                            {showSecretariatSubmit(row) ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                onClick={() => openSubmitForm(row.id)}
                              >
                                Submit
                              </Button>
                            ) : null}
                            <DetailRowActionButton
                              type="button"
                              tooltip="View details"
                              aria-label={`View renewal application ${row.applicationNumber}`}
                              onClick={() => openApplicationDetail(row.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalCount > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={(nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages)))}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize)
                setPage(1)
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
