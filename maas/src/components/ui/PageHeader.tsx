import type { ReactNode } from 'react';

/**
 * 管理页标准页头（交互设计语言：列表管理页 / 配置页通用）
 * 结构：面包屑 · 标题 + 一句话职责说明 + 右侧主操作区
 */
export default function PageHeader({
  crumb,
  title,
  desc,
  actions,
}: {
  /** 面包屑：如「计量与运营」 */
  crumb?: string;
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {crumb && <div className="mb-0.5 text-[11px] text-text-secondary/80">{crumb}</div>}
        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight text-text-primary">
          <span className="grad-brand h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
          {title}
        </h2>
        {desc && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{desc}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
