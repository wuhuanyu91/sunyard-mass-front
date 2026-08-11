import { getStatusMeta, TONE_CLASS } from './statusMap';
import type { StatusNs } from './statusMap';

/** 状态标签：颜色 + 图标 + 文字 同现（规范 10.2 禁止仅用颜色）；ns 用于同名枚举消歧 */
export default function StatusTag({ status, size = 'md', ns }: { status: string; size?: 'sm' | 'md'; ns?: StatusNs }) {
  const meta = getStatusMeta(status, ns);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-medium ${TONE_CLASS[meta.tone]} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm'
      }`}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {meta.label}
    </span>
  );
}
