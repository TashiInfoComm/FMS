import { PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

const NDI_VIDEO_GUIDE_URL = 'https://www.youtube.com/@BhutanNDI'

export function NdiVideoGuideButton() {
  const handleOpenVideoGuide = () => {
    window.open(NDI_VIDEO_GUIDE_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleOpenVideoGuide}
      className="group h-9 cursor-pointer rounded-full border-[var(--fms-ndi-text)] bg-transparent px-4 text-[var(--fms-ndi-text)] transition-colors hover:border-[var(--fms-ndi-text)] hover:bg-[var(--fms-ndi-text)] hover:text-white"
    >
      Watch video guide
      <PlayCircle className="ml-2 h-5 w-5 text-[var(--fms-ndi-text)] transition-colors group-hover:text-white" />
    </Button>
  )
}
