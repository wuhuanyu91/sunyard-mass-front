import type { ReactNode } from 'react';

/** 右侧抽屉（规范 5.5）：宽度 480px，多级下钻与返回 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="overlay-in absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="drawer-in absolute inset-y-0 right-0 flex flex-col border-l border-border-default shadow-2xl"
        style={{ width }}
        role="dialog"
        aria-label={typeof title === 'string' ? title : '详情'}
      >
        <header className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-text-secondary transition-colors hover:bg-panel-soft hover:text-text-primary"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && <footer className="border-t border-border-default p-3">{footer}</footer>}
      </div>
    </div>
  );
}
