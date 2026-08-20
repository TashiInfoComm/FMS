// Super-admin only: rolls up a month's parking claims into a single consolidated claim.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/services/apiClient'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

export function ParkingClaimsConsolidationCard() {
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')

  const consolidateMutation = useMutation({
    mutationFn: async () => {
      const monthNumber = Number(month.trim())
      const yearNumber = Number(year.trim())
      if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        throw new Error('Month must be a number from 1 to 12.')
      }
      if (!Number.isInteger(yearNumber) || yearNumber < 1) {
        throw new Error('Year must be a valid number.')
      }

      return apiPost<unknown, { month: number; year: number }>('/parking/claims/consolidate', {
        month: monthNumber,
        year: yearNumber,
      })
    },
    onSuccess: () => {
      showSuccessToast('Parking claims consolidation submitted.')
    },
    onError: (error) => {
      showErrorToast(error, 'Could not consolidate parking claims.')
    },
  })

  return (
    <Card className="rounded-xl border border-[var(--fms-strokes)] ring-0">
      <CardHeader>
        <CardTitle className="text-base">Parking Claims Consolidation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="consolidate-month">Month</Label>
            <Input
              id="consolidate-month"
              type="text"
              inputMode="numeric"
              placeholder="Enter month (1-12)"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consolidate-year">Year</Label>
            <Input
              id="consolidate-year"
              type="text"
              inputMode="numeric"
              placeholder="Enter year (e.g. 2026)"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          className="bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
          disabled={consolidateMutation.isPending}
          onClick={() => consolidateMutation.mutate()}
        >
          {consolidateMutation.isPending ? 'Consolidating…' : 'Consolidate'}
        </Button>
      </CardContent>
    </Card>
  )
}
