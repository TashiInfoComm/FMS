import { useParams } from 'react-router-dom'

import { AgencyHierarchyCrudSection } from '@/features/master/components/AgencyHierarchyCrudSection'
import {
  divisionListPath,
  mapDivisionRows,
  type HierarchyTableRow,
} from '@/features/master/lib/agency-hierarchy-api'
import {
  buildSubDivisionNavigationTarget,
  useDivisionParentContext,
} from '@/features/master/lib/agency-hierarchy-navigation'

const DIVISION_FORM_FIELDS = [
  { key: 'code', label: 'Division Code', type: 'text' as const, placeholder: 'Enter division code' },
  { key: 'name', label: 'Division Name', type: 'text' as const, placeholder: 'Enter division name' },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea' as const,
    placeholder: 'Enter description for this division',
  },
]

export function DivisionListPage() {
  const { departmentCode = '' } = useParams()
  const {
    departmentId,
    departmentName,
    agencyCode,
    agencyId,
    agencyName,
  } = useDivisionParentContext(departmentCode)

  const departmentBackLink = agencyCode
    ? {
        to: `/master/agency/${encodeURIComponent(agencyCode)}/departments`,
        state: {
          agencyId,
          agencyName,
        },
        label: agencyName ? `Back to ${agencyName} Departments` : 'Back to Department List',
      }
    : { to: '/master/agency', label: 'Back to Agency List' }

  return (
    <AgencyHierarchyCrudSection
      level="Division"
      title="Division"
      subtitle={
        departmentName
          ? `Manage divisions under ${departmentName}`
          : 'Manage division records and configurations'
      }
      columns={['Sl.No', 'Division', 'Code', 'Status']}
      tableKeys={['serialNo', 'division', 'displayCode']}
      formFields={DIVISION_FORM_FIELDS}
      listQueryKey={['master-divisions-by-department', departmentCode]}
      buildListPath={(search, page, pageSize) =>
        divisionListPath(departmentCode, search, page, pageSize)
      }
      parentField="department_id"
      parentId={departmentId}
      parentContextName={departmentName || undefined}
      backLink={departmentBackLink}
      drillDown={{
        detailTooltip: 'View Sub-Divisions',
        getNavigation: (row: HierarchyTableRow) =>
          buildSubDivisionNavigationTarget(row, {
            departmentCode,
            departmentId,
            departmentName,
            agencyCode,
            agencyId,
            agencyName,
          }),
      }}
      mapRows={mapDivisionRows}
      enabled={Boolean(departmentCode)}
    />
  )
}
