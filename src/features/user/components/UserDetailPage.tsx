/**
 * Route: `/users/:userId`. Loads one user, maps to display fields, shows cards grouped by topic; Edit link visible when `canRead`
 * routes to `/users/:id/edit` (update permission enforced on edit page save). Pending registrations show approve/reject when `canUpdate`.
 */
import type { ComponentType, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { ArrowLeft, Building2, Fingerprint, IdCard, KeyRound, Pencil, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  approvePendingUser,
  buildPendingUserActionPayload,
  fetchUserById,
  mapUserDetailFields,
  rejectPendingUser,
} from '@/features/user/lib/users-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { cn } from '@/lib/utils'

function statusDisplayClass(status: string) {
  const key = status.trim().toLowerCase();
  if (key === "approved")
    return "text-xs text-[var(--fms-success-text)] font-medium";
  if (key === "pending")
    return "text-xs text-[var(--fms-info-text)] font-medium";
  if (key === "rejected")
    return "text-xs text-[var(--fms-error-text)] font-medium";
  return "text-xs";
}

/** Placeholder cards while `GET /admin/users/:id` is loading. */
function UserDetailPageSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DetailCardSkeleton className="min-w-0" fieldRows={3} />
      <DetailCardSkeleton className="md:col-span-1" fieldRows={3} />
      <DetailCardSkeleton className="md:col-span-2 lg:col-span-1" fieldRows={5} wideGrid />
      <DetailCardSkeleton className="md:col-span-2 lg:col-span-1" fieldRows={2} twoCol />
      <DetailCardSkeleton className="md:col-span-2" fieldRows={0} chips />
    </div>
  )
}

function DetailCardSkeleton({
  className,
  fieldRows,
  wideGrid,
  twoCol,
  chips,
}: {
  className?: string
  fieldRows: number
  wideGrid?: boolean
  twoCol?: boolean
  chips?: boolean
}) {
  return (
    <Card size="sm" className={cn('border border-[var(--fms-strokes)] bg-white shadow-sm', className)}>
      <CardHeader className="border-b border-[var(--fms-strokes)] pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-full max-w-[14rem]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {chips ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        ) : wideGrid ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: fieldRows }).map((_, i) => (
              <div key={`sk-w-${i}`} className={i === fieldRows - 1 ? 'sm:col-span-2' : undefined}>
                <Skeleton className="mb-1 h-3 w-20" />
                <Skeleton className="h-4 w-full max-w-[12rem]" />
              </div>
            ))}
          </div>
        ) : twoCol ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: fieldRows }).map((_, i) => (
              <div key={`sk-2-${i}`} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full max-w-[10rem]" />
              </div>
            ))}
          </div>
        ) : (
          Array.from({ length: fieldRows }).map((_, i) => (
            <div key={`sk-f-${i}`} className="space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

/** Read-only summary with permission gates and optimistic navigation helpers. */
export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/users')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const userQuery = useQuery({
    queryKey: ['admin-user-detail', userId],
    enabled: Boolean(userId?.trim()) && crud.isResolved && crud.canRead,
    queryFn: async () => {
      if (!userId?.trim()) throw new Error('Missing user id')
      const record = await fetchUserById(userId)
      return { record }
    },
  })

  const detail = useMemo(() => {
    const record = userQuery.data?.record
    if (!record) return undefined
    return mapUserDetailFields(record)
  }, [userQuery.data?.record])

  const approveMutation = useMutation({
    mutationFn: async () => {
      const id = userId?.trim()
      if (!id) throw new Error('Missing user id')
      const rec = userQuery.data?.record
      if (!rec) throw new Error('User data is not loaded')
      const body = buildPendingUserActionPayload(rec)
      return approvePendingUser(id, body)
    },
    onSuccess: () => {
      showSuccessToast('User approved')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
      navigate('/users')
    },
    onError: (err) => {
      showErrorToast(err instanceof Error ? err.message : 'Approve failed')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const id = userId?.trim()
      if (!id) throw new Error('Missing user id')
      const rec = userQuery.data?.record
      if (!rec) throw new Error('User data is not loaded')
      const trimmed = reason.trim()
      if (!trimmed) throw new Error('Rejection reason is required')
      return rejectPendingUser(id, {reason: trimmed, action: 'reject'})
    },
    onSuccess: () => {
      showSuccessToast('Registration rejected')
      setRejectOpen(false)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
      navigate('/users')
    },
    onError: (err) => {
      showErrorToast(err instanceof Error ? err.message : 'Reject failed')
    },
  })

  if (crud.isLoading || !crud.isResolved) {
    return (
      <section className="space-y-5">
        <PageHeader title="User detail" subtitle="View account information" />
        <UserDetailPageSkeleton />
      </section>
    )
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="User detail" subtitle="View account information" />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view user details.</p>
        <Button variant="outline" asChild>
          <Link to="/users">Back to list</Link>
        </Button>
      </section>
    )
  }

  const editHref = userId?.trim() ? `/users/${encodeURIComponent(userId)}/edit` : '/users'

  const isAwaitingApproval =
    Boolean(detail) && detail!.status.trim().toLowerCase() === 'pending' && crud.canUpdate && Boolean(userQuery.data?.record)
  const actionBusy = approveMutation.isPending || rejectMutation.isPending

  return (
    <section className="space-y-5">
      {isAwaitingApproval ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-[var(--fms-strokes)] bg-[var(--fms-info-fill)]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div>
            <p className="text-sm font-medium text-[var(--fms-text-header)]">
              Pending registration
            </p>
            <p className="text-xs text-[var(--fms-text-subheading)]">
              Approve to activate this account or reject with a reason.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              className="min-w-[6rem] bg-[var(--fms-success-text)] text-white hover:bg-[var(--fms-success-text)]/90"
              disabled={actionBusy}
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-w-[6rem]"
              disabled={actionBusy}
              onClick={() => {
                setRejectReason("");
                setRejectOpen(true);
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="User detail"
          subtitle="Account information from the server."
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {crud.canRead && userId?.trim() ? (
            <Link
              to={editHref}
              className={cn(
                "inline-flex h-9 w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--fms-button)] px-4 text-sm font-medium text-white no-underline hover:bg-[var(--fms-button-hover)] sm:w-auto",
              )}
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              Edit user
            </Link>
          ) : null}
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/users">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to list
            </Link>
          </Button>
        </div>
      </div>

      {userQuery.isLoading ? (
        <UserDetailPageSkeleton />
      ) : userQuery.isError ? (
        <p className="text-sm text-[var(--fms-delete)]">
          {userQuery.error instanceof Error
            ? userQuery.error.message
            : "Failed to load user"}
        </p>
      ) : detail ? (
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
            description="Display name and how to reach this user."
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
            description="Roles granted to this account."
          >
            <div className="flex flex-wrap gap-2">
              {detail.rolesLabel === "-" ? (
                <span className="text-sm text-[var(--fms-text-subheading)]">
                  No roles assigned.
                </span>
              ) : (
                detail.rolesLabel.split(",").map((role, idx) => (
                  <span
                    key={`${idx}-${role.trim()}`}
                    className={cn(
                      "rounded-full border border-[var(--fms-info-border)] bg-[var(--fms-info-fill)] px-3 py-1 text-xs font-medium text-[var(--fms-text-header)]",
                    )}
                  >
                    {role.trim()}
                  </span>
                ))
              )}
            </div>
          </DetailCard>
        </div>
      ) : null}

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              This user will remain inactive. Provide a short reason for the
              applicant or your records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this registration is rejected..."
              disabled={rejectMutation.isPending}
              className={cn(
                "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              )}
            />
          </div>
          <DialogFooter className="-mx-0 border-0 bg-transparent p-0 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending || rejectReason.trim() === ""}
              onClick={() => rejectMutation.mutate(rejectReason)}
            >
              {rejectMutation.isPending ? "Submitting…" : "Confirm reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
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
