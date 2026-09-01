import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export type AppView = 'chat' | 'tasks';

interface SidebarProps {
  active: AppView;
  onNavigate: (view: AppView) => void;
  pendingCount?: number;
}

const NAV: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: '◌' },
  { id: 'tasks', label: 'Tarefas', icon: '☰' },
];

export function Sidebar({ active, onNavigate, pendingCount = 0 }: SidebarProps) {
  return (
    <aside style={styles.aside}>
      <div style={styles.brand}>
        <span style={styles.logo}>μ</span>
        <div>
          <div style={styles.brandTitle}>Micro</div>
          <div style={styles.brandSub}>Assistente</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            active={active === item.id}
            onClick={() => onNavigate(item.id)}
            badge={item.id === 'tasks' && pendingCount > 0 ? pendingCount : undefined}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {item.label}
          </NavItem>
        ))}
      </nav>
    </aside>
  );
}

function NavItem({
  children,
  active,
  onClick,
  badge,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : {}),
      }}
      whileHover={{ backgroundColor: 'var(--surface-hover)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      {children}
      {badge !== undefined && <span style={styles.badge}>{badge}</span>}
    </motion.button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: 220,
    minWidth: 220,
    borderRight: '1px solid var(--border)',
    background: 'var(--surface)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 12px',
    gap: 24,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 8px',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'var(--accent-dim)',
    color: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 18,
    fontFamily: 'var(--font-mono)',
  },
  brandTitle: {
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.2,
  },
  brandSub: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-muted)',
    textAlign: 'left',
    width: '100%',
  },
  navItemActive: {
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 600,
  },
  navIcon: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    opacity: 0.8,
  },
  badge: {
    marginLeft: 'auto',
    background: 'var(--accent-dim)',
    color: 'var(--bg)',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 999,
    fontFamily: 'var(--font-mono)',
  },
};
