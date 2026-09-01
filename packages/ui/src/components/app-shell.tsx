import { Suspense, lazy, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../lib/api';
import { Sidebar, type AppView } from './sidebar';
import { StatusBar } from './status-bar';
import { ChatSkeleton, DashboardSkeleton } from './skeleton';

const ChatPage = lazy(() => import('../pages/chat'));
const TasksPage = lazy(() => import('../pages/tasks'));

export function AppShell() {
  const [view, setView] = useState<AppView>('chat');

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.tasks,
  });

  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0;

  return (
    <div style={styles.root}>
      <Sidebar active={view} onNavigate={setView} pendingCount={pendingCount} />
      <div style={styles.main}>
        <StatusBar />
        <div style={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              style={styles.page}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
            >
              <Suspense fallback={view === 'chat' ? <ChatSkeleton /> : <DashboardSkeleton />}>
                {view === 'chat' ? <ChatPage /> : <TasksPage />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: 'var(--bg)',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  page: {
    height: '100%',
  },
};
