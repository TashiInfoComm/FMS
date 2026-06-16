import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MasterDataSelect } from '@/features/vehicles/components/MasterDataSelect'
import type { MasterOption } from '@/features/vehicles/lib/vehicle-create-master-data'
import {
  type AgencyAssignmentTierSelection,
  type VehicleAgencyAssignmentMasterData,
  fetchVehicleAgencyAssignmentMasterData,
} from '@/features/vehicles/lib/vehicle-agency-assignment-api'
import {
  isDuplicateOrgScope,
  mergeOrgScope,
  mergeOrgScopes,
  resolveOrgScopeFromTiers,
  type UserOrgScopeListItem,
} from '@/features/user/lib/user-org-scopes-api'
import { showErrorToast } from '@/shared/lib/toast'

function emptyTiers(): AgencyAssignmentTierSelection {
  return { agencyId: '', departmentId: '', divisionId: '', subDivisionId: '' }
}

function rowsToOptions(rows: { id: string; name: string }[]): MasterOption[] {
  return rows.map((r) => ({ value: r.id, label: r.name }))
}

function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type FormRow = {
  id: string
  tiers: AgencyAssignmentTierSelection
}

function createFormRow(): FormRow {
  return { id: newRowId(), tiers: emptyTiers() }
}

function resolveScopesFromRows(
  rows: FormRow[],
  master: VehicleAgencyAssignmentMasterData,
): UserOrgScopeListItem[] {
  const scopes: UserOrgScopeListItem[] = []
  for (const row of rows) {
    const resolved = resolveOrgScopeFromTiers(row.tiers, master)
    if (!resolved) continue
    scopes.push({
      scopeType: resolved.scopeType,
      scopeId: resolved.scopeId,
      name: resolved.name,
    })
  }
  return scopes
}

export type UserOrgScopeAssignDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingScopes: UserOrgScopeListItem[]
  onSubmit: (scopes: UserOrgScopeListItem[]) => Promise<void>
}

type OrgScopeFieldRowProps = {
  rowId: string
  tiers: AgencyAssignmentTierSelection
  masterLoading: boolean
  agencyOptions: MasterOption[]
  departments: VehicleAgencyAssignmentMasterData['departments']
  divisions: VehicleAgencyAssignmentMasterData['divisions']
  subDivisions: VehicleAgencyAssignmentMasterData['subDivisions']
  canRemove: boolean
  onRemove: () => void
  onChange: (tiers: AgencyAssignmentTierSelection) => void
}

function OrgScopeFieldRow({
  rowId,
  tiers,
  masterLoading,
  agencyOptions,
  departments,
  divisions,
  subDivisions,
  canRemove,
  onRemove,
  onChange,
}: OrgScopeFieldRowProps) {
  const departmentOptions = useMemo(() => {
    if (!tiers.agencyId) return []
    return rowsToOptions(departments.filter((d) => d.agencyId === tiers.agencyId))
  }, [departments, tiers.agencyId])

  const divisionOptions = useMemo(() => {
    if (!tiers.departmentId) return []
    return rowsToOptions(divisions.filter((d) => d.departmentId === tiers.departmentId))
  }, [divisions, tiers.departmentId])

  const subDivisionOptions = useMemo(() => {
    if (!tiers.divisionId) return []
    return rowsToOptions(subDivisions.filter((s) => s.divisionId === tiers.divisionId))
  }, [subDivisions, tiers.divisionId])

  const setAgency = (agencyId: string) => {
    onChange({ agencyId, departmentId: '', divisionId: '', subDivisionId: '' })
  }

  const setDepartment = (departmentId: string) => {
    onChange({
      ...tiers,
      departmentId,
      divisionId: '',
      subDivisionId: '',
    })
  }

  const setDivision = (divisionId: string) => {
    onChange({
      ...tiers,
      divisionId,
      subDivisionId: '',
    })
  }

  const setSubDivision = (subDivisionId: string) => {
    onChange({ ...tiers, subDivisionId })
  }

  return (
    <div className="flex items-start gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-4 gap-4">
        <MasterDataSelect
          id={`user-org-agency-${rowId}`}
          label="Agency"
          placeholder="Select agency"
          options={agencyOptions}
          value={tiers.agencyId}
          loading={masterLoading}
          onValueChange={setAgency}
        />
        <MasterDataSelect
          id={`user-org-department-${rowId}`}
          label="Department"
          placeholder={tiers.agencyId ? 'Select department' : 'Select agency first'}
          options={departmentOptions}
          value={tiers.departmentId}
          disabled={!tiers.agencyId}
          loading={masterLoading}
          onValueChange={setDepartment}
        />
        <MasterDataSelect
          id={`user-org-division-${rowId}`}
          label="Division"
          placeholder={tiers.departmentId ? 'Select division' : 'Select department first'}
          options={divisionOptions}
          value={tiers.divisionId}
          disabled={!tiers.departmentId}
          loading={masterLoading}
          onValueChange={setDivision}
        />
        <MasterDataSelect
          id={`user-org-sub-division-${rowId}`}
          label="Sub division"
          placeholder={
            tiers.divisionId
              ? subDivisionOptions.length
                ? 'Select sub division (optional)'
                : 'No sub divisions'
              : 'Select division first'
          }
          options={subDivisionOptions}
          value={tiers.subDivisionId}
          disabled={!tiers.divisionId || subDivisionOptions.length === 0}
          loading={masterLoading}
          onValueChange={setSubDivision}
        />
      </div>
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-7 size-8 shrink-0"
          aria-label="Remove row"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
        </Button>
      ) : (
        <span className="mt-7 size-8 shrink-0" aria-hidden />
      )}
    </div>
  )
}

export function UserOrgScopeAssignDialog({
  open,
  onOpenChange,
  existingScopes,
  onSubmit,
}: UserOrgScopeAssignDialogProps) {
  const [formRows, setFormRows] = useState<FormRow[]>(() => [createFormRow()])
  const [master, setMaster] = useState<VehicleAgencyAssignmentMasterData | null>(null)
  const [masterLoading, setMasterLoading] = useState(false)
  const [masterError, setMasterError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFormRows([createFormRow()])
      return
    }
    let cancelled = false
    setMasterLoading(true)
    setMasterError(null)
    void fetchVehicleAgencyAssignmentMasterData()
      .then((data) => {
        if (!cancelled) setMaster(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setMasterError(err instanceof Error ? err.message : 'Could not load master data.')
        }
      })
      .finally(() => {
        if (!cancelled) setMasterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const { agencies, departments, divisions, subDivisions } = master ?? {
    agencies: [],
    departments: [],
    divisions: [],
    subDivisions: [],
  }

  const agencyOptions = useMemo(() => rowsToOptions(agencies), [agencies])

  const pendingScopes = useMemo(() => {
    if (!master) return []
    return resolveScopesFromRows(formRows, master)
  }, [formRows, master])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!master) throw new Error('Master data is not loaded')
      const toSend = resolveScopesFromRows(formRows, master)
      if (toSend.length === 0) {
        throw new Error('Select at least one agency in the rows above')
      }

      let batch: UserOrgScopeListItem[] = []
      for (const scope of toSend) {
        if (isDuplicateOrgScope([...existingScopes, ...batch], scope)) {
          throw new Error('Duplicate organization in the form or already assigned to this user')
        }
        batch = mergeOrgScope(batch, {
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          name: scope.name ?? scope.scopeId,
        })
      }

      const merged = mergeOrgScopes(existingScopes, batch)
      if (merged.length === existingScopes.length) {
        throw new Error('All selected organizations are already assigned to this user')
      }
      await onSubmit(merged)
    },
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      showErrorToast(err, 'Failed to add organizations')
    },
  })

  const handleAddMore = () => {
    setFormRows((prev) => [...prev, createFormRow()])
  }

  const updateRow = (index: number, tiers: AgencyAssignmentTierSelection) => {
    setFormRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, tiers } : row)),
    )
  }

  const removeRow = (index: number) => {
    setFormRows((prev) => prev.filter((_, i) => i !== index))
  }

  const canSubmit =
    pendingScopes.length > 0 && !saveMutation.isPending && !masterLoading && Boolean(master)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto px-6 sm:max-w-[min(96rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Add organization</DialogTitle>
          <DialogDescription>
            Fill each row with agency through sub division. Use Add more for
            another empty row, then save to send all scopes in one request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formRows.map((row, index) => (
            <OrgScopeFieldRow
              key={row.id}
              rowId={row.id}
              tiers={row.tiers}
              masterLoading={masterLoading}
              agencyOptions={agencyOptions}
              departments={departments}
              divisions={divisions}
              subDivisions={subDivisions}
              canRemove={formRows.length > 1}
              onRemove={() => removeRow(index)}
              onChange={(tiers) => updateRow(index, tiers)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-[var(--fms-info-border)] hover:bg-[#1b458bvar(--fms-info-border)] text-white"
            onClick={handleAddMore}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add more
          </Button>
        </div>

        {masterError ? (
          <p className="text-sm text-[var(--fms-error-text)]">{masterError}</p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? "Saving…"
              : `Save ${pendingScopes.length} organization${pendingScopes.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
