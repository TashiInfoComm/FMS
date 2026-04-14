import type { LucideIcon } from "lucide-react";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldUser,
  UserCog,
} from "lucide-react";

export type Role = "Admin" | "Manager" | "Operator";

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
  Admin: [
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
  Manager: [
    "dashboard:view",
    "agency:view",
    "assign-vehicle:view",
    "vehicle:view",
    "status:view",
    "trip-type:view",
    "dzongkhag:view",
    "create-user:view",
  ],
  Operator: [
    "dashboard:view",
    "agency:view",
    "vehicle:view",
    "status:view",
    "dzongkhag:view",
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
        href: "/master/dzongkhag-gewog",
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
        id: "vehicle",
        label: "Vehicle",
        href: "/master/vehicle",
        permissions: ["vehicle:view"],
      },
      {
        id: "assign-vehicle",
        label: "Assign Vehicle",
        href: "/master/assign-vehicle",
        permissions: ["assign-vehicle:view"],
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
    id: "user-management",
    label: "User Management",
    icon: UserCog,
    permissions: ["user-role:view"],
    children: [
      {
        id: "user-role",
        label: "User Role",
        href: "/users/user-role",
        permissions: ["user-role:view"],
      },
      {
        id: "permission",
        label: "Permission",
        href: "/users/permission",
        permissions: ["permission:view"],
      },
      {
        id: "role-permission",
        label: "Role Permission",
        href: "/users/role-permission",
        permissions: ["role-permission:view"],
      },
      {
        id: "users",
        label: "Users",
        href: "/users",
        permissions: ["create-user:view"],
      },
    ],
  },
  {
    id: "logout",
    label: "Logout",
    icon: LogOut,
    href: "/login/ndi",
  },
];

export const DEFAULT_ROLE: Role = "Admin";
export const ROLE_ICON = ShieldUser;
