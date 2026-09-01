import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusSkeleton } from './skeleton';

export function StatusBar() {
  const queryClient = useQueryClient();

  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
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

  if (isLoading) return <StatusSkeleton />;

  const agentRunning = health?.agent.running ?? false;

  return (
    <div style={styles.bar}>
      <Indicator label="LLM" active={health?.llm ?? false} />
      <Indicator label="Agente" active={agentRunning} />
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {agentRunning ? (
          <button
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            style={{ ...styles.btn, ...styles.btnDanger }}
          >
            Parar agente
          </button>
        ) : (
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            style={{ ...styles.btn, ...styles.btnPrimary }}
          >
            Iniciar agente
          </button>
        )}
      </div>
    </div>
  );
}

function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={styles.indicator}>
      <span style={{ ...styles.dot, background: active ? 'var(--success)' : 'var(--danger)' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{active ? 'online' : 'offline'}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  btn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
  },
  btnPrimary: {
    background: 'var(--accent-dim)',
    color: 'var(--bg)',
  },
  btnDanger: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
  },
};
