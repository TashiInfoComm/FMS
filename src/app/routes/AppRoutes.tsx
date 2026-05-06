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
import { DestinationPage } from '@/features/master/pages/DestinationPage'
import { DzongkhagListPage } from '@/features/master/pages/DzongkhagListPage'
import { FuelTypePage } from '@/features/master/pages/FuelTypePage'
import { GewogListPage } from '@/features/master/pages/GewogListPage'
import { InsuranceProviderPage } from '@/features/master/pages/InsuranceProviderPage'
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
import { VehicleTypeCategoryPage } from '@/features/master/pages/VehicleTypeCategoryPage'
import { AssignVehicleCreatePage } from '@/features/vehicles/pages/AssignVehicleCreatePage'
import { AssignVehiclePage } from '@/features/vehicles/pages/AssignVehiclePage'
import { VehicleCreatePage } from '@/features/vehicles/pages/VehicleCreatePage'
import { VehicleManagementPage } from '@/features/vehicles/pages/VehicleManagementPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth and registration */}
        <Route path="/" element={<Navigate to="/login/ndi" replace />} />
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
            path="/assign-vehicle"
            element={<AssignVehiclePage />}
          />
          <Route
            path="/assign-vehicle/add"
            element={<AssignVehicleCreatePage />}
          />
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
            path="/master/purpose-of-journey"
            element={<PurposeOfJourneyPage />}
          />
          <Route path="/vehicle/list" element={<VehicleManagementPage />} />
          <Route path="/vehicle/add" element={<VehicleCreatePage />} />
          <Route path="/master/status" element={<VehicleStatusPage />} />
          <Route
            path="/master/vehicle-type-category"
            element={<VehicleTypeCategoryPage />}
          />
          <Route path="/master/trip-type" element={<TripTypePage />} />
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
          <Route path="/users" element={<CreateUserListPage />} />
          <Route path="/users/add" element={<CreateUserFormPage />} />
          <Route path="/users/:userId/edit" element={<EditUserFormPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
