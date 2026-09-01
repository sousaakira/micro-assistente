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
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Skeleton width={12} height={12} borderRadius="50%" />
      <Skeleton width={120} height={14} />
    </div>
  );
}
