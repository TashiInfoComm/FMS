import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function TripTypePage() {
  return (
    <MasterDataPage
      title="Trip Type"
      subtitle="Manage trip type records and configurations"
      columns={['Sl. No', 'Trip Type', 'Description', 'Actions']}
      tableKeys={['id', 'tripType', 'description']}
      initialRows={[
        { id: 1, tripType: 'Local Trip', description: 'Within city limits' },
        { id: 2, tripType: 'Long Trip', description: 'Outside city limits' },
      ]}
      createFields={[
        { key: 'tripType', label: 'Trip Type', placeholder: 'Enter trip type' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this trip type' },
      ]}
    />
  )
}
