import { z } from 'zod'

import type { CreateUserOrgIds, FetchedPerson } from '@/features/user/lib/users-api'
import type { OrgTierSelection } from '@/features/user/lib/groups-api'

export function directoryUserRegistrationSchema(isAdmin: boolean) {
  return z
    .object({
      username: z.string().trim().min(1, 'Username is required'),
      cid: z.string().trim().min(1, 'CID/Employee ID is required'),
      employeeId: z.string().trim(),
      firstName: z.string().trim().min(1, 'First name is required'),
      middleName: z.string().trim(),
      lastName: z.string().trim(),
      contact: z
        .string()
        .trim()
        .refine((s) => s.replace(/\D/g, '').length === 8, {
          message: 'Phone number must contain exactly 8 digits',
        }),
      email: z
        .string()
        .trim()
        .pipe(z.email({ error: 'Enter a valid email address' })),
      designation: z
        .string()
        .trim()
        .refine((s) => s !== '' && s !== '-', { message: 'Designation is required' }),
      agencyId: z.string().trim().min(1, 'Agency is required'),
      departmentId: z.string().trim(),
      divisionId: z.string().trim(),
      subDivisionId: z.string().trim(),
      roles: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
      if (isAdmin && data.roles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one role',
          path: ['roles'],
        })
      }
    })
}

export type DirectoryUserFormValues = z.infer<
  ReturnType<typeof directoryUserRegistrationSchema>
>

export type DirectoryUserFormFieldKey = keyof DirectoryUserFormValues

export const DIRECTORY_USER_FORM_FIELD_KEYS = [
  'username',
  'cid',
  'employeeId',
  'firstName',
  'middleName',
  'lastName',
  'contact',
  'email',
  'designation',
  'agencyId',
  'departmentId',
  'divisionId',
  'subDivisionId',
  'roles',
] as const satisfies readonly DirectoryUserFormFieldKey[]

export function buildDirectoryUserFormValues(
  profile: FetchedPerson,
  username: string,
  orgSelection: OrgTierSelection,
  roles: string[],
): DirectoryUserFormValues {
  const contactRaw = profile.contact === '-' ? '' : profile.contact
  const emailRaw = profile.email === '-' ? '' : profile.email
  const designationRaw = profile.designationFromDirectory
    ? profile.designation
    : profile.designation === '-'
      ? ''
      : profile.designation

  return {
    username: username.trim(),
    cid: profile.cid === '-' ? '' : profile.cid,
    employeeId: profile.employeeId === '-' ? '' : profile.employeeId,
    firstName: profile.firstName ?? '',
    middleName: profile.middleName ?? '',
    lastName: profile.lastName ?? '',
    contact: contactRaw,
    email: emailRaw,
    designation: designationRaw,
    agencyId: orgSelection.agencyId,
    departmentId: orgSelection.departmentId,
    divisionId: orgSelection.divisionId,
    subDivisionId: orgSelection.subDivisionId,
    roles,
  }
}

export function getDirectoryUserFormFieldErrors(
  values: DirectoryUserFormValues,
  isAdmin: boolean,
): Partial<Record<DirectoryUserFormFieldKey, string>> {
  const parsed = directoryUserRegistrationSchema(isAdmin).safeParse(values)
  if (parsed.success) return {}

  const errors: Partial<Record<DirectoryUserFormFieldKey, string>> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as DirectoryUserFormFieldKey] = issue.message
    }
  }
  return errors
}

export function isDirectoryUserFormValid(
  values: DirectoryUserFormValues,
  isAdmin: boolean,
): boolean {
  return directoryUserRegistrationSchema(isAdmin).safeParse(values).success
}

export function directoryUserFormValuesToOrgIds(
  orgSelection: OrgTierSelection,
): CreateUserOrgIds {
  return {
    agency_id: orgSelection.agencyId,
    department_id: orgSelection.departmentId || undefined,
    division_id: orgSelection.divisionId || undefined,
    sub_division_id: orgSelection.subDivisionId || undefined,
  }
}
