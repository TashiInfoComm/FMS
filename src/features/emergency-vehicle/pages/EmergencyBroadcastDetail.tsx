import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CarFront,
  Info,
  MapPin,
  Truck,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

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
import type { EmergencyIncidentDetail } from '@/features/emergency-vehicle/lib/emergency-broadcast-types'
import {
  fetchEmergencyIncidentById,
  formatEmergencyIncidentDateTime,
} from '@/features/emergency-vehicle/lib/emergency-incidents-api'
import { cn } from '@/lib/utils'
import { ListPanelMessage } from '@/shared/components/MobileListCard'
import { DetailFieldBoxSkeleton } from '@/shared/components/detail-loading'

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

function EmergencyBroadcastDetailContent({
  detail,
  showBroadcastSummary,
}: {
  detail: EmergencyIncidentDetail
  showBroadcastSummary: boolean
}) {
  const [mapOpen, setMapOpen] = useState(false)
  const broadcastsWithDeclines = detail.broadcasts.filter(
    (broadcast) => broadcast.declinedVehicleTypesCount > 0,
  )
  const showDeployments = detail.deployments.length > 0
  const showBroadcasts = broadcastsWithDeclines.length > 0
  const requestTime = formatEmergencyIncidentDateTime(detail.startDate || detail.initiatedAt)
  const endTime = formatEmergencyIncidentDateTime(detail.endDate)
  const hasCoordinates = detail.latitude != null && detail.longitude != null

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

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">
              Emergency Assistance Request Details
            </h2>
            <EmergencyBroadcastStatusCell
              status={detail.status}
              statusLabel={detail.statusLabel}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <IncidentDetailItem
              icon={<MapPin className="h-4 w-4" />}
              iconClassName="bg-[#fee2e2] text-[#dc2626]"
              label="Emergency Location"
              value={detail.location || '—'}
              subvalue={
                hasCoordinates
                  ? `${detail.latitude!.toFixed(5)}, ${detail.longitude!.toFixed(5)}`
                  : undefined
              }
              onIconClick={hasCoordinates ? () => setMapOpen(true) : undefined}
              iconAriaLabel="View emergency location on map"
            />
            <IncidentDetailItem
              icon={<CarFront className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="Vehicle Type Required"
              value={detail.vehicleCategory || '—'}
            />
            <IncidentDetailItem
              icon={<CalendarDays className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="Start Date and Time"
              value={requestTime}
              subvalue={
                detail.timeoutMinutes != null
                  ? `Response window: ${detail.timeLabel}`
                  : detail.initiatedByName
                    ? `Initiated by ${detail.initiatedByName}`
                    : undefined
              }
            />
            <IncidentDetailItem
              icon={<CalendarDays className="h-4 w-4" />}
              iconClassName="bg-[#dbeafe] text-[#2563eb]"
              label="End Date and Time"
              value={endTime}
            />
          </div>

          <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#fafafa] px-4 py-3">
            <p className="text-xs font-medium text-[var(--fms-text-subheading)]">
              Incident Description
            </p>
            <p className="mt-1 text-sm text-[var(--fms-text-header)]">
              {detail.description || '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Emergency Location</DialogTitle>
            <DialogDescription>
              {detail.location || 'Incident coordinates on the map'}
            </DialogDescription>
          </DialogHeader>
          {hasCoordinates ? (
            <EmergencyLocationMapView
              latitude={detail.latitude!}
              longitude={detail.longitude!}
              label={detail.location}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {showBroadcasts ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">
              Broadcasts
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Agency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Declined Vehicle Types
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastsWithDeclines.map((broadcast) => (
                    <tr
                      key={broadcast.id}
                      className="border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--fms-text-header)]">
                          {broadcast.agencyName}
                        </p>
                        {broadcast.agencyCode ? (
                          <p className="text-xs text-[var(--fms-text-subheading)]">
                            {broadcast.agencyCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {broadcast.declinedVehicleTypesLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-medium text-[#1d4ed8]">
                          {broadcast.response}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showDeployments ? (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-[var(--fms-text-header)]">
              Deployments
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#f6f6f7] text-[var(--fms-text-subheading)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Agency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Vehicles Offered
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Vehicle Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Deployment Date and Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.deployments.map((deployment) => (
                    <tr
                      key={deployment.id}
                      className="border-t border-[var(--fms-strokes)] hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--fms-text-header)]">
                          {deployment.agencyName}
                        </p>
                        {deployment.agencyCode ? (
                          <p className="text-xs text-[var(--fms-text-subheading)]">
                            {deployment.agencyCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {deployment.vehiclesOfferedLabel}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {deployment.vehicleTypeName}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {deployment.deploymentDateTimeLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[#d0fae5] px-2.5 py-1 text-xs font-medium text-[#007a55]">
                          {deployment.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function EmergencyBroadcastDetail() {
  const { incidentId = '' } = useParams<{ incidentId: string }>()
  const location = useLocation()
  const backPath =
    (location.state as { backPath?: string } | null)?.backPath ?? '/emergency/broadcast'
  const showBroadcastSummary = backPath === '/emergency/broadcast'
  const resolvedId = decodeURIComponent(incidentId).trim()

  const detailQuery = useQuery({
    queryKey: ['emergency', 'incidents', 'detail', resolvedId],
    queryFn: () => fetchEmergencyIncidentById(resolvedId),
    enabled: resolvedId.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const detail = detailQuery.data

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <Button type="button" variant="ghost" className="-ml-2 w-fit px-2" asChild>
          <Link to={backPath}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-[var(--fms-text-header)] sm:text-2xl">
          {detail
            ? `Emergency Request ${detail.requestId}`
            : 'Emergency Request Detail'}
        </h1>
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
