// Provides typed convenience wrappers around Sonner toast calls.
import { toast } from 'sonner'

import { getApiErrorMessage } from '@/shared/lib/api-error'

type ToastDescription = {
  description?: string
}

export function showSuccessToast(message: string, options?: ToastDescription) {
  toast.success(message, options)
}

/** Shows a string message or extracts API `detail` from a thrown error. */
export function showErrorToast(message: string, options?: ToastDescription): void
export function showErrorToast(error: unknown, fallback: string): void
export function showErrorToast(
  messageOrError: string | unknown,
  optionsOrFallback?: ToastDescription | string,
) {
  let message: string
  let options: ToastDescription | undefined

  if (typeof messageOrError === 'string') {
    message = messageOrError
    options =
      optionsOrFallback && typeof optionsOrFallback === 'object'
        ? optionsOrFallback
        : undefined
  } else {
    const fallback =
      typeof optionsOrFallback === 'string'
        ? optionsOrFallback
        : 'Something went wrong'
    message = getApiErrorMessage(messageOrError, fallback)
  }

  toast.error(message, options)
}

/** @deprecated Use `showErrorToast(error, fallback)` instead. */
export function showApiErrorToast(error: unknown, fallback = 'Something went wrong') {
  showErrorToast(error, fallback)
}
