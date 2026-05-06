/**
 * Route: `/users/:userId/edit`. Hydrates from `GET /admin/users/:id`; saves with `PUT /admin/users/:id` via `buildCreateUserPayload`.
 * View allowed with `canRead`, submit with `canUpdate`. Only contact, email, and roles are editable; other fields are read-only.
 */
import { CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  apiRecordToFetchedPerson,
  buildCreateUserPayload,
  fetchRealmRoleOptions,
  fetchUserById,
  realmRoleNamesFromUserRecord,
  toText,
  type FetchedPerson,
} from '@/features/user/lib/users-api'
import { PageHeader } from '@/shared/components/PageHeader'
import { useRouteCrudPermissions } from '@/shared/hooks/useRouteCrudPermissions'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'
import { apiPut } from '@/services/apiClient'

function displayOrDash(value: string) {
  const t = value.trim()
  return t && t !== '-' ? t : '-'
}

/** Same create-style layout, seeded from server; PUT persists changes to contact, email, and roles only (other fields shown read-only). */
export function EditUserFormPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const crud = useRouteCrudPermissions('/users')

  const [profile, setProfile] = useState<FetchedPerson | null>(null)
  const [username, setUsername] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const hydratedFromServer = useRef(false)

  useEffect(() => {
    hydratedFromServer.current = false
  }, [userId])

  const userRecordQuery = useQuery({
    queryKey: ['admin-user-edit', userId],
    queryFn: async () => {
      if (!userId?.trim()) throw new Error('Missing user id')
      return fetchUserById(userId)
    },
    enabled: Boolean(userId?.trim()) && crud.isResolved && crud.canRead,
    staleTime: 30_000,
  })

  useEffect(() => {
    const r = userRecordQuery.data
    if (!r || hydratedFromServer.current) return
    hydratedFromServer.current = true
    setProfile(apiRecordToFetchedPerson(r))
    setUsername(toText(r.username) || toText(r.user_name) || '')
    setSelectedRoles(new Set(realmRoleNamesFromUserRecord(r)))
  }, [userRecordQuery.data])

  const rolesQuery = useQuery({
    queryKey: ['admin-roles-user-form'],
    queryFn: fetchRealmRoleOptions,
    staleTime: 60_000,
    enabled: crud.isResolved && crud.canRead,
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!crud.canUpdate) {
        throw new Error('You do not have permission to update users.')
      }
      if (!userId?.trim()) throw new Error('Missing user id')
      if (!profile) throw new Error('Missing profile data')
      const u = username.trim()
      if (!u) throw new Error('Username is required')
      const roles = [...selectedRoles]
      if (roles.length === 0) throw new Error('Select at least one role')
      const body = buildCreateUserPayload(profile, u, roles)
      return apiPut<unknown, typeof body>(`/admin/users/${encodeURIComponent(userId)}`, body)
    },
    onSuccess: () => {
      showSuccessToast('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-edit', userId] })
      if (userId) navigate(`/users/${encodeURIComponent(userId)}`)
      else navigate('/users')
    },
    onError: (err) => {
      showErrorToast(err instanceof Error ? err.message : 'Failed to update user')
    },
  })

  if (crud.isLoading || !crud.isResolved) {
    return (
      <section className="space-y-5">
        <PageHeader title="Edit user" subtitle="Update account details." />
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading permissions…</p>
      </section>
    )
  }

  if (crud.isResolved && !crud.canRead) {
    return (
      <section className="space-y-5">
        <PageHeader title="Edit user" subtitle="Update account details." />
        <p className="text-sm text-[var(--fms-text-subheading)]">You do not have permission to view or edit users.</p>
        <Button variant="outline" asChild>
          <Link to="/users">Back to list</Link>
        </Button>
      </section>
    )
  }

  const formLocked = !(crud.isResolved && crud.canUpdate)
  const roleOptions = rolesQuery.data ?? []
  const detailHref = userId ? `/users/${encodeURIComponent(userId)}` : '/users'

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

  return (
    <section className="space-y-5">
      <PageHeader
        title="Edit user"
        subtitle="Update contact, email, and realm roles. Other fields come from the saved account."
      />

      {userRecordQuery.isLoading ? (
        <p className="text-sm text-[var(--fms-text-subheading)]">Loading user…</p>
      ) : userRecordQuery.isError ? (
        <p className="text-sm text-[var(--fms-delete)]">
          {userRecordQuery.error instanceof Error ? userRecordQuery.error.message : 'Failed to load user'}
        </p>
      ) : (
        <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
          <CardContent className="space-y-6 pt-5">
            {crud.canRead && !crud.canUpdate ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-50">
                You can open this screen, but your role does not include <strong>update</strong> (or{' '}
                <strong>edit</strong>) on Users—save is disabled until that permission is granted.
              </p>
            ) : null}

            {profile ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>CID</Label>
                    <Input value={displayOrDash(profile.cid)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      value={displayOrDash(profile.employeeId)}
                      readOnly
                      tabIndex={-1}
                      className="bg-[#fafafa]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={displayOrDash(profile.name)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Agency</Label>
                    <Input value={displayOrDash(profile.agency)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={displayOrDash(profile.department)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Division</Label>
                    <Input value={displayOrDash(profile.division)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sub division</Label>
                    <Input value={displayOrDash(profile.subDivision)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input value={displayOrDash(profile.designation)} readOnly tabIndex={-1} className="bg-[#fafafa]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input
                      value={profile.contact === '-' ? '' : profile.contact}
                      onChange={(e) => patchProfile({ contact: e.target.value })}
                      placeholder="Enter contact number"
                      disabled={formLocked}
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
                    <Label htmlFor="edit-username">
                      Username <span className="text-[var(--fms-delete)]">*</span>
                    </Label>
                    <Input
                      id="edit-username"
                      value={username}
                      readOnly
                      tabIndex={-1}
                      className="bg-[#fafafa]"
                      aria-readonly="true"
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-[var(--fms-strokes)] pt-4">
                  <div className="inline-flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 text-[var(--fms-button)]" />
                    <p className="text-sm font-semibold text-[var(--fms-text-header)]">Roles</p>
                  </div>
                  <p className="text-xs text-[var(--fms-text-subheading)]">Select one or more realm roles.</p>

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
                                <span className="block text-sm font-semibold text-[var(--fms-text-header)]">{opt.roleName}</span>
                                {opt.description ? (
                                  <span className="block text-xs text-[var(--fms-text-subheading)]">{opt.description}</span>
                                ) : null}
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" asChild>
                <Link to={detailHref}>Cancel</Link>
              </Button>
              <Button
                disabled={formLocked || updateMutation.isPending || !profile}
                onClick={() => updateMutation.mutate()}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
