export type WorkOrderStatus =
  | 'Pending'
  | 'Pending Approval'
  | 'Approved'
  | 'Approved for Service'
  | 'Completed'
  | 'Rejected'

export type MaintenanceType = 'Minor' | 'Major'

export type MaintenanceLineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export type MaintenanceProofFile = {
  name: string
  sizeLabel: string
}

export type WorkOrderListItem = {
  id: string
  workOrderId: string
  vehiclePlate: string
  assetCode?: string
  maintenanceType: MaintenanceType
  status: WorkOrderStatus
}

export type WorkOrderDetail = WorkOrderListItem & {
  driverName: string
  vehicleModel: string
  initiationReason: string
  problemCategory: string
  problemDescription: string
  proof?: MaintenanceProofFile
  lineItems: MaintenanceLineItem[]
  maintenanceRequestStatus?: string
  vehicleReadyStatus?: string
  lastServiceDate?: string
}

export type ServiceRecordListItem = {
  id: string
  workOrderId: string
  vehiclePlate: string
  maintenanceType: MaintenanceType
  status: WorkOrderStatus
}

const LINE_ITEMS_SAMPLE: MaintenanceLineItem[] = [
  { id: 'li-1', description: 'Engine Diagnostics', quantity: 1, unitPrice: 650 },
  { id: 'li-2', description: 'Engine Oil', quantity: 4, unitPrice: 562.5 },
  { id: 'li-3', description: 'Labor Charge', quantity: 1, unitPrice: 250 },
]

function buildWorkOrder(
  index: number,
  overrides: Partial<WorkOrderDetail> = {},
): WorkOrderDetail {
  const n = String(index).padStart(3, '0')
  const base: WorkOrderDetail = {
    id: `wo-${index}`,
    workOrderId: `WO-2026-${n}`,
    vehiclePlate: `BG-1-A${1200 + index}`,
    assetCode: index % 3 === 0 ? `BG-1-${1100 + index}` : undefined,
    maintenanceType: index % 2 === 0 ? 'Minor' : 'Major',
    status: index % 4 === 0 ? 'Approved' : index % 3 === 0 ? 'Pending Approval' : 'Pending',
    driverName: 'Pema Wangdi',
    vehicleModel: 'Toyota Hilux',
    initiationReason: 'Reactive : Driver Reported',
    problemCategory:
      index % 2 === 0 ? 'Routine Servicing' : 'Change oil filter',
    problemDescription:
      index % 2 === 0
        ? 'Scheduled minor service due'
        : 'Engine knocking noise observed',
    proof: { name: 'Carpicture.jpg', sizeLabel: '17.4 KB' },
    lineItems: LINE_ITEMS_SAMPLE.map((row, i) => ({
      ...row,
      id: `wo-${index}-li-${i + 1}`,
    })),
    maintenanceRequestStatus: 'Approved for Service',
    vehicleReadyStatus: 'Proceed to workshop',
    lastServiceDate: '12 Mar 2025',
  }
  return { ...base, ...overrides }
}

export const WORK_ORDER_MOCK_ROWS: WorkOrderDetail[] = Array.from(
  { length: 18 },
  (_, i) => buildWorkOrder(i + 1),
)

export const SERVICE_RECORD_MOCK_ROWS: ServiceRecordListItem[] =
  WORK_ORDER_MOCK_ROWS.map((row) => ({
    id: row.id,
    workOrderId: row.workOrderId,
    vehiclePlate: row.vehiclePlate,
    maintenanceType: row.maintenanceType,
    status:
      row.status === 'Pending'
        ? 'Pending Approval'
        : row.status === 'Approved'
          ? 'Approved'
          : row.status,
  }))

export function getWorkOrderById(id: string): WorkOrderDetail | undefined {
  const key = id.trim().toLowerCase()
  return WORK_ORDER_MOCK_ROWS.find(
    (row) =>
      row.id.toLowerCase() === key ||
      row.workOrderId.toLowerCase() === key,
  )
}

export function getServiceRecordById(id: string): WorkOrderDetail | undefined {
  return getWorkOrderById(id)
}

export function filterWorkOrders(
  rows: WorkOrderListItem[],
  search: string,
): WorkOrderListItem[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (row) =>
      row.workOrderId.toLowerCase().includes(q) ||
      row.vehiclePlate.toLowerCase().includes(q) ||
      (row.assetCode?.toLowerCase().includes(q) ?? false) ||
      row.maintenanceType.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q),
  )
}

export function filterServiceRecords(
  rows: ServiceRecordListItem[],
  search: string,
): ServiceRecordListItem[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (row) =>
      row.workOrderId.toLowerCase().includes(q) ||
      row.vehiclePlate.toLowerCase().includes(q) ||
      row.maintenanceType.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q),
  )
}

export function sumLineItems(items: MaintenanceLineItem[]): number {
  return items.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
}

export const MAINTENANCE_TYPE_OPTIONS: MaintenanceType[] = ['Minor', 'Major']

export const PROBLEM_CATEGORY_OPTIONS = [
  'Routine Servicing',
  'Change oil filter',
  'Brake inspection',
  'Tyre replacement',
  'Engine diagnostics',
  'Electrical fault',
] as const
