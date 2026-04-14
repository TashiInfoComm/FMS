import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function PurposeOfJourneyPage() {
  return (
    <MasterDataPage
      title="Purpose Of Journey"
      subtitle="Manage purpose of journey records and configurations"
      columns={['Sl.No', 'Purpose', 'Description', 'Actions']}
      tableKeys={['id', 'purpose', 'description']}
      initialRows={[
        { id: 1, purpose: 'Meeting', description: 'Attending meetings with other agencies' },
        { id: 2, purpose: 'Training', description: 'Attending or conducting training' },
      ]}
      createFields={[
        { key: 'purpose', label: 'Purpose', placeholder: 'Enter purpose' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this purpose' },
      ]}
    />
  )
}
