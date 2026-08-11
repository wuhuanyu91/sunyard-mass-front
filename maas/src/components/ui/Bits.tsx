import { useEffect, useRef, useState, type ReactNode } from 'react';
import { History } from 'lucide-react';
import type { OperationRecord } from '../../types';

/* ---------------- QuotaBar（配额进度条：<80% 蓝 / 80-100% 黄 / 超限红） ---------------- */

const fmtNum = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return n.toLocaleString('zh-CN');
};

export function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const over = pct > 100;
  const warn = pct >= 80 && !over;
  const color = over ? 'bg-danger' : warn ? 'bg-warning' : 'bg-primary';
  return (
    <div className="min-w-28" title={`已用 ${fmtNum(used)} / 总额 ${fmtNum(total)}（${pct.toFixed(1)}%）`}>
      <div className="flex items-center justify-between text-xs">
        <span className="num text-text-secondary">
          {fmtNum(used)} / {fmtNum(total)}
        </span>
        {over ? (
          <span className="rounded bg-danger/15 px-1 text-[10px] font-bold text-danger">已超限</span>
        ) : (
          <span className={`num ${warn ? 'text-warning' : 'text-text-secondary'}`}>{pct.toFixed(0)}%</span>
        )}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-default/60">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/* ---------------- StepBar（五步条） ---------------- */

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={s} className="flex items-center">
            {i > 0 && <span className={`mx-2 h-px w-10 ${done || active ? 'bg-primary/60' : 'bg-border-default'}`} aria-hidden />}
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                  done
                    ? 'border-success/60 bg-success/15 text-success'
                    : active
                      ? 'animate-pulse border-primary bg-primary/20 text-primary'
                      : 'border-border-default bg-panel-soft text-text-secondary'
                }`}
              >
                {done ? '✓' : n}
              </span>
              <span className={`text-xs ${active ? 'font-medium text-primary' : done ? 'text-success' : 'text-text-secondary'}`}>{s}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- TagEditor（回车/逗号生成 chip，支持校验） ---------------- */

export function TagEditor({
  tags,
  onChange,
  placeholder = '输入后回车添加',
  validate,
  disabled,
  max,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  validate?: (v: string) => string | null; // 返回错误文案则拒绝添加
  disabled?: boolean;
  max?: number;
}) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');

  const add = () => {
    const v = input.trim().replace(/[,，]$/, '');
    if (!v) return;
    if (tags.includes(v)) {
      setErr('已存在重复项');
      return;
    }
    if (max && tags.length >= max) {
      setErr(`最多 ${max} 条`);
      return;
    }
    const msg = validate?.(v);
    if (msg) {
      setErr(msg);
      return;
    }
    setErr('');
    onChange([...tags, v]);
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-border-default bg-bg-page p-1.5">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
            {t}
            {!disabled && (
              <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-primary/60 hover:text-danger" aria-label={`移除 ${t}`}>
                ✕
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setErr('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="min-w-24 flex-1 bg-transparent px-1 py-0.5 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/50"
          />
        )}
      </div>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

/* ---------------- OperationTimeline（操作留痕） ---------------- */

export function OperationTimeline({ records, title = '操作留痕' }: { records: OperationRecord[]; title?: string }) {
  if (records.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <History size={13} /> {title}（最新在上）
      </div>
      <div className="max-h-56 space-y-0 overflow-auto rounded border border-border-default bg-panel-soft p-3">
        {records.map((r, i) => (
          <div key={r.opId} className="relative flex gap-2.5 pb-3 last:pb-0">
            {i < records.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border-default" aria-hidden />}
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border-default'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-text-primary">
                  {r.opType} · <span className="font-mono text-primary">{r.targetId}</span>
                </span>
                <span className="num shrink-0 text-text-secondary">
                  {new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-text-secondary">{r.detail} —— {r.operator}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 表单字段包装 + 输入框样式 ---------------- */

export const INPUT_CLS = 'w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50';
export const SELECT_CLS = 'w-full rounded border border-border-default bg-bg-page px-2.5 py-2 text-sm text-text-primary outline-none focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50';

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-text-secondary">
        {required && <span className="text-danger">*</span>}
        {label}
        {hint && <span className="text-text-secondary/60">（{hint}）</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ---------------- 评分星（模型广场） ---------------- */

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="num inline-flex items-center gap-0.5 text-xs text-warning" title={`评分 ${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? '' : 'opacity-25'}>★</span>
      ))}
      <span className="ml-1 text-text-secondary">{rating.toFixed(1)}</span>
    </span>
  );
}

/* ---------------- 进度环（倒计时/进度模拟） ---------------- */

export function ProgressBar({ pct, tone = 'primary' }: { pct: number; tone?: 'primary' | 'danger' | 'success' }) {
  const color = tone === 'danger' ? 'bg-danger' : tone === 'success' ? 'bg-success' : 'bg-primary';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-default/60">
      <div className={`h-full rounded-full transition-all duration-200 ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** 简易倒计时 hook（秒） */
export function useCountdown(): [number, (sec: number) => void] {
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = (sec: number) => {
    if (timer.current) clearInterval(timer.current);
    setLeft(sec);
    timer.current = setInterval(() => {
      setLeft((v) => {
        if (v <= 1 && timer.current) clearInterval(timer.current);
        return Math.max(0, v - 1);
      });
    }, 1000);
  };
  return [left, start];
}
