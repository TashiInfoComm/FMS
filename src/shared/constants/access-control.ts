// Defines roles, permissions, and menu metadata for access control.
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldUser,
  UserCog,
  CarFront,
  Settings
} from "lucide-react";

export type Role = "Super Admin" | "Agency Admin";

export type Permission =
  | "dashboard:view"
  | "agency:view"
  | "assign-vehicle:view"
  | "destination:view"
  | "dzongkhag:view"
  | "fuel-type:view"
  | "insurance-provider:view"
  | "maintenance-type:view"
  | "purpose-of-journey:view"
  | "vehicle:view"
  | "status:view"
  | "vehicle-type-category:view"
  | "trip-type:view"
  | "user-role:view"
  | "permission:view"
  | "role-permission:view"
  | "create-user:view";

export type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  permissions?: Permission[];
  children?: Array<{
    id: string;
    label: string;
    href: string;
    permissions?: Permission[];
  }>;
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  "Super Admin": [
    "dashboard:view",
    "agency:view",
    "assign-vehicle:view",
    "destination:view",
    "dzongkhag:view",
    "fuel-type:view",
    "insurance-provider:view",
    "maintenance-type:view",
    "purpose-of-journey:view",
    "vehicle:view",
    "status:view",
    "vehicle-type-category:view",
    "trip-type:view",
    "user-role:view",
    "permission:view",
    "role-permission:view",
    "create-user:view",
  ],
  /** Coarse nav: operational access without global Permission / Role Permission admin screens. */
  "Agency Admin": [
    "dashboard:view",
    "agency:view",
    "assign-vehicle:view",
    "destination:view",
    "dzongkhag:view",
    "fuel-type:view",
    "insurance-provider:view",
    "maintenance-type:view",
    "purpose-of-journey:view",
    "vehicle:view",
    "status:view",
    "vehicle-type-category:view",
    "trip-type:view",
    "user-role:view",
    "create-user:view",
  ],
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    permissions: ["dashboard:view"],
  },
  {
    id: "system-settings",
    label: "System Settings",
    icon: Settings,
    permissions: ["user-role:view"],
    children: [
      {
        id: "menus",
        label: "Modules",
        href: "/admin/modules",
        permissions: ["user-role:view"],
      },
      {
        id: "user-role",
        label: " Roles",
        href: "/admin/roles",
        permissions: ["user-role:view"],
      },
      {
        id: "permission",
        label: "Permission",
        href: "/admin/permissions",
        permissions: ["permission:view"],
      },
      {
        id: "role-permission",
        label: "Role Permission",
        href: "/admin/role-permission",
        permissions: ["role-permission:view"],
      },
    ],
  },
  {
    id: "user-management",
    label: "User Management",
    icon: UserCog,
    permissions: ["user-role:view"],
    children: [
      
      {
        id: "users",
        label: "Users",
        href: "/users",
        permissions: ["create-user:view"],
      },
    ],
  },
  {
    id: "master-management",
    label: "Master Management",
    icon: Building2,
    permissions: ["agency:view"],
    children: [
      {
        id: "agency",
        label: "Agency & Department",
        href: "/master/agency",
        permissions: ["agency:view"],
      },
      {
        id: "vehicle-type",
        label: "Vehicle Type & Category",
        href: "/master/vehicle-type-category",
        permissions: ["vehicle-type-category:view"],
      },
      {
        id: "fuel-type",
        label: "Fuel Type",
        href: "/master/fuel-type",
        permissions: ["fuel-type:view"],
      },
      {
        id: "trip-type",
        label: "Trip Type",
        href: "/master/trip-type",
        permissions: ["trip-type:view"],
      },

      {
        id: "dzongkhag",
        label: "Dzongkhag & Gewog",
        href: "/master/dzongkhags",
        permissions: ["dzongkhag:view"],
      },
      {
        id: "destination",
        label: "Destination",
        href: "/master/destination",
        permissions: ["destination:view"],
      },
      {
        id: "status",
        label: "Status",
        href: "/master/status",
        permissions: ["status:view"],
      },

      {
        id: "insurance-provider",
        label: "Insurance Provider",
        href: "/master/insurance-provider",
        permissions: ["insurance-provider:view"],
      },

      {
        id: "purpose-journey",
        label: "Purpose of Journey",
        href: "/master/purpose-of-journey",
        permissions: ["purpose-of-journey:view"],
      },
      {
        id: "maintenance-type",
        label: "Maintenance Type",
        href: "/master/maintenance-type",
        permissions: ["maintenance-type:view"],
      },
    ],
  },
  {
    id: "vehicle-management",
    label: "Vehicle Management",
    icon: CarFront,
    permissions: ["agency:view"],
    children: [
      {
        id: "vehicle",
        label: "Vehicle",
        href: "/vehicle/list",
        permissions: ["vehicle:view"],
      },
      {
        id: "assign-vehicle",
        label: "Assign Vehicle",
        href: "/assign-vehicle",
        permissions: ["assign-vehicle:view"],
      },
    ],
  },

  {
    id: "logout",
    label: "Logout",
    icon: LogOut,
    // Route-based logout entry; session cleanup is handled elsewhere in app flow.
    href: "/login/ndi",
  },
];

export const DEFAULT_ROLE: Role = "Agency Admin";
export const ROLE_ICON = ShieldUser;
