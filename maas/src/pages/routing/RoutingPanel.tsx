import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Activity, Search, ShieldCheck, ArrowRight, Zap } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { FunnelStage, RateLimitHit, RateLimitDimension, RouterLog } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Banner from '../../components/ui/Banner';
import StatusTag from '../../components/ui/StatusTag';
import { EmptyState } from '../../components/ui/EmptyState';
import RationaleDrawer from './RationaleDrawer';
import RoutingEnginePanel from './RoutingEnginePanel';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtWan = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return fmt(n);
};

const CHART_TOOLTIP = {
  contentStyle: { background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.55)' },
  labelStyle: { color: 'var(--color-text-secondary)' },
  itemStyle: { color: 'var(--color-text-primary)' },
};

const RATE_DIM_LABEL: Record<RateLimitDimension, string> = {
  QPS: 'QPS',
  TOKEN: '输入 Token',
  COST: '总成本',
  CONCURRENCY: '并发数',
};

const FUNNEL_COLORS = ['#2d7be5', '#10b981', '#f59e0b', '#ef4444'];

/** 6.3 智能路由白盒（规范 6.3） */
export default function RoutingPanel() {
  const [params] = useSearchParams();
  const { tenantId } = useApp();
  const [logs, setLogs] = useState<RouterLog[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitHit[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [dimFilter, setDimFilter] = useState<RateLimitDimension | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RouterLog | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([api.getRouterLogs(), api.getFunnelData(), api.getRateLimitHits(), api.getSummary()]).then(([lg, fu, rl, su]) => {
      setLogs(lg);
      setFunnel(fu);
      setRateLimits(rl);
      setSummary(su);
      setLoading(false);
      const trace = params.get('trace');
      if (trace) {
        const hit = lg.find((l) => l.traceId === trace);
        if (hit) setSelected(hit);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 租户联动（规范 4.3：切换租户后 Trace/限流明细随之过滤；KPI 仍为全行口径） */
  const tenantLogs = useMemo(
    () => (tenantId === 'GLOBAL' ? logs : logs.filter((l) => l.tenantId === tenantId)),
    [logs, tenantId],
  );

  const degradedLogs = useMemo(() => tenantLogs.filter((l) => l.status === 'DEGRADED').slice(0, 8), [tenantLogs]);

  /** 锚定检索提示（跟随租户范围：仅展示当前租户内的降级/阻断锚点） */
  const anchorHints = useMemo(() => {
    const anchors = tenantLogs.filter((l) => l.traceId === 'TR-20260803-999001' || l.traceId === 'TR-20260803-888002');
    return anchors.map((l) => (l.status === 'DEGRADED' ? `降级 ${l.traceId}` : `阻断 ${l.traceId}`)).join(' · ');
  }, [tenantLogs]);

  const filteredLimits = useMemo(
    () =>
      rateLimits.filter(
        (r) => (tenantId === 'GLOBAL' || r.tenantId === tenantId) && (dimFilter === 'ALL' || r.dimension === dimFilter),
      ),
    [rateLimits, dimFilter, tenantId],
  );

  const overview = useMemo(() => {
    const s = summary ?? { requests: 0, inputTokens: 0, outputTokens: 0, qps: 0, p95: 0 };
    return { total: s.requests, prompt: s.inputTokens, output: s.outputTokens, qps: s.qps, p95: s.p95 };
  }, [summary]);

  const search = (raw: string) => {
    const traceId = raw.trim();
    if (!traceId) return;
    const hit = logs.find((l) => l.traceId === traceId) ?? null;
    if (hit) {
      setNotFound(false);
      setSelected(hit);
    } else {
      // 规范 6.3.7：未命中展示提示，不静默降级
      setNotFound(true);
      setSelected(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="调度算力" title="路由总览" desc="多约束路由引擎运行总览：约束配置、流量漏斗、限流命中与调用决策追溯" />
      {/* 多约束路由引擎配置中心（智能网关核心能力） */}
      <RoutingEnginePanel />

      {/* 请求总览条（6.3.2：QPS/Token 双维） */}
      <div className="grid grid-cols-5 gap-3">
        <Overview label="实时 QPS" value={fmt(overview.qps)} unit="req/s" icon={<Activity size={14} />} tone="text-primary" hint="网关入口 QPS（近实时 ≤5s）" />
        <Overview label="近 24h 请求" value={fmtWan(overview.total)} unit="次" icon={<Zap size={14} />} tone="text-text-primary" hint={`成功率 ${summary?.successRate ?? 99.3}%`} />
        <Overview label="输入 Token" value={fmtWan(overview.prompt)} unit="Tokens" icon={<Activity size={14} />} tone="text-primary" hint="近 24h 输入 Token 总量" />
        <Overview label="输出 Token" value={fmtWan(overview.output)} unit="Tokens" icon={<Activity size={14} />} tone="text-success" hint="近 24h 输出 Token 总量" />
        <Overview label="P95 时延" value={fmt(overview.p95)} unit="ms" icon={<Activity size={14} />} tone="text-warning" hint="avgLatency 长尾口径（8.1）" />
      </div>

      {/* 路由漏斗（6.3.2） */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="路由漏斗（入站 → 分流 → 限流/熔断 → 派发）" className="col-span-4" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip {...CHART_TOOLTIP} formatter={(v, n) => [`${fmt(Number(v))} 条`, String(n)]} />
              <Funnel dataKey="value" data={funnel} isAnimationActive={false} lastShapeType="rectangle">
                <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="name" fontSize={12} />
                {funnel.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <div className="mt-1 space-y-1">
            {funnel.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs text-text-secondary">
                <span>{s.name}</span>
                <span className="num text-text-primary">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* 请求检索 + Rationale 入口（6.3.5） */}
        <Panel title="TraceID 检索" className="col-span-4" height={280}>
          <div className="flex flex-col gap-3">
            {notFound && (
              <Banner tone="warning">
                未检索到该 TraceID，请确认时间范围（规范 6.3.7）
              </Banner>
            )}
            <div className="flex gap-2">
              <input
                name="trace-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search(query)}
                placeholder="输入 TraceID，如 TR-20260803-999001"
                className="min-w-0 flex-1 rounded border border-border-default bg-bg-page px-3 py-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/60 focus:border-primary/60"
                aria-label="TraceID 检索"
              />
              <button
                onClick={() => search(query)}
                className="flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/20"
              >
                <Search size={13} /> 检索
              </button>
            </div>
            <div className="flex-1 space-y-1.5 overflow-auto">
              {tenantLogs.slice(0, 6).map((l) => (
                <button
                  key={l.traceId}
                  onClick={() => setSelected(l)}
                  className="flex w-full items-center justify-between gap-2 rounded border border-border-default bg-panel-soft px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
                >
                  <span className="truncate font-mono text-text-primary">{l.traceId}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="truncate text-text-secondary">{l.appId}</span>
                    <StatusTag status={l.status} ns="RouterLog" size="sm" />
                    <ArrowRight size={12} className="text-text-secondary/60" />
                  </span>
                </button>
              ))}
            </div>
            {anchorHints && <p className="text-xs text-text-secondary">常用检索：{anchorHints}</p>}
          </div>
        </Panel>

        {/* 降级与切备历史（6.3.5 FallbackTimeline） */}
        <Panel title="降级与切备历史" className="col-span-4" height={280}>
          {degradedLogs.length === 0 ? (
            <EmptyState text="时间窗内无降级记录" />
          ) : (
            <div className="h-full space-y-2 overflow-auto pr-1">
              {degradedLogs.map((l) => (
                <button
                  key={l.traceId}
                  onClick={() => setSelected(l)}
                  className="w-full rounded border border-warning/25 bg-warning/5 px-2.5 py-2 text-left transition-colors hover:border-warning/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-warning">{l.traceId}</span>
                    <span className="num shrink-0 text-xs text-text-secondary">
                      {new Date(l.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-text-secondary">{l.decision.fallbackReason}</div>
                  <div className="mt-0.5 truncate text-xs text-text-secondary/70">→ {l.decision.selectedModel}@{l.decision.selectedVersion}</div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* 限流与熔断面板（6.3.2 / 6.3.5：维度筛选 + 快捷入口） */}
      <Panel
        title="限流命中记录"
        height={260}
        extra={
          <>
            <button
              onClick={() => (window.location.href = '/routing?tab=traffic&tview=limit')}
              className="mr-2 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
            >
              管理限流规则 →
            </button>
            <div className="flex items-center gap-1 rounded border border-border-default bg-bg-page p-0.5">
            {(['ALL', 'QPS', 'TOKEN', 'COST', 'CONCURRENCY'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDimFilter(d)}
                className={`rounded px-2 py-1 text-xs transition-colors ${dimFilter === d ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {d === 'ALL' ? '全部' : RATE_DIM_LABEL[d]}
              </button>
            ))}
            </div>
          </>
        }
      >
        {filteredLimits.length === 0 ? (
          <EmptyState text="当前维度无限流命中" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">时间</th>
                <th className="pb-2 font-medium">维度</th>
                <th className="pb-2 font-medium">阈值 / 当前值</th>
                <th className="pb-2 font-medium">动作</th>
                <th className="pb-2 font-medium">策略</th>
                <th className="pb-2 font-medium">应用</th>
                <th className="pb-2 font-medium">TraceID</th>
              </tr>
            </thead>
            <tbody>
              {filteredLimits.map((r) => (
                <tr key={r.rateLimitId} className="border-b border-border-default/40 last:border-0">
                  <td className="num py-2 text-xs text-text-secondary">
                    {new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2">{RATE_DIM_LABEL[r.dimension]}</td>
                  <td className="num py-2">
                    <span className="text-text-secondary">{fmt(r.threshold)}</span>
                    <span className="mx-1 text-text-secondary/50">/</span>
                    <span className={r.currentValue > r.threshold ? 'text-danger' : 'text-text-primary'}>{fmt(r.currentValue)}</span>
                  </td>
                  <td className="py-2">
                    <StatusTag status={r.action === 'BLOCK' ? 'BLOCKED' : 'DEGRADED'} ns="RouterLog" size="sm" />
                  </td>
                  <td className="py-2 text-xs text-text-secondary">{r.policyName}</td>
                  <td className="num py-2 text-xs text-text-secondary">{r.appId}</td>
                  <td className="py-2">
                    {r.traceId ? (
                      <button
                        onClick={() => {
                          const hit = logs.find((l) => l.traceId === r.traceId);
                          if (hit) setSelected(hit);
                        }}
                        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {r.traceId}
                      </button>
                    ) : (
                      <span className="text-xs text-text-secondary/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Rationale 白盒 Drawer */}
      <RationaleDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Overview({
  label,
  value,
  unit,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="panel flex items-center gap-3 p-3" title={hint}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-current/20 bg-current/5 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          {label}
          {hint && <ShieldCheck size={12} className="cursor-help opacity-50" />}
        </div>
        <div className={`num text-xl font-semibold leading-tight ${tone}`}>
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-text-secondary">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
