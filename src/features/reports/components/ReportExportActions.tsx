import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ExcelExportIcon,
  PdfExportIcon,
} from '@/features/reports/components/ReportExportIcons'

export type ReportExportFormat = 'xlsx' | 'pdf'

type ReportExportActionsProps = {
  onExport: (format: ReportExportFormat) => void
  exportingFormat?: ReportExportFormat | null
}

export function ReportExportActions({
  onExport,
  exportingFormat = null,
}: ReportExportActionsProps) {
  const isBusy = exportingFormat !== null

  return (
    <div className="flex items-center gap-1 self-start sm:self-auto">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onExport('xlsx')}
            disabled={isBusy}
            aria-label={exportingFormat === 'xlsx' ? 'Exporting Excel' : 'Export Excel'}
            className="h-9 w-9 text-[var(--fms-button)] hover:bg-[#eff6ff] hover:text-[var(--fms-button-hover)]"
          >
            {exportingFormat === 'xlsx' ? (
              <Spinner className="size-5" />
            ) : (
              <ExcelExportIcon className="size-6" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export Excel</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onExport('pdf')}
            disabled={isBusy}
            aria-label={exportingFormat === 'pdf' ? 'Exporting PDF' : 'Export PDF'}
            className="h-9 w-9 text-[var(--fms-button)] hover:bg-[#eff6ff] hover:text-[var(--fms-button-hover)]"
          >
            {exportingFormat === 'pdf' ? (
              <Spinner className="size-5" />
            ) : (
              <PdfExportIcon className="size-6" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export PDF</TooltipContent>
      </Tooltip>
    </div>
  )
}
