import { useState } from 'react'

import { MasterDataPage } from '@/shared/components/MasterDataPage'
import { PageHeader } from '@/shared/components/PageHeader'

const tabs = ['Dzongkhag', 'Gewog'] as const
type Tab = (typeof tabs)[number]

export function DzongkhagGewogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Dzongkhag')

  return (
    <section className="space-y-4">
      {activeTab === 'Dzongkhag' ? (
        <MasterDataPage
          title="Dzongkhag"
          subtitle="Manage dzongkhag records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Dzongkhag" subtitle="Manage dzongkhag records and configurations" />
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
          columns={['Sl.No', 'Dzongkhag', 'Actions']}
          tableKeys={['id', 'dzongkhag']}
          initialRows={[
            { id: 1, dzongkhag: 'Thimphu' },
            { id: 2, dzongkhag: 'Paro' },
          ]}
          createFields={[{ key: 'dzongkhag', label: 'Dzongkhag', placeholder: 'Enter dzongkhag' }]}
        />
      ) : (
        <MasterDataPage
          title="Gewog"
          subtitle="Manage gewog records and configurations"
          headerContent={
            <div className="space-y-4">
              <PageHeader title="Gewog" subtitle="Manage gewog records and configurations" />
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
          columns={['Sl.No', 'Gewog', 'Dzongkhag', 'Actions']}
          tableKeys={['id', 'gewog', 'dzongkhag']}
          initialRows={[
            { id: 1, gewog: 'Babesa', dzongkhag: 'Thimphu' },
            { id: 2, gewog: 'Chang', dzongkhag: 'Thimphu' },
          ]}
          createFields={[
            { key: 'gewog', label: 'Gewog', placeholder: 'Enter gewog' },
            {
              key: 'dzongkhag',
              label: 'Dzongkhag',
              type: 'select',
              placeholder: 'Select Dzongkhag',
              options: ['Thimphu', 'Paro', 'Punakha'],
            },
          ]}
        />
      )}
    </section>
  )
}
