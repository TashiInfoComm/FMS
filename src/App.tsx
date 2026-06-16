import { AppRoutes } from '@/app/routes/AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { GlobalApiLoadingOverlay } from '@/shared/components/GlobalApiLoadingOverlay'

function App() {
  return (
    <>
      <AppRoutes />
      <GlobalApiLoadingOverlay />
      <Toaster position="top-right" richColors />
    </>
  )
}

export default App
