// Declares public and protected routes for the application.
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { MainLayout } from '@/app/layout/MainLayout'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { NdiLoginPage } from '@/features/auth/components/NdiLoginPage'
import { NdiRegistrationPage } from '@/features/auth/components/NdiRegistrationPage'
import { SignupPage } from '@/features/auth/components/SignupPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { AgencyPage } from '@/features/master/pages/AgencyPage'
import { DepartmentListPage } from '@/features/master/pages/DepartmentListPage'
import { DivisionListPage } from '@/features/master/pages/DivisionListPage'
import { SubDivisionListPage } from '@/features/master/pages/SubDivisionListPage'
import { DestinationPage } from '@/features/master/pages/DestinationPage'
import { DzongkhagListPage } from '@/features/master/pages/DzongkhagListPage'
import { FuelTypePage } from '@/features/master/pages/FuelTypePage'
import { GewogListPage } from '@/features/master/pages/GewogListPage'
import { InsuranceProviderPage } from '@/features/master/pages/InsuranceProviderPage'
import { MaintenanceProblemCategory } from '@/features/master/pages/MaintenanceProblemCategory'
import { MaintenanceTypePage } from '@/features/master/pages/MaintenanceTypePage'
import { PurposeOfJourneyPage } from '@/features/master/pages/PurposeOfJourneyPage'
import { TripTypePage } from '@/features/master/pages/TripTypePage'
import { ModuleFormPage } from '@/features/modules/pages/ModuleFormPage'
import { ModuleListPage } from '@/features/modules/pages/ModuleListPage'
import { CreateUserFormPage } from '@/features/user/components/CreateUserFormPage'
import { CreateUserListPage } from '@/features/user/components/CreateUserListPage'
import { EditUserFormPage } from '@/features/user/components/EditUserFormPage'
import { UserDetailPage } from '@/features/user/components/UserDetailPage'
import { PermissionManagement } from '@/features/user/components/PermissionManagement'
import { RolePermissionManagement } from '@/features/user/components/RolePermissionManagement'
import { UserRoleManagement } from '@/features/user/components/UserRoleManagement'
import { RoleFormPage } from '@/features/user/components/RoleFormPage'
import { VehicleStatusPage } from '@/features/master/pages/VehicleStatusPage'
import { VehicleCategoryDetailPage } from '@/features/master/pages/VehicleCategoryDetailPage'
import { VehicleTypeCategoryPage } from '@/features/master/pages/VehicleTypeCategoryPage'
import { AssignVehicleCreatePage } from '@/features/vehicles/pages/AssignVehicleCreatePage'
import { AssignVehicleDetailPage } from '@/features/vehicles/pages/AssignVehicleDetailPage'
import { AssignVehicleEditPage } from '@/features/vehicles/pages/AssignVehicleEditPage'
import { AssignVehiclePage } from '@/features/vehicles/pages/AssignVehiclePage'
import { VehicleFormPage } from '@/features/vehicles/pages/VehicleCreatePage'
import { VehicleDetailPage } from '@/features/vehicles/pages/VehicleDetailPage'
import { VehicleAgencyMapping } from '@/features/vehicles/pages/VehicleAgencyMapping'
import { VehicleManagementPage } from '@/features/vehicles/pages/VehicleManagementPage'
import TripRequisition from '@/features/trips/pages/TripRequisition'
import TripRequisitionDetailPage from '@/features/trips/pages/TripRequisitionDetailPage'
import TripRequest from '@/features/trips/pages/TripRequest'
import TripRequestDetailPage from '@/features/trips/pages/TripRequestDetailPage'
import MyAssignments from '@/features/trips/pages/MyAssignments'
import UpdateTripStatus from '@/features/trips/pages/UpdateTripStatus'
import DriverFeedback from '@/features/trips/pages/DriverFeedback'
import RateDriverPage from '@/features/trips/pages/RateDriverPage'
import CreateTripRequisition from '@/features/trips/pages/CreateTripRequisition'
import WorkOrders from '@/features/maintenance/pages/WorkOrders'
import WorkOrderDetail from '@/features/maintenance/pages/WorkOrderDetail'
import CreateWorkOrder from '@/features/maintenance/pages/CreateWorkOrder'
import ServiceRecord from '@/features/maintenance/pages/ServiceRecord'
import QuotaConfiguration from '@/features/fuel/pages/QuotaConfiguration'
import QuotaRequestList from '@/features/fuel/pages/QuotaRequestList'
import QuotaRequestDetailPage from '@/features/fuel/pages/QuotaRequestDetailPage'
import UpdateQuota from '@/features/fuel/pages/UpdateQuota'
import FuelLog from '@/features/fuel/pages/FuelLog'
import CreateFuelLog from '@/features/fuel/pages/CreateFuelLog'
import FuelReports from '@/features/reports/pages/fuel/FuelReports'
import EmergencyReports from '@/features/reports/pages/emergency/EmergencyReports'
import VehicleLoanReports from '@/features/reports/pages/vehicleLoan/VehicleLoanReports'
import VehicleReports from '@/features/reports/pages/vehicle/VehicleReports'
import ParkingReports from '@/features/reports/pages/parking/ParkingReports'
import MaintenanceReports from '@/features/reports/pages/maintenance/Maintenancereports'
import TripReports from '@/features/reports/pages/trips/TripReports'
import ParkingLogs from '@/features/parking/pages/ParkingLogs'
import ReimbursementClaims from '@/features/parking/pages/ReimbursementClaims'
import ReimbursementClaimDetailPage from '@/features/parking/pages/ReimbursementClaimDetailPage'
import LoanRequisition from '@/features/inter-agency-vehicle-loan/pages/LoanRequisition'
import LoanLendingRequisition from '@/features/inter-agency-vehicle-loan/pages/LoanLendingRequisition'
import LoanRequisitionApprovalList from '@/features/inter-agency-vehicle-loan/pages/LoanRequisitionApprovalList'
import CreateNewRequisition from '@/features/inter-agency-vehicle-loan/pages/CreateNewRequisition'
import LoanRequisitionDetail from '@/features/inter-agency-vehicle-loan/pages/LoanRequisitionDetail'
import DispatchVehicle from '@/features/inter-agency-vehicle-loan/pages/DispatchVehicle'
import ReturnVehicle from '@/features/inter-agency-vehicle-loan/pages/ReturnVehicle'
import CheckListItem from '@/features/master/pages/CheckListItem'
import { VehicleDesignatedTypePage } from '@/features/master/pages/VehicleDesignatedTypePage'
import DesignatedVehicle from '@/features/designated-vehicle/pages/DesignatedVehicle'
import DriverOffence from '@/features/driver-offence/pages/DriverOffence'
import CreateEmergencyBroadcast from '@/features/emergency-vehicle/pages/CreateEmergencyBroadcast'
import EmergencyBroadcast from '@/features/emergency-vehicle/pages/EmergencyBroadcast'
import EmergencyBroadcastDetail from '@/features/emergency-vehicle/pages/EmergencyBroadcastDetail'
import EmergencyDispatchedList from '@/features/emergency-vehicle/pages/EmergencyDispatchedList'
import EmergencyRequest from '@/features/emergency-vehicle/pages/EmergencyRequest'
import VehicleDeployment from '@/features/emergency-vehicle/pages/VehicleDeployment'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth and registration */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login/ndi" element={<NdiLoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<NdiRegistrationPage />} />
        <Route path="/signup/manual" element={<SignupPage />} />

        {/* Authenticated shell: sidebar + outlet (see MainLayout) */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/master/agency" element={<AgencyPage />} />
          <Route
            path="/master/agency/:agencyCode/departments"
            element={<DepartmentListPage />}
          />
          <Route
            path="/master/departments/:departmentCode/divisions"
            element={<DivisionListPage />}
          />
          <Route
            path="/master/divisions/:divisionCode/sub-divisions"
            element={<SubDivisionListPage />}
          />
          {/* Master data routes */}
          <Route path="/master/destination" element={<DestinationPage />} />
          <Route path="/master/dzongkhags" element={<DzongkhagListPage />} />
          <Route
            path="/master/dzongkhag-gewog/:dzongkhagId/gewogs"
            element={<GewogListPage />}
          />
          <Route path="/master/fuel-type" element={<FuelTypePage />} />
          <Route
            path="/master/insurance-provider"
            element={<InsuranceProviderPage />}
          />
          <Route
            path="/master/maintenance-type"
            element={<MaintenanceTypePage />}
          />
          <Route
            path="/master/maintenance-type/:maintenanceTypeCode/problem-categories"
            element={<MaintenanceProblemCategory />}
          />
          <Route
            path="/master/purpose-of-journey"
            element={<PurposeOfJourneyPage />}
          />
          <Route path="/master/status" element={<VehicleStatusPage />} />
          <Route
            path="/master/vehicle-type-category"
            element={<VehicleTypeCategoryPage />}
          />
          <Route
            path="/master/vehicle-type-category/:categoryCode"
            element={<VehicleCategoryDetailPage />}
          />
          <Route path="/master/trip-type" element={<TripTypePage />} />
          <Route path="/master/checklist-items" element={<CheckListItem />} />
          <Route
            path="/master/designated-type"
            element={<VehicleDesignatedTypePage />}
          />
          {/* Vehicle routes */}
          <Route path="/vehicle/list" element={<VehicleManagementPage />} />
          <Route path="/vehicle/list/:vehicleId/edit" element={<VehicleFormPage />} />
          <Route
            path="/vehicle/list/:vehicleId/agency-assignments"
            element={<VehicleAgencyMapping />}
          />
          <Route
            path="/vehicle/list/:vehicleId/assign-driver"
            element={<AssignVehicleCreatePage />}
          />
          <Route
            path="/vehicle/list/:vehicleId/drivers"
            element={<AssignVehiclePage />}
          />
          <Route path="/vehicle/list/:vehicleId" element={<VehicleDetailPage />} />
          <Route path="/vehicle/add" element={<VehicleFormPage />} />
          <Route
            path="/assign-driver/add"
            element={<AssignVehicleCreatePage />}
          />
          <Route
            path="/assign-driver/:assignmentId/edit"
            element={<AssignVehicleEditPage />}
          />
          <Route
            path="/assign-driver/:assignmentId"
            element={<AssignVehicleDetailPage />}
          />
          {/* Designated vehicle routes */}
          <Route path="/vehicle/designated-officials" element={<DesignatedVehicle />} />
          {/* Admin settings routes */}
          <Route path="/admin/modules" element={<ModuleListPage />} />
          <Route path="/admin/modules/add" element={<ModuleFormPage />} />
          <Route path="/admin/modules/:id/edit" element={<ModuleFormPage />} />
          <Route path="/admin/roles/add" element={<Navigate to="/admin/roles" replace />} />
          <Route path="/admin/roles/:roleName/edit" element={<RoleFormPage />} />
          <Route path="/admin/roles" element={<UserRoleManagement />} />
          <Route path="/admin/permissions" element={<PermissionManagement />} />
          <Route
            path="/admin/role-permission"
            element={<RolePermissionManagement />}
          />
          {/* User routes */}
          <Route path="/users" element={<CreateUserListPage />} />
          <Route path="/users/add" element={<CreateUserFormPage />} />
          <Route path="/users/:userId/edit" element={<EditUserFormPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          {/* Trip routes */}
          <Route path="/trip/requisition" element={<TripRequisition />} />
          <Route path="/trip/requisition/:tripId" element={<TripRequisitionDetailPage />} />
          <Route path="/trip/request" element={<TripRequest />} />
          <Route path="/trip/request/create" element={<CreateTripRequisition />} />
          <Route path="/trip/request/:requestId" element={<TripRequestDetailPage />} />
          <Route path="/trip/my-assignments" element={<MyAssignments />} />
          <Route path="/trip/my-assignments/:tripId" element={<UpdateTripStatus />} />
          <Route path="/trip/driver-feedback" element={<DriverFeedback />} />
          <Route
            path="/trip/driver-feedback/:tripId/rate"
            element={<RateDriverPage />}
          />
          {/* Fuel routes */}
          <Route path="/fuel/quota-configuration" element={<QuotaConfiguration />} />
          <Route path="/fuel/quota-request-list" element={<QuotaRequestList />} />
          <Route
            path="/fuel/quota-request-list/:requestId/replenish"
            element={<QuotaRequestDetailPage />}
          />
          <Route
            path="/fuel/quota-request-list/:requestId"
            element={<QuotaRequestDetailPage />}
          />
          <Route path="/fuel/update-quota" element={<UpdateQuota />} />
          <Route path="/fuel/logs" element={<FuelLog />} />
          <Route path="/fuel/logs/:logId" element={<CreateFuelLog />} />
          <Route path="/fuel/create-fuel-log" element={<CreateFuelLog />} />
          {/* Maintenance routes */}
          <Route path="/maintenance/work-orders" element={<WorkOrders />} />
          <Route path="/maintenance/work-orders/create" element={<CreateWorkOrder />} />
          <Route path="/maintenance/work-orders/:workOrderId" element={<WorkOrderDetail />} />
          <Route path="/maintenance/records" element={<ServiceRecord />} />

          {/* Parking routes */}
          <Route path="/parking/expense-log" element={<ParkingLogs />} />
          <Route path="/parking/reimbursement-claims" element={<ReimbursementClaims />} />
          <Route
            path="/parking/reimbursement-claims/:claimId"
            element={<ReimbursementClaimDetailPage />}
          />
          {/* Inter-agency vehicle loan routes */}
          <Route path="/vehicle-loan/requisition" element={<LoanRequisition />} />
          <Route path="/vehicle-loan/lending" element={<LoanLendingRequisition />} />
          <Route path="/vehicle-loan/approval" element={<LoanRequisitionApprovalList />} />
          <Route path="/vehicle-loan/requisition/create" element={<CreateNewRequisition />} />
          <Route path="/vehicle-loan/requisition/:loanId/edit" element={<CreateNewRequisition />} />
          <Route path="/vehicle-loan/:loanId/dispatch" element={<DispatchVehicle />} />
          <Route path="/vehicle-loan/:loanId/return" element={<ReturnVehicle />} />
          <Route path="/vehicle-loan/:loanId" element={<LoanRequisitionDetail />} />
          {/* Driver offence routes */}
          <Route path="/offences" element={<DriverOffence />} />
          {/* Emergency dispatch routes */}
          <Route path="/emergency/broadcast" element={<EmergencyBroadcast />} />
          <Route
            path="/emergency/broadcast/create"
            element={<CreateEmergencyBroadcast />}
          />
          <Route
            path="/emergency/broadcast/:incidentId"
            element={<EmergencyBroadcastDetail />}
          />
          <Route path="/emergency/request" element={<EmergencyRequest />} />
          <Route
            path="/emergency/request/:incidentId/deploy"
            element={<VehicleDeployment />}
          />
          <Route path="/emergency/dispatched" element={<EmergencyDispatchedList />} />
          {/* Reports routes */}
          <Route path="/reports/fuel" element={<FuelReports />} />
          <Route path="/reports/emergency" element={<EmergencyReports />} />
          <Route path="/reports/vehicle-loan" element={<VehicleLoanReports />} />
          <Route path="/reports/vehicle" element={<VehicleReports />} />
          <Route path="/reports/parking" element={<ParkingReports />} />
          <Route path="/reports/maintenance" element={<MaintenanceReports />} />
          <Route path="/reports/trips" element={<TripReports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
