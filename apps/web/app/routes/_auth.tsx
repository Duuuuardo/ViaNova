import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ViaLogo } from '../components/brand'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <ViaLogo />
        </div>
        <div className="bg-surface border border-line rounded-card p-8 shadow-[0_1px_2px_rgba(22,21,31,0.05)]">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">
          Uma conta para todos os produtos.
        </p>
      </div>
    </main>
  )
}
