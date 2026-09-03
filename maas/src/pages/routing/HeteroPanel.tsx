import { useEffect, useState } from 'react';
import { Cpu, Save, ServerCog } from 'lucide-react';
import { api } from '../../services/api';
import type { HeteroSchedPolicy, HeteroVendor } from '../../types';
import Panel from '../../components/ui/Panel';
import { ToggleSwitch } from '../../components/ui/Controls';
import { BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const COMPAT_LABEL: Record<HeteroVendor['compatStatus'], { label: string; cls: string }> = {
  COMPATIBLE: { label: '已适配', cls: 'bg-success/10 text-success' },
  ADAPTING: { label: '适配中', cls: 'bg-warning/10 text-warning' },
  PLANNED: { label: '规划引入', cls: 'bg-border-default/40 text-text-secondary' },
};

const COST_LABEL: Record<HeteroVendor['costTag'], { label: string; cls: string }> = {
  LOW: { label: '低成本', cls: 'text-success' },
  MID: { label: '中成本', cls: 'text-warning' },
  HIGH: { label: '高成本', cls: 'text-danger' },
};

function utilTone(u: number) {
  if (u >= 85) return 'bg-danger';
  if (u >= 70) return 'bg-warning';
  return 'bg-primary';
}

/** 异构算力厂商资源矩阵（13.4：英伟达/华为昇腾/沐曦/Intel 统一纳管视图） */
export function HeteroMatrix() {
  const [vendors, setVendors] = useState<HeteroVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHeteroVendors().then((v) => {
      setVendors(v);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="panel h-52 animate-pulse" />;

  const domesticCount = vendors.filter((v) => v.domestic).reduce((s, v) => s + v.count, 0);
  const totalCount = vendors.reduce((s, v) => s + v.count, 0);

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <ServerCog size={15} className="text-primary" /> 异构算力资源矩阵（多厂商统一纳管）
        </span>
      }
      extra={
        <span className="num text-xs text-text-secondary">
          {totalCount} 卡/节点 · 国产化 {domesticCount}（{Math.round((domesticCount / totalCount) * 100)}%）
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2.5">
        {vendors.map((v) => (
          <div key={v.vendorId} className="rounded-lg border border-border-default bg-panel-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                {v.kind === 'CPU' ? <Cpu size={14} className="text-text-secondary" /> : <ServerCog size={14} className="text-primary" />}
                {v.vendor} <span className="text-xs text-text-secondary">{v.chip}</span>
              </span>
              <span className="flex items-center gap-1">
                {v.domestic && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">国产</span>}
                <span className="rounded bg-bg-page px-1.5 py-0.5 text-[10px] text-text-secondary">{v.kind}</span>
              </span>
            </div>
            {/* 利用率 */}
            <div className="mt-2.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-text-secondary">利用率</span>
                <span className="num text-text-primary">{v.utilization}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-default/50">
                <div className={`h-full rounded-full ${utilTone(v.utilization)}`} style={{ width: `${v.utilization}%` }} />
              </div>
            </div>
            {/* 指标行 */}
            <div className="num mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
              <div className="rounded bg-bg-page px-1 py-1">
                <div className="font-semibold text-text-primary">{v.count}</div>
                <div className="text-text-secondary">{v.kind === 'CPU' ? '节点' : '卡'}</div>
              </div>
              <div className="rounded bg-bg-page px-1 py-1">
                <div className="font-semibold text-text-primary">{v.vramPerCard > 0 ? `${v.vramPerCard}G` : '—'}</div>
                <div className="text-text-secondary">显存/卡</div>
              </div>
              <div className="rounded bg-bg-page px-1 py-1">
                <div className="font-semibold text-text-primary">{v.hostedModels}</div>
                <div className="text-text-secondary">承载模型</div>
              </div>
            </div>
            {/* 状态行 */}
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className={`rounded px-1.5 py-0.5 ${COMPAT_LABEL[v.compatStatus].cls}`}>{COMPAT_LABEL[v.compatStatus].label}</span>
              <span className={COST_LABEL[v.costTag].cls}>{COST_LABEL[v.costTag].label}</span>
              <span className="font-mono text-text-secondary/70">{v.pools.join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-text-secondary/70">按厂商×芯片聚合纳管，调度以模型兼容关系与实测数据为依据，不做无差别互换；国产化资源（昇腾/沐曦）独立适配跟踪。</p>
    </Panel>
  );
}

/** 异构调度策略配置（国产化优先/跨厂商迁移/租赁削峰） */
export function HeteroSchedPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [policy, setPolicy] = useState<HeteroSchedPolicy | null>(null);
  const [vendors, setVendors] = useState<HeteroVendor[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Promise.all([api.getHeteroSchedPolicy(), api.getHeteroVendors()]).then(([p, v]) => {
      setPolicy(p);
      setVendors(v);
    });
  }, []);

  if (!policy) return null;

  const setFlag = (k: 'domesticFirst' | 'crossVendorFailover' | 'rentalPeak', v: boolean) => {
    setPolicy({ ...policy, [k]: v });
    setDirty(true);
  };

  const save = async () => {
    await api.saveHeteroSchedPolicy(policy);
    setDirty(false);
    notify.success('异构调度策略已保存，分钟级下发算力调度器（已写入审计日志）');
  };

  return (
    <Panel
      title="异构调度策略（厂商级）"
      extra={
        <button onClick={save} disabled={readOnly || !dirty} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : dirty ? '保存并下发' : '无修改'}>
          <Save size={12} /> 保存并下发
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <PolicyFlag label="国产化优先" desc="同等条件下优先调度昇腾 / 沐曦资源，支撑信创考核口径" checked={policy.domesticFirst} onChange={(v) => setFlag('domesticFirst', v)} />
          <PolicyFlag label="跨厂商故障迁移" desc="单厂商集群故障时，按兼容矩阵自动迁移至其他厂商资源池" checked={policy.crossVendorFailover} onChange={(v) => setFlag('crossVendorFailover', v)} />
          <PolicyFlag label="峰值租赁削峰" desc="本地利用率超阈值时自动启用租赁池补充（成本单独计量）" checked={policy.rentalPeak} onChange={(v) => setFlag('rentalPeak', v)} />
        </div>
        <div className="rounded-lg border border-border-default bg-panel-soft p-3">
          <div className="mb-2 text-xs font-medium text-text-primary">厂商调度优先级（高 → 低）</div>
          <div className="space-y-1.5">
            {policy.vendorPriority.map((id, i) => {
              const v = vendors.find((x) => x.vendorId === id);
              if (!v) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-primary/15 text-primary' : 'bg-panel text-text-secondary'}`}>{i + 1}</span>
                  <span className="text-text-primary">{v.vendor} {v.chip}</span>
                  {v.domestic && <span className="rounded bg-danger/10 px-1 text-[10px] text-danger">国产</span>}
                  <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${COMPAT_LABEL[v.compatStatus].cls}`}>{COMPAT_LABEL[v.compatStatus].label}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-text-secondary/70">适配中厂商仅承接已验证模型；优先级调整需结合适配状态评估。</p>
        </div>
      </div>
      {dirty && <p className="mt-2 text-[11px] text-warning">有未下发的策略修改 —— 保存后分钟级生效，并写入审计日志</p>}
    </Panel>
  );
}

function PolicyFlag({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-default bg-panel-soft px-2.5 py-2">
      <div className="min-w-0">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <p className="truncate text-[10px] text-text-secondary">{desc}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
