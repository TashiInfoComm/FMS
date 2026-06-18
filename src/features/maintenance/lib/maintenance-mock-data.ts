export type WorkOrderStatus = string

export const WORK_ORDER_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING_MTO_APPROVAL', label: 'Pending MTO Approval' },
  { value: 'PENDING_AGENCY_APPROVAL', label: 'Pending Agency Approval' },
  { value: 'APPROVED_FOR_SERVICE', label: 'Approved for Service' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const

export type MaintenanceType = 'Minor' | 'Major'

export type MaintenanceLineItem = {
  id: string
  servicePartId?: string
  description: string
  quantity: number
  unitPrice: number
  notes?: string
  isNew?: boolean
}

export type ServicePartOption = {
  id: string
  label: string
  unitPrice: number
}

export const SERVICE_PART_OPTIONS: ServicePartOption[] = [
  { id: 'sp-engine-diagnostics', label: 'Engine Diagnostics', unitPrice: 650 },
  { id: 'sp-engine-oil', label: 'Engine Oil', unitPrice: 30062.5 },
  { id: 'sp-oil-filter', label: 'Oil Filter', unitPrice: 180 },
  { id: 'sp-brake-pads', label: 'Brake Pads', unitPrice: 420 },
  { id: 'sp-brake-fluid', label: 'Brake Fluid', unitPrice: 95 },
  { id: 'sp-air-filter', label: 'Air Filter', unitPrice: 145 },
  { id: 'sp-spark-plugs', label: 'Spark Plugs', unitPrice: 220 },
  { id: 'sp-labor-charge', label: 'Labor Charge', unitPrice: 250 },
  { id: 'sp-wheel-alignment', label: 'Wheel Alignment', unitPrice: 380 },
  { id: 'sp-battery-replacement', label: 'Battery Replacement', unitPrice: 890 },
]

export function getServicePartOptions(): ServicePartOption[] {
  return SERVICE_PART_OPTIONS
}

export type MaintenanceProofFile = {
  name: string
  sizeLabel: string
  downloadUrl?: string
}

export type WorkOrderProofAttachment = {
  id: string
  fileName: string
  sizeLabel: string
  contentType?: string
  downloadUrl?: string
}

export type WorkOrderProblemReport = {
  id: string
  categoryName: string
  description: string
  proofAttachments: WorkOrderProofAttachment[]
}

export type WorkOrderListItem = {
  id: string
  workOrderId: string
  vehiclePlate: string
  assetCode?: string
  maintenanceType: string
  status: WorkOrderStatus
}

export type WorkOrderDetail = WorkOrderListItem & {
  reportedById: string
  maintenanceTypeId?: string
  driverName: string
  vehicleModel: string
  triggerType: string
  priority: string
  initiationReason: string
  problemCategory: string
  problemDescription: string
  proof?: MaintenanceProofFile
  problemReports: WorkOrderProblemReport[]
  lineItems: MaintenanceLineItem[]
  maintenanceRequestStatus?: string
  vehicleReadyStatus?: string
  lastServiceDate?: string
  serviceRecord?: WorkOrderServiceRecord
}

export type WorkOrderServiceRecord = {
  id: string
  workOrderId?: string
  invoiceNumber: string
  invoiceDate: string
  invoiceUrl?: string
  notes?: string
  laborHours?: number
  createdAt?: string
}

export function sumLineItems(items: MaintenanceLineItem[]): number {
  return items.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
}
