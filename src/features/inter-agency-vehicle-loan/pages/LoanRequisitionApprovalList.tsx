import { LoanRequisitionListView } from '@/features/inter-agency-vehicle-loan/components/LoanRequisitionListView'

function LoanRequisitionApprovalList() {
  return (
    <LoanRequisitionListView
      fixedStatus="PENDING_HIGHEST_ADMIN"
      //asLending={false}
      title="Vehicle Loan Requisition Approvals"
      permissionPath="/vehicle-loan/approval"
      detailBackPath="/vehicle-loan/approval"
      searchAriaLabel="Search vehicle loan requisition approvals"
      emptyMessage="No vehicle loan requisitions pending approval."
    />
  )
}

export default LoanRequisitionApprovalList
