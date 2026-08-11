import type { ReactNode } from 'react';

/** 面板容器（规范 5.3） */
export default function Panel({
  title,
  extra,
  children,
  className = '',
  height,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: string | number;
}) {
  return (
    <section
      className={`panel flex flex-col overflow-hidden ${className}`}
      style={height ? { height: typeof height === 'number' ? `${height}px` : height } : undefined}
    >
      {(title || extra) && (
        <header className="flex items-center justify-between border-b border-border-default px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="grad-brand h-3.5 w-1 rounded-full bg-primary" aria-hidden />
            {title}
          </h3>
          <div className="flex items-center gap-2">{extra}</div>
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}
