/**
 * Human-readable realm role label for UI: strips a leading `fms-`, replaces
 * hyphens with spaces, and sentence-cases (e.g. `fms-super-admin` → "Super admin").
 */
export function formatRealmRoleDisplayName(raw: string): string {
  const t = raw.trim()
  if (!t || t === '-') return t
  let s = t.toLowerCase()
  if (s.startsWith('fms-')) s = s.slice(4)
  s = s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return t
  return s.charAt(0).toUpperCase() + s.slice(1)
}
