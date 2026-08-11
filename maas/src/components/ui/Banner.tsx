import type { ReactNode } from 'react';

/** 顶部横幅：只读 / 口径待校准 / 高优先级被挤压 / 配额预警 / 熔断（规范 5.5 + 6.4.5 + 9.7） */
export default function Banner({
  tone = 'warning',
  children,
  action,
}: {
  tone?: 'warning' | 'danger' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger/50 bg-danger/10 text-danger'
      : tone === 'info'
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-warning/50 bg-warning/10 text-warning';
  return (
    <div className={`flex items-center justify-between gap-3 border px-4 py-2 text-sm ${cls}`}>
      <div className="flex items-center gap-2">{children}</div>
      {action}
    </div>
  );
}
