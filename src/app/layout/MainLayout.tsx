// Defines the main application layout, navigation, and user menu.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, LogOut, Menu, User, X } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/services/user-store'
import layoutLogoImage from '@/assets/layout_logo.png'
import { MenuLucideIcon } from '@/features/modules/components/MenuLucideIcon'
import { fetchUserSidebarMenus, normalizeFrontendRoute } from '@/features/modules/lib/menus-api'
import { DEFAULT_ROLE, ROLE_ICON, type Role } from '@/shared/constants/access-control'
import { Loader } from '@/shared/components/Loader'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import {
  canReadSubMenuRow,
  canShowDirectRouteMenu,
  shouldApplySubMenuPermissionFilter,
  useRolePermissionsDetail,
} from '@/shared/hooks/useRolePermissionsDetail'
import { notifyRolePreferenceChanged } from '@/shared/lib/realm-role-mapping'
import { showSuccessToast } from '@/shared/lib/toast'

function hasMenuRoute(route: string | undefined) {
  return (route?.trim() ?? '') !== ''
}

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const authenticated = useUserStore((state) => state.authenticated)
  const { role, roles: profileRoles, setRole, permissions } = useAccessControl()
  const rolePermDetail = useRolePermissionsDetail()
  const currentProfile = useUserStore((state) => state.user)
  const clearSession = useUserStore((state) => state.clearSession)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const RoleIcon = ROLE_ICON

  const menuQuery = useQuery({
    queryKey: ['me-menu'],
    queryFn: fetchUserSidebarMenus,
    staleTime: 60_000,
  })

  const sidebarPermWaiting =
    authenticated &&
    Boolean(rolePermDetail.apiRoleName) &&
    rolePermDetail.isLoading &&
    !rolePermDetail.isError

  const navMenus = useMemo(() => {
    const raw = menuQuery.data
    const rows = Array.isArray(raw) ? raw : []
    const routeReady = rows.filter((menu) => {
      if (menu.direct_route && hasMenuRoute(menu.direct_route)) return true
      return (menu.sub_menus ?? []).some((s) => hasMenuRoute(s.route))
    })

    const permMap = rolePermDetail.permissionsBySubMenu
    const filterActive =
      authenticated &&
      Boolean(rolePermDetail.apiRoleName) &&
      rolePermDetail.isSuccess &&
      shouldApplySubMenuPermissionFilter(rolePermDetail.data)

    const visible: typeof routeReady = []
    for (const menu of routeReady) {
      if (menu.direct_route && hasMenuRoute(menu.direct_route)) {
        if (!canShowDirectRouteMenu(permMap, menu.id, filterActive)) continue
        visible.push(menu)
        continue
      }
      const subs = (menu.sub_menus ?? []).filter(
        (s) =>
          hasMenuRoute(s.route) && canReadSubMenuRow(permMap, s.id, filterActive),
      )
      if (subs.length === 0) continue
      visible.push({ ...menu, sub_menus: subs })
    }
    return visible
  }, [
    menuQuery.data,
    authenticated,
    rolePermDetail.apiRoleName,
    rolePermDetail.isSuccess,
    rolePermDetail.data,
    rolePermDetail.permissionsBySubMenu,
  ])

  useEffect(() => {
    const path = location.pathname
    for (const menu of navMenus) {
      if (menu.direct_route && normalizeFrontendRoute(menu.direct_route) === path) {
        break
      }
      const subs = menu.sub_menus ?? []
      if (!subs.some((s) => normalizeFrontendRoute(s.route) === path)) continue
      setExpandedSection((prev) => (prev === menu.id ? prev : menu.id))
      break
    }
  }, [location.pathname, navMenus])

  useEffect(() => {
    if (!isProfileMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const el = profileMenuRef.current
      if (el && !el.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isProfileMenuOpen])

  const currentProfileName = useMemo(() => {
    if (!currentProfile || typeof currentProfile !== 'object') return 'User'
    const name = (currentProfile as { name?: unknown }).name
    return typeof name === 'string' && name.trim() ? name.trim() : 'User'
  }, [currentProfile])

  const profileInitials = currentProfileName.slice(0, 2).toUpperCase()

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id))
  }

  const logout = () => {
    clearSession()
    localStorage.removeItem('fms-role')
    localStorage.removeItem('fms-permissions')
    notifyRolePreferenceChanged()
    showSuccessToast('You have been logged out successfully')
    navigate('/login/ndi')
  }

  const renderNavigation = () => {
    if (menuQuery.isLoading) {
      return <Loader />
    }
    if (sidebarPermWaiting) {
      return <Loader />
    }
    if (menuQuery.isError) {
      return (
        <p className="px-2 text-sm text-[var(--fms-delete)]">
          Could not load navigation.
        </p>
      )
    }

    const navLinkClass =
      'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm font-medium text-[var(--fms-text-header)] hover:bg-[var(--fms-background)]'
    const navLinkActiveClass = 'bg-[var(--fms-info-fill)] text-[var(--fms-text-header)]'

    return (
      <nav className="space-y-2">
        {permissions.includes('dashboard:view') ? (
          <Link
            to="/dashboard"
            onClick={() => setIsSidebarOpen(false)}
            className={cn(navLinkClass, location.pathname === '/dashboard' && navLinkActiveClass)}
          >
            <MenuLucideIcon iconName="LayoutDashboard" className="h-5 w-5 shrink-0 text-[var(--fms-text-subheading)]" aria-hidden />
            Dashboard
          </Link>
        ) : null}

        {navMenus.map((item) => {
          if (item.direct_route) {
            const href = normalizeFrontendRoute(item.direct_route)
            return (
              <Link
                key={item.id}
                to={href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(navLinkClass, location.pathname === href && navLinkActiveClass)}
              >
                <MenuLucideIcon iconName={item.icon} className="h-5 w-5 shrink-0" style={{ color: item.icon_color }} aria-hidden />
                {item.name}
              </Link>
            )
          }

          const subLinks = (item.sub_menus ?? [])
            .filter((s) => hasMenuRoute(s.route))
            .map((child) => ({
              ...child,
              href: normalizeFrontendRoute(child.route),
            }))

          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(item.id)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-[var(--fms-text-header)] hover:bg-[var(--fms-background)]"
              >
                <span className="inline-flex items-center gap-3">
                  <MenuLucideIcon iconName={item.icon} className="h-5 w-5 shrink-0" style={{ color: item.icon_color }} aria-hidden />
                  {item.name}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-[var(--fms-text-subheading)] transition-transform',
                    expandedSection === item.id && 'rotate-180',
                  )}
                />
              </button>
              {expandedSection === item.id ? (
                <div className="ml-6 space-y-1">
                  {subLinks.map((child) => (
                    <Link
                      key={child.id ?? `${child.href}-${child.name}`}
                      to={child.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        'block cursor-pointer rounded-md px-2 py-1.5 text-sm text-[var(--fms-text-subheading)] hover:bg-[var(--fms-background)]',
                        location.pathname === child.href && navLinkActiveClass,
                      )}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => {
            setIsSidebarOpen(false)
            setIsLogoutDialogOpen(true)
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-[var(--fms-text-header)] hover:bg-[var(--fms-background)]"
        >
          <MenuLucideIcon iconName="LogOut" className="h-5 w-5 shrink-0 text-[var(--fms-delete)]" aria-hidden />
          Logout
        </button>
      </nav>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#f4f4f5]">
      <header className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--fms-strokes)] py-3 px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-[var(--fms-strokes)] p-2 lg:hidden"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
          <img
            src={layoutLogoImage}
            alt="MoF Logo"
            className="h-auto w-45 object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-3">
          {profileRoles.length > 1 ? (
            <label className="rounded-md border border-[var(--fms-strokes)] px-2 py-1 text-[var(--fms-text-subheading)]">
              Role:
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="ml-1 bg-transparent text-[var(--fms-text-header)] outline-none"
              >
                {profileRoles.map((roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleOption}
                  </option>
                ))}
              </select>
            </label>
          ) : profileRoles.length === 1 ? (
            <span className="rounded-md border border-[var(--fms-strokes)] px-2 py-1 text-[var(--fms-text-subheading)]">
              Role: <span className="text-[var(--fms-text-header)]">{profileRoles[0]}</span>
            </span>
          ) : (
            <span className="rounded-md border border-[var(--fms-strokes)] px-2 py-1 text-[var(--fms-text-subheading)]">
              Role: <span className="text-[var(--fms-text-header)]">{DEFAULT_ROLE}</span>
            </span>
          )}
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              className="flex cursor-pointer items-center gap-2 rounded-md py-1 pl-1 pr-1.5 outline-none hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[var(--fms-button)]"
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="menu"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--fms-button)] text-xs font-semibold text-white">
                {profileInitials}
              </span>
              <span className="hidden text-[var(--fms-text-header)] sm:inline">
                {currentProfileName}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-[var(--fms-text-subheading)] transition-transform',
                  isProfileMenuOpen && 'rotate-180',
                )}
              />
            </button>
            {isProfileMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] rounded-md border border-[var(--fms-strokes)] bg-white py-1 shadow-md"
              >
                <Link
                  to="/profile"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--fms-text-header)] hover:bg-[var(--fms-background)]"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <User className="h-4 w-4 shrink-0 text-[var(--fms-text-subheading)]" aria-hidden />
                  Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-[var(--fms-text-header)] hover:bg-[var(--fms-background)]"
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setIsLogoutDialogOpen(true)
                  }}
                >
                  <LogOut className="h-4 w-4 shrink-0 text-[var(--fms-delete)]" aria-hidden />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside
          className={cn(
            'border-r border-[var(--fms-strokes)] bg-white p-4 lg:block',
            isSidebarOpen ? 'block' : 'hidden',
          )}
        >
          {renderNavigation()}
        </aside>

        <main className="min-w-0 bg-[#f8f8f9] py-3 px-5 sm:py-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-[var(--fms-info-fill)] px-2 py-1 text-xs text-[var(--fms-text-header)]">
            <RoleIcon className="h-3.5 w-3.5" />
            {role || DEFAULT_ROLE} Permissions Applied
          </div>
          <Outlet />
        </main>
      </div>

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout from this session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-2 pt-2">
            <Button variant="outline" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsLogoutDialogOpen(false)
                logout()
              }}
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
