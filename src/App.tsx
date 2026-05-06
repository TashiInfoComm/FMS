// Composes app routes with the global toast provider.
import { AppRoutes } from '@/app/routes/AppRoutes'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster richColors position="top-right" />
    </>
  )
}

export default App
