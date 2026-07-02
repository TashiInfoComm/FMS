import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FuelTableListToolbar } from '@/features/fuel/components/FuelTableListToolbar'
import {
  buildFuelQuotaOrgIds,
  createFuelQuota,
  fetchFuelQuotasPage,
  fetchFuelTypeOptions,
  fetchQuotaAssetNameOptions,
  mergeQuotaOrgScopeAutocompleteOptions,
  orgScopeOptionKey,
  parseOrgScopeOptionKey,
  profileToOrgScopeOption,
  profileToOrgScopeOptions,
  resolveCurrentUserId,
  resolveQuotaOrgScopeOptions,
  resolveQuotaVehicleType,
  updateFuelQuota,
  type FuelQuotaListRow,
  type FuelQuotaRuleStatus,
} from '@/features/fuel/lib/quota-configuration-api'
import { formatNuAmount } from '@/features/maintenance/lib/maintenance-ui'
import type { ApiRecord } from '@/features/user/lib/roles-api'
import { fetchUserOrgScopes } from '@/features/user/lib/user-org-scopes-api'
import {
  fetchUserOrganogramDisplayNames,
  mapUserDetailFields,
} from '@/features/user/lib/users-api'
import { useUserStore } from '@/services/user-store'
import { PageHeader } from '@/shared/components/PageHeader'
import { SearchableAutocomplete } from '@/shared/components/SearchableAutocomplete'
import {
  EditRowActionButton,
  rowActionsContainerClassName,
} from '@/shared/components/TableRowActionButtons'
import { TablePagination } from '@/shared/components/TablePagination'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

type QuotaFormValues = {
  vehicleCategory: string
  fuelTypeId: string
  organizationKey: string
  maximumQuota: string
  threshold: string
  notes: string
}

const TABLE_COLUMNS = [
  'SL.No',
  'Vehicle Type',
  'Organization',
  'Maximum Quota',
  'Threshold',
  'Fuel Type',
  'Status',
] as const

function asRecord(user: unknown): ApiRecord | null {
  if (user && typeof user === 'object' && !Array.isArray(user)) {
    return user as ApiRecord
  }
  return null
}

function emptyFormValues(defaultOrganizationKey = ''): QuotaFormValues {
  return {
    vehicleCategory: '',
    fuelTypeId: '',
    organizationKey: defaultOrganizationKey,
    maximumQuota: '',
    threshold: '',
    notes: '',
  }
}

function quotaRowToFormValues(row: FuelQuotaListRow): QuotaFormValues {
  return {
    vehicleCategory: row.vehicleCategoryValue,
    fuelTypeId: row.fuelTypeId,
    organizationKey: row.organizationKey,
    maximumQuota: String(row.maximumQuota),
    threshold: String(row.threshold),
    notes: row.notes ?? '',
  }
}

function QuotaStatusBadge({ status }: { status: FuelQuotaRuleStatus }) {
  const isActive = status === 'Active'
  return (
    <span
      className={
        isActive
          ? "rounded-full bg-[#d7f8e8] px-2 py-1 text-xs text-[#0f8e5c]"
          : "rounded-full bg-[#fff4cc] px-2 py-1 text-xs text-[#9f7b00]"
      }
    >
      {status}
    </span>
  );
}

function NuAmountField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex overflow-hidden rounded-lg border border-[var(--fms-strokes)] focus-within:ring-3 focus-within:ring-[var(--fms-info-border)]/40">
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="border-0 rounded-none shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  )
}

export default function QuotaConfiguration() {
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/fuel/quota-configuration')
  const user = useUserStore((state) => state.user)
  const profileRecord = asRecord(user)
  const currentUserId = resolveCurrentUserId(profileRecord)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<QuotaFormValues>(() => emptyFormValues())

  const organogramNamesQuery = useQuery({
    queryKey: ['quota-config', 'profile-organogram', currentUserId],
    enabled: Boolean(profileRecord),
    queryFn: () => fetchUserOrganogramDisplayNames(profileRecord!),
    staleTime: 60_000,
  })

  const profileScopes = useMemo(() => {
    if (!profileRecord) return []
    const labels = organogramNamesQuery.data ?? mapUserDetailFields(profileRecord)
    return profileToOrgScopeOptions(profileRecord, {
      agency: labels.agency,
      department: labels.department,
      division: labels.division,
      subDivision: labels.subDivision,
    })
  }, [profileRecord, organogramNamesQuery.data])

  const organizationOptionsQuery = useQuery({
    queryKey: [
      'quota-config',
      'org-options',
      currentUserId,
      profileScopes.map((scope) => orgScopeOptionKey(scope)).join('|'),
    ],
    enabled: Boolean(currentUserId) || profileScopes.length > 0,
    queryFn: async () => {
      const apiScopes = currentUserId ? await fetchUserOrgScopes(currentUserId) : []
      return resolveQuotaOrgScopeOptions(profileScopes, apiScopes)
    },
    staleTime: 60_000,
  })

  const fuelTypesQuery = useQuery({
    queryKey: ['quota-config', 'fuel-types'],
    queryFn: fetchFuelTypeOptions,
    staleTime: 60_000,
  })

  const assetNamesQuery = useQuery({
    queryKey: ['quota-config', 'asset-names'],
    queryFn: fetchQuotaAssetNameOptions,
    staleTime: 60_000,
  })

  const organizationOptions = organizationOptionsQuery.data ?? []

  const defaultOrganizationKey = useMemo(() => {
    if (profileRecord) {
      const labels = organogramNamesQuery.data ?? mapUserDetailFields(profileRecord)
      const mostSpecific = profileToOrgScopeOption(profileRecord, {
        agency: labels.agency,
        department: labels.department,
        division: labels.division,
        subDivision: labels.subDivision,
      })
      if (mostSpecific) return orgScopeOptionKey(mostSpecific)
    }
    const first = organizationOptions[0]
    return first ? orgScopeOptionKey(first) : ''
  }, [profileRecord, organogramNamesQuery.data, organizationOptions])

  const organizationAutocompleteOptions = useMemo(
    () => mergeQuotaOrgScopeAutocompleteOptions(profileScopes, organizationOptions),
    [profileScopes, organizationOptions],
  )

  const listLookups = useMemo(
    () => ({
      fuelTypes: fuelTypesQuery.data ?? [],
      assetNames: assetNamesQuery.data ?? [],
    }),
    [fuelTypesQuery.data, assetNamesQuery.data],
  )

  const quotasQuery = useQuery({
    queryKey: ['fuel-quotas', search, page, pageSize, fuelTypesQuery.dataUpdatedAt],
    enabled: !crud.isResolved || crud.canRead,
    queryFn: () => fetchFuelQuotasPage(search, page, pageSize, listLookups),
    staleTime: 30_000,
  })

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  const rows = quotasQuery.data?.rows ?? []
  const totalCount = quotasQuery.data?.totalCount ?? rows.length
  const effectivePageSize = quotasQuery.data?.effectivePageSize ?? pageSize
  const totalPages =
    quotasQuery.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / effectivePageSize))
  const serialBase = quotasQuery.data?.serialBase ?? (page - 1) * pageSize

  const invalidateQuotas = () => {
    queryClient.invalidateQueries({ queryKey: ['fuel-quotas'] })
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setForm(emptyFormValues())
  }

  const buildQuotaPayload = (
    vehicleCategory: string,
    fuelTypeId: string,
    organizationKey: string,
    maximumQuota: number,
    threshold: number,
  ) => {
    const organization = parseOrgScopeOptionKey(organizationKey)
    if (!organization) throw new Error('Select a valid organization')
    const assetNames = assetNamesQuery.data ?? []
    const vehicleType = resolveQuotaVehicleType(vehicleCategory, assetNames)
    return {
      vehicle_type: vehicleType,
      fuel_type_id: fuelTypeId,
      ...buildFuelQuotaOrgIds(organization.scopeType, organization.scopeId),
      ceiling_amount: maximumQuota,
      low_balance_threshold: threshold,
    }
  }

  const createQuotaMutation = useMutation({
    mutationFn: createFuelQuota,
    onSuccess: () => {
      showSuccessToast('Quota configuration saved')
      invalidateQuotas()
      setPage(1)
      closeDialog()
    },
    onError: (err) => {
      showErrorToast(err, 'Could not save quota configuration')
    },
  })

  const updateQuotaMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof buildQuotaPayload> }) =>
      updateFuelQuota(id, body),
    onSuccess: () => {
      showSuccessToast('Quota configuration updated')
      invalidateQuotas()
      closeDialog()
    },
    onError: (err) => {
      showErrorToast(err, 'Could not update quota configuration')
    },
  })


  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (!dialogOpen || editingId) return
    if (!defaultOrganizationKey) return
    setForm((current) => {
      if (current.organizationKey) return current
      const hasOption = organizationAutocompleteOptions.some(
        (option) => option.value === defaultOrganizationKey,
      )
      if (!hasOption) return current
      return { ...current, organizationKey: defaultOrganizationKey }
    })
  }, [dialogOpen, editingId, defaultOrganizationKey, organizationAutocompleteOptions])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyFormValues())
    setDialogOpen(true)
  }

  const openEditDialog = (row: FuelQuotaListRow) => {
    setEditingId(row.id)
    setForm(quotaRowToFormValues(row))
    setDialogOpen(true)
  }


  const onSaveConfiguration = () => {
    const vehicleCategory = form.vehicleCategory.trim()
    const fuelTypeId = form.fuelTypeId.trim()
    const maximumQuota = Number(form.maximumQuota)
    const threshold = Number(form.threshold)
    const organization = parseOrgScopeOptionKey(form.organizationKey)

    if (
      !vehicleCategory ||
      !fuelTypeId ||
      !organization ||
      !Number.isFinite(maximumQuota) ||
      !Number.isFinite(threshold)
    ) {
      return
    }

    try {
      const payload = buildQuotaPayload(
        vehicleCategory,
        fuelTypeId,
        form.organizationKey,
        maximumQuota,
        threshold,
      )
      if (editingId) {
        updateQuotaMutation.mutate({ id: editingId, body: payload })
        return
      }
      createQuotaMutation.mutate(payload)
    } catch (err) {
      showErrorToast(err, 'Could not save quota configuration')
    }
  }

  const isSaving = createQuotaMutation.isPending || updateQuotaMutation.isPending

  const canSubmit =
    form.vehicleCategory.trim() !== '' &&
    form.fuelTypeId.trim() !== '' &&
    form.organizationKey.trim() !== '' &&
    Number(form.maximumQuota) > 0 &&
    Number(form.threshold) > 0 &&
    !isSaving

  const orgSelectLoading =
    (Boolean(profileRecord) && organogramNamesQuery.isLoading) ||
    (organizationOptionsQuery.isLoading && organizationAutocompleteOptions.length === 0)

  return (
    <section className="space-y-5">
      <PageHeader title="Quota Configuration" />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[var(--fms-text-header)]">
              Existing Quota Rules
            </h2>
            <Button
              type="button"
              className="w-full bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)] sm:w-auto"
              onClick={openCreateDialog}
              disabled={!crud.canCreate && crud.isResolved}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          </div>

          <FuelTableListToolbar
            search={search}
            onSearchChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
            searchPlaceholder="Search by vehicle category"
            searchAriaLabel="Search quota rules"
          />

          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--fms-strokes)]">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th key={column} className="px-4 py-3 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crud.isResolved && !crud.canRead ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      You do not have permission to view quota rules.
                    </td>
                  </tr>
                ) : quotasQuery.isLoading ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      Loading quota rules…
                    </td>
                  </tr>
                ) : quotasQuery.isError ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {quotasQuery.error instanceof Error
                        ? quotasQuery.error.message
                        : 'Could not load quota rules.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-[var(--fms-strokes)]">
                    <td
                      colSpan={TABLE_COLUMNS.length + 1}
                      className="px-4 py-6 text-center text-[var(--fms-text-subheading)]"
                    >
                      {search.trim()
                        ? 'No quota rules match your search.'
                        : 'No quota rules found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--fms-strokes)]"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--fms-text-subheading)]">
                        {serialBase + index + 1}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-header)]">
                        {row.vehicleCategory}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.organization}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatNuAmount(row.maximumQuota)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {formatNuAmount(row.threshold)}
                      </td>
                      <td className="px-4 py-3 text-[var(--fms-text-subheading)]">
                        {row.fuelType}
                      </td>
                      <td className="px-4 py-3">
                        <QuotaStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className={rowActionsContainerClassName}>
                          <EditRowActionButton
                            type="button"
                            disabled={!crud.canUpdate && crud.isResolved}
                            onClick={() => openEditDialog(row)}
                          />
                          {/* <DeleteRowActionButton
                            type="button"
                            disabled={
                              (!crud.canDelete && crud.isResolved) ||
                              deleteQuotaMutation.isPending
                            }
                            onClick={() => onDeleteRequest(row)}
                          /> */}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={effectivePageSize}
            totalCount={totalCount}
            onPageChange={(nextPage) =>
              setPage(Math.max(1, Math.min(nextPage, totalPages)))
            }
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[var(--fms-text-header)]">
              Add/Update Quota Configuration
            </DialogTitle>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              onSaveConfiguration()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="quota-organization">Organization</Label>
                <SearchableAutocomplete
                  id="quota-organization"
                  value={form.organizationKey}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, organizationKey: value }))
                  }
                  options={organizationAutocompleteOptions}
                  loading={orgSelectLoading}
                  disabled={!orgSelectLoading && organizationAutocompleteOptions.length === 0}
                  placeholder={
                    orgSelectLoading
                      ? 'Loading organizations…'
                      : organizationAutocompleteOptions.length === 0
                        ? 'No organizations available'
                        : 'Search and select organization'
                  }
                  searchPlaceholder="Type to search…"
                  emptyMessage="No organizations found."
                  side="top"
                />
              </div>

              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select
                  value={form.vehicleCategory || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, vehicleCategory: value }))
                  }
                  disabled={assetNamesQuery.isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        assetNamesQuery.isLoading
                          ? 'Loading vehicle types…'
                          : 'Select Vehicle Type'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(assetNamesQuery.data ?? []).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <NuAmountField
                id="maximum-quota"
                label="Maximum Quota Amount"
                value={form.maximumQuota}
                placeholder="Enter Amount"
                onChange={(value) =>
                  setForm((current) => ({ ...current, maximumQuota: value }))
                }
              />

              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select
                  value={form.fuelTypeId || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, fuelTypeId: value }))
                  }
                  disabled={fuelTypesQuery.isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        fuelTypesQuery.isLoading ? 'Loading fuel types…' : 'Select Fuel Type'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(fuelTypesQuery.data ?? []).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <NuAmountField
                id="threshold-amount"
                label="Threshold Amount"
                value={form.threshold}
                placeholder="Enter Amount"
                onChange={(value) =>
                  setForm((current) => ({ ...current, threshold: value }))
                }
              />
            </div>

            <div className="flex justify-center pt-1">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="min-w-[200px] bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
              >
                {isSaving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>


    </section>
  )
}
