import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Converse com a IA… (Enter envia, Shift+Enter quebra linha)'}
        disabled={disabled}
        rows={2}
        style={styles.input}
      />
      <motion.button
        type="submit"
        disabled={disabled || !value.trim()}
        style={styles.btn}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.18 }}
      >
        Enviar
      </motion.button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    gap: 10,
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    padding: '12px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
  },
  btn: {
    padding: '12px 18px',
    background: 'var(--accent-dim)',
    color: 'var(--bg)',
    borderRadius: 'var(--radius)',
    fontSize: 13,
    fontWeight: 600,
    opacity: 1,
  },
};
