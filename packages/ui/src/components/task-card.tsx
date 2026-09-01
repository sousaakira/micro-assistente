import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '../lib/api';
import { api } from '../lib/api';

const STATUS_COLORS: Record<Task['status'], string> = {
  pending: 'var(--text-muted)',
  running: 'var(--warning)',
  completed: 'var(--success)',
  failed: 'var(--danger)',
  cancelled: 'var(--text-muted)',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  pending: 'Pendente',
  running: 'Executando',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <motion.article
      layout
      style={styles.card}
      whileHover={{ backgroundColor: 'var(--surface-hover)' }}
      transition={{ duration: 0.18 }}
    >
      <div style={styles.header}>
        <span style={{ ...styles.status, color: STATUS_COLORS[task.status] }}>
          <motion.span
            style={styles.dot}
            animate={task.status === 'running' ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={task.status === 'running' ? { duration: 1.2, repeat: Infinity } : {}}
          />
          {STATUS_LABELS[task.status]}
        </span>
        {task.status !== 'running' && (
          <motion.button
            onClick={() => deleteMutation.mutate()}
            style={styles.deleteBtn}
            whileHover={{ color: 'var(--danger)' }}
            whileTap={{ scale: 0.9 }}
          >
            ×
          </motion.button>
        )}
      </div>
      <h3 style={styles.title}>{task.title}</h3>
      {task.description && <p style={styles.desc}>{task.description}</p>}
      {task.result && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={styles.result}
        >
          {task.result}
        </motion.p>
      )}
      {task.error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.error}
        >
          {task.error}
        </motion.p>
      )}
    </motion.article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'currentColor',
  },
  deleteBtn: {
    fontSize: 18,
    color: 'var(--text-muted)',
    lineHeight: 1,
    padding: '2px 6px',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 8,
  },
  result: {
    fontSize: 13,
    color: 'var(--accent)',
    marginTop: 8,
    padding: '8px 10px',
    background: 'rgba(110, 231, 183, 0.06)',
    borderRadius: 6,
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
  },
  error: {
    fontSize: 13,
    color: 'var(--danger)',
    marginTop: 8,
  },
};
