import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

/** 弹窗基座（Esc 关闭 + 遮罩点击关闭） */
export function Modal({
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="overlay-in absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={typeof title === 'string' ? title : '弹窗'}
        className="modal-in relative flex max-h-[85vh] flex-col rounded-xl border border-border-default shadow-2xl"
        style={{ width }}
      >
        <header className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="rounded px-2 py-1 text-text-secondary transition-colors hover:bg-panel-soft hover:text-text-primary" aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border-default px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmDialog（完善方案 1.1：info / warning / danger 三级）          */
/* ------------------------------------------------------------------ */

export type ConfirmLevel = 'info' | 'warning' | 'danger';

const LEVEL_META: Record<ConfirmLevel, { icon: typeof Info; cls: string; btn: string }> = {
  info: { icon: Info, cls: 'text-primary', btn: 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/40' },
  warning: { icon: AlertTriangle, cls: 'text-warning', btn: 'bg-warning/15 text-warning hover:bg-warning/25 border border-warning/40' },
  danger: { icon: ShieldAlert, cls: 'text-danger', btn: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/40' },
};

export function ConfirmDialog({
  open,
  level = 'warning',
  title,
  message,
  confirmText = '确认执行',
  /** danger 级：需输入该词才可确认 */
  confirmWord,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  level?: ConfirmLevel;
  title: string;
  message: ReactNode;
  confirmText?: string;
  confirmWord?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const [ack, setAck] = useState(false);
  const [word, setWord] = useState('');

  useEffect(() => {
    if (open) {
      setAck(false);
      setWord('');
    }
  }, [open]);

  const meta = LEVEL_META[level];
  const Icon = meta.icon;
  const blocked = level === 'warning' ? !ack : level === 'danger' && confirmWord ? word !== confirmWord : false;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      width={440}
      title={
        <span className={`flex items-center gap-2 ${meta.cls}`}>
          <Icon size={16} /> {title}
        </span>
      }
      footer={
        <>
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary">
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={blocked || loading}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${meta.btn}`}
          >
            {loading ? '执行中…' : confirmText}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
        <div>{message}</div>
        {level === 'warning' && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-warning">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#f59e0b]" />
            我已知晓上述影响
          </label>
        )}
        {level === 'danger' && confirmWord && (
          <div>
            <p className="mb-1.5 text-xs">请输入 <b className="font-mono text-danger">{confirmWord}</b> 以确认执行：</p>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-danger/60"
              placeholder={confirmWord}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 按钮样式常量（全站统一）                                             */
/* ------------------------------------------------------------------ */

export const BTN_PRIMARY = 'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_GHOST = 'rounded-md border border-border-default bg-bg-panel px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-panel-soft hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_DANGER = 'rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_SUCCESS = 'rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-40';
