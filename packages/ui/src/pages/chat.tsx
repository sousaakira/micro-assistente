import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { api, type ChatMessage, type ToolActivity } from '../lib/api';
import { ChatInput } from '../components/chat-input';
import { ChatMessageBubble, ChatTypingIndicator } from '../components/chat-message';
import { FadeIn } from '../components/motion';
import { ChatSkeleton } from '../components/skeleton';

interface DisplayMessage extends ChatMessage {
  toolActivities?: ToolActivity[];
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: api.chatSessions,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: () => api.chatMessages(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId && sessions && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessages]);

  const sendMutation = useMutation({
    mutationFn: api.sendChat,
    onMutate: async (vars) => {
      const optimistic: DisplayMessage = {
        id: `temp-${Date.now()}`,
        sessionId: vars.sessionId ?? 'temp',
        role: 'user',
        content: vars.message,
        createdAt: new Date().toISOString(),
      };
      setPendingMessages((prev) => [...prev, optimistic]);
      return { optimistic };
    },
    onSuccess: (reply) => {
      setSessionId(reply.sessionId);
      setPendingMessages([]);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', reply.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      setPendingMessages([]);
    },
  });

  const handleSend = (message: string) => {
    sendMutation.mutate({ message, sessionId: sessionId ?? undefined });
  };

  const handleNewSession = async () => {
    const session = await api.createChatSession();
    setSessionId(session.id);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
  };

  const allMessages: DisplayMessage[] = [
    ...(messages ?? []),
    ...pendingMessages,
  ];

  const isLoading = sessionsLoading || (!!sessionId && messagesLoading);

  return (
    <div style={styles.container}>
      <FadeIn>
        <header style={styles.header}>
          <div>
            <h2 style={styles.title}>Chat</h2>
            <p style={styles.subtitle}>
              Converse com a IA — ela conhece suas tarefas e pode criar, listar e verificar a fila
            </p>
          </div>
          <button onClick={handleNewSession} style={styles.newBtn}>
            + Nova conversa
          </button>
        </header>
      </FadeIn>

      <div style={styles.messages}>
        {isLoading && allMessages.length === 0 ? (
          <ChatSkeleton />
        ) : allMessages.length === 0 ? (
          <FadeIn>
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>Olá! Sou o Micro Assistente.</p>
              <p style={styles.emptyText}>
                Pergunte sobre suas tarefas, peça para criar uma nova, ou diga "verifique a fila".
              </p>
            </div>
          </FadeIn>
        ) : (
          <AnimatePresence mode="popLayout">
            {allMessages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                toolActivities={msg.toolActivities}
              />
            ))}
          </AnimatePresence>
        )}
        {sendMutation.isPending && <ChatTypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={sendMutation.isPending} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 20px 12px',
    gap: 16,
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
    maxWidth: 480,
  },
  newBtn: {
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text-muted)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius)',
    whiteSpace: 'nowrap',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 20px 16px',
    minHeight: 0,
  },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--text-muted)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 1.6,
  },
};
