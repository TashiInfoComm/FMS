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

/** Domain acronyms that stay uppercase in headings. */
const ROLE_ACRONYMS = new Set(['mto', 'ndi', 'vip', 'gps', 'hr', 'it'])

/**
 * Heading-style realm role label, title-cased word by word
 * (e.g. `fms-highest-admin` → "Highest Admin", `fms-mto` → "MTO").
 */
export function formatRealmRoleTitle(raw: string): string {
  const display = formatRealmRoleDisplayName(raw)
  if (!display || display === '-') return display

  return display
    .split(/\s+/)
    .map((word) =>
      ROLE_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}
