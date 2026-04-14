import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function RolePermissionManagement() {
  return (
    <MasterDataPage
      title="Role Permission"
      subtitle="Manage role permission records and configurations"
      columns={['Sl.No', 'Role Name', 'Permission', 'Actions']}
      tableKeys={['id', 'roleName', 'permission']}
      initialRows={[
        { id: 1, roleName: 'Admin', permission: 'trip:approve' },
        { id: 2, roleName: 'Operator', permission: 'trip:create' },
      ]}
      createFields={[
        {
          key: 'roleName',
          label: 'Role Name',
          type: 'select',
          placeholder: 'Select role',
          options: ['Admin', 'Manager', 'Operator'],
        },
        {
          key: 'permission',
          label: 'Permission',
          type: 'select',
          placeholder: 'Select permission',
          options: ['trip:create', 'trip:approve', 'vehicle:view', 'status:view'],
        },
      ]}
    />
  )
}
