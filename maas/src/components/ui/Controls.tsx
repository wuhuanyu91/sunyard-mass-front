import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { useApp } from '../../store/app';

/* ---------------- ToggleSwitch（44×24，readOnly 禁用） ---------------- */

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  const { readOnly } = useApp();
  const off = disabled || readOnly;
  return (
    <button
      role="switch"
      aria-checked={checked}
      title={readOnly ? '只读模式下写操作已禁用' : title}
      disabled={off}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border-default'} ${off ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

/* ---------------- Segmented（分段选择器） ---------------- */

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-border-default bg-bg-page p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-xs transition-colors ${value === o.value ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Slider（带数值气泡） ---------------- */

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  display,
  disabled,
  marks,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  display?: string; // 气泡展示文案（与原始值不同口径时使用，避免误解）
  disabled?: boolean;
  marks?: number[]; // 吸附档位
}) {
  const snap = (v: number) => {
    if (!marks || marks.length === 0) return v;
    return marks.reduce((best, m) => (Math.abs(m - v) < Math.abs(best - v) ? m : best), marks[0]);
  };
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(snap(Number(e.target.value)))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border-default accent-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="num w-16 shrink-0 rounded border border-border-default bg-bg-page px-1.5 py-0.5 text-center text-xs text-primary">
        {display ?? `${value}${unit}`}
      </span>
    </div>
  );
}

/* ---------------- Stepper（数字步进） ---------------- */

export function Stepper({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  const { readOnly } = useApp();
  const off = disabled || readOnly;
  return (
    <div className="flex items-center gap-1">
      <button
        disabled={off || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-7 w-7 rounded border border-border-default text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        title={readOnly ? '只读模式下写操作已禁用' : '减少'}
      >
        −
      </button>
      <span className="num w-10 text-center text-sm text-text-primary">{value}</span>
      <button
        disabled={off || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-7 w-7 rounded border border-border-default text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        title={readOnly ? '只读模式下写操作已禁用' : '增加'}
      >
        +
      </button>
    </div>
  );
}

/* ---------------- CopyButton ---------------- */

export function CopyButton({ text, title = '复制' }: { text: string; title?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1500);
    return () => clearTimeout(t);
  }, [ok]);
  return (
    <button
      title={title}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setOk(true);
      }}
      className={`rounded p-1 transition-colors ${ok ? 'text-success' : 'text-text-secondary hover:text-text-primary'}`}
      aria-label={title}
    >
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ---------------- Tabs（二级 Tab 容器，支持 badge） ---------------- */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; badge?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border-default" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm transition-colors ${
            active === t.key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-black">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
