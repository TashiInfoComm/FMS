import { CircleCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/shared/components/PageHeader'

type RoleOption = 'System Admin' | 'Driver' | 'Approver'

type EmployeeProfile = {
  employeeId: string
  cidNo: string
  name: string
  agency: string
  department: string
  designation: string
  contactNo: string
  email: string
}

const employeeDirectory: EmployeeProfile[] = [
  {
    employeeId: 'E01167',
    cidNo: '11501001234',
    name: 'Sonam Dorji',
    agency: 'Ministry of Finance',
    department: 'Fleet Services',
    designation: 'Transport Officer',
    contactNo: '17676543',
    email: 'sonam@email.com',
  },
  {
    employeeId: 'E00765',
    cidNo: '11502005678',
    name: 'Karma Wangmo',
    agency: 'Ministry of Finance',
    department: 'Administration',
    designation: 'Driver',
    contactNo: '77654321',
    email: 'karma@email.com',
  },
]

export function CreateUserFormPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [selectedRole, setSelectedRole] = useState<RoleOption>('System Admin')
  const [submittedId, setSubmittedId] = useState('')

  const matchedEmployee = useMemo(
    () => employeeDirectory.find((employee) => employee.employeeId.toLowerCase() === submittedId.toLowerCase()),
    [submittedId],
  )

  return (
    <section className="space-y-5">
      <PageHeader title="Add New User" subtitle="Enter the details of the new user." />

      <Card className="rounded-xl border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-6 pt-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-[var(--fms-button)]" />
              <p className="text-sm font-semibold text-[var(--fms-text-header)]">Personal Information</p>
            </div>
            <p className="text-xs text-[var(--fms-text-subheading)]">Basic identification details for the user.</p>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="employeeId">
                  Employee ID <span className="text-[var(--fms-delete)]">*</span>
                </Label>
                <Input id="employeeId" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Enter employee ID" />
              </div>
              <Button type="button" onClick={() => setSubmittedId(employeeId.trim())}>
                Search
              </Button>
            </div>
          </div>

          {matchedEmployee ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>CID No</Label>
                  <Input value={matchedEmployee.cidNo} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={matchedEmployee.name} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Agency</Label>
                  <Input value={matchedEmployee.agency} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={matchedEmployee.department} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input value={matchedEmployee.designation} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Contact No</Label>
                  <Input value={matchedEmployee.contactNo} readOnly />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>Email</Label>
                  <Input value={matchedEmployee.email} readOnly />
                </div>
              </div>

              <div className="space-y-3 border-t border-[var(--fms-strokes)] pt-4">
                <div className="inline-flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-[var(--fms-button)]" />
                  <p className="text-sm font-semibold text-[var(--fms-text-header)]">Role & Permissions</p>
                </div>
                <p className="text-xs text-[var(--fms-text-subheading)]">Define what this user can do within the system.</p>

                <div className="grid gap-3 md:grid-cols-3">
                  {(['System Admin', 'Driver', 'Approver'] as RoleOption[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={
                        role === selectedRole
                          ? 'rounded-md border border-[var(--fms-button)] bg-[var(--fms-info-fill)] p-3 text-left'
                          : 'rounded-md border border-[var(--fms-strokes)] bg-white p-3 text-left'
                      }
                    >
                      <p className="text-sm font-semibold text-[var(--fms-text-header)]">{role}</p>
                      <p className="text-xs text-[var(--fms-text-subheading)]">
                        {role === 'System Admin'
                          ? 'Full access and permissions.'
                          : role === 'Driver'
                            ? 'Field access to assigned duties.'
                            : 'Approves trip requests.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="flex items-center gap-3">
            <Button variant="destructive" asChild>
              <Link to="/users">Close</Link>
            </Button>
            <Button asChild>
              <Link to="/users">Save User</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
