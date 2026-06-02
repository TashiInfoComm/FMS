// Composes app routes with the global toast provider.
import { AppRoutes } from '@/app/routes/AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GlobalApiLoadingOverlay } from '@/shared/components/GlobalApiLoadingOverlay'

function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AppRoutes />
      <GlobalApiLoadingOverlay />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}

export default App
