import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Server, Cpu, Gauge, AlertTriangle, Layers } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { BatchPoint, ComputeResource } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { HeteroMatrix } from './HeteroPanel';

const fmt = (n: number) => n.toLocaleString('zh-CN');

const CHART_TOOLTIP = {
  contentStyle: { background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.55)' },
  labelStyle: { color: 'var(--color-text-secondary)' },
  itemStyle: { color: 'var(--color-text-primary)' },
};

/** 6.4 弹性算力中心 · 算力总览（看板：优化收益 / 异构纳管 / 吞吐趋势；节点·集群·队列管理在左侧子菜单） */
export default function ComputePanel() {
  const [resources, setResources] = useState<ComputeResource[]>([]);
  const [batch, setBatch] = useState<BatchPoint[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getResources(), api.getBatchTrend(), api.getSummary()]).then(([r, b, su]) => {
      setResources(r);
      setBatch(b);
      setSummary(su);
      setLoading(false);
    });
  }, []);

  const kpi = useMemo(() => {
    const queueDepth = resources.reduce((s, r) => s + r.queueDepth, 0);
    const s = summary ?? { nodes: 0, pools: 0, gpuUtil: 0, cacheHitRate: 0 };
    return { nodes: s.nodes, pools: s.pools, avgUtil: s.gpuUtil, queueDepth, avgCache: s.cacheHitRate, rental: 24, local: s.nodes - 24 };
  }, [resources, summary]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="调度算力" title="算力总览" desc="弹性算力运行总览：优化收益、异构纳管矩阵与吞吐趋势；节点/集群/队列管理见左侧子菜单" />

      {/* 弹性算力优化收益总览（突出管控一体化能力成果） */}
      <div className="grid grid-cols-4 gap-3">
        <div className="panel p-3.5">
          <div className="flex items-center justify-between text-xs text-text-secondary"><span>GPU 平均利用率</span><span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">优化后 +18pct</span></div>
          <div className="num mt-1.5 text-xl font-semibold text-primary">{kpi.avgUtil}%</div>
          <p className="mt-0.5 text-[11px] text-text-secondary">连续批处理 + 错峰调度 + 混部综合收益</p>
        </div>
        <div className="panel p-3.5">
          <div className="flex items-center justify-between text-xs text-text-secondary"><span>vGPU 切分承载能力</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">1% 算力粒度</span></div>
          <div className="num mt-1.5 text-xl font-semibold text-success">8×+</div>
          <p className="mt-0.5 text-[11px] text-text-secondary">单卡承载模型数提升；3 卡需求 → 1~2 卡承载</p>
        </div>
        <div className="panel p-3.5">
          <div className="flex items-center justify-between text-xs text-text-secondary"><span>KV 缓存命中</span><span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">语义感知调度</span></div>
          <div className="num mt-1.5 text-xl font-semibold text-warning">{kpi.avgCache}%</div>
          <p className="mt-0.5 text-[11px] text-text-secondary">命中率 25%→50%+，折合日省算力成本 ≈ ¥12,400</p>
        </div>
        <div className="panel p-3.5">
          <div className="flex items-center justify-between text-xs text-text-secondary"><span>削峰填谷 · 弹性补充</span><span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">租赁池 {kpi.rental} 节点</span></div>
          <div className="num mt-1.5 text-xl font-semibold text-text-primary">3×峰值</div>
          <p className="mt-0.5 text-[11px] text-text-secondary">3 倍峰值下成功率 95%+；批量任务错峰排队</p>
        </div>
      </div>

      {/* 异构算力厂商矩阵（13.4：英伟达/昇腾/沐曦/Intel 统一纳管） */}
      <HeteroMatrix />

      {/* 算力资源总览（6.4.2 KpiRow） */}
      <div className="grid grid-cols-5 gap-3">
        <Kpi icon={<Server size={15} />} label="纳管节点" value={`${kpi.nodes}`} unit={`个 · ${kpi.pools} 池`} hint="GPU/CPU/NPU/租赁 全量纳管节点" tone="text-primary" />
        <Kpi icon={<Gauge size={15} />} label="GPU 平均利用率" value={`${kpi.avgUtil}`} unit="%" hint="时间加权利用率（非显存占用，8.1）" tone={kpi.avgUtil > 85 ? 'text-danger' : 'text-primary'} />
        <Kpi icon={<AlertTriangle size={15} />} label="队列深度" value={fmt(kpi.queueDepth)} unit="任务" hint="全局排队任务数（含 P0 挤压）" tone={kpi.queueDepth > 20 ? 'text-warning' : 'text-text-primary'} />
        <Kpi icon={<Cpu size={15} />} label="缓存命中率" value={`${kpi.avgCache}`} unit="%" hint="Token 级命中率（8.1）" tone="text-success" />
        <Kpi icon={<Layers size={15} />} label="本地 / 租赁" value={`${kpi.local} / ${kpi.rental}`} unit="节点" hint="costTag 分组：LOCAL/RENTAL" tone="text-text-primary" />
      </div>

      {/* 批处理与缓存看板（6.4.5：双图联动，同一时间窗） */}
      <div className="grid grid-cols-2 gap-3">
        <Panel title="批处理吞吐与批大小（近 24h）" height={240} extra={<span className="text-xs text-text-secondary">吞吐提升是否牺牲首字时延 → 右图</span>}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={batch} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border-default)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar yAxisId="right" dataKey="batchSize" name="平均批大小" fill="#2d7be5" fillOpacity={0.35} barSize={8} />
              <Line yAxisId="left" type="monotone" dataKey="throughput" name="吞吐 tokens/s" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="TTFT P50 与批大小联动（近 24h）" height={240} extra={<span className="text-xs text-text-secondary">批大小升高 → TTFT 是否恶化</span>}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={batch} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border-default)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar yAxisId="right" dataKey="batchSize" name="平均批大小" fill="#f59e0b" fillOpacity={0.3} barSize={8} />
              <Line yAxisId="left" type="monotone" dataKey="ttftMs" name="TTFT P50 ms" stroke="#ef4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  unit,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="panel flex items-center gap-3 p-3" title={hint}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-current/20 bg-current/5 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-text-secondary">{label}</div>
        <div className={`num text-xl font-semibold leading-tight ${tone}`}>
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-text-secondary">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
