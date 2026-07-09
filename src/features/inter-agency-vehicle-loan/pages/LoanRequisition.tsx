import { LoanRequisitionListView } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionListView'

function LoanRequisition() {
  return (
    <LoanRequisitionListView
      asLending={false}
      title="Vehicle Loan Requisitions"
      permissionPath="/vehicle-loan/requisition"
      detailBackPath="/vehicle-loan/requisition"
      searchAriaLabel="Search vehicle loan requisitions"
      emptyMessage="No vehicle loan requisitions found."
      createPath="/vehicle-loan/requisition/create"
      enableBorrowerActions
    />
  )
}

export default LoanRequisition
