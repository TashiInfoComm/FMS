import { useMemo } from 'react'

import type { fetchApprovableTypes } from '@/features/settings/lib/approval-rules-api'

export type ApprovalRuleFormValues = {
  workflow_approval_head_id: string;
  workflow_module_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: string;
};

export const DEFINITIONS_QUERY_KEY = 'workflows/definitions'
export const APPROVAL_HEADS_TABS_QUERY_KEY = 'workflows/approval-heads-tabs'
export const APPROVABLE_TYPES_QUERY_KEY = 'workflows/approvable-types'

export function emptyApprovalRuleFormValues(approvalHeadId = ''): ApprovalRuleFormValues {
  return {
    workflow_approval_head_id: approvalHeadId,
    workflow_module_id: "",
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    is_active: "true",
  };
}

export function formatModuleLabel(module: string, lookup: Record<string, string>) {
  const key = module.trim()
  return (key && lookup[key]) || key || '-'
}


export function useApprovableTypeMaps(
  approvableTypes: Awaited<ReturnType<typeof fetchApprovableTypes>> | undefined,
) {
  return useMemo(() => {
    const moduleLabelByValue: Record<string, string> = {}
    const typeLabelByModule: Record<string, Record<string, string>> = {}
    const typeOptionsByModule: Record<string, {id: string; value: string; label: string }[]> = {}

    for (const item of approvableTypes ?? []) {
      moduleLabelByValue[item.value] = item.label
      typeLabelByModule[item.value] = Object.fromEntries(
        item.types.map((type) => [type.value, type.label]),
      )
      typeOptionsByModule[item.value] = item.types.map((type) => ({id: '', value: type.value, label: type.label }))
    }

    return { moduleLabelByValue, typeLabelByModule, typeOptionsByModule }
  }, [approvableTypes])
}
