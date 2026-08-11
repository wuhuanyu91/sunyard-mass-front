import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowLeft, Database, Gauge, ServerCog, ShieldAlert, Zap } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { BatchPoint, CircuitBreaker, ComputeResource, HeatCell, Instance, KvCacheGovernance, PriorityQueueItem } from '../../types';
import Panel from '../../components/ui/Panel';
import { useApp } from '../../store/app';

const fmtWan = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return n.toLocaleString('zh-CN');
};

const CHART_TOOLTIP = {
  contentStyle: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-text-primary)',
    boxShadow: '0 8px 24px -12px rgba(0,0,0,0.55)',
  },
  labelStyle: { color: 'var(--color-text-secondary)' },
  itemStyle: { color: 'var(--color-text-primary)' },
};

const ENGINE_LABEL: Record<string, string> = { VLLM: 'vLLM', SGLANG: 'SGLang', OTHER: '自研/其他' };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  RUNNING: { label: '运行', cls: 'bg-success/10 text-success' },
  MAINTENANCE: { label: '维护', cls: 'bg-warning/10 text-warning' },
  OFFLINE: { label: '离线', cls: 'bg-border-default/40 text-text-secondary' },
};
const CB_TONE: Record<string, string> = { OPEN: 'bg-danger/10 text-danger', HALF_OPEN: 'bg-warning/10 text-warning', CLOSED: 'bg-success/10 text-success' };

/** 运维大盘（九章：面向技术团队，与管理驾驶舱共用同一套底层数据口径） */
export default function OpsDashboard() {
  const { readOnly } = useApp();
  const [, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [resources, setResources] = useState<ComputeResource[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [queue, setQueue] = useState<PriorityQueueItem[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [kv, setKv] = useState<KvCacheGovernance | null>(null);
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [batch, setBatch] = useState<BatchPoint[]>([]);
  const [trend, setTrend] = useState<{ t: string; gpuUtil: number; ttftP50: number; avgP95: number }[]>([]);

  useEffect(() => {
    Promise.all([
      api.getSummary(),
      api.getResources(),
      api.getInstances(),
      api.getQueueData(),
      api.getHeatmapData(),
      api.getKvGovernance(),
      api.getCircuitBreakers(),
      api.getBatchTrend(),
      api.getTrendSeries(),
    ]).then(([su, rs, is, qu, he, kv_, cb, ba, tr]) => {
      setSummary(su);
      setResources(rs);
      setInstances(is);
      setQueue(qu);
      setHeat(he);
      setKv(kv_);
      setBreakers(cb);
      setBatch(ba);
      setTrend(tr);
      setLoading(false);
    });
  }, []);

  /* ---------------- 派生指标（与驾驶舱同一来源，运维视角聚合） ---------------- */
  const nodeStat = useMemo(() => {
    const byStatus: Record<string, number> = { RUNNING: 0, MAINTENANCE: 0, OFFLINE: 0 };
    resources.forEach((r) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; });
    const running = byStatus.RUNNING ?? 0;
    const total = resources.length || 1;
    return { RUNNING: running, MAINTENANCE: byStatus.MAINTENANCE ?? 0, OFFLINE: byStatus.OFFLINE ?? 0, running, maintenance: byStatus.MAINTENANCE ?? 0, offline: byStatus.OFFLINE ?? 0, onlinePct: Math.round((running / total) * 100) };
  }, [resources]);

  const totalQueued = useMemo(() => queue.reduce((s, q) => s + q.queued, 0), [queue]);
  const avgWaitMs = useMemo(() => (queue.length ? Math.round(queue.reduce((s, q) => s + q.avgWaitMs * q.queued, 0) / Math.max(totalQueued, 1)) : 0), [queue, totalQueued]);

  /** 热区聚合：按节点取平均利用率，输出 Top 热点节点 */
  const heatAgg = useMemo(() => {
    const m = new Map<string, { node: string; pool: string; sum: number; count: number; peak: number }>();
    heat.forEach((h) => {
      const cur = m.get(h.node) ?? { node: h.node, pool: h.pool, sum: 0, count: 0, peak: 0 };
      cur.sum += h.utilization; cur.count += 1; cur.peak = Math.max(cur.peak, h.utilization);
      m.set(h.node, cur);
    });
    return [...m.values()].map((v) => ({ node: v.node, pool: v.pool, avg: Math.round(v.sum / v.count), peak: v.peak })).sort((a, b) => b.avg - a.avg).slice(0, 6);
  }, [heat]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const s = summary!;
  const runningInstances = instances.filter((i) => i.assetId).length;

  return (
    <div className="flex flex-col gap-3">
      {/* 视图头（九章：运维大盘面向技术团队，双大盘同口径） */}
      <div className="panel flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <ServerCog size={15} className="text-primary" /> 运维大盘 · 技术团队视角
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">技术团队运维视角 · 与管理驾驶舱共用同一套底层数据</span>
          <button
            onClick={() => setParams({})}
            className="flex shrink-0 items-center gap-1 rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:border-primary/60 hover:text-text-primary"
          >
            <ArrowLeft size={12} /> 返回管理驾驶舱
          </button>
        </span>
      </div>

      {/* 运维 KPI（同源聚合） */}
      <div className="grid grid-cols-4 gap-3">
        <div className="panel flex items-center justify-between p-3">
          <div>
            <div className="text-xs text-text-secondary">集群在线节点</div>
            <div className="num mt-1.5 text-2xl font-semibold text-primary">{nodeStat.running}<span className="text-sm text-text-secondary">/{resources.length}</span></div>
            <div className="mt-1 text-[10px] text-text-secondary">在线率 {nodeStat.onlinePct}% · 维护 {nodeStat.maintenance} · 离线 {nodeStat.offline}</div>
          </div>
          <ServerCog size={20} className="text-primary/50" />
        </div>
        <div className="panel flex items-center justify-between p-3">
          <div>
            <div className="text-xs text-text-secondary">实时并发</div>
            <div className="num mt-1.5 text-2xl font-semibold text-primary">{totalQueued}<span className="text-sm text-text-secondary"> 排队</span></div>
            <div className="mt-1 text-[10px] text-text-secondary">平均等待 {avgWaitMs}ms · 实例 {runningInstances} 个</div>
          </div>
          <Activity size={20} className="text-primary/50" />
        </div>
        <div className="panel flex items-center justify-between p-3">
          <div>
            <div className="text-xs text-text-secondary">首 Token 时延 P50</div>
            <div className="num mt-1.5 text-2xl font-semibold text-primary">{s.ttftP50}<span className="text-sm text-text-secondary"> ms</span></div>
            <div className="mt-1 text-[10px] text-text-secondary">P95 {s.p95}ms · SLA 达成 {s.successRate}%</div>
          </div>
          <Zap size={20} className="text-primary/50" />
        </div>
        <div className="panel flex items-center justify-between p-3">
          <div>
            <div className="text-xs text-text-secondary">KV 缓存命中</div>
            <div className="num mt-1.5 text-2xl font-semibold text-primary">{s.cacheHitRate}<span className="text-sm text-text-secondary">%</span></div>
            <div className="mt-1 text-[10px] text-text-secondary">近 24h 命中 {kv ? fmtWan(kv.hitTokens24h) : '-'} Tokens · 节省约 {kv?.savedCostPct ?? 0}%</div>
          </div>
          <Database size={20} className="text-primary/50" />
        </div>
      </div>

      {/* 模型实例矩阵 + 集群健康/熔断 */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="模型实例矩阵" className="col-span-7" height={300} extra={<span className="text-xs text-text-secondary">引擎 · 量化 · 批处理 · KV · 时延 · 吞吐</span>}>
          <div className="overflow-auto pr-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="pb-2 font-medium">实例</th>
                  <th className="pb-2 font-medium">引擎</th>
                  <th className="pb-2 font-medium">量化</th>
                  <th className="pb-2 font-medium">批上限</th>
                  <th className="pb-2 font-medium">KV</th>
                  <th className="pb-2 font-medium">TTFT</th>
                  <th className="pb-2 font-medium">P95</th>
                  <th className="pb-2 font-medium">吞吐</th>
                  <th className="pb-2 font-medium">命中</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((i) => (
                  <tr key={i.instanceId} className="border-t border-border-default/60 text-text-primary">
                    <td className="py-1.5 pr-2">{i.instanceId}</td>
                    <td className="py-1.5 pr-2">{ENGINE_LABEL[i.engineType] ?? i.engineType}</td>
                    <td className="py-1.5 pr-2">{i.quantizationType === 'NONE' ? '-' : i.quantizationType}</td>
                    <td className="py-1.5 pr-2">{i.batchConfig.maxBatch}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${i.kvCacheEnabled ? 'bg-success/10 text-success' : 'bg-border-default/40 text-text-secondary'}`}>{i.kvCacheEnabled ? '开' : '关'}</span>
                    </td>
                    <td className="py-1.5 pr-2">{i.ttftMs}ms</td>
                    <td className="py-1.5 pr-2">{i.avgLatencyMs}ms</td>
                    <td className="py-1.5 pr-2 num">{i.tokensPerSec}/s</td>
                    <td className="py-1.5 pr-2">{i.cacheHitRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="col-span-5 flex flex-col gap-3">
          <Panel title="集群健康（节点状态 + 熔断）" height={152}>
            <div className="grid grid-cols-3 gap-2">
              {(['RUNNING', 'MAINTENANCE', 'OFFLINE'] as const).map((k) => (
                <div key={k} className="rounded-lg border border-border-default bg-panel-soft px-3 py-2">
                  <div className={`text-[10px] ${STATUS_LABEL[k].cls} inline-block rounded px-1.5 py-0.5`}>{STATUS_LABEL[k].label}</div>
                  <div className="num mt-1 text-xl font-semibold text-text-primary">{nodeStat[k]}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {breakers.length === 0 && <span className="text-xs text-text-secondary">无熔断记录</span>}
              {breakers.map((b) => (
                <span key={b.circuitId} className={`rounded px-2 py-0.5 text-[10px] ${CB_TONE[b.status] ?? 'bg-border-default/40 text-text-secondary'}`}>
                  {b.dimension} 熔断 {b.status === 'OPEN' ? '已断开' : b.status === 'HALF_OPEN' ? '半开探测' : '已恢复'}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="容量余量 · 优先级队列" height={140}>
            {queue.map((q) => (
              <div key={q.priorityClass} className="mb-1.5 flex items-center gap-2 text-xs">
                <span className={`w-8 shrink-0 rounded px-1.5 py-0.5 text-center font-medium ${q.priorityClass === 'P0' ? 'bg-danger/10 text-danger' : q.priorityClass === 'P1' ? 'bg-warning/10 text-warning' : 'bg-border-default/40 text-text-secondary'}`}>{q.priorityClass}</span>
                <span className="w-24 shrink-0 text-text-secondary">排队 {q.queued} · 运行 {q.running}</span>
                <span className="num text-text-primary">等待 {q.avgWaitMs}ms</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-default/40">
                  <div className={`h-full rounded-full ${q.priorityClass === 'P0' ? 'bg-danger' : q.priorityClass === 'P1' ? 'bg-warning' : 'bg-text-secondary/50'}`} style={{ width: `${Math.min(100, (q.queued / Math.max(totalQueued, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-1 text-[10px] text-text-secondary/70">口径：P0/P1 在线任务优先保障，P2 离线批量仅错峰窗口调度，不抢占 P0/P1 资源。</p>
          </Panel>
        </div>
      </div>

      {/* 时延/利用率趋势 + 热区 */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="响应时间与利用率趋势（近 24h）" className="col-span-7" height={240}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgba(142,163,184,0.12)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis yAxisId="l" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="l" type="monotone" dataKey="ttftP50" name="TTFT P50 (ms)" stroke="#2d7be5" strokeWidth={1.8} dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="avgP95" name="响应 P95 (ms)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="gpuUtil" name="GPU 利用率 (%)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="资源热点（近 24h 高负载节点）" className="col-span-5" height={240} extra={<span className="text-xs text-text-secondary">联动错峰建议</span>}>
          <div className="overflow-auto pr-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="pb-2 font-medium">节点</th>
                  <th className="pb-2 font-medium">资源池</th>
                  <th className="pb-2 font-medium">平均</th>
                  <th className="pb-2 font-medium">峰值</th>
                  <th className="pb-2 font-medium">健康度</th>
                </tr>
              </thead>
              <tbody>
                {heatAgg.map((h) => (
                  <tr key={h.node} className="border-t border-border-default/60 text-text-primary">
                    <td className="py-1.5 pr-2">{h.node}</td>
                    <td className="py-1.5 pr-2">{h.pool}</td>
                    <td className="py-1.5 pr-2 num">{h.avg}%</td>
                    <td className="py-1.5 pr-2 num text-warning">{h.peak}%</td>
                    <td className="py-1.5 pr-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border-default/40">
                        <div className={`h-full rounded-full ${h.avg > 80 ? 'bg-danger' : h.avg > 65 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${h.avg}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* 批处理吞吐与容量余量 */}
      <Panel title="连续批处理吞吐（吞吐提升 ↔ 首字时延联动观察）" height={200} extra={<span className="text-xs text-text-secondary">八章：吞吐优化不能只追求最大化，须同时观察 TTFT 与业务 SLA</span>}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={batch} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(142,163,184,0.12)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
            <YAxis yAxisId="l" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip {...CHART_TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="l" type="monotone" dataKey="throughput" name="吞吐 (tokens/s)" stroke="#2d7be5" strokeWidth={1.8} dot={false} />
            <Line yAxisId="l" type="monotone" dataKey="batchSize" name="平均批大小" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="ttftMs" name="TTFT P50 (ms)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* 运维状态栏（告警 + 资源汇总，分隔线分区） */}
      <div className="panel flex items-center gap-4 px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0 text-warning" />
          <span className="text-text-secondary">待处置告警</span>
          <span className="num text-sm font-semibold text-warning">{s.alertOpen}</span>
        </span>
        <span className="h-4 w-px shrink-0 bg-border-default" aria-hidden />
        <span className="text-text-secondary">今日异常 <span className="num font-semibold text-text-primary">{s.abnormal}</span> 起 · 降级 {s.degraded} / 阻断 {s.blocked} / 熔断 {s.circuitOpen}</span>
        <span className="ml-auto flex items-center gap-2">
          <Gauge size={14} className="shrink-0 text-primary/70" />
          <span className="text-text-secondary">GPU <span className="num font-semibold text-text-primary">{s.gpuUtil}%</span> · 卡时 {fmtWan(s.gpuHours)} GPU·h · {s.nodes} 节点 / {s.pools} 资源池</span>
        </span>
      </div>
      {readOnly && <p className="text-right text-[10px] text-text-secondary/60">只读模式：运维大盘仅观测，写操作请至 调度算力 / 计量运营 页面</p>}
    </div>
  );
}
