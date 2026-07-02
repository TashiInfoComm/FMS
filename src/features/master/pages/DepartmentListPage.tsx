import { useParams } from 'react-router-dom'

import { AgencyHierarchyCrudSection } from '@/features/master/components/AgencyHierarchyCrudSection'
import {
  departmentListPath,
  mapDepartmentRows,
  type HierarchyTableRow,
} from '@/features/master/lib/agency-hierarchy-api'
import {
  buildDivisionNavigationTarget,
  useDepartmentParentContext,
} from '@/features/master/lib/agency-hierarchy-navigation'

const DEPARTMENT_FORM_FIELDS = [
  { key: 'code', label: 'Department Code', type: 'text' as const, placeholder: 'Enter department code' },
  { key: 'name', label: 'Department Name', type: 'text' as const, placeholder: 'Enter department name' },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea' as const,
    placeholder: 'Enter description for this department',
  },
]

export function DepartmentListPage() {
  const { agencyCode = '' } = useParams()
  const { agencyId, agencyName } = useDepartmentParentContext(agencyCode)

  return (
    <AgencyHierarchyCrudSection
      level="Department"
      title="Department"
      subtitle={
        agencyName
          ? `Manage departments under ${agencyName}`
          : 'Manage department records and configurations'
      }
      columns={['Sl.No', 'Department Name', 'Code', 'Status']}
      tableKeys={['serialNo', 'departmentName', 'displayCode']}
      formFields={DEPARTMENT_FORM_FIELDS}
      listQueryKey={['master-departments-by-agency', agencyCode]}
      buildListPath={(search, page, pageSize) =>
        departmentListPath(agencyCode, search, page, pageSize)
      }
      parentField="agency_id"
      parentId={agencyId}
      parentContextName={agencyName || undefined}
      backLink={{ to: '/master/agency', label: 'Back to Agency List' }}
      drillDown={{
        detailTooltip: 'View Divisions',
        getNavigation: (row: HierarchyTableRow) =>
          buildDivisionNavigationTarget(row, agencyCode, agencyId, agencyName),
      }}
      mapRows={mapDepartmentRows}
      enabled={Boolean(agencyCode)}
    />
  )
}
