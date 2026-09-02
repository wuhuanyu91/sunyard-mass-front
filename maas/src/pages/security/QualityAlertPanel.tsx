import { useEffect, useState } from 'react';
import { BellRing, Pencil, Plus } from 'lucide-react';
import { api } from '../../services/api';
import type { QualityAlertRule } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { Modal, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { ToggleSwitch, Segmented } from '../../components/ui/Controls';
import { Field, INPUT_CLS } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const METRIC_LABEL: Record<QualityAlertRule['metric'], string> = {
  P95: 'P95 时延',
  ERROR_RATE: '错误率',
  QUEUE: '队列深度',
  CALL_SPIKE: '调用量突增',
};

/** P0-4 调用质量告警规则（对标百炼观测与告警：自定义规则 + 通知渠道） */
export default function QualityAlertPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [rules, setRules] = useState<QualityAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ data: QualityAlertRule | null } | null>(null);

  const reload = () => api.getQualityAlertRules().then((r) => { setRules(r); setLoading(false); });
  useEffect(() => {
    reload();
  }, []);

  if (loading) return <div className="panel h-52 animate-pulse" />;

  return (
    <div className="mock-data flex flex-col gap-3">
      <PageHeader crumb="安全审计" title="告警规则" desc="调用质量告警规则配置，触发后联动安全态势风险队列与通知渠道" />
      <Panel
      title={
        <span className="flex items-center gap-1.5">
          <BellRing size={14} className="text-warning" /> 调用质量告警规则
        </span>
      }
      extra={
        <div className="flex items-center gap-2">
          <span className="num text-xs text-text-secondary">{rules.filter((r) => r.enabled).length}/{rules.length} 已启用 · 近 24h 触发 {rules.reduce((s, r) => s + r.hits24h, 0)} 次</span>
          <button disabled={readOnly} onClick={() => setDialog({ data: null })} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
            <Plus size={12} /> 新建规则
          </button>
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">规则</th>
            <th className="pb-2 font-medium">监控指标</th>
            <th className="pb-2 font-medium">阈值</th>
            <th className="pb-2 font-medium">通知渠道</th>
            <th className="pb-2 font-medium">近 24h 触发</th>
            <th className="pb-2 font-medium">启用</th>
            <th className="pb-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.ruleId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
              <td className="py-2 text-text-primary">{r.name}</td>
              <td className="py-2">
                <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">{METRIC_LABEL[r.metric]}</span>
              </td>
              <td className="num py-2">{r.threshold.toLocaleString()} {r.unit}</td>
              <td className="py-2 text-xs text-text-secondary">{r.channels.join(' / ')}</td>
              <td className="num py-2">{r.hits24h > 0 ? <span className="text-warning">{r.hits24h} 次</span> : <span className="text-text-secondary/60">0</span>}</td>
              <td className="py-2">
                <ToggleSwitch
                  checked={r.enabled}
                  onChange={async () => {
                    await api.toggleQualityAlertRule(r.ruleId);
                    notify.success(`告警规则「${r.name}」已${r.enabled ? '停用' : '启用'}`);
                    reload();
                  }}
                />
              </td>
              <td className="py-2 text-right">
                <button disabled={readOnly} onClick={() => setDialog({ data: r })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑">
                  <Pencil size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-secondary/70">告警与安全态势页联动，触发后进入风险告警列表并推送对应渠道；与成本预警（计量页）共同构成运营双预警。</p>

      {dialog && <RuleDialog initial={dialog.data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
      </Panel>
    </div>
  );
}

function RuleDialog({ initial, onClose, onSaved }: { initial: QualityAlertRule | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState(initial?.name ?? '');
  const [metric, setMetric] = useState<QualityAlertRule['metric']>(initial?.metric ?? 'P95');
  const [threshold, setThreshold] = useState(String(initial?.threshold ?? 1200));
  const [channels, setChannels] = useState<QualityAlertRule['channels']>(initial?.channels ?? ['SITE']);

  const unit = metric === 'P95' ? 'ms' : metric === 'ERROR_RATE' ? '%' : metric === 'QUEUE' ? '任务' : '倍';
  const nameOk = name.trim().length >= 2 && name.trim().length <= 30;
  const thNum = Number(threshold);
  const thOk = /^\d+(\.\d+)?$/.test(threshold) && thNum > 0;
  const invalid = !nameOk || !thOk || channels.length === 0;
  const toggle = (c: 'SITE' | 'MAIL' | 'SMS') => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={initial ? `编辑告警规则 · ${initial.name}` : '新建告警规则'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.saveQualityAlertRule({
                ruleId: initial?.ruleId ?? '',
                name: name.trim(),
                metric,
                threshold: thNum,
                unit,
                enabled: initial?.enabled ?? true,
                channels,
                hits24h: initial?.hits24h ?? 0,
              });
              notify.success(`告警规则「${name.trim()}」已保存`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="规则名称" required error={name ? (!nameOk ? '2~30 字' : '') : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：P95 时延超标" />
        </Field>
        <Field label="监控指标" required>
          <Segmented
            options={[
              { value: 'P95', label: 'P95 时延' },
              { value: 'ERROR_RATE', label: '错误率' },
              { value: 'QUEUE', label: '队列深度' },
              { value: 'CALL_SPIKE', label: '调用突增' },
            ]}
            value={metric}
            onChange={(v) => setMetric(v as QualityAlertRule['metric'])}
          />
        </Field>
        <Field label={`阈值（${unit}）`} required error={threshold && !thOk ? '需为正数' : ''}>
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
        </Field>
        <Field label="通知渠道" required error={channels.length === 0 ? '至少选择 1 个渠道' : ''}>
          <div className="flex gap-2">
            {([
              ['SITE', '站内信'],
              ['MAIL', '邮件'],
              ['SMS', '短信'],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded border border-border-default bg-bg-page px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input type="checkbox" checked={channels.includes(v)} onChange={() => toggle(v)} className="accent-[#2d7be5]" />
                {label}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
