import { useState } from 'react'

import { MasterDataPage } from '@/shared/components/MasterDataPage'
import { PageHeader } from '@/shared/components/PageHeader'

const tabs = ['Vehicle Type', 'Vehicle Category'] as const
type VehicleMetaTab = (typeof tabs)[number]

export function VehicleTypeCategoryPage() {
  const [activeTab, setActiveTab] = useState<VehicleMetaTab>('Vehicle Type')

  return (
    <section className="space-y-4">
      {activeTab === "Vehicle Type" ? (
        <MasterDataPage
          title="Vehicle Type"
          subtitle="Manage vehicle type records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Vehicle Type" subtitle="Manage vehicle type records and configurations" />
              <div className="inline-flex w-full max-w-full overflow-x-auto rounded-md bg-[#e8ebf0] p-1 sm:w-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={
                      tab === activeTab
                        ? "rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs"
                        : "rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]"
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
          columns={[
            "Sl.No",
            "Vehicle Type",
            "Description",
            "Status",
            "Actions",
          ]}
          tableKeys={["id", "vehicleType", "description", "status"]}
          initialRows={[
            {
              id: 1,
              vehicleType: "Light",
              description: "Small utility vehicles",
              status: "Active",
            },
            {
              id: 2,
              vehicleType: "Medium",
              description: "Mid-size service vehicles",
              status: "Active",
            },
            {
              id: 3,
              vehicleType: "Heavy",
              description: "Large transport vehicles",
              status: "Inactive",
            },
          ]}
          createFields={[
            {
              key: "vehicleType",
              label: "Vehicle Type",
              placeholder: "Enter vehicle type",
            },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              placeholder: "Enter description for this vehicle type",
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              placeholder: "Select status",
              options: ["Active", "Inactive"],
            },
          ]}
        />
      ) : (
        <MasterDataPage
          title="Vehicle Category"
          subtitle="Manage vehicle category records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Vehicle Category" subtitle="Manage vehicle category records and configurations" />
              <div className="inline-flex w-full max-w-full overflow-x-auto rounded-md bg-[#e8ebf0] p-1 sm:w-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={
                      tab === activeTab
                        ? "rounded-sm bg-white px-3 py-1.5 text-sm text-[var(--fms-text-header)] shadow-xs"
                        : "rounded-sm px-3 py-1.5 text-sm text-[var(--fms-text-subheading)]"
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          }
          columns={[
            "Sl.No",
            "Vehicle Category",
            "Description",
            "Status",
            "Actions",
          ]}
          tableKeys={["id", "vehicleCategory", "description", "status"]}
          initialRows={[
            {
              id: 1,
              vehicleCategory: "Sedan",
              description: "Passenger car",
              status: "Active",
            },
            {
              id: 2,
              vehicleCategory: "SUV",
              description: "Sport utility vehicle",
              status: "Active",
            },
            {
              id: 3,
              vehicleCategory: "Truck",
              description: "Cargo vehicle",
              status: "Inactive",
            },
          ]}
          createFields={[
            {
              key: "vehicleCategory",
              label: "Vehicle Category",
              placeholder: "Enter vehicle category",
            },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              placeholder: "Enter description for this vehicle category",
            },
            {
              key: "status",
              label: "Status",
              type: "select",
              placeholder: "Select status",
              options: ["Active", "Inactive"],
            },
          ]}
        />
      )}
    </section>
  )
}
