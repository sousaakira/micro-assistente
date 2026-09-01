import { motion, type HTMLMotionProps } from 'motion/react';

const ENTER = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(4px)' },
};

const SPRING = { type: 'spring' as const, duration: 0.45, bounce: 0 };

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
}

export function FadeIn({ children, delay = 0, ...props }: FadeInProps) {
  return (
    <motion.div
      {...ENTER}
      transition={{ ...SPRING, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StaggerList({ children, className, style }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: ENTER.initial,
        visible: { ...ENTER.animate, transition: SPRING },
      }}
    >
      {children}
    </motion.div>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        style={{ height: '100%', background: 'var(--accent)', borderRadius: 2 }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', duration: 0.55, bounce: 0 }}
      />
    </div>
  );
}
