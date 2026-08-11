import type { ReactNode } from 'react';

/**
 * 窄指标条（管理页专用）：替代大屏式 KPI 大卡。
 * 一行横向排列的轻量指标，值字号收敛至 18px，突出"概览不抢戏"。
 */
export type KpiItem = {
  label: string;
  value: string;
  unit?: string;
  /** 数值颜色类，默认 text-text-primary */
  tone?: string;
  hint?: string;
};

export default function KpiStrip({ items, extra }: { items: KpiItem[]; extra?: ReactNode }) {
  return (
    <div className="panel flex items-stretch divide-x divide-border-default overflow-hidden">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 flex-1 px-4 py-2.5" title={it.hint}>
          <div className="truncate text-xs text-text-secondary">{it.label}</div>
          <div className={`num mt-0.5 truncate text-lg font-semibold leading-tight ${it.tone ?? 'text-text-primary'}`}>
            {it.value}
            {it.unit && <span className="ml-1 text-xs font-normal text-text-secondary">{it.unit}</span>}
          </div>
        </div>
      ))}
      {extra && <div className="flex shrink-0 items-center px-4">{extra}</div>}
    </div>
  );
}
