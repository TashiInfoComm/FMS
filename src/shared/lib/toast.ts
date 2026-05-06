// Provides typed convenience wrappers around Sonner toast calls.
import { toast } from 'sonner'

type ToastDescription = {
  description?: string
}

export function showSuccessToast(message: string, options?: ToastDescription) {
  toast.success(message, options)
}

export function showErrorToast(message: string, options?: ToastDescription) {
  toast.error(message, options)
}
