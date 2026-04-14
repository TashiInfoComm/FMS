import { useState } from 'react'

import { MasterDataPage } from '@/shared/components/MasterDataPage'
import { PageHeader } from '@/shared/components/PageHeader'

const tabs = ['Vehicle Status', 'Vehicle Movement Status', 'Trip Status'] as const
type VehicleStatusTab = (typeof tabs)[number]

export function VehicleStatusPage() {
  const [activeTab, setActiveTab] = useState<VehicleStatusTab>('Vehicle Status')

  return (
    <section className="space-y-4">
      {activeTab === 'Vehicle Status' ? (
        <MasterDataPage
          title="Vehicle Status"
          subtitle="Manage vehicle status records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Vehicle Status" subtitle="Manage vehicle status records and configurations" />
              <div className="inline-flex rounded-md bg-[#e8ebf0] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={
                      tab === activeTab
                        ? 'rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs'
                        : 'rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]'
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
          columns={['Sl.No', 'Vehicle Status', 'Description', 'Actions']}
          tableKeys={['id', 'vehicleStatus', 'description']}
          initialRows={[
            { id: 1, vehicleStatus: 'Active', description: 'Available for use' },
            { id: 2, vehicleStatus: 'Under Maintenance', description: 'Currently in workshop' },
            { id: 3, vehicleStatus: 'Suspended', description: 'No longer in service' },
          ]}
          createFields={[
            { key: 'vehicleStatus', label: 'Vehicle Status', placeholder: 'Enter vehicle status' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this vehicle status' },
          ]}
        />
      ) : activeTab === 'Vehicle Movement Status' ? (
        <MasterDataPage
          title="Vehicle Movement Status"
          subtitle="Manage vehicle movement status records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Vehicle Movement Status" subtitle="Manage vehicle movement status records and configurations" />
              <div className="inline-flex rounded-md bg-[#e8ebf0] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={
                      tab === activeTab
                        ? 'rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs'
                        : 'rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]'
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
          columns={['Sl.No', 'Movement Status', 'Description', 'Actions']}
          tableKeys={['id', 'movementStatus', 'description']}
          initialRows={[
            { id: 1, movementStatus: 'Dispatched', description: 'Vehicle is on trip' },
            { id: 2, movementStatus: 'Returned', description: 'Vehicle has returned to base' },
            { id: 3, movementStatus: 'Standby', description: 'Vehicle waiting for assignment' },
          ]}
          createFields={[
            { key: 'movementStatus', label: 'Movement Status', placeholder: 'Enter movement status' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this movement status' },
          ]}
        />
      ) : (
        <MasterDataPage
          title="Trip Status"
          subtitle="Manage trip status records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Trip Status" subtitle="Manage trip status records and configurations" />
              <div className="inline-flex rounded-md bg-[#e8ebf0] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={
                      tab === activeTab
                        ? 'rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs'
                        : 'rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]'
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
          columns={['Sl.No', 'Trip Status', 'Description', 'Actions']}
          tableKeys={['id', 'tripStatus', 'description']}
          initialRows={[
            { id: 1, tripStatus: 'Approved', description: 'Trip approved' },
            { id: 2, tripStatus: 'Pending', description: 'Trip approval pending' },
          ]}
          createFields={[
            { key: 'tripStatus', label: 'Trip Status', placeholder: 'Enter trip status' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Enter description for this trip status' },
          ]}
        />
      )}
    </section>
  )
}
