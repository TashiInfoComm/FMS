import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function UserRoleManagement() {
  return (
    <MasterDataPage
      title="User Role"
      subtitle="Manage user role records and configurations"
      columns={['Sl.No', 'Role Name', 'Description', 'Actions']}
      tableKeys={['id', 'roleName', 'description']}
      initialRows={[
        { id: 1, roleName: 'System Administrator', description: 'Full system access and control' },
        { id: 2, roleName: 'FMS User', description: 'Basic fleet operation management' },
        { id: 3, roleName: 'Approver', description: 'Approves movement and assignment workflows' },
      ]}
      createFields={[
        { key: 'roleName', label: 'Role Name', placeholder: 'Enter role name' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this role' },
      ]}
    />
  )
}
