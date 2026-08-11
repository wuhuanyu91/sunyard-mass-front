import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** 全局上下文（规范 4.3 顶部全局栏）：时间档位 / 租户 / 只读 / 冻结 / 主题 */
export type TimeRange = 'REALTIME' | '1H' | '24H' | '7D' | '30D';
export type ThemeMode = 'dark' | 'light';

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  REALTIME: '实时',
  '1H': '1h',
  '24H': '24h',
  '7D': '7d',
  '30D': '30d',
};

interface AppState {
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  tenantId: string;
  setTenantId: (t: string) => void;
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;
  frozen: boolean;
  setFrozen: (v: boolean) => void;
  circuitOpen: boolean;
  setCircuitOpen: (v: boolean) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [tenantId, setTenantId] = useState('GLOBAL');
  const [readOnly, setReadOnly] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('maas-theme');
    return saved === 'dark' ? 'dark' : 'light'; // V4：浅色为默认，深色可选
  });

  /** 主题切换：html data-theme 驱动 CSS 变量，持久化到 localStorage */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('maas-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({ timeRange, setTimeRange, tenantId, setTenantId, readOnly, setReadOnly, frozen, setFrozen, circuitOpen, setCircuitOpen, theme, setTheme }),
    [timeRange, tenantId, readOnly, frozen, circuitOpen, theme],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
