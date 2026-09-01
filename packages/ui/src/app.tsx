import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { DashboardSkeleton } from './components/skeleton';
import './styles/global.css';

const Dashboard = lazy(() => import('./pages/dashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3000,
      refetchInterval: 5000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<AppShell skeleton />}>
        <Dashboard />
      </Suspense>
    </QueryClientProvider>
  );
}

function AppShell({ skeleton }: { skeleton?: boolean }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Micro Assistente
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Agente local leve com IA e plugins
        </p>
      </header>
      {skeleton && <DashboardSkeleton />}
    </div>
  );
}

export { AppShell, AnimatePresence };
