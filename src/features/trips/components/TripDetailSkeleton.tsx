import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DetailLabeledValueSkeleton,
  DetailReadOnlyFieldSkeleton,
} from '@/shared/components/detail-loading'
import { BackToListButton } from '@/shared/components/BackToListButton'
import { PageHeader } from '@/shared/components/PageHeader'

const APPLICANT_FIELDS = [
  'Employee Number',
  'Applicant Name',
  'Designation',
  'Agency',
  'Department',
  'Division',
  'Sub Division',
  'Contact Number',
  'Email',
] as const

const TRIP_FIELDS = [
  'Trip Type',
  'Purpose of Journey',
  'Preferred Vehicle Type',
  'Origin',
  'Final Destination',
  'Date of Journey',
  'Time of Journey',
] as const

type TripDetailSkeletonProps = {
  title: string
  backPath: string
}

export function TripDetailSkeleton({ title, backPath }: TripDetailSkeletonProps) {
  return (
    <section className="space-y-5">
      <BackToListButton to={backPath} />
      <PageHeader
        title={title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </span>
        }
      />

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {APPLICANT_FIELDS.map((label) => (
              <DetailReadOnlyFieldSkeleton key={label} label={label} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRIP_FIELDS.map((label) => (
              <DetailReadOnlyFieldSkeleton key={label} label={label} />
            ))}
          </div>
          <DetailReadOnlyFieldSkeleton label="Remarks" className="w-full" />
        </CardContent>
      </Card>

      <Card className="border border-[var(--fms-strokes)] bg-white">
        <CardContent className="space-y-4 pt-5">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-72" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
            <div className="space-y-3 bg-[#f6f6f7] px-4 py-3">
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`official-sk-${index}`} className="grid gap-3 sm:grid-cols-3">
                  <DetailLabeledValueSkeleton label="Sl.No" />
                  <DetailLabeledValueSkeleton label="Employee CID" />
                  <DetailLabeledValueSkeleton label="Full Name" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
