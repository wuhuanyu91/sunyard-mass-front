import { Inbox, AlertTriangle, Lock } from 'lucide-react';

/** 三类兜底态（规范 5.5 / 10.1） */
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-text-secondary">
      <Inbox size={36} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ErrorState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-danger">
      <AlertTriangle size={36} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
      {action}
    </div>
  );
}

export function NoPermissionState({ text = '当前角色无权限访问该页面' }: { text?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-text-secondary">
      <Lock size={36} strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}
