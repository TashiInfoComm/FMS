import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

import {
  fetchAgencyByCode,
  fetchDepartmentByCode,
  fetchDivisionByCode,
  type HierarchyTableRow,
} from '@/features/master/lib/agency-hierarchy-api'

export type HierarchyNavigationTarget = {
  pathname: string
  state?: unknown
}

export type DepartmentListLocationState = {
  agencyId?: string
  agencyName?: string
}

export type DivisionListLocationState = {
  departmentId?: string
  departmentName?: string
  agencyCode?: string
  agencyId?: string
  agencyName?: string
}

export type SubDivisionListLocationState = {
  divisionId?: string
  divisionName?: string
  departmentCode?: string
  departmentId?: string
  departmentName?: string
  agencyCode?: string
  agencyId?: string
  agencyName?: string
}

function readLocationState<T>(location: ReturnType<typeof useLocation>): T {
  return (location.state ?? {}) as T
}

export function buildDepartmentNavigationTarget(
  row: HierarchyTableRow,
): HierarchyNavigationTarget {
  const agencyCode = String(row.code ?? '')
  return {
    pathname: `/master/agency/${encodeURIComponent(agencyCode)}/departments`,
    state: {
      agencyId: String(row.id ?? ''),
      agencyName: String(row.name ?? ''),
    } satisfies DepartmentListLocationState,
  }
}

export function buildDivisionNavigationTarget(
  row: HierarchyTableRow,
  agencyCode: string,
  agencyId: string,
  agencyName: string,
): HierarchyNavigationTarget {
  const departmentCode = String(row.code ?? '')
  return {
    pathname: `/master/departments/${encodeURIComponent(departmentCode)}/divisions`,
    state: {
      departmentId: String(row.id ?? ''),
      departmentName: String(row.name ?? ''),
      agencyCode,
      agencyId,
      agencyName,
    } satisfies DivisionListLocationState,
  }
}

export function buildSubDivisionNavigationTarget(
  row: HierarchyTableRow,
  ancestry: DivisionListLocationState & { departmentCode: string },
): HierarchyNavigationTarget {
  const divisionCode = String(row.code ?? '')
  return {
    pathname: `/master/divisions/${encodeURIComponent(divisionCode)}/sub-divisions`,
    state: {
      divisionId: String(row.id ?? ''),
      divisionName: String(row.name ?? ''),
      departmentCode: ancestry.departmentCode,
      departmentId: ancestry.departmentId,
      departmentName: ancestry.departmentName,
      agencyCode: ancestry.agencyCode,
      agencyId: ancestry.agencyId,
      agencyName: ancestry.agencyName,
    } satisfies SubDivisionListLocationState,
  }
}

export function useDepartmentParentContext(agencyCode: string) {
  const location = useLocation()
  const state = readLocationState<DepartmentListLocationState>(location)
  const needsFetch = !state.agencyId?.trim() || !state.agencyName?.trim()

  const agencyQuery = useQuery({
    queryKey: ['master-agency-by-code', agencyCode],
    queryFn: () => fetchAgencyByCode(agencyCode),
    enabled: Boolean(agencyCode) && needsFetch,
    staleTime: 60_000,
  })

  return {
    agencyId: state.agencyId?.trim() || agencyQuery.data?.id || '',
    agencyName: state.agencyName?.trim() || agencyQuery.data?.name || '',
    isResolvingParent: needsFetch && agencyQuery.isLoading,
  }
}

export function useDivisionParentContext(departmentCode: string) {
  const location = useLocation()
  const state = readLocationState<DivisionListLocationState>(location)
  const needsDepartmentFetch =
    !state.departmentId?.trim() ||
    !state.departmentName?.trim() ||
    !state.agencyCode?.trim()

  const departmentQuery = useQuery({
    queryKey: ['master-department-by-code', departmentCode],
    queryFn: () => fetchDepartmentByCode(departmentCode),
    enabled: Boolean(departmentCode) && needsDepartmentFetch,
    staleTime: 60_000,
  })

  const fetched = departmentQuery.data

  return {
    departmentId: state.departmentId?.trim() || fetched?.id || '',
    departmentName: state.departmentName?.trim() || fetched?.name || '',
    agencyCode: state.agencyCode?.trim() || fetched?.agencyCode || '',
    agencyId: state.agencyId?.trim() || fetched?.agencyId || '',
    agencyName: state.agencyName?.trim() || fetched?.agencyName || '',
    isResolvingParent: needsDepartmentFetch && departmentQuery.isLoading,
  }
}

export function useSubDivisionParentContext(divisionCode: string) {
  const location = useLocation()
  const state = readLocationState<SubDivisionListLocationState>(location)
  const needsDivisionFetch =
    !state.divisionId?.trim() ||
    !state.divisionName?.trim() ||
    !state.departmentCode?.trim()

  const divisionQuery = useQuery({
    queryKey: ['master-division-by-code', divisionCode],
    queryFn: () => fetchDivisionByCode(divisionCode),
    enabled: Boolean(divisionCode) && needsDivisionFetch,
    staleTime: 60_000,
  })

  const fetched = divisionQuery.data

  return {
    divisionId: state.divisionId?.trim() || fetched?.id || '',
    divisionName: state.divisionName?.trim() || fetched?.name || '',
    departmentCode: state.departmentCode?.trim() || fetched?.departmentCode || '',
    departmentId: state.departmentId?.trim() || fetched?.departmentId || '',
    departmentName: state.departmentName?.trim() || fetched?.departmentName || '',
    agencyCode: state.agencyCode?.trim() || fetched?.agencyCode || '',
    agencyId: state.agencyId?.trim() || fetched?.agencyId || '',
    agencyName: state.agencyName?.trim() || fetched?.agencyName || '',
    isResolvingParent: needsDivisionFetch && divisionQuery.isLoading,
  }
}
