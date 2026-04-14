import type { MenuItem, Permission } from '@/shared/constants/access-control'

function canAccess(required: Permission[] | undefined, permissions: Permission[]) {
  if (!required || required.length === 0) return true
  return required.some((permission) => permissions.includes(permission))
}

export function getVisibleMenuItems(items: MenuItem[], permissions: Permission[]): MenuItem[] {
  return items
    .filter((item) => canAccess(item.permissions, permissions))
    .map((item) => {
      if (!item.children) return item

      const visibleChildren = item.children.filter((child) => canAccess(child.permissions, permissions))
      return { ...item, children: visibleChildren }
    })
    .filter((item) => !item.children || item.children.length > 0)
}
