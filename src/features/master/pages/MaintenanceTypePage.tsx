import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function MaintenanceTypePage() {
  return (
    <MasterDataPage
      title="Maintenance Type"
      subtitle="Manage maintenance type records and configurations"
      columns={['Sl.No', 'Maintenance Type', 'Description', 'Actions']}
      tableKeys={['id', 'maintenanceType', 'description']}
      initialRows={[
        { id: 1, maintenanceType: 'Routine Servicing', description: 'Regular oil change and checkup' },
        { id: 2, maintenanceType: 'Accident Repair', description: 'Major engine overhaul' },
        { id: 3, maintenanceType: 'Tire Replacement', description: 'Changing worn out tires' },
      ]}
      createFields={[
        { key: 'maintenanceType', label: 'Maintenance Type', placeholder: 'Enter maintenance type' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this maintenance type' },
      ]}
    />
  )
}
