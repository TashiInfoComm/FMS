import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CarFront,
  Info,
  MapPin,
  Send,
  Truck,
  Users,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmergencyBroadcastStatusCell } from '@/features/emergency-vehicle/components/EmergencyBroadcastStatusCell'
import { EmergencyLocationMapView } from '@/features/emergency-vehicle/components/EmergencyLocationMapView'
import type {
  EmergencyIncidentAssignment,
  EmergencyIncidentDetail,
} from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import {
  canCancelOrCloseEmergencyIncident,
  fetchEmergencyIncidentById,
  formatEmergencyIncidentDateTime,
  isEmergencyDeployFullyCovered,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { mapUserDetailFields } from '@/features/user/lib/users-api'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/services/user-store'
import { ListPanelMessage } from '@/shared/components/MobileListCard'
import { DetailFieldBoxSkeleton } from '@/shared/components/detail-loading'

function resolveSessionAgency(user: Record<string, unknown> | null): {
  id: string
  name: string
} {
  if (!user) return { id: '', name: '' }
  const id = String(
    user.agency_id ?? user.agencyId ?? user.agencyID ?? '',
  ).trim()
  const detail = mapUserDetailFields(user)
  const name =
    detail.agency !== '-'
      ? detail.agency.trim()
      : String(user.agency_name ?? user.agencyName ?? '').trim()
  return { id, name }
}

function MetricCard({
  icon,
  iconClassName,
  value,
  label,
  sublabel,
}: {
  icon: ReactNode
  iconClassName: string
  value: string
  label: string
  sublabel: string
}) {
  return (
    <div className="rounded-xl border border-[var(--fms-strokes)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-[var(--fms-text-header)]">{value}</p>
          <p className="mt-1 text-sm font-medium text-[var(--fms-text-header)]">{label}</p>
          <p className="text-xs text-[var(--fms-text-subheading)]">{sublabel}</p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconClassName,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function IncidentDetailItem({
  icon,
  iconClassName,
  label,
  value,
  subvalue,
  onIconClick,
  iconAriaLabel,
}: {
  icon: ReactNode
  iconClassName: string
  label: string
  value: string
  subvalue?: string
  onIconClick?: () => void
  iconAriaLabel?: string
}) {
  const iconNode = (
    <div
      className={cn(
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        iconClassName,
        onIconClick && 'cursor-pointer transition-opacity hover:opacity-80',
      )}
    >
      {icon}
    </div>
  )

  return (
    <div className="flex items-start gap-3">
      {onIconClick ? (
        <button
          type="button"
          onClick={onIconClick}
          aria-label={iconAriaLabel ?? `View ${label} on map`}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {iconNode}
        </button>
      ) : (
        iconNode
      )}
      <div className="min-w-0">
        <p className="text-xs text-[var(--fms-text-subheading)]">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-[var(--fms-text-header)]">{value}</p>
        {subvalue ? (
          <p className="text-xs text-[var(--fms-text-subheading)]">{subvalue}</p>
        ) : null}
      </div>
    </div>
  )
}

function respondedPercent(detail: EmergencyIncidentDetail): string {
  if (detail.agenciesNotified <= 0) return '0%'
  return `${Math.round((detail.agenciesResponded / detail.agenciesNotified) * 100)}%`
}

function AssignmentDetailCard({
  assignment,
  index,
  total,
  status,
  statusLabel,
  fallbackDescription,
}: {
  assignment: EmergencyIncidentAssignment
  index: number
  total: number
  status: EmergencyIncidentDetail['status']
  statusLabel: string
  fallbackDescription: string
}) {
  const [mapOpen, setMapOpen] = useState(false)
  const hasCoordinates = assignment.latitude != null && assignment.longitude != null
  const vehicleLabel =
    assignment.vehicleTypes.map((type) => type.name).filter(Boolean).join(', ') || '—'
  const notes = assignment.notes.trim() || fallbackDescription || '—'

  return (
    <>
      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">
              {total > 1
                ? `Emergency Assistance Request ${index + 1}`
                : 'Emergency Assistance Request Details'}
            </h2>
            {index === 0 ? (
              <EmergencyBroadcastStatusCell status={status} statusLabel={statusLabel} />
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <IncidentDetailItem
              icon={<MapPin className="h-4 w-4" />}
              iconClassName="bg-[#fee2e2] text-[#dc2626]"
              label="Emergency Location"
              value={assignment.location || '—'}
              subvalue={
                hasCoordinates
                  ? `${assignment.latitude!.toFixed(5)}, ${assignment.longitude!.toFixed(5)}`
                  : undefined
              }
              onIconClick={hasCoordinates ? () => setMapOpen(true) : undefined}
              iconAriaLabel={`View ${assignment.location} on map`}
            />
            <IncidentDetailItem
              icon={<CarFront className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="Vehicle Type Required"
              value={vehicleLabel}
            />
            <IncidentDetailItem
              icon={<CalendarDays className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="Start Date and Time"
              value={formatEmergencyIncidentDateTime(assignment.startDate)}
            />
            <IncidentDetailItem
              icon={<CalendarDays className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="End Date and Time"
              value={formatEmergencyIncidentDateTime(assignment.endDate)}
            />
          </div>

          <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-3">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
              Agencies
            </p>
            {assignment.agencies.length > 0 ? (
              <ul className="mt-3 space-y-4">
                {assignment.agencies.map((agency) => {
                  const broadcasts = (
                    Array.isArray(agency.broadcasts) ? agency.broadcasts : []
                  ).filter((broadcast) => broadcast.declinedVehicleTypesCount > 0)
                  const deployments = Array.isArray(agency.deployments)
                    ? agency.deployments
                    : []
                  const showBroadcasts = broadcasts.length > 0
                  const showDeployments = deployments.length > 0
                  return (
                    <li key={agency.id} className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Building2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fms-text-subheading)]"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                            {agency.agencyName}
                          </p>
                          {agency.agencyCode ? (
                            <p className="text-xs text-[var(--fms-text-subheading)]">
                              {agency.agencyCode}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {showBroadcasts ? (
                        <div className="ml-6 space-y-2">
                          <p className="text-xs font-semibold tracking-wide text-[var(--fms-text-header)] uppercase">
                            Broadcast
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)] bg-white">
                            <table className="w-max min-w-full text-sm">
                              <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Declined Vehicle Types
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Response
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Vehicles Offered
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {broadcasts.map((broadcast) => (
                                  <tr
                                    key={broadcast.id}
                                    className="border-t border-[var(--fms-strokes)]"
                                  >
                                    <td className="px-3 py-2 text-[var(--fms-text-header)]">
                                      {broadcast.declinedVehicleTypesLabel}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-medium text-[#1d4ed8]">
                                        {broadcast.response}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-[var(--fms-text-header)]">
                                      {broadcast.vehiclesOfferedLabel}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {showDeployments ? (
                        <div className="ml-6 space-y-2">
                          <p className="text-xs font-semibold tracking-wide text-[var(--fms-text-header)] uppercase">
                            Deployment
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)] bg-white">
                            <table className="w-max min-w-full text-sm">
                              <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Vehicle
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Vehicle Type
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Deployed At
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Deployed By
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {deployments.map((deployment) => (
                                  <tr
                                    key={deployment.id}
                                    className="border-t border-[var(--fms-strokes)]"
                                  >
                                    <td className="px-3 py-2 font-medium text-[var(--fms-text-header)]">
                                      {deployment.vehiclesOfferedLabel}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--fms-text-header)]">
                                      {deployment.vehicleTypeName}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--fms-text-header)]">
                                      {deployment.deploymentDateTimeLabel}
                                    </td>
                                    <td className="px-3 py-2 text-[var(--fms-text-header)]">
                                      {deployment.deployedByName || '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className="inline-flex rounded-full bg-[#d0fae5] px-2.5 py-1 text-xs font-medium text-[#007a55]">
                                        {deployment.statusLabel}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--fms-text-header)]">—</p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-3">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
              Incident Description
            </p>
            <p className="mt-1 text-sm text-[var(--fms-text-header)]">{notes}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Emergency Location</DialogTitle>
            <DialogDescription>
              {assignment.location || 'Incident coordinates on the map'}
            </DialogDescription>
          </DialogHeader>
          {hasCoordinates ? (
            <EmergencyLocationMapView
              latitude={assignment.latitude!}
              longitude={assignment.longitude!}
              label={assignment.location}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function EmergencyBroadcastDetailContent({
  detail,
  showBroadcastSummary,
}: {
  detail: EmergencyIncidentDetail
  showBroadcastSummary: boolean
}) {
  const assignments =
    detail.assignments.length > 0
      ? detail.assignments
      : [
          {
            id: detail.id,
            location: detail.location,
            latitude: detail.latitude,
            longitude: detail.longitude,
            startDate: detail.startDate,
            endDate: detail.endDate,
            notes: detail.description,
            vehicleTypes: detail.vehicleTypes,
            agencies: [],
          } satisfies EmergencyIncidentAssignment,
        ]

  return (
    <div className="space-y-5">
      {showBroadcastSummary ? (
        <>
          {detail.agenciesResponded > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {detail.agenciesResponded}{' '}
                {detail.agenciesResponded === 1 ? 'agency has' : 'agencies have'} responded with
                vehicle offers.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Incident broadcasted to agencies. Awaiting vehicle offers and deployment
                responses.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Building2 className="h-5 w-5" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              value={String(detail.agenciesNotified)}
              label="Total Agencies Notified"
              sublabel={
                detail.searchRadiusKm != null
                  ? `Within ${detail.searchRadiusKm} KM`
                  : 'Broadcast recipients'
              }
            />
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              value={`${detail.agenciesResponded} (${respondedPercent(detail)})`}
              label="Agencies Responded"
              sublabel="Offered vehicles"
            />
            <MetricCard
              icon={<Truck className="h-5 w-5" />}
              iconClassName="bg-[#dcfce7] text-[#16a34a]"
              value={String(detail.vehiclesOffered)}
              label="Vehicles Offered"
              sublabel={
                detail.agenciesResponded > 0
                  ? `Across ${detail.agenciesResponded} ${detail.agenciesResponded === 1 ? 'agency' : 'agencies'}`
                  : 'No offers yet'
              }
            />
          </div>
        </>
      ) : null}

      {detail.description.trim() && detail.assignments.length > 1 ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
              Description
            </p>
            <p className="mt-1 text-sm text-[var(--fms-text-header)]">
              {detail.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {assignments.map((assignment, index) => (
        <AssignmentDetailCard
          key={assignment.id}
          assignment={assignment}
          index={index}
          total={assignments.length}
          status={detail.status}
          statusLabel={detail.statusLabel}
          fallbackDescription={detail.description}
        />
      ))}
    </div>
  )
}

function EmergencyBroadcastDetail() {
  const navigate = useNavigate()
  const { incidentId = '' } = useParams<{ incidentId: string }>()
  const location = useLocation()
  const user = useUserStore((state) => state.user)
  const sessionAgency = useMemo(
    () =>
      resolveSessionAgency(
        user && typeof user === 'object' && !Array.isArray(user)
          ? (user as Record<string, unknown>)
          : null,
      ),
    [user],
  )
  const backPath =
    (location.state as { backPath?: string } | null)?.backPath ?? '/emergency/broadcast'
  const showBroadcastSummary = backPath === '/emergency/broadcast'
  const showDeployAction = backPath === '/emergency/request'
  const resolvedId = decodeURIComponent(incidentId).trim()

  const detailQuery = useQuery({
    queryKey: ['emergency', 'incidents', 'detail', resolvedId],
    queryFn: () => fetchEmergencyIncidentById(resolvedId),
    enabled: resolvedId.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const detail = detailQuery.data
  const canDeploy =
    detail != null && canCancelOrCloseEmergencyIncident(detail.status)
  const deployFullyCovered =
    detail != null &&
    isEmergencyDeployFullyCovered(detail, {
      id: sessionAgency.id,
      name: sessionAgency.name,
    })
  const showDeployButton =
    showDeployAction && detail != null && !deployFullyCovered

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <Button type="button" variant="ghost" className="-ml-2 w-fit px-2" asChild>
          <Link to={backPath}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
            {detail
              ? `Emergency Request ${detail.requestId}`
              : 'Emergency Request Detail'}
          </h1>
          {showDeployButton ? (
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] text-white hover:bg-[var(--fms-button-hover)] sm:w-auto"
              disabled={!canDeploy}
              onClick={() =>
                navigate(`/emergency/request/${encodeURIComponent(detail.id)}/deploy`)
              }
            >
              <Send className="mr-1 h-4 w-4" />
              Deploy Vehicle
            </Button>
          ) : null}
        </div>
      </div>

      {detailQuery.isLoading ? (
        showBroadcastSummary ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <DetailFieldBoxSkeleton key={index} label="Loading" />
            ))}
          </div>
        ) : (
          <DetailFieldBoxSkeleton label="Loading" />
        )
      ) : detailQuery.isError || !detail ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="p-4">
            <ListPanelMessage>
              {detailQuery.isError
                ? 'Failed to load emergency incident details.'
                : 'Emergency incident not found.'}
            </ListPanelMessage>
          </CardContent>
        </Card>
      ) : (
        <EmergencyBroadcastDetailContent
          detail={detail}
          showBroadcastSummary={showBroadcastSummary}
        />
      )}
    </section>
  )
}

export default EmergencyBroadcastDetail
