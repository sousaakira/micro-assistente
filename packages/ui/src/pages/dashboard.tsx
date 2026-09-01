import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { FadeIn, StaggerList, StaggerItem } from '../components/motion';
import { DashboardSkeleton, StatusSkeleton } from '../components/skeleton';
import { NewTaskForm } from '../components/new-task-form';
import { TaskCard } from '../components/task-card';

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.tasks,
  });

  const startMutation = useMutation({
    mutationFn: api.startAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: api.stopAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
  });

  const agentRunning = health?.agent.running ?? false;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <FadeIn>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Micro Assistente
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Agente local leve com IA e plugins
          </p>
        </header>
      </FadeIn>

      <FadeIn delay={0.05}>
        <section style={{ marginBottom: 24 }}>
          {healthLoading ? (
            <StatusSkeleton />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <StatusIndicator
                label="LLM"
                active={health?.llm ?? false}
              />
              <StatusIndicator
                label="Agente"
                active={agentRunning}
              />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {agentRunning ? (
                  <ActionButton
                    onClick={() => stopMutation.mutate()}
                    loading={stopMutation.isPending}
                    variant="danger"
                  >
                    Parar
                  </ActionButton>
                ) : (
                  <ActionButton
                    onClick={() => startMutation.mutate()}
                    loading={startMutation.isPending}
                    variant="primary"
                  >
                    Iniciar agente
                  </ActionButton>
                )}
              </div>
            </div>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.1}>
        <section style={{ marginBottom: 20 }}>
          <NewTaskForm />
        </section>
      </FadeIn>

      <FadeIn delay={0.15}>
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tarefas
          </h2>
          {tasksLoading ? (
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
            <FadeIn>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                Nenhuma tarefa ainda. Crie uma acima.
              </p>
            </FadeIn>
          )}
        </section>
      </FadeIn>
    </div>
  );
}

function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? 'var(--success)' : 'var(--danger)',
        }}
      />
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {active ? 'online' : 'offline'}
      </span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant: 'primary' | 'danger';
}) {
  const bg = variant === 'primary' ? 'var(--accent-dim)' : 'transparent';
  const color = variant === 'primary' ? 'var(--bg)' : 'var(--danger)';
  const border = variant === 'danger' ? '1px solid var(--danger)' : 'none';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 16px',
        background: bg,
        color,
        border,
        borderRadius: 'var(--radius)',
        fontSize: 13,
        fontWeight: 600,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
