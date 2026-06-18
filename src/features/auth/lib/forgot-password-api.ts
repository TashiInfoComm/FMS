import { apiPost } from '@/services/apiClient'

export type ForgotPasswordPayload = {
  username: string
}

export type ForgotPasswordResponse = {
  message?: string
  [key: string]: unknown
}

export function requestForgotPassword(payload: ForgotPasswordPayload) {
  return apiPost<ForgotPasswordResponse, ForgotPasswordPayload>(
    '/auth/forgot-password',
    {
      username: payload.username.trim(),
    },
  )
}
