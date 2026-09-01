import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { FadeIn, StaggerList, StaggerItem } from '../components/motion';
import { DashboardSkeleton } from '../components/skeleton';
import { NewTaskForm } from '../components/new-task-form';
import { TaskCard } from '../components/task-card';

export default function TasksPage() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.tasks,
  });

  return (
    <div style={styles.container}>
      <FadeIn>
        <header style={styles.header}>
          <h2 style={styles.title}>Tarefas</h2>
          <p style={styles.subtitle}>
            Fila de execução do agente — ou peça via chat para criar e verificar tarefas
          </p>
        </header>
      </FadeIn>

      <FadeIn delay={0.05}>
        <section style={{ marginBottom: 20, padding: '0 20px' }}>
          <NewTaskForm />
        </section>
      </FadeIn>

      <FadeIn delay={0.1}>
        <section style={{ padding: '0 20px 20px' }}>
          {isLoading ? (
            <DashboardSkeleton />
          ) : tasks && tasks.length > 0 ? (
            <StaggerList style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => (
                  <StaggerItem key={task.id}>
                    <TaskCard task={task} />
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </StaggerList>
          ) : (
            <p style={styles.empty}>Nenhuma tarefa ainda. Crie uma acima ou peça no chat.</p>
          )}
        </section>
      </FadeIn>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflowY: 'auto',
  },
  header: {
    padding: '20px 20px 12px',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
  },
};
