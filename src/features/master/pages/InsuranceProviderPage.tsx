import { MasterDataPage } from '@/shared/components/MasterDataPage'

export function InsuranceProviderPage() {
  return (
    <MasterDataPage
      title="Insurance Provider"
      subtitle="Manage insurance provider records and configurations"
      columns={['Sl.No', 'Insurance Provider', 'Contact Details', 'Actions']}
      tableKeys={['id', 'provider', 'contact']}
      initialRows={[
        { id: 1, provider: 'Royal Insurance Corporation of Bhutan', contact: 'PhoneNo.: 17111111' },
        { id: 2, provider: 'Bhutan Insurance Limited', contact: 'PhoneNo.: 17222222' },
      ]}
      createFields={[
        { key: 'provider', label: 'Insurance Provider', placeholder: 'Enter insurance provider' },
        { key: 'contact', label: 'Contact Details', placeholder: 'Enter contact details' },
      ]}
    />
  )
}
