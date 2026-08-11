import { useEffect, useState } from 'react';
import { Waypoints, LogIn, ScanSearch, ShieldCheck, Scale, Gauge, Network, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { RoutingEngineConfig } from '../../types';
import Panel from '../../components/ui/Panel';
import { Slider, ToggleSwitch } from '../../components/ui/Controls';
import { BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const STAGES = [
  { icon: LogIn, label: 'OpenAI 兼容接入', desc: '上层应用零改造' },
  { icon: ScanSearch, label: '业务识别', desc: '场景/任务/数据等级' },
  { icon: ShieldCheck, label: '安全鉴权', desc: '护栏前置校验' },
  { icon: Scale, label: '多约束评分', desc: '四维权重选模' },
  { icon: Gauge, label: '限流/熔断', desc: 'QPS+Token 双维' },
  { icon: Network, label: '智能派发', desc: '异常自动降级' },
];

const WEIGHT_LABEL: Record<keyof RoutingEngineConfig['weights'], string> = {
  latency: '时延',
  cost: '成本',
  risk: '风险',
  load: '负载',
};

/** 多约束路由引擎配置中心（突出智能网关核心能力：评分权重 + 路由策略全部可配置） */
export default function RoutingEnginePanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [cfg, setCfg] = useState<RoutingEngineConfig | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getRoutingEngine().then(setCfg);
  }, []);

  if (!cfg) return null;

  const total = cfg.weights.latency + cfg.weights.cost + cfg.weights.risk + cfg.weights.load || 1;
  const pct = (k: keyof RoutingEngineConfig['weights']) => Math.round((cfg.weights[k] / total) * 100);

  const setWeight = (k: keyof RoutingEngineConfig['weights'], v: number) => {
    setCfg({ ...cfg, weights: { ...cfg.weights, [k]: v } });
    setDirty(true);
  };

  const setFlag = (k: 'cacheFirst' | 'budgetGuard' | 'slaPriority' | 'autoFallback' | 'openaiCompat', v: boolean) => {
    setCfg({ ...cfg, [k]: v });
    setDirty(true);
  };

  const save = async () => {
    await api.saveRoutingEngine(cfg);
    setDirty(false);
    notify.success('路由引擎配置已保存，分钟级下发全部网关节点（已写入审计日志）');
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Waypoints size={15} className="text-primary" /> 多约束路由引擎 · 配置中心
        </span>
      }
      extra={
        <button onClick={save} disabled={readOnly || !dirty} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : dirty ? '保存并下发' : '无修改'}>
          <Save size={12} /> 保存并下发
        </button>
      }
    >
      {/* 路由流水线（六段式处理链路） */}
      <div className="mb-4 flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className="group relative min-w-32 flex-1 rounded-lg border border-border-default bg-panel-soft px-3 py-2 transition-colors hover:border-primary/50">
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className="text-primary" />
                  <span className="text-xs font-medium text-text-primary">{s.label}</span>
                  <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-success" title="运行中" />
                </div>
                <p className="mt-0.5 text-[10px] text-text-secondary">{s.desc}</p>
              </div>
              {i < STAGES.length - 1 && <span className="text-xs text-text-secondary/50">→</span>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 四维评分权重 */}
        <div className="rounded-lg border border-border-default bg-panel-soft p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-primary">候选模型评分权重（自动归一化）</span>
            <span className="text-[10px] text-text-secondary">影响每一次路由决策的模型选择</span>
          </div>
          <div className="space-y-2.5">
            {(Object.keys(WEIGHT_LABEL) as (keyof RoutingEngineConfig['weights'])[]).map((k) => (
              <div key={k}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{WEIGHT_LABEL[k]}权重</span>
                  <span className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${pct(k) >= 30 ? 'bg-primary/15 text-primary' : 'bg-panel text-text-secondary'}`}>{pct(k)}%</span>
                </div>
                <Slider value={cfg.weights[k]} onChange={(v) => setWeight(k, v)} min={0} max={50} disabled={readOnly} />
              </div>
            ))}
          </div>
        </div>

        {/* 路由策略开关 */}
        <div className="rounded-lg border border-border-default bg-panel-soft p-3">
          <div className="mb-2 text-xs font-medium text-text-primary">路由策略开关</div>
          <div className="space-y-2">
            <FlagRow label="缓存优先" desc="命中 KV Cache 的实例优先派发，降低重复计算成本" checked={cfg.cacheFirst} onChange={(v) => setFlag('cacheFirst', v)} />
            <FlagRow label="成本预算约束" desc="超出 budgetClass 预算的候选模型降权/剔除" checked={cfg.budgetGuard} onChange={(v) => setFlag('budgetGuard', v)} />
            <FlagRow label="SLA 优先" desc="P0/P1 关键业务独享资源预留，不被低优任务挤占" checked={cfg.slaPriority} onChange={(v) => setFlag('slaPriority', v)} />
            <FlagRow label="自动降级" desc="主模型异常自动切备用/小模型，全程留痕可追溯" checked={cfg.autoFallback} onChange={(v) => setFlag('autoFallback', v)} />
            <FlagRow label="OpenAI 兼容入口" desc="标准 /v1/chat/completions 接口，上层应用零改造切模型" checked={cfg.openaiCompat} onChange={(v) => setFlag('openaiCompat', v)} />
          </div>
        </div>
      </div>
      {dirty && <p className="mt-2 text-[11px] text-warning">有未下发的配置修改 —— 保存后分钟级生效，并写入审计日志</p>}
    </Panel>
  );
}

function FlagRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border-default bg-bg-page px-2.5 py-1.5">
      <div className="min-w-0">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <p className="truncate text-[10px] text-text-secondary">{desc}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
