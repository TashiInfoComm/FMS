import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DeleteDialog } from '@/shared/components/DeleteDialog'
import { PageHeader } from '@/shared/components/PageHeader'

type UserRow = {
  id: number
  name: string
  contact: string
  email: string
  role: string
}

const initialUsers: UserRow[] = [
  { id: 1, name: 'Sonam Dorji', contact: '17676543', email: 'sonam@email.com', role: 'Approver' },
  { id: 2, name: 'Karma Wangmo', contact: '77654321', email: 'karma@email.com', role: 'Driver' },
]

export function CreateUserListPage() {
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users
    return users.filter((user) => `${user.id} ${user.name} ${user.contact} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))
  }, [query, users])

  const askDelete = (id: number) => {
    setSelectedId(id)
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    if (selectedId === null) return
    setUsers((prev) => prev.filter((user) => user.id !== selectedId))
    setSelectedId(null)
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Create User" subtitle="Manage user records and configurations" />
        <Button asChild className="w-full sm:w-auto">
          <Link to="/users/add">
            <Plus className="mr-1 h-4 w-4" />
            Add New
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white p-2 sm:p-4">
        <CardContent className="space-y-4 p-0">
          <div className="flex justify-end">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--fms-text-subheading)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by code or name"
                className="pl-9"
              />
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-[var(--fms-strokes)] md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f6f7] text-[var(--fms-text-header)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sl.No</th>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">EID</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--fms-strokes)]">
                    <td className="px-4 py-3">{user.id}</td>
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3">{user.contact}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-info-fill)]">
                          <Pencil className="h-4 w-4 text-[var(--fms-text-header)]" />
                        </button>
                        <button type="button" className="rounded p-1 hover:bg-[var(--fms-error-fill)]" onClick={() => askDelete(user.id)}>
                          <Trash2 className="h-4 w-4 text-[var(--fms-delete)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onConfirmDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
      />
    </section>
  )
}
