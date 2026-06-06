// Wraps the Sonner toaster with app default configuration.
import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      toastOptions={{
        duration: 3000,
        closeButton: true,
        classNames: {
          toast:
            'group relative border border-[var(--fms-strokes)] bg-white pr-10 text-[var(--fms-neutral-text)] [&_[data-close-button]]:absolute [&_[data-close-button]]:right-2 [&_[data-close-button]]:top-2',
          title: 'text-sm font-semibold',
          description: 'text-sm text-[var(--fms-text-subheading)]',
          actionButton: 'bg-[var(--fms-button)] text-white',
          cancelButton: 'bg-slate-200 text-slate-900',
          closeButton: 'absolute top-2 right-2',
          loader: 'h-1 bg-[var(--fms-button)]',
        },
      }}
      {...props}
    />
  )
}
