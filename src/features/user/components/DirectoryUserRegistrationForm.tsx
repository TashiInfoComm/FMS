/**
 * CID directory lookup and group-directory org tiers — shared by admin create user and public manual signup.
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
import { OrgGroupAutocomplete } from '@/features/user/components/OrgGroupAutocomplete'
import {
  buildCreateUserPayload,
  fetchEmployeeByCid,
  fetchRealmRoleOptions,
  hasEmployeeDirectoryOrgLabels,
  isDirectoryProvided,
  mergedOrganogramHintsForProfile,
  suggestedUsername,
  type CreateUserOrgIds,
  type FetchedPerson,
} from '@/features/user/lib/users-api'
import {
  childGroupsOf,
  emptyOrgLocks,
  emptyOrgSelection,
  fetchAdminGroups,
  rootGroupNodes,
  resolveOrgSelectionFromHints,
  type OrgTierLocks,
  type OrgTierSelection,
} from '@/features/user/lib/groups-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { apiPost } from '@/services/apiClient'

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
    queryKey: ['admin-groups', mode],
    queryFn: fetchAdminGroups,
    staleTime: 60_000,
    enabled: queriesEnabled,
  })

  useEffect(() => {
    if (mode !== 'signup' || !ndiBootstrap || ndiWelcomeRef.current) return
    ndiWelcomeRef.current = true
    showSuccessToast('Your details were filled in from Bhutan NDI.')
  }, [mode, ndiBootstrap])

  const groupNodes = groupsQuery.data ?? []
  const agencyOptions = useMemo(() => {
    const roots = rootGroupNodes(groupNodes)
    return roots.length > 0 ? roots : groupNodes
  }, [groupNodes])
  const departmentOptions = useMemo(() => {
    if (!orgSelection.agencyId) return []
    return childGroupsOf(orgSelection.agencyId, groupNodes)
  }, [groupNodes, orgSelection.agencyId])
  const divisionOptions = useMemo(() => {
    if (!orgSelection.departmentId) return []
    return childGroupsOf(orgSelection.departmentId, groupNodes)
  }, [groupNodes, orgSelection.departmentId])
  const subDivisionOptions = useMemo(() => {
    if (!orgSelection.divisionId) return []
    return childGroupsOf(orgSelection.divisionId, groupNodes)
  }, [groupNodes, orgSelection.divisionId])

  useEffect(() => {
    if (!profile) {
      setOrgSelection(emptyOrgSelection())
      setOrgLocks(emptyOrgLocks())
      return
    }
    const nodes = groupsQuery.data
    if (!nodes?.length) return
    const hints = mergedOrganogramHintsForProfile(profile)
    const { selection, locks } = resolveOrgSelectionFromHints(hints, nodes)
    setOrgSelection(selection)
    setOrgLocks(locks)
  }, [profileOrgKey, groupsQuery.data])

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
      showErrorToast(err instanceof Error ? err.message : 'Lookup failed')
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
      const u = username.trim()
      if (!u) throw new Error('Username is required')
      const roles = isAdmin ? [...selectedRoles] : []
      if (isAdmin && roles.length === 0) throw new Error('Select at least one role')

      const fn = (profile.firstName ?? '').trim()
      const ln = (profile.lastName ?? '').trim()
      if (!fn && !ln) {
        throw new Error('Enter at least a first name or a last name')
      }

      const nodes = groupsQuery.data ?? []
      if (!nodes.length)
        throw new Error('Group directory could not be loaded. Try again.')

      if (!orgSelection.agencyId || !orgSelection.departmentId || !orgSelection.divisionId) {
        throw new Error('Select agency, department, and division from the group directory.')
      }
      const subRequired = childGroupsOf(orgSelection.divisionId, nodes).length > 0
      if (subRequired && !orgSelection.subDivisionId) {
        throw new Error('Select a sub division for the chosen division.')
      }

      const orgIds: CreateUserOrgIds = {
        agency_id: orgSelection.agencyId,
        department_id: orgSelection.departmentId,
        division_id: orgSelection.divisionId,
        sub_division_id: orgSelection.subDivisionId || undefined,
      }
      const body = buildCreateUserPayload(profile, u, roles, orgIds)
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
      showErrorToast(err instanceof Error ? err.message : 'Failed to submit')
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

  const toggleRole = (roleName: string) => {
    if (formLocked) return
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleName)) next.delete(roleName)
      else next.add(roleName)
      return next
    })
  }

  const patchProfile = (patch: Partial<FetchedPerson>) => {
    setProfile((p) => (p ? { ...p, ...patch } : p))
  }

  const namesLocked =
    profile?.directoryLookup === 'employee' && isDirectoryProvided(profile.name)

  const setPersonFirstName = (value: string) => {
    setProfile((p) => {
      if (!p) return p
      const lastName = p.lastName ?? ''
      const combined = [value, lastName].filter((x) => x.trim()).join(' ').trim()
      return {
        ...p,
        firstName: value,
        name: combined || '-',
      }
    })
  }

  const setPersonLastName = (value: string) => {
    setProfile((p) => {
      if (!p) return p
      const firstName = p.firstName ?? ''
      const combined = [firstName, value].filter((x) => x.trim()).join(' ').trim()
      return {
        ...p,
        lastName: value,
        name: combined || '-',
      }
    })
  }

  const setAgency = (id: string, name: string) => {
    if (formLocked) return
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
        title={isAdmin ? 'Add New User' : 'User Registration'}
        subtitle={
          isAdmin
            ? 'Look up by Citizen ID (CID). Agency hierarchy comes from GET /public/groups: values matched from directory organogram fields are read-only; otherwise search each tier.'
            : isNdiSignupBootstrap
              ? 'Details were loaded from Bhutan NDI. Agency hierarchy uses /public/groups: matched organogram tiers may be read-only; otherwise choose each tier from the autocomplete fields.'
              : 'Look up by Citizen ID (CID). Agency hierarchy comes from the group directory: values matched from directory organogram fields are read-only; otherwise search each tier.'
        }
      />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-6 pt-5">
          {!isNdiSignupBootstrap ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="lookup-cid">
                    Citizen ID (CID) <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  <Input
                    id="lookup-cid"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Enter CID"
                    disabled={formLocked}
                  />
                </div>
                <Button
                  type="button"
                  disabled={formLocked || lookupMutation.isPending}
                  onClick={() => lookupMutation.mutate()}
                >
                  {lookupMutation.isPending ? 'Loading…' : 'Fetch details'}
                </Button>
              </div>
            </div>
          ) : null}

          {profile ? (
            <>
              {groupsQuery.isLoading ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">Loading group directory (/public/groups)…</p>
              ) : groupsQuery.isError ? (
                <p className="text-xs text-[var(--fms-delete)]">
                  Could not load /public/groups. Reload the page or try again—org assignment requires this list.
                </p>
              ) : null}
              {!profile.organogramHints && !hasEmployeeDirectoryOrgLabels(profile) ? (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  {isNdiSignupBootstrap
                    ? 'No organogram fields were returned from NDI. Use the autocomplete fields below to select agency, department, division, and sub division.'
                    : 'No organogram fields were returned for this CID. Use the search fields below to pick agency, department, division, and sub division from the group directory.'}
                </p>
              ) : (
                <p className="text-xs text-[var(--fms-text-subheading)]">
                  Directory organogram IDs and names (or agency, department, division, and sub division from the employee
                  record) were matched to /public/groups where possible. Read-only tiers were resolved from{' '}
                  {isNdiSignupBootstrap ? 'your NDI verification payload' : 'your EMS/directory payload'}.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>CID</Label>
                  <Input value={profile.cid || '-'} readOnly className="bg-[#fafafa]" />
                </div>
                {isDirectoryProvided(profile.employeeId) ? (
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input value={profile.employeeId || '-'} readOnly className="bg-[#fafafa]" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>
                    First name <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  {namesLocked ? (
                    <Input value={profile.firstName ?? ''} readOnly className="bg-[#fafafa]" />
                  ) : (
                    <Input
                      value={profile.firstName ?? ''}
                      onChange={(e) => setPersonFirstName(e.target.value)}
                      placeholder="First name"
                      disabled={formLocked}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  {namesLocked ? (
                    <Input value={profile.lastName ?? ''} readOnly className="bg-[#fafafa]" />
                  ) : (
                    <Input
                      value={profile.lastName ?? ''}
                      onChange={(e) => setPersonLastName(e.target.value)}
                      placeholder="Last name"
                      disabled={formLocked}
                    />
                  )}
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupAutocomplete
                    label={
                      <>
                        Agency <span className="text-[var(--fms-delete)]">*</span>
                      </>
                    }
                    options={agencyOptions}
                    selectedId={orgSelection.agencyId}
                    selectedName={orgSelection.agencyName}
                    locked={orgLocks.agency}
                    disabled={formLocked || groupsQuery.isLoading || !!groupsQuery.isError}
                    placeholder="Search agency…"
                    onSelect={setAgency}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupAutocomplete
                    label={
                      <>
                        Department <span className="text-[var(--fms-delete)]">*</span>
                      </>
                    }
                    options={departmentOptions}
                    selectedId={orgSelection.departmentId}
                    selectedName={orgSelection.departmentName}
                    locked={orgLocks.department}
                    disabled={
                      formLocked ||
                      groupsQuery.isLoading ||
                      !!groupsQuery.isError ||
                      (!orgLocks.department && !orgSelection.agencyId)
                    }
                    placeholder={
                      orgSelection.agencyId ? 'Search department…' : 'Select agency first'
                    }
                    onSelect={setDepartment}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupAutocomplete
                    label={
                      <>
                        Division <span className="text-[var(--fms-delete)]">*</span>
                      </>
                    }
                    options={divisionOptions}
                    selectedId={orgSelection.divisionId}
                    selectedName={orgSelection.divisionName}
                    locked={orgLocks.division}
                    disabled={
                      formLocked ||
                      groupsQuery.isLoading ||
                      !!groupsQuery.isError ||
                      (!orgLocks.division && !orgSelection.departmentId)
                    }
                    placeholder={
                      orgSelection.departmentId ? 'Search division…' : 'Select department first'
                    }
                    onSelect={setDivision}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <OrgGroupAutocomplete
                    label={
                      <>
                        Sub division
                        {subDivisionOptions.length > 0 ? (
                          <span className="text-[var(--fms-delete)]"> *</span>
                        ) : null}
                      </>
                    }
                    options={subDivisionOptions}
                    selectedId={orgSelection.subDivisionId}
                    selectedName={orgSelection.subDivisionName}
                    locked={orgLocks.subDivision}
                    disabled={
                      formLocked ||
                      groupsQuery.isLoading ||
                      !!groupsQuery.isError ||
                      (!orgLocks.subDivision &&
                        (!orgSelection.divisionId || subDivisionOptions.length === 0))
                    }
                    placeholder={
                      !orgSelection.divisionId
                        ? 'Select division first'
                        : subDivisionOptions.length === 0
                          ? 'No sub-divisions for this division'
                          : 'Search sub division…'
                    }
                    onSelect={setSubDivision}
                  />
                  {orgSelection.divisionId && subDivisionOptions.length === 0 ? (
                    <p className="text-xs text-[var(--fms-text-subheading)]">
                      No sub-divisions are listed under this division—saving without a sub division is allowed.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  {profile.designationFromDirectory ? (
                    <Input value={profile.designation} readOnly className="bg-[#fafafa]" />
                  ) : (
                    <Input
                      value={profile.designation === '-' ? '' : profile.designation}
                      onChange={(e) => patchProfile({ designation: e.target.value })}
                      placeholder="Enter designation"
                      disabled={formLocked}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Contact</Label>

                  <Input
                    value={profile.contact === '-' ? '' : profile.contact}
                    onChange={(e) => patchProfile({ contact: e.target.value })}
                    placeholder="Enter contact number"
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>Email</Label>

                  <Input
                    type="email"
                    value={profile.email === '-' ? '' : profile.email}
                    onChange={(e) => patchProfile({ email: e.target.value })}
                    placeholder="Enter email"
                    disabled={formLocked}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="username">
                    Username <span className="text-[var(--fms-delete)]">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    placeholder="Login username for this user"
                    readOnly
                  />
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-3 border-t border-[var(--fms-strokes)] pt-4">
                  <div className="inline-flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 text-[var(--fms-button)]" />
                    <p className="text-sm font-semibold text-[var(--fms-text-header)]">Roles</p>
                  </div>
                  <p className="text-xs text-[var(--fms-text-subheading)]">
                    Select one or more realm roles from the server.
                  </p>

                  {rolesQuery.isLoading ? (
                    <p className="text-sm text-[var(--fms-text-subheading)]">Loading roles…</p>
                  ) : rolesQuery.isError ? (
                    <p className="text-sm text-[var(--fms-delete)]">Could not load roles.</p>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--fms-strokes)] p-3">
                      {roleOptions.length === 0 ? (
                        <p className="text-sm text-[var(--fms-text-subheading)]">No roles returned by the API.</p>
                      ) : (
                        roleOptions.map((opt) => {
                          const checked = selectedRoles.has(opt.roleName)
                          return (
                            <label
                              key={opt.roleName}
                              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                                checked
                                  ? 'border-[var(--fms-button)] bg-[var(--fms-info-fill)]'
                                  : 'border-[var(--fms-strokes)] bg-white'
                              } ${formLocked ? 'pointer-events-none opacity-60' : ''}`}
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
                                  {opt.roleName}
                                </span>
                                {opt.description ? (
                                  <span className="block text-xs text-[var(--fms-text-subheading)]">
                                    {opt.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
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
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Saving…' : 'Save User'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" asChild>
                  <Link to="/signup">Back</Link>
                </Button>
                <Button disabled={createMutation.isPending || !profile} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? 'Submitting…' : 'Sign Up'}
                </Button>
              </div>
              <p className="text-center text-sm text-[var(--fms-text-subheading)]">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-[var(--fms-accent-purple)]">
                  Sign In
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
