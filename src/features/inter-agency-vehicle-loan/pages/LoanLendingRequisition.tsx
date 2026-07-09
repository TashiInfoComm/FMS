import { LoanRequisitionListView } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionListView'

function LoanLendingRequisition() {
  return (
    <LoanRequisitionListView
      asLending
      title="Vehicle Lending Requests"
      permissionPath="/vehicle-loan/lending"
      detailBackPath="/vehicle-loan/lending"
      searchAriaLabel="Search vehicle lending requisitions"
      emptyMessage="No vehicle lending requisitions found."
    />
  )
}

export default LoanLendingRequisition
