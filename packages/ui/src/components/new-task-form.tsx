import { useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function NewTaskForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.createTask({ title, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTitle('');
      setDescription('');
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <motion.button
        onClick={() => setOpen(true)}
        style={styles.addBtn}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', duration: 0.18, bounce: 0 }}
      >
        + Nova tarefa
      </motion.button>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
      style={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <input
        placeholder="Título da tarefa"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.input}
        autoFocus
      />
      <textarea
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setOpen(false)} style={styles.cancelBtn}>
          Cancelar
        </button>
        <motion.button
          type="submit"
          disabled={!title.trim() || mutation.isPending}
          style={styles.submitBtn}
          whileTap={{ scale: 0.97 }}
        >
          {mutation.isPending ? 'Criando...' : 'Criar'}
        </motion.button>
      </div>
    </motion.form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  addBtn: {
    padding: '10px 16px',
    background: 'var(--surface)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    fontSize: 14,
    width: '100%',
  },
  form: {
    padding: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    outline: 'none',
  },
  cancelBtn: {
    padding: '8px 14px',
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  submitBtn: {
    padding: '8px 16px',
    background: 'var(--accent-dim)',
    color: 'var(--bg)',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
  },
};
