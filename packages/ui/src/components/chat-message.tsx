import { motion } from 'motion/react';
import type { ChatMessage, ToolActivity } from '../lib/api';
import { FadeIn } from './motion';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  toolActivities?: ToolActivity[];
}

export function ChatMessageBubble({ message, toolActivities }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <FadeIn>
      <div style={{ ...styles.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{ ...styles.bubble, ...(isUser ? styles.userBubble : styles.assistantBubble) }}>
          {!isUser && <div style={styles.role}>Assistente</div>}
          <div style={styles.content}>{message.content}</div>
          {toolActivities && toolActivities.length > 0 && (
            <div style={styles.tools}>
              {toolActivities.map((t, i) => (
                <ToolActivityCard key={`${t.name}-${i}`} activity={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

function ToolActivityCard({ activity }: { activity: ToolActivity }) {
  return (
    <motion.div
      style={styles.toolCard}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
    >
      <div style={styles.toolName}>⚙ {activity.name}</div>
      <div style={styles.toolOutput}>{activity.output.slice(0, 400)}</div>
    </motion.div>
  );
}

export function ChatTypingIndicator() {
  return (
    <FadeIn>
      <div style={styles.row}>
        <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
          <div style={styles.typing}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                style={styles.typingDot}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    marginBottom: 12,
  },
  bubble: {
    maxWidth: '85%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  userBubble: {
    background: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  assistantBubble: {
    background: 'var(--surface)',
  },
  role: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
  tools: {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  toolCard: {
    padding: '8px 10px',
    background: 'var(--bg)',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  toolName: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent)',
    marginBottom: 4,
  },
  toolOutput: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'pre-wrap',
  },
  typing: {
    display: 'flex',
    gap: 4,
    padding: '4px 0',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text-muted)',
    display: 'inline-block',
  },
};
