import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function PermissionManagement() {
  return (
    <MasterDataPage
      title="Permission"
      subtitle="Manage permission records and configurations"
      columns={['Sl.No', 'Permission Name', 'Description', 'Actions']}
      tableKeys={['id', 'permissionName', 'description']}
      initialRows={[
        { id: 1, permissionName: 'trip:create', description: 'Allows creating new trips' },
        { id: 2, permissionName: 'trip:approve', description: 'Allows trip approval actions' },
      ]}
      createFields={[
        { key: 'permissionName', label: 'Permission Name', placeholder: 'Enter permission name' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this permission' },
      ]}
    />
  )
}
