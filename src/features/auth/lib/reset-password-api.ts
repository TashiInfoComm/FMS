import { apiPost } from '@/services/apiClient'

export type ResetPasswordPayload = {
  token: string
  new_password: string
}

export type ResetPasswordResponse = {
  message?: string
  [key: string]: unknown
}

export function resetPassword(payload: ResetPasswordPayload) {
  return apiPost<ResetPasswordResponse, ResetPasswordPayload>('/auth/reset-password', {
    token: payload.token.trim(),
    new_password: payload.new_password,
  })
}
