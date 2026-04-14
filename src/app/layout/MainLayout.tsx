import { useMemo, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import layoutLogoImage from '@/assets/layout_logo.png'
import { DEFAULT_ROLE, MENU_ITEMS, ROLE_ICON, type Role } from '@/shared/constants/access-control'
import { useAccessControl } from '@/shared/hooks/useAccessControl'
import { getVisibleMenuItems } from '@/shared/utils/navigation'

export function MainLayout() {
  const location = useLocation()
  const { role, permissions, setRole } = useAccessControl()
  const visibleMenuItems = useMemo(() => getVisibleMenuItems(MENU_ITEMS, permissions), [permissions])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const RoleIcon = ROLE_ICON

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id))
  }

  const renderNavigation = () => (
    <nav className="space-y-2">
      {visibleMenuItems.map((item) => {
        const Icon = item.icon
        const isActive = item.href ? location.pathname === item.href : false

        if (item.children && item.children.length > 0) {
          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(item.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-[var(--fms-text-header)]"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-[var(--fms-text-subheading)] transition-transform',
                    expandedSection === item.id && 'rotate-180',
                  )}
                />
              </button>
              {expandedSection === item.id ? (
                <div className="ml-6 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.id}
                      to={child.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={cn(
                        'block rounded-md px-2 py-1.5 text-sm text-[var(--fms-text-subheading)]',
                        location.pathname === child.href && 'bg-[var(--fms-info-fill)] text-[var(--fms-text-header)]',
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )
        }

        return (
          <Link
            key={item.id}
            to={item.href ?? '#'}
            onClick={() => setIsSidebarOpen(false)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-[var(--fms-text-header)]',
              isActive && 'bg-[var(--fms-info-fill)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

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
          <label className="rounded-md border border-[var(--fms-strokes)] px-2 py-1 text-[var(--fms-text-subheading)]">
            Role:
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="ml-1 bg-transparent text-[var(--fms-text-header)] outline-none"
            >
              {(["Admin", "Manager", "Operator"] as Role[]).map(
                (roleOption) => (
                  <option key={roleOption} value={roleOption}>
                    {roleOption}
                  </option>
                ),
              )}
            </select>
          </label>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--fms-button)] text-xs font-semibold text-white">
            TD
          </span>
          <span className="hidden text-[var(--fms-text-header)] sm:inline">
            Tshering Dorji
          </span>
          <ChevronDown className="h-4 w-4 text-[var(--fms-text-subheading)]" />
        </div>
      </header>

      <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[240px_1fr]">
        <aside
          className={cn(
            "border-r border-[var(--fms-strokes)] bg-white p-4 lg:block",
            isSidebarOpen ? "block" : "hidden",
          )}
        >
          {renderNavigation()}
        </aside>

        <main className="bg-[#f8f8f9] py-3 px-5 sm:py-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-[var(--fms-info-fill)] px-2 py-1 text-xs text-[var(--fms-text-header)]">
            <RoleIcon className="h-3.5 w-3.5" />
            {role || DEFAULT_ROLE} Permissions Applied
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
