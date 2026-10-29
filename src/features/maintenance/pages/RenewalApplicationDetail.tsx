import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  fetchRenewalApplication,
  formatRenewalStatusLabel,
  isSecretariatDesignationType,
  normalizeRenewalStatus,
  RENEWAL_PENDING_DRIVER_STATUS,
  renewalStatusBadgeClass,
  submitRenewalApplication,
  type RenewalApplicationItem,
} from '@/features/maintenance/lib/renewal-applications-api'
import { useUserStore } from '@/services/user-store'
import { BackToListButton } from '@/shared/components/BackToListButton'
import {
  canShowDesignatedFuelLogCreate,
  canShowMaintenanceRenewalMenu,
} from '@/shared/lib/designated-mto-access'
import { PageHeader } from '@/shared/components/PageHeader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

function applicationDocuments(items: RenewalApplicationItem[]): RenewalApplicationItem[] {
  const seen = new Set<string>()
  const documents: RenewalApplicationItem[] = []
  for (const item of items) {
    const typeId = item.documentTypeId.trim()
    if (!typeId || seen.has(typeId)) continue
    seen.add(typeId)
    documents.push(item)
  }
  return documents
}

function documentLabel(item: RenewalApplicationItem): string {
  return item.documentTypeName.trim() || item.documentTypeCode.trim() || 'Document'
}

function displayDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function RenewalApplicationDetail() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { applicationId = '' } = useParams<{ applicationId: string }>()
  const crud = useRouteCrudPermissions('/maintenance/renewal')
  const { role, apiRoleName } = useAccessControl()
  const user = useUserStore((state) => state.user)
  const normalizedRole = `${role ?? ''} ${apiRoleName ?? ''}`.toLowerCase()
  const isDriverRole = normalizedRole.includes('driver')
  const designatedMtoRenewal = canShowMaintenanceRenewalMenu(apiRoleName)
  const canViewRenewal = designatedMtoRenewal || !crud.isResolved || crud.canRead
  const renewalViewDenied = crud.isResolved && !crud.canRead && !designatedMtoRenewal
  const designatedMtoCanSubmit =
    canShowDesignatedFuelLogCreate(apiRoleName, user) ||
    canShowDesignatedFuelLogCreate(role, user)

  const [remarks, setRemarks] = useState('')
  const [seededId, setSeededId] = useState('')
  const [fieldError, setFieldError] = useState('')

  const detailQuery = useQuery({
    queryKey: ['renewal-application', applicationId],
    queryFn: () => fetchRenewalApplication(applicationId),
    enabled: Boolean(applicationId.trim()) && canViewRenewal,
    staleTime: 30_000,
  })

  const application = detailQuery.data
  const canSubmitSecretariat =
    Boolean(application) &&
    isSecretariatDesignationType(application?.designationType ?? '') &&
    normalizeRenewalStatus(application?.status ?? '') === RENEWAL_PENDING_DRIVER_STATUS &&
    designatedMtoCanSubmit
  const canSubmit = !crud.isResolved || crud.canCreate || crud.canUpdate || canSubmitSecretariat
  const documents = useMemo(
    () => applicationDocuments(application?.items ?? []),
    [application?.items],
  )

  if (application && application.id !== seededId) {
    setRemarks('')
    setFieldError('')
    setSeededId(application.id)
  }

  const documentTypeIds = useMemo(
    () => documents.map((item) => item.documentTypeId).filter(Boolean),
    [documents],
  )

  const subtitle = useMemo(() => {
    const labels = documents.map(documentLabel)
    if (labels.length === 0) return 'Documents included with this renewal.'
    return labels.join(', ')
  }, [documents])

  const submitMutation = useMutation({
    mutationFn: () =>
      submitRenewalApplication(applicationId, {
        selectedDocumentTypeIds: documentTypeIds,
        submissionRemarks: remarks,
      }),
    onSuccess: async () => {
      showSuccessToast('Renewal application submitted.')
      await queryClient.invalidateQueries({ queryKey: ['renewal-applications'] })
      await queryClient.invalidateQueries({ queryKey: ['renewal-application', applicationId] })
      navigate('/maintenance/renewal')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not submit the renewal application.')
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || submitMutation.isPending) return
    if (documentTypeIds.length === 0) {
      setFieldError('This application has no documents to submit.')
      return
    }
    setFieldError('')
    submitMutation.mutate()
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Submit Renewal Application" subtitle={subtitle} />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackToListButton
              to="/maintenance/renewal"
              label="Back to Preventive Maintenance"
            />
            {isDriverRole && application?.status ? (
              <Badge className={renewalStatusBadgeClass(application.status)}>
                {formatRenewalStatusLabel(application.status)}
              </Badge>
            ) : null}
          </div>

          {renewalViewDenied ? (
            <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
              You do not have permission to view this renewal application.
            </p>
          ) : detailQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
              Loading renewal application…
            </p>
          ) : detailQuery.isError ? (
            <p className="py-6 text-center text-sm text-[var(--fms-text-subheading)]">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : 'Could not load this renewal application.'}
            </p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--fms-text-header)]">Documents</h2>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    Documents on this renewal application.
                  </p>
                </div>
                {documents.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--fms-strokes)] px-4 py-6 text-center text-sm text-[var(--fms-text-subheading)]">
                    This application has no documents to submit.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((item) => (
                      <li
                        key={item.documentTypeId}
                        className="rounded-xl border border-[var(--fms-strokes)] px-4 py-3"
                      >
                        <span className="block text-sm font-semibold text-[var(--fms-text-header)]">
                          {documentLabel(item)}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fms-text-subheading)]">
                          <span>
                            Expiry date:{' '}
                            <span className="font-medium text-[var(--fms-text-header)]">
                              {displayDate(item.currentExpiryDate)}
                            </span>
                          </span>
                          <span>
                            Renewal:{' '}
                            <span className="font-medium text-[var(--fms-text-header)]">
                              Up to 1 year
                            </span>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="submission-remarks">Remarks</Label>
                <textarea
                  id="submission-remarks"
                  value={remarks}
                  disabled={!canSubmit}
                  onChange={(event) => {
                    setRemarks(event.target.value)
                    setFieldError('')
                  }}
                  placeholder="Enter remarks"
                  className="min-h-[88px] w-full rounded-lg border border-[var(--fms-strokes)] bg-white px-3 py-2 text-sm text-[var(--fms-text-header)] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {fieldError ? <p className="text-sm text-[var(--fms-delete)]">{fieldError}</p> : null}

              {canSubmit ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending || documents.length === 0}
                  >
                    {submitMutation.isPending ? 'Saving…' : 'Save Renewal'}
                  </Button>
                </div>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
