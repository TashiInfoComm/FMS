import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function DestinationPage() {
  return (
    <MasterDataPage
      title="Destination"
      subtitle="Manage destination records and configurations"
      columns={['Sl.No', 'Destination', 'Description', 'Dzongkhag', 'Gewog', 'Actions']}
      tableKeys={['id', 'destination', 'description', 'dzongkhag', 'gewog']}
      initialRows={[
        { id: 1, destination: 'Thimphu', description: 'To attending meetings', dzongkhag: 'Thimphu', gewog: 'Chang' },
        { id: 2, destination: 'Paro', description: 'To attend or conduct training', dzongkhag: 'Thimphu', gewog: 'Babesa' },
      ]}
      createFields={[
        { key: 'destination', label: 'Destination', placeholder: 'Enter destination' },
        { key: 'dzongkhag', label: 'Dzongkhag', type: 'select', placeholder: 'Select Dzongkhag', options: ['Thimphu', 'Paro', 'Punakha'] },
        { key: 'gewog', label: 'Gewog', type: 'select', placeholder: 'Select gewog', options: ['Chang', 'Babesa', 'Kawang'] },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this destination' },
      ]}
    />
  )
}
