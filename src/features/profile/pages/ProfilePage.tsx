// Shows the signed-in user profile from persisted session (local storage via user store).
import type { ComponentType, ReactNode } from 'react'
import { useMemo } from 'react'
import { Building2, Fingerprint, IdCard, KeyRound, UserRound } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { mapUserDetailFields } from '@/features/user/lib/users-api'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import { cn } from '@/lib/utils'

function asRecord(user: unknown): ApiRecord | null {
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    return user as ApiRecord
  }
  return null
}

function statusDisplayClass(status: string) {
  const key = status.trim().toLowerCase()
  if (key === 'approved') return 'text-xs text-[var(--fms-success-text)] font-medium'
  if (key === 'pending') return 'text-xs text-[var(--fms-info-text)] font-medium'
  if (key === 'rejected') return 'text-xs text-[var(--fms-error-text)] font-medium'
  return 'text-xs'
}

export function ProfilePage() {
  const user = useUserStore((state) => state.user)
  const record = asRecord(user)

  const detail = useMemo(() => (record ? mapUserDetailFields(record) : undefined), [record])

  return (
    <section className="space-y-5">
      <PageHeader title="Profile" subtitle="Account information from your session." />

      {!detail ? (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--fms-text-subheading)]">
            No profile is stored for this session. Sign in again to load your account details.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DetailCard
            className="min-w-0"
            icon={KeyRound}
            title="Account"
            description="Identifiers used for login and API."
          >
            <FieldRow label="Username" value={detail.username} />
            <FieldRow
              label="Status"
              value={detail.status}
              className={cn(statusDisplayClass(detail.status))}
            />
          </DetailCard>

          <DetailCard
            className="md:col-span-1"
            icon={UserRound}
            title="Profile"
            description="Display name and how to reach you."
          >
            <FieldRow label="Full name" value={detail.name} />
            <FieldRow label="Email" value={detail.email} />
            <FieldRow label="Contact" value={detail.contact} />
          </DetailCard>

          <DetailCard
            className="md:col-span-2 lg:col-span-1"
            icon={Building2}
            title="Organization"
            description="Designation and organogram tiers from assigned groups."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Designation" value={detail.designation} />
              <FieldRow label="Agency" value={detail.agency} />
              <FieldRow label="Department" value={detail.department} />
              <FieldRow label="Division" value={detail.division} />
              <div className="sm:col-span-2">
                <FieldRow label="Sub division" value={detail.subDivision} />
              </div>
            </div>
          </DetailCard>

          <DetailCard
            className="md:col-span-2 lg:col-span-1"
            icon={IdCard}
            title="Identification"
            description="Employee and citizen identifiers."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Employee ID" value={detail.employeeId} />
              <FieldRow label="Citizen ID (CID)" value={detail.cid} />
            </div>
          </DetailCard>

          <DetailCard
            className="md:col-span-2"
            icon={Fingerprint}
            title="Realm roles"
            description="Roles granted to your account."
          >
            <div className="flex flex-wrap gap-2">
              {detail.rolesLabel === '-' ? (
                <span className="text-sm text-[var(--fms-text-subheading)]">
                  No roles assigned.
                </span>
              ) : (
                detail.rolesLabel.split(',').map((role, idx) => (
                  <span
                    key={`${idx}-${role.trim()}`}
                    className={cn(
                      'rounded-full border border-[var(--fms-info-border)] bg-[var(--fms-info-fill)] px-3 py-1 text-xs font-medium text-[var(--fms-text-header)]',
                    )}
                  >
                    {role.trim()}
                  </span>
                ))
              )}
            </div>
          </DetailCard>
        </div>
      )}
    </section>
  )
}

/** Styled card wrapper: icon header + description + arbitrary field children. */
function DetailCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: ReactNode
  className?: string
}) {
  return (
    <Card size="sm" className={cn('border border-[var(--fms-strokes)] bg-white shadow-sm', className)}>
      <CardHeader className="border-b border-[var(--fms-strokes)] pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--fms-info-fill)] text-[var(--fms-info-text)]">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-[var(--fms-text-header)]">{title}</CardTitle>
            <CardDescription className="text-[var(--fms-text-subheading)]">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">{children}</CardContent>
    </Card>
  )
}

/** Single label/value row for detail cards; `mono` styles ids; optional `className` on the value line. */
function FieldRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fms-text-subheading)]">{label}</p>
      <p className={cn('text-sm text-[var(--fms-text-header)]', mono && 'font-mono text-xs', className)}>
        {value || '—'}
      </p>
    </div>
  )
}
