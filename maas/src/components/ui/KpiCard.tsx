import type { ReactNode } from 'react';

/** KPI 卡（规范 5.5）：标题 + 大数字 + 环比/同比 + hover 口径 tooltip */
export default function KpiCard({
  label,
  value,
  unit,
  hint,
  delta,
  deltaUpIsGood = true,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string; // 口径说明（规范 8.1）
  delta?: number; // 环比 %（正负）
  deltaUpIsGood?: boolean;
  tone?: 'default' | 'danger' | 'success';
  onClick?: () => void;
}) {
  const deltaTone =
    delta === undefined
      ? ''
      : delta > 0
        ? deltaUpIsGood
          ? 'text-success'
          : 'text-danger'
        : deltaUpIsGood
          ? 'text-danger'
          : 'text-success';

  const valueColor = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-text-primary';

  return (
    <div
      onClick={onClick}
      className={`panel group relative flex flex-col justify-between p-3 transition-all ${
        onClick ? 'hover-lift cursor-pointer hover:border-primary/60' : ''
      }`}
      title={hint}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-xs text-text-secondary">{label}</span>
        {hint && (
          <span className="ml-1 shrink-0 cursor-help text-xs text-text-secondary opacity-0 transition-opacity group-hover:opacity-100" title={hint}>
            ⓘ
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`num text-[30px] font-semibold leading-none ${valueColor}`}>{value}</span>
        {unit && <span className="text-xs text-text-secondary">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={`num mt-1 text-xs ${deltaTone}`}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '―'} {Math.abs(delta)}% 环比
        </div>
      )}
    </div>
  );
}
