/**
 * CID directory lookup and org tiers — shared by admin create user and public manual signup.
 * Admin mode uses `/master/*` organogram lists; signup uses `GET /public/groups`.
 * Realm roles are chosen only in admin mode; signup uses backend default role assignment.
 */
import { CircleCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { OrgGroupSelect } from '@/features/user/components/OrgGroupSelect'
import {
  buildCreateUserPayload,
  fetchEmployeeByCid,
  fetchRealmRoleOptions,
  hasEmployeeDirectoryOrgLabels,
  isDirectoryProvided,
  mergedOrganogramHintsForProfile,
  suggestedUsername,
  type FetchedPerson,
} from '@/features/user/lib/users-api'
import {
  applyCidHintsToAdminOrgSelection,
  childGroupsOf,
  emptyOrgLocks,
  emptyOrgSelection,
  fetchAdminGroups,
  orgTierSelectionEqual,
  rootGroupNodes,
  resolveOrgSelectionFromHints,
  type OrgTierLocks,
  type OrgTierSelection,
} from '@/features/user/lib/groups-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { formatRealmRoleDisplayName } from '@/shared/lib/format-realm-role-display'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import {
  buildDirectoryUserFormValues,
  directoryUserFormValuesToOrgIds,
  directoryUserRegistrationSchema,
  DIRECTORY_USER_FORM_FIELD_KEYS,
  getDirectoryUserFormFieldErrors,
  isDirectoryUserFormValid,
  type DirectoryUserFormFieldKey,
} from '@/features/user/lib/directory-user-form-schema'
import {
  fetchAdminAgencyGroupNodes,
  fetchAdminDepartmentGroupNodes,
  fetchAdminDivisionGroupNodes,
  fetchAdminSubDivisionGroupNodes,
} from '@/features/vehicles/lib/vehicle-agency-assignment-api'
import { apiPost } from '@/services/apiClient'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-normal text-[var(--fms-error-text)]">{message}</p>
}

export type DirectoryUserRegistrationFormProps = {
  mode: 'admin' | 'signup'
  /** One-shot prefill from NDI callback (signup only); not merged with router state in this component. */
  ndiBootstrap?: FetchedPerson | null
}

export function DirectoryUserRegistrationForm({
  mode,
  ndiBootstrap = null,
}: DirectoryUserRegistrationFormProps) {
  const navigate = useNavigate()
  const ndiWelcomeRef = useRef(false)
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/users')
  const [lookupInput, setLookupInput] = useState(() => {
    if (!ndiBootstrap) return ''
    const cid = (ndiBootstrap.cid ?? '').trim()
    const emp = (ndiBootstrap.employeeId ?? '').trim()
    return cid || emp || ''
  })
  const [profile, setProfile] = useState<FetchedPerson | null>(() => ndiBootstrap ?? null)
  const [username, setUsername] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [orgSelection, setOrgSelection] = useState<OrgTierSelection>(() => emptyOrgSelection())
  const [orgLocks, setOrgLocks] = useState<OrgTierLocks>(() => emptyOrgLocks())
  const [touched, setTouched] = useState<Partial<Record<DirectoryUserFormFieldKey, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const isAdmin = mode === 'admin'
  /** Signup opened after NDI verification — CID lookup UI is omitted; data came from check_callback_response. */
  const isNdiSignupBootstrap = mode === 'signup' && ndiBootstrap != null
  const queriesEnabled = isAdmin ? crud.isResolved && crud.canCreate : true
  const formLocked = isAdmin && !(crud.isResolved && crud.canCreate)

  const profileOrgKey = useMemo(() => {
    if (!profile) return ''
    return `${profile.lookupId}\u0000${profile.cid}\u0000${JSON.stringify(profile.organogramHints ?? null)}\u0000${profile.employeeId}\u0000${profile.agency}\u0000${profile.department}\u0000${profile.division}\u0000${profile.subDivision}`
  }, [
    profile?.lookupId,
    profile?.cid,
    profile?.organogramHints,
    profile?.employeeId,
    profile?.agency,
    profile?.department,
    profile?.division,
    profile?.subDivision,
  ])

  const rolesQuery = useQuery({
    queryKey: ['admin-roles-user-form'],
    queryFn: fetchRealmRoleOptions,
    staleTime: 60_000,
    enabled: queriesEnabled && isAdmin,
  })

  const groupsQuery = useQuery({
    queryKey: ['public-groups'],
    queryFn: fetchAdminGroups,
    staleTime: 60_000,
    enabled: queriesEnabled && !isAdmin,
  })

  const agencyQuery = useQuery({
    queryKey: ['admin-master-org', 'agencies'],
    queryFn: fetchAdminAgencyGroupNodes,
    staleTime: 60_000,
    enabled: queriesEnabled && isAdmin,
  })

  const selectedAgencyCode = useMemo(() => {
    const node = (agencyQuery.data ?? []).find((item) => item.id === orgSelection.agencyId)
    return node?.code?.trim() ?? ''
  }, [agencyQuery.data, orgSelection.agencyId])

  const departmentQuery = useQuery({
    queryKey: ['admin-master-org', 'departments', selectedAgencyCode],
    queryFn: () =>
      fetchAdminDepartmentGroupNodes(selectedAgencyCode, orgSelection.agencyId),
    staleTime: 60_000,
    enabled:
      queriesEnabled &&
      isAdmin &&
      Boolean(selectedAgencyCode && orgSelection.agencyId.trim()),
  })

  const selectedDepartmentCode = useMemo(() => {
    const node = (departmentQuery.data ?? []).find((item) => item.id === orgSelection.departmentId)
    return node?.code?.trim() ?? ''
  }, [departmentQuery.data, orgSelection.departmentId])

  const divisionQuery = useQuery({
    queryKey: ['admin-master-org', 'divisions', selectedDepartmentCode],
    queryFn: () =>
      fetchAdminDivisionGroupNodes(selectedDepartmentCode, orgSelection.departmentId),
    staleTime: 60_000,
    enabled:
      queriesEnabled &&
      isAdmin &&
      Boolean(selectedDepartmentCode && orgSelection.departmentId.trim()),
  })

  const selectedDivisionCode = useMemo(() => {
    const node = (divisionQuery.data ?? []).find((item) => item.id === orgSelection.divisionId)
    return node?.code?.trim() ?? ''
  }, [divisionQuery.data, orgSelection.divisionId])

  const subDivisionQuery = useQuery({
    queryKey: ['admin-master-org', 'sub-divisions', selectedDivisionCode],
    queryFn: () =>
      fetchAdminSubDivisionGroupNodes(selectedDivisionCode, orgSelection.divisionId),
    staleTime: 60_000,
    enabled:
      queriesEnabled &&
      isAdmin &&
      Boolean(selectedDivisionCode && orgSelection.divisionId.trim()),
  })

  useEffect(() => {
    if (mode !== 'signup' || !ndiBootstrap || ndiWelcomeRef.current) return
    ndiWelcomeRef.current = true
    showSuccessToast('Your details were filled in from Bhutan NDI.')
  }, [mode, ndiBootstrap])

  const groupNodes = groupsQuery.data ?? []
  const agencyOptions = useMemo(() => {
    if (isAdmin) return agencyQuery.data ?? []
    const roots = rootGroupNodes(groupNodes)
    return roots.length > 0 ? roots : groupNodes
  }, [agencyQuery.data, groupNodes, isAdmin])
  const departmentOptions = useMemo(() => {
    if (!orgSelection.agencyId) return []
    if (isAdmin) return departmentQuery.data ?? []
    return childGroupsOf(orgSelection.agencyId, groupNodes)
  }, [departmentQuery.data, groupNodes, isAdmin, orgSelection.agencyId])
  const divisionOptions = useMemo(() => {
    if (!orgSelection.departmentId) return []
    if (isAdmin) return divisionQuery.data ?? []
    return childGroupsOf(orgSelection.departmentId, groupNodes)
  }, [divisionQuery.data, groupNodes, isAdmin, orgSelection.departmentId])
  const subDivisionOptions = useMemo(() => {
    if (!orgSelection.divisionId) return []
    if (isAdmin) return subDivisionQuery.data ?? []
    return childGroupsOf(orgSelection.divisionId, groupNodes)
  }, [groupNodes, isAdmin, orgSelection.divisionId, subDivisionQuery.data])

  const orgMasterLoading = isAdmin
    ? agencyQuery.isLoading ||
      departmentQuery.isLoading ||
      divisionQuery.isLoading ||
      subDivisionQuery.isLoading
    : groupsQuery.isLoading
  const orgMasterError = isAdmin
    ? agencyQuery.isError ||
      departmentQuery.isError ||
      divisionQuery.isError ||
      subDivisionQuery.isError
    : groupsQuery.isError

  useEffect(() => {
    setTouched({})
    setSubmitAttempted(false)
  }, [profileOrgKey])

  const formValues = useMemo(() => {
    if (!profile) return null
    const roles = isAdmin ? [...selectedRoles] : []
    return buildDirectoryUserFormValues(profile, username, orgSelection, roles)
  }, [profile, username, orgSelection, selectedRoles, isAdmin])

  const fieldErrors = useMemo(() => {
    if (!formValues) return {}
    return getDirectoryUserFormFieldErrors(formValues, isAdmin)
  }, [formValues, isAdmin])

  const visibleFieldErrors = useMemo(() => {
    if (submitAttempted) return fieldErrors
    const visible: Partial<Record<DirectoryUserFormFieldKey, string>> = {}
    for (const key of DIRECTORY_USER_FORM_FIELD_KEYS) {
      if (touched[key] && fieldErrors[key]) visible[key] = fieldErrors[key]
    }
    return visible
  }, [fieldErrors, submitAttempted, touched])

  const touchField = (key: DirectoryUserFormFieldKey) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  const touchAllFields = () => {
    setTouched(Object.fromEntries(DIRECTORY_USER_FORM_FIELD_KEYS.map((key) => [key, true])))
  }

  const fieldError = (key: DirectoryUserFormFieldKey) => visibleFieldErrors[key]

  useEffect(() => {
    if (!profile) {
      setOrgSelection(emptyOrgSelection())
      setOrgLocks(emptyOrgLocks())
      return
    }
    if (isAdmin) return
    const nodes = groupsQuery.data
    if (!nodes?.length) return
    const hints = mergedOrganogramHintsForProfile(profile)
    const { selection, locks } = resolveOrgSelectionFromHints(hints, nodes)
    setOrgSelection(selection)
    setOrgLocks(locks)
  }, [isAdmin, profileOrgKey, groupsQuery.data])

  useEffect(() => {
    if (!isAdmin || !profile) return
    const hints = mergedOrganogramHintsForProfile(profile)
    if (!hints) return
    const agencies = agencyQuery.data ?? []
    if (!agencies.length) return

    setOrgSelection((current) => {
      const { selection, locks } = applyCidHintsToAdminOrgSelection(hints, {
        agencies,
        departments: departmentQuery.data?.length ? departmentQuery.data : undefined,
        divisions: divisionQuery.data?.length ? divisionQuery.data : undefined,
        subDivisions: subDivisionQuery.data?.length ? subDivisionQuery.data : undefined,
      }, current)

      setOrgLocks(locks)
      if (orgTierSelectionEqual(selection, current)) return current
      return selection
    })
  }, [
    isAdmin,
    profileOrgKey,
    agencyQuery.data,
    departmentQuery.data,
    divisionQuery.data,
    subDivisionQuery.data,
  ])

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const raw = lookupInput.trim()
      if (!raw) throw new Error('Enter a Citizen ID (CID)')
      return fetchEmployeeByCid(raw)
    },
    onMutate: () => {
      setOrgSelection(emptyOrgSelection())
      setOrgLocks(emptyOrgLocks())
    },
    onSuccess: (data) => {
      setProfile(data)
      showSuccessToast('Details loaded')
    },
    onError: (err) => {
      setProfile(null)
      showErrorToast(err, 'Lookup failed')
    },
  })

  useEffect(() => {
    if (profile) {
      const s = suggestedUsername(profile)
      setUsername((prev) => (prev.trim() ? prev : s))
    }
  }, [profile])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile) {
        throw new Error(
          ndiBootstrap
            ? 'Registration profile is missing. Start again from Bhutan NDI signup.'
            : 'Look up details by CID first',
        )
      }
      const nodes = isAdmin ? agencyOptions : groupsQuery.data ?? []
      if (!nodes.length) {
        throw new Error(
          isAdmin
            ? 'Master organogram lists could not be loaded. Try again.'
            : 'Group directory could not be loaded. Try again.',
        )
      }

      const roles = isAdmin ? [...selectedRoles] : []
      const values = buildDirectoryUserFormValues(profile, username, orgSelection, roles)
      const parsed = directoryUserRegistrationSchema(isAdmin).safeParse(values)
      if (!parsed.success) {
        throw new Error('Please fix the highlighted fields before submitting.')
      }

      const u = parsed.data.username
      const contactDigits = parsed.data.contact.replace(/\D/g, '')
      const fn = parsed.data.firstName
      const mn = parsed.data.middleName
      const ln = parsed.data.lastName
      const combinedName = [fn, mn, ln].filter(Boolean).join(' ').trim()
      const profileForPayload: FetchedPerson = {
        ...profile,
        firstName: fn,
        middleName: mn,
        lastName: ln,
        name: combinedName || profile.name,
        contact: contactDigits,
        email: parsed.data.email,
        designation: parsed.data.designation,
      }

      const orgIds = directoryUserFormValuesToOrgIds(orgSelection)
      const body = buildCreateUserPayload(profileForPayload, u, roles, orgIds)
      const path = mode === 'signup' ? '/public/register' : '/admin/users'
      return apiPost<unknown, typeof body>(path, body)
    },
    onSuccess: () => {
      if (isAdmin) {
        showSuccessToast('User created successfully')
        queryClient.invalidateQueries({ queryKey: ['admin-users'] })
        navigate('/users')
      } else {
        showSuccessToast('Registration submitted successfully')
        navigate('/login')
      }
    },
    onError: (err) => {
      showErrorToast(err, 'Failed to submit')
    },
  })

  if (isAdmin && crud.isResolved && !crud.canCreate) {
    return (
      <>
        <PageHeader title="Add New User" subtitle="Enter the details of the new user." />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to create users.</p>
      </>
    )
  }

  const roleOptions = rolesQuery.data ?? []

  const onSubmit = () => {
    if (formLocked) return
    if (!profile) return
    setSubmitAttempted(true)
    touchAllFields()
    const roles = isAdmin ? [...selectedRoles] : []
    const values = buildDirectoryUserFormValues(profile, username, orgSelection, roles)
    if (!isDirectoryUserFormValid(values, isAdmin)) return
    createMutation.mutate()
  }

  const toggleRole = (roleName: string) => {
    if (formLocked) return
    touchField('roles')
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleName)) next.delete(roleName)
      else next.add(roleName)
      return next
    })
  }

  const patchProfile = (patch: Partial<FetchedPerson>, touchKeys?: DirectoryUserFormFieldKey[]) => {
    setProfile((p) => (p ? { ...p, ...patch } : p))
    touchKeys?.forEach(touchField)
  }

  const namesLocked =
    profile?.directoryLookup === 'employee' && isDirectoryProvided(profile.name)

  const setPersonFirstName = (value: string) => {
    touchField('firstName')
    setProfile((p) => {
      if (!p) return p
      const middleName = p.middleName ?? ''
      const lastName = p.lastName ?? ''
      const combined = [value, middleName, lastName].filter((x) => x.trim()).join(' ').trim()
      return {
        ...p,
        firstName: value,
        name: combined || '-',
      }
    })
  }

  const setPersonMiddleName = (value: string) => {
    setProfile((p) => {
      if (!p) return p
      const firstName = p.firstName ?? ''
      const lastName = p.lastName ?? ''
      const combined = [firstName, value, lastName].filter((x) => x.trim()).join(' ').trim()
      return {
        ...p,
        middleName: value,
        name: combined || '-',
      }
    })
  }

  const setPersonLastName = (value: string) => {
    setProfile((p) => {
      if (!p) return p
      const firstName = p.firstName ?? ''
      const middleName = p.middleName ?? ''
      const combined = [firstName, middleName, value].filter((x) => x.trim()).join(' ').trim()
      return {
        ...p,
        lastName: value,
        name: combined || '-',
      }
    })
  }

  const setAgency = (id: string, name: string) => {
    if (formLocked) return
    touchField('agencyId')
    setOrgSelection((prev) => {
      const next = { ...prev, agencyId: id, agencyName: name }
      if (!orgLocks.department) {
        next.departmentId = ''
        next.departmentName = ''
      }
      if (!orgLocks.division) {
        next.divisionId = ''
        next.divisionName = ''
      }
      if (!orgLocks.subDivision) {
        next.subDivisionId = ''
        next.subDivisionName = ''
      }
      return next
    })
  }

  const setDepartment = (id: string, name: string) => {
    if (formLocked) return
    touchField('departmentId')
    setOrgSelection((prev) => {
      const next = { ...prev, departmentId: id, departmentName: name }
      if (!orgLocks.division) {
        next.divisionId = ''
        next.divisionName = ''
      }
      if (!orgLocks.subDivision) {
        next.subDivisionId = ''
        next.subDivisionName = ''
      }
      return next
    })
  }

  const setDivision = (id: string, name: string) => {
    if (formLocked) return
    touchField('divisionId')
    setOrgSelection((prev) => {
      const next = { ...prev, divisionId: id, divisionName: name }
      if (!orgLocks.subDivision) {
        next.subDivisionId = ''
        next.subDivisionName = ''
      }
      return next
    })
  }

  const setSubDivision = (id: string, name: string) => {
    if (formLocked) return
    setOrgSelection((prev) => ({
      ...prev,
      subDivisionId: id,
      subDivisionName: name,
    }))
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? "Add New User" : "User Registration"}
        subtitle={
          isAdmin
            ? "Look up by Citizen ID (CID)/Employee ID."
            : isNdiSignupBootstrap
              ? "Details were loaded from Bhutan NDI."
              : "Look up by Citizen ID (CID)/Employee ID."
        }
      />

      <Card className="overflow-visible rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-6 pt-5">
          {!isNdiSignupBootstrap ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="lookup-cid">
                    Citizen ID (CID)/Employee ID{" "}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  <Input
                    id="lookup-cid"
                    value={lookupInput}
                    onChange={(e) => {
                      setLookupInput(e.target.value)
                      if (lookupMutation.isError) lookupMutation.reset()
                    }}
                    placeholder="Enter CID/Employee ID"
                    disabled={formLocked}
                  />
                  {lookupMutation.isError ? (
                    <p className="text-sm text-[var(--fms-error-text)]">
                      {lookupMutation.error instanceof Error
                        ? lookupMutation.error.message
                        : 'Lookup failed'}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  disabled={formLocked || lookupMutation.isPending}
                  onClick={() => lookupMutation.mutate()}
                >
                  {lookupMutation.isPending ? "Loading…" : "Fetch details"}
                </Button>
              </div>
            </div>
          ) : null}

          {profile ? (
            <>
              {orgMasterLoading ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  {isAdmin
                    ? 'Loading master organogram (agency, department, division, sub division)…'
                    : 'Loading group directory (/public/groups)…'}
                </p>
              ) : orgMasterError ? (
                <p className="text-xs text-[var(--fms-delete)]">
                  {isAdmin
                    ? 'Could not load master organogram lists. Reload the page or try again—org assignment requires these lists.'
                    : 'Could not load /public/groups. Reload the page or try again—org assignment requires this list.'}
                </p>
              ) : null}
              {!profile.organogramHints &&
              !hasEmployeeDirectoryOrgLabels(profile) ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  {isNdiSignupBootstrap
                    ? "No organogram fields were returned from NDI. Use the select lists below to choose agency, department, division, and sub division."
                    : isAdmin
                      ? 'No organogram fields were returned for this CID. Use the search fields below to pick agency, department, division, and sub division from master data.'
                      : 'No organogram fields were returned for this CID. Use the search fields below to pick agency, department, division, and sub division from the group directory.'}
                </p>
              ) : (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  Directory organogram IDs and names (or agency, department,
                  division, and sub division from the employee record).
                  Read-only tiers were resolved from{" "}
                  {isNdiSignupBootstrap
                    ? "your NDI verification payload"
                    : "your EMS/directory payload"}
                  .
                </p>
              )}
              {/* {isNdiSignupBootstrap && profile ? (
                <div className="rounded-lg border border-[var(--fms-strokes)] bg-[#fafafa] px-3 py-3 text-sm">
                  <p className="font-medium text-[var(--fms-text-heading)]">From Bhutan NDI (directory)</p>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--fms-text-subheading)]">Agency</dt>
                      <dd className="text-[var(--fms-text-heading)]">
                        {isDirectoryProvided(profile.agency) ? profile.agency : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--fms-text-subheading)]">Department</dt>
                      <dd className="text-[var(--fms-text-heading)]">
                        {isDirectoryProvided(profile.department) ? profile.department : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--fms-text-subheading)]">Division</dt>
                      <dd className="text-[var(--fms-text-heading)]">
                        {isDirectoryProvided(profile.division) ? profile.division : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--fms-text-subheading)]">Section</dt>
                      <dd className="text-[var(--fms-text-heading)]">
                        {isDirectoryProvided(profile.subDivision) ? profile.subDivision : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null} */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>CID</Label>
                  <Input
                    value={profile.cid || "-"}
                    readOnly
                    className="bg-[#fafafa]"
                  />
                </div>
                {isDirectoryProvided(profile.employeeId) ? (
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      value={profile.employeeId || "-"}
                      readOnly
                      className="bg-[#fafafa]"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>
                    First name{" "}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {namesLocked ? (
                    <Input
                      value={profile.firstName ?? ""}
                      readOnly
                      className="bg-[#fafafa]"
                    />
                  ) : (
                    <Input
                      value={profile.firstName ?? ""}
                      onChange={(e) => setPersonFirstName(e.target.value)}
                      onBlur={() => touchField('firstName')}
                      placeholder="First name"
                      disabled={formLocked}
                      aria-invalid={fieldError('firstName') ? true : undefined}
                    />
                  )}
                  <FieldError message={fieldError('firstName')} />
                </div>
                <div className="space-y-2">
                  <Label>
                    Middle name{' '}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {namesLocked ? (
                    <Input
                      value={profile.middleName ?? ""}
                      readOnly
                      className="bg-[#fafafa]"
                    />
                  ) : (
                    <Input
                      value={profile.middleName ?? ""}
                      onChange={(e) => setPersonMiddleName(e.target.value)}
                      placeholder="Middle name"
                      disabled={formLocked}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  {namesLocked ? (
                    <Input
                      value={profile.lastName ?? ""}
                      readOnly
                      className="bg-[#fafafa]"
                    />
                  ) : (
                    <Input
                      value={profile.lastName ?? ""}
                      onChange={(e) => setPersonLastName(e.target.value)}
                      placeholder="Last name"
                      disabled={formLocked}
                    />
                  )}
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupSelect
                    label={
                      <>
                        Agency{" "}
                        <span className="text-[var(--fms-delete)]">*</span>
                      </>
                    }
                    options={agencyOptions}
                    selectedId={orgSelection.agencyId}
                    selectedName={orgSelection.agencyName}
                    locked={orgLocks.agency}
                    disabled={
                      formLocked ||
                      agencyQuery.isLoading ||
                      !!agencyQuery.isError
                    }
                    placeholder="Search agency…"
                    error={Boolean(fieldError('agencyId'))}
                    onSelect={setAgency}
                  />
                  <FieldError message={fieldError('agencyId')} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupSelect
                    label="Department"
                    options={departmentOptions}
                    selectedId={orgSelection.departmentId}
                    selectedName={orgSelection.departmentName}
                    locked={orgLocks.department}
                    disabled={
                      formLocked ||
                      departmentQuery.isLoading ||
                      !!departmentQuery.isError ||
                      (!orgLocks.department && !orgSelection.agencyId)
                    }
                    placeholder={
                      orgSelection.agencyId
                        ? "Search department…"
                        : "Select agency first"
                    }
                    error={Boolean(fieldError('departmentId'))}
                    onSelect={setDepartment}
                  />
                  <FieldError message={fieldError('departmentId')} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupSelect
                    label="Division"
                    options={divisionOptions}
                    selectedId={orgSelection.divisionId}
                    selectedName={orgSelection.divisionName}
                    locked={orgLocks.division}
                    disabled={
                      formLocked ||
                      divisionQuery.isLoading ||
                      !!divisionQuery.isError ||
                      (!orgLocks.division && !orgSelection.departmentId)
                    }
                    placeholder={
                      orgSelection.departmentId
                        ? "Search division…"
                        : "Select department first"
                    }
                    error={Boolean(fieldError('divisionId'))}
                    onSelect={setDivision}
                  />
                  <FieldError message={fieldError('divisionId')} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupSelect
                    label="Sub division"
                    options={subDivisionOptions}
                    selectedId={orgSelection.subDivisionId}
                    selectedName={orgSelection.subDivisionName}
                    locked={orgLocks.subDivision}
                    disabled={
                      formLocked ||
                      subDivisionQuery.isLoading ||
                      !!subDivisionQuery.isError ||
                      (!orgLocks.subDivision &&
                        (!orgSelection.divisionId ||
                          subDivisionOptions.length === 0))
                    }
                    placeholder={
                      !orgSelection.divisionId
                        ? "Select division first"
                        : subDivisionOptions.length === 0
                          ? "No sub-divisions for this division"
                          : "Search sub division…"
                    }
                    onSelect={setSubDivision}
                  />
                  {orgSelection.divisionId &&
                  subDivisionOptions.length === 0 ? (
                    <p className="text-xs text-[var(--fms-text-subheading)]">
                      No sub-divisions are listed under this division
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>
                    Designation{' '}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {profile.designationFromDirectory ? (
                    <Input
                      value={profile.designation}
                      readOnly
                      className="bg-[#fafafa]"
                    />
                  ) : (
                    <Input
                      value={
                        profile.designation === "-" ? "" : profile.designation
                      }
                      onChange={(e) =>
                        patchProfile({ designation: e.target.value }, ['designation'])
                      }
                      onBlur={() => touchField('designation')}
                      placeholder="Enter designation"
                      disabled={formLocked}
                      aria-invalid={fieldError('designation') ? true : undefined}
                    />
                  )}
                  <FieldError message={fieldError('designation')} />
                </div>
                <div className="space-y-2">
                  <Label>
                    Contact{' '}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>

                  <Input
                    value={profile.contact === "-" ? "" : profile.contact}
                    onChange={(e) => patchProfile({ contact: e.target.value }, ['contact'])}
                    onBlur={() => touchField('contact')}
                    placeholder="8-digit phone number"
                    disabled={formLocked}
                    aria-invalid={fieldError('contact') ? true : undefined}
                  />
                  <FieldError message={fieldError('contact')} />
                </div>
                <div className="space-y-2">
                  <Label>
                    Email{' '}
                    <span className="text-[var(--fms-delete)]">*</span>
                  </Label>

                  <Input
                    type="email"
                    value={profile.email === "-" ? "" : profile.email}
                    onChange={(e) => patchProfile({ email: e.target.value }, ['email'])}
                    onBlur={() => touchField('email')}
                    placeholder="Enter email"
                    disabled={formLocked}
                    aria-invalid={fieldError('email') ? true : undefined}
                  />
                  <FieldError message={fieldError('email')} />
                </div>
                <div className="space-y-2 ">
                  <Label htmlFor="username">
                    Username <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    placeholder="Login username for this user"
                    readOnly
                    aria-invalid={fieldError('username') ? true : undefined}
                  />
                  <FieldError message={fieldError('username')} />
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-3 border-t border-[var(--fms-strokes)] pt-4">
                  <div className="inline-flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 text-[var(--fms-button)]" />
                    <p className="text-sm font-semibold text-[var(--fms-text-header)]">
                      Roles
                    </p>
                  </div>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    Select one or more realm roles from the server.
                  </p>

                  {rolesQuery.isLoading ? (
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--fms-strokes)] p-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                          key={`role-dir-load-sk-${i}`}
                          className="h-14 w-full rounded-md"
                        />
                      ))}
                    </div>
                  ) : rolesQuery.isError ? (
                    <p className="text-sm text-[var(--fms-delete)]">
                      Could not load roles.
                    </p>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--fms-strokes)] p-3">
                      {roleOptions.length === 0 ? (
                        <p className="text-sm text-[var(--fms-text-subheading)]">
                          No roles returned by the API.
                        </p>
                      ) : (
                        roleOptions.map((opt) => {
                          const checked = selectedRoles.has(opt.roleName);
                          return (
                            <label
                              key={opt.roleName}
                              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                                checked
                                  ? "border-[var(--fms-button)] bg-[var(--fms-info-fill)]"
                                  : "border-[var(--fms-strokes)] bg-white"
                              } ${formLocked ? "pointer-events-none opacity-60" : ""}`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[var(--fms-button)]"
                                checked={checked}
                                disabled={formLocked}
                                onChange={() => toggleRole(opt.roleName)}
                              />
                              <span>
                                <span className="block text-sm font-semibold text-[var(--fms-text-header)]">
                                  {formatRealmRoleDisplayName(opt.roleName)}
                                </span>
                                {opt.description ? (
                                  <span className="block text-xs text-[var(--fms-text-subheading)]">
                                    {opt.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                  <FieldError message={fieldError('roles')} />
                </div>
              ) : null}
            </>
          ) : null}

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="destructive" asChild>
                <Link to="/users">Close</Link>
              </Button>
              <Button
                disabled={formLocked || createMutation.isPending || !profile}
                onClick={onSubmit}
              >
                {createMutation.isPending ? "Saving…" : "Save User"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" asChild>
                  <Link to="/signup">Back</Link>
                </Button>
                <Button
                  disabled={createMutation.isPending || !profile}
                  onClick={onSubmit}
                >
                  {createMutation.isPending ? "Submitting…" : "Sign Up"}
                </Button>
              </div>
              <p className="text-center text-sm text-[var(--fms-text-subheading)]">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-[var(--fms-accent-purple)]"
                >
                  Sign In
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
