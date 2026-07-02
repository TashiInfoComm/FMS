import { useParams } from 'react-router-dom'

import { AgencyHierarchyCrudSection } from '@/features/master/components/AgencyHierarchyCrudSection'
import {
  mapSubDivisionRows,
  subDivisionListPath,
} from '@/features/master/lib/agency-hierarchy-api'
import { useSubDivisionParentContext } from '@/features/master/lib/agency-hierarchy-navigation'

const SUB_DIVISION_FORM_FIELDS = [
  {
    key: 'code',
    label: 'Sub-Division Code',
    type: 'text' as const,
    placeholder: 'Enter sub-division code',
  },
  {
    key: 'name',
    label: 'Sub-Division Name',
    type: 'text' as const,
    placeholder: 'Enter sub-division name',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea' as const,
    placeholder: 'Enter description for this sub-division',
  },
]

export function SubDivisionListPage() {
  const { divisionCode = '' } = useParams()
  const {
    divisionId,
    divisionName,
    departmentCode,
    departmentId,
    departmentName,
    agencyCode,
    agencyId,
    agencyName,
  } = useSubDivisionParentContext(divisionCode)

  const divisionBackLink = departmentCode
    ? {
        to: `/master/departments/${encodeURIComponent(departmentCode)}/divisions`,
        state: {
          departmentId,
          departmentName,
          agencyCode,
          agencyId,
          agencyName,
        },
        label: departmentName
          ? `Back to ${departmentName} Divisions`
          : 'Back to Division List',
      }
    : { to: '/master/agency', label: 'Back to Agency List' }

  return (
    <AgencyHierarchyCrudSection
      level="Sub-Division"
      title="Sub-Division"
      subtitle={
        divisionName
          ? `Manage sub-divisions under ${divisionName}`
          : 'Manage sub-division records and configurations'
      }
      columns={['Sl.No', 'Sub-Division', 'Code', 'Status']}
      tableKeys={['serialNo', 'subDivision', 'displayCode']}
      formFields={SUB_DIVISION_FORM_FIELDS}
      listQueryKey={['master-sub-divisions-by-division', divisionCode]}
      buildListPath={(search, page, pageSize) =>
        subDivisionListPath(divisionCode, search, page, pageSize)
      }
      parentField="division_id"
      parentId={divisionId}
      parentContextName={divisionName || undefined}
      backLink={divisionBackLink}
      mapRows={mapSubDivisionRows}
      enabled={Boolean(divisionCode)}
    />
  )
}
