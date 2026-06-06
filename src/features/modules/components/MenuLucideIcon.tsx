import { useEffect, useState } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { LayoutGrid } from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

import { apiIconLabelToLucideKebab } from '@/features/modules/lib/menus-api'

type IconLoaderRecord = Record<string, (() => Promise<{ default: LucideIcon }>) | undefined>
const loaders = dynamicIconImports as IconLoaderRecord

type Props = LucideProps & {
  iconName: string
}

/** Renders a Lucide icon from an API icon string using `lucide-react/dynamicIconImports` (tree-shaking safe). */
export function MenuLucideIcon({ iconName, ...props }: Props) {
  const [Icon, setIcon] = useState<LucideIcon>(() => LayoutGrid)

  useEffect(() => {
    const candidate = apiIconLabelToLucideKebab(iconName)
    const load = loaders[candidate]
    if (!load) {
      setIcon(() => LayoutGrid)
      return
    }

    let cancelled = false

    void load().then((mod) => {
      if (!cancelled) setIcon(() => mod.default)
    })

    return () => {
      cancelled = true
    }
  }, [iconName])

  return <Icon {...props} />
}
