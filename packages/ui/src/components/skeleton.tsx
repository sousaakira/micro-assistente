import { motion } from 'motion/react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, className }: SkeletonProps) {
  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 50%, var(--surface) 75%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      aria-hidden="true"
    />
  );
}

export function TaskSkeleton() {
  return (
    <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <Skeleton width="60%" height={14} />
      <div style={{ marginTop: 8 }}>
        <Skeleton width="40%" height={12} />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <TaskSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatusSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 20px' }}>
      <Skeleton width={12} height={12} borderRadius="50%" />
      <Skeleton width={120} height={14} />
    </div>
  );
}

export function ChatSkeleton({ full }: { full?: boolean }) {
  if (full) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        <div style={{ width: 220, borderRight: '1px solid var(--border)', padding: 20 }}>
          <Skeleton width="80%" height={36} borderRadius={10} />
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={40} borderRadius={8} />
            <Skeleton height={40} borderRadius={8} />
          </div>
        </div>
        <div style={{ flex: 1, padding: 20 }}>
          <ChatSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
      <MessageSkeleton align="left" />
      <MessageSkeleton align="right" />
      <MessageSkeleton align="left" />
    </div>
  );
}

function MessageSkeleton({ align }: { align: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ width: '70%', padding: 14, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <Skeleton width="90%" height={12} />
        <div style={{ marginTop: 8 }}>
          <Skeleton width="60%" height={12} />
        </div>
      </div>
    </div>
  );
}
