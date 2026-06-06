// Defines realm roles, permission codes, and menu metadata for access control.
// Role slugs and effective permission codes are loaded from the backend; this file lists known FMS realm roles and static menu metadata only.
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldUser,
  UserCog,
  CarFront,
  Settings,
} from "lucide-react";

/** Realm roles returned by Keycloak / admin APIs for this app (see backend role list). */
export const FMS_REALM_ROLES = [
  "fms-super-admin",
  "fms-agency-admin",
  "fms-finance-officer",
  "fms-mto",
  "fms-driver",
  "fms-applicant",
  "fms-viewer",
] as const;

export type FmsRealmRole = (typeof FMS_REALM_ROLES)[number];

/** Active realm-role slug from JWT + header switcher (`fms-role`). */
export type Role = FmsRealmRole | (string & {});

/** Permission codes (e.g. `dashboard:view`) — resolved at runtime from menus + role matrix. */
export type Permission = string;

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

/** Priority for choosing a default role when the user has several `fms-*` roles (higher = preferred). */
export const REALM_ROLE_PRIORITY: Record<string, number> = {
  "fms-super-admin": 100,
  "fms-agency-admin": 90,
  "fms-finance-officer": 80,
  "fms-mto": 70,
  "fms-driver": 60,
  "fms-applicant": 50,
  "fms-viewer": 40,
};

/**
 * Reference menu tree (labels / routes). Live sidebar uses GET `/admin/me/menu` with CRUD from
 * GET `/admin/roles/{role}/permissions`. Optional `permissions` are illustrative; runtime checks use
 * {@link buildEffectivePermissionCodes}.
 */
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
        id: "assign-driver",
        label: "Assign Driver",
        href: "/assign-driver",
        permissions: ["assign-driver:view"],
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

/** Default realm role when none match (lowest privilege). */
export const DEFAULT_ROLE: Role = "fms-viewer";
export const ROLE_ICON = ShieldUser;
