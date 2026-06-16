import { apiPost } from '@/services/apiClient'

export type ChangePasswordPayload = {
  current_password: string
  new_password: string
}

export type ChangePasswordResponse = {
  message?: string
  [key: string]: unknown
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiPost<ChangePasswordResponse, ChangePasswordPayload>(
    '/auth/change-password',
    payload,
  )
}
