import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/app-shell';
import { ChatSkeleton } from './components/skeleton';
import './styles/global.css';

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
      <Suspense fallback={<ChatSkeleton full />}>
        <AppShell />
      </Suspense>
    </QueryClientProvider>
  );
}
