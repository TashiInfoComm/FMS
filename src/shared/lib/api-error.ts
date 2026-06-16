type ApiRecord = Record<string, unknown>

function pickString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function messageFromDetailValue(detail: unknown): string | null {
  const direct = pickString(detail)
  if (direct) return direct

  if (Array.isArray(detail)) {
    const parts: string[] = []
    for (const item of detail) {
      const itemText = pickString(item)
      if (itemText) {
        parts.push(itemText)
        continue
      }
      if (item && typeof item === 'object') {
        const record = item as ApiRecord
        const nested =
          pickString(record.msg) ??
          pickString(record.message) ??
          pickString(record.detail) ??
          pickString(record.error)
        if (nested) parts.push(nested)
      }
    }
    if (parts.length > 0) return parts.join('; ')
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const record = detail as ApiRecord
    return (
      pickString(record.msg) ??
      pickString(record.message) ??
      pickString(record.detail) ??
      pickString(record.error)
    )
  }

  return null
}

/** Reads `detail`, `message`, and `error` from common API error envelopes. */
export function extractApiErrorMessageFromPayload(
  payload: unknown,
  status?: number,
): string | null {
  if (typeof payload === 'string') {
    return pickString(payload)
  }

  if (!payload || typeof payload !== 'object') return null

  const root = payload as ApiRecord
  const sources: unknown[] = [root.detail, root.message, root.error]

  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as ApiRecord
    sources.push(nested.detail, nested.message, nested.error)
  }

  for (const source of sources) {
    const message = messageFromDetailValue(source) ?? pickString(source)
    if (message) return message
  }

  const listCandidates = [root.errors, root.non_field_errors]
  for (const candidate of listCandidates) {
    const message = messageFromDetailValue(candidate)
    if (message) return message
  }

  if (typeof status === 'number' && Number.isFinite(status)) {
    return `API Error: ${status}`
  }

  return null
}

/** Normalizes thrown errors (including apiClient) into a user-facing toast message. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (message && !/^API Error: \d{3}$/.test(message)) return message
  }

  if (error && typeof error === 'object') {
    const record = error as ApiRecord
    const fromPayload = extractApiErrorMessageFromPayload(record)
    if (fromPayload && !/^API Error: \d{3}$/.test(fromPayload)) return fromPayload
  }

  const direct = pickString(error)
  if (direct) return direct

  return fallback
}
