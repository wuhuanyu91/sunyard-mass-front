import { useEffect, useMemo, useState } from 'react';
import { Calculator, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { CostAllocateBy, CostKind, CostModelConfig } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { Segmented, Slider } from '../../components/ui/Controls';
import { BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const KIND_META: { key: CostKind; label: string; desc: string; color: string }[] = [
  { key: 'infra', label: '基础设施', desc: '硬件折旧/机房/电力/制冷/网络/存储', color: '#2d7be5' },
  { key: 'compute', label: '推理计算', desc: 'GPU 算力消耗/推理引擎运行', color: '#10b981' },
  { key: 'license', label: '软件许可', desc: '模型授权/平台与开源组件许可', color: '#f59e0b' },
  { key: 'external', label: '外部调用', desc: '公有云/第三方模型服务调用', color: '#ef4444' },
];

/** 九章：TCO 成本模型可配置（不能将单一分摊方式固化在系统中；财务口径由管理部门确认） */
export default function CostModelPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [cfg, setCfg] = useState<CostModelConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getCostModelConfig().then((c) => { setCfg(c); setDirty(false); });
  }, []);

  /** 归一化权重（合计恒为 100，末位补差） */
  const normWeights = useMemo(() => {
    if (!cfg) return null;
    const total = cfg.weights.infra + cfg.weights.compute + cfg.weights.license + cfg.weights.external || 1;
    const raw = KIND_META.map((k) => (cfg.weights[k.key] / total) * 100);
    const ints = raw.map((v) => Math.round(v));
    ints[3] += 100 - ints.reduce((s, v) => s + v, 0);
    return Object.fromEntries(KIND_META.map((k, i) => [k.key, ints[i]])) as Record<CostKind, number>;
  }, [cfg]);

  const todayTco = 684_000; // 与驾驶舱/计量台账同一口径（近 24h）
  const set = (patch: Partial<CostModelConfig>) => { if (cfg) { setCfg({ ...cfg, ...patch }); setDirty(true); } };

  const save = async () => {
    if (!cfg || !normWeights) return;
    const rec = await api.saveCostModelConfig({ ...cfg, weights: normWeights });
    notify.success(`成本模型已保存并下发（${rec.opId}）`);
    setDirty(false);
  };

  if (!cfg || !normWeights) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="成本模型"
        desc="TCO 四类成本权重与口径参数可配置，不固化单一分摊方式；保存后新口径同步至账单与大盘。"
      />
      <div className="grid grid-cols-12 gap-3">
      {/* 配置区：四类权重 + 口径参数 */}
      <Panel title="TCO 成本模型配置" className="col-span-7" extra={<span className="text-xs text-text-secondary">成本模型可配置，不固化单一分摊方式</span>}>
        <div className="flex flex-col gap-3.5">
          {KIND_META.map((k) => (
            <div key={k.key} className="rounded-lg border border-border-default bg-panel-soft px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-text-primary">
                  <span className="h-2 w-2 rounded-full" style={{ background: k.color }} /> {k.label}
                  <span className="font-normal text-text-secondary">（{k.desc}）</span>
                </span>
                <span className="num text-xs font-semibold text-primary">{normWeights[k.key]}%</span>
              </div>
              <Slider value={cfg.weights[k.key]} onChange={(v) => set({ weights: { ...cfg.weights, [k.key]: v } })} min={0} max={100} disabled={readOnly} />
            </div>
          ))}
          <p className="text-[11px] text-text-secondary/80">权重保存时自动归一为 100%（末位补差），驾驶舱 TCO 明细与月度账单分摊将同步采用此口径。</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-default bg-panel-soft px-3 py-2">
              <div className="mb-1.5 text-xs font-medium text-text-primary">硬件折旧年限</div>
              <Segmented
                options={[{ value: '3', label: '3 年' }, { value: '5', label: '5 年' }]}
                value={String(cfg.depreciationYears)}
                onChange={(v) => set({ depreciationYears: Number(v) })}
              />
              <p className="mt-1.5 text-[10px] text-text-secondary/70">影响基础设施类成本的年化分摊；监管类硬件按 5 年。</p>
            </div>
            <div className="rounded-lg border border-border-default bg-panel-soft px-3 py-2">
              <div className="mb-1.5 text-xs font-medium text-text-primary">外部租赁折算系数</div>
              <Slider value={cfg.rentalFactor} onChange={(v) => set({ rentalFactor: v })} min={1} max={2} step={0.05} marks={[1, 1.25, 1.5, 1.75, 2]} disabled={readOnly} />
              <p className="mt-1.5 text-[10px] text-text-secondary/70">租赁卡时成本 = 自建 × 系数，实现两类资源统一可比（自建 = 1.00）。</p>
            </div>
          </div>

          <div className="rounded-lg border border-border-default bg-panel-soft px-3 py-2">
            <div className="mb-1.5 text-xs font-medium text-text-primary">部门分摊基准</div>
            <Segmented
              options={[{ value: 'TOKEN', label: '按 Token' }, { value: 'CARD_HOUR', label: '按卡时' }, { value: 'CALLS', label: '按调用次数' }]}
              value={cfg.allocateBy}
              onChange={(v) => set({ allocateBy: v as CostAllocateBy })}
            />
            <p className="mt-1.5 text-[10px] text-text-secondary/70">基准决定部门 TCO 分摊结果：Token 反映实际消耗，卡时反映算力占用，调用次数适合轻量模型。</p>
          </div>
        </div>
      </Panel>

      {/* 预览区：今日拆分 + 租赁折算示例 + 保存 */}
      <div className="col-span-5 flex flex-col gap-3">
        <Panel title="今日 TCO 拆分预览（近 24h ¥684,000）" height={180}>
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            {KIND_META.map((k) => (
              <div key={k.key} style={{ width: `${normWeights[k.key]}%`, background: k.color }} title={`${k.label} ${normWeights[k.key]}%`} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {KIND_META.map((k) => (
              <div key={k.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: k.color }} /> {k.label}
                </span>
                <span className="num text-text-primary">¥{Math.round((todayTco * normWeights[k.key]) / 100).toLocaleString('zh-CN')}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-text-secondary/70">合计恒等于 ¥684,000；四类之和 = 今日预估 TCO（驾驶舱同口径）。</p>
        </Panel>

        <Panel title="自建 vs 外部租赁折算" height={150} extra={<span className="text-xs text-text-secondary">两类资源统一计量、可比</span>}>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Calculator size={13} className="shrink-0 text-primary" />
            租赁池（CloudA H20）94GB 卡时成本 = 自建 H20 × <span className="num font-semibold text-primary">{cfg.rentalFactor.toFixed(2)}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border-default bg-panel-soft px-2 py-2">
              <div className="text-[10px] text-text-secondary">自建卡时单价</div>
              <div className="num mt-0.5 text-sm font-semibold text-text-primary">¥32.5/h</div>
            </div>
            <div className="rounded-lg border border-border-default bg-panel-soft px-2 py-2">
              <div className="text-[10px] text-text-secondary">租赁折算单价</div>
              <div className="num mt-0.5 text-sm font-semibold text-warning">¥{(32.5 * cfg.rentalFactor).toFixed(1)}/h</div>
            </div>
            <div className="rounded-lg border border-border-default bg-panel-soft px-2 py-2">
              <div className="text-[10px] text-text-secondary">今日租赁卡时</div>
              <div className="num mt-0.5 text-sm font-semibold text-text-primary">{(7860 * 0.12).toFixed(0)}h</div>
            </div>
          </div>
        </Panel>

        <div className="panel flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">上次生效：{cfg.updatedAt.slice(0, 16).replace('T', ' ')}</span>
            {dirty && <span className="text-xs text-warning">有未下发的配置修改</span>}
          </div>
          <button
            onClick={save}
            disabled={!dirty || readOnly}
            className={`${BTN_PRIMARY} justify-center disabled:cursor-not-allowed disabled:opacity-40`}
            title={readOnly ? '只读模式下写操作已禁用' : '保存并下发新口径'}
          >
            <Save size={14} /> 保存并下发
          </button>
          <p className="text-[10px] leading-relaxed text-text-secondary/70">保存将写入审计留痕；驾驶舱 TCO 明细、月度账单分摊与运维大盘同步采用新口径。具体财务口径由管理部门确认。</p>
        </div>
      </div>
      </div>
    </div>
  );
}
