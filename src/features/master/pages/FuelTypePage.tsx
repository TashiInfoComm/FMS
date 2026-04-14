import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function FuelTypePage() {
  return (
    <MasterDataPage
      title="Fuel Type"
      subtitle="Manage fuel type records and configurations"
      columns={['Sl.No', 'Fuel Type', 'Actions']}
      tableKeys={['id', 'fuelType']}
      initialRows={[
        { id: 1, fuelType: 'Petrol' },
        { id: 2, fuelType: 'Diesel' },
      ]}
      createFields={[{ key: 'fuelType', label: 'Fuel Type', placeholder: 'Enter fuel type' }]}
    />
  )
}
