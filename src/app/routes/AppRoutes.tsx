import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { MainLayout } from '@/app/layout/MainLayout'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { NdiLoginPage } from '@/features/auth/components/NdiLoginPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { AgencyPage } from '@/features/master/pages/AgencyPage'
import { DestinationPage } from '@/features/master/pages/DestinationPage'
import { DzongkhagGewogPage } from '@/features/master/pages/DzongkhagGewogPage'
import { FuelTypePage } from '@/features/master/pages/FuelTypePage'
import { InsuranceProviderPage } from '@/features/master/pages/InsuranceProviderPage'
import { MaintenanceTypePage } from '@/features/master/pages/MaintenanceTypePage'
import { PurposeOfJourneyPage } from '@/features/master/pages/PurposeOfJourneyPage'
import { TripTypePage } from '@/features/master/pages/TripTypePage'
import { CreateUserFormPage } from '@/features/user/components/CreateUserFormPage'
import { CreateUserListPage } from '@/features/user/components/CreateUserListPage'
import { PermissionManagement } from '@/features/user/components/PermissionManagement'
import { RolePermissionManagement } from '@/features/user/components/RolePermissionManagement'
import { UserRoleManagement } from '@/features/user/components/UserRoleManagement'
import { VehicleStatusPage } from '@/features/master/pages/VehicleStatusPage'
import { VehicleTypeCategoryPage } from '@/features/master/pages/VehicleTypeCategoryPage'
import { AssignVehicleCreatePage } from '@/features/vehicles/pages/AssignVehicleCreatePage'
import { AssignVehiclePage } from '@/features/vehicles/pages/AssignVehiclePage'
import { VehicleCreatePage } from '@/features/vehicles/pages/VehicleCreatePage'
import { VehicleManagementPage } from '@/features/vehicles/pages/VehicleManagementPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login/ndi" replace />} />
        <Route path="/login/ndi" element={<NdiLoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/master/agency" element={<AgencyPage />} />
          <Route path="/master/assign-vehicle" element={<AssignVehiclePage />} />
          <Route path="/master/assign-vehicle/add" element={<AssignVehicleCreatePage />} />
          <Route path="/master/destination" element={<DestinationPage />} />
          <Route path="/master/dzongkhag-gewog" element={<DzongkhagGewogPage />} />
          <Route path="/master/fuel-type" element={<FuelTypePage />} />
          <Route path="/master/insurance-provider" element={<InsuranceProviderPage />} />
          <Route path="/master/maintenance-type" element={<MaintenanceTypePage />} />
          <Route path="/master/purpose-of-journey" element={<PurposeOfJourneyPage />} />
          <Route path="/master/vehicle" element={<VehicleManagementPage />} />
          <Route path="/master/vehicle/add" element={<VehicleCreatePage />} />
          <Route path="/master/status" element={<VehicleStatusPage />} />
          <Route path="/master/vehicle-type-category" element={<VehicleTypeCategoryPage />} />
          <Route path="/master/trip-type" element={<TripTypePage />} />
          <Route path="/users/user-role" element={<UserRoleManagement />} />
          <Route path="/users/permission" element={<PermissionManagement />} />
          <Route path="/users/role-permission" element={<RolePermissionManagement />} />
          <Route path="/users" element={<CreateUserListPage />} />
          <Route path="/users/add" element={<CreateUserFormPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
