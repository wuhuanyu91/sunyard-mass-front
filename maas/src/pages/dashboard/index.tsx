import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertOctagon, ShieldAlert, Siren, Coins, Rocket, ShieldCheck, ChevronRight, ChevronLeft, FileDown, X } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { ApplicationRegistry, ComputeResource, GrayRelease, ModelAsset, PlatformAlert } from '../../types';
import KpiCard from '../../components/ui/KpiCard';
import Panel from '../../components/ui/Panel';
import StatusTag from '../../components/ui/StatusTag';
import Drawer from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { useApp } from '../../store/app';
import Topology from './Topology';
import OpsDashboard from './OpsDashboard';
import type { CostModelConfig } from '../../types';

const fmt = (n: number) => n.toLocaleString('zh-CN');

/** 驾驶舱消息通知池（与各页真实数据/事件联动，单行轮播展示） */
interface DashNotice {
  id: string;
  tag: '通知' | '公告' | '维护';
  title: string;
  content: string;
  time: string;
}
const NOTICE_TAG_CLS: Record<DashNotice['tag'], string> = {
  通知: 'bg-warning/10 text-warning',
  公告: 'bg-primary/10 text-primary',
  维护: 'bg-success/10 text-success',
};
const NOTICES: DashNotice[] = [
  { id: 'N1', tag: '通知', title: '计量口径待校准', content: '失败/重试 Token 暂未计入成本，可在「计量运营」页开关即时切换（切换留痕审计）', time: '今日 08:30' },
  { id: 'N2', tag: '公告', title: '全行统一调用入口', content: 'OpenAI 兼容 API 已上线，上层应用零改造切模型，支持流式/多模态/工具调用；双大盘共用同一数据口径', time: '今日 08:30' },
  { id: 'N3', tag: '通知', title: '部门配额预警', content: '零售银行总部配额已用 89%（预警阈值 80%）；风险管理部超限停发，恢复审批中', time: '今日 08:00' },
  { id: 'N4', tag: '公告', title: '语义路由节省播报', content: '本月智能路由已节省 ¥274 万（-42.7%），对比全量旗舰模型口径 ¥642 万；明细见 计量运营 → 模型统计', time: '今日 07:30' },
  { id: 'N5', tag: '公告', title: '灰度发布进展', content: 'Fin-Qwen-14B-SFT v3.2 处于 A/B 对照阶段，Fin-Qwen-14B-INT4 已切流 5%；可在 模型资产 → 发布归档 查看', time: '今日 07:10' },
  { id: 'N6', tag: '通知', title: '安全拦截播报', content: '今日护栏拦截高风险请求 12 次，Top 类型为私人娱乐越规；处置队列见 安全审计 → 安全态势', time: '今日 06:50' },
  { id: 'N7', tag: '维护', title: 'POOL-H20 例行维护完成', content: 'node-gpu-02 固件升级已于 08-06 02:00-04:00 完成，期间请求自动调度至其他节点，业务无感', time: '昨日 17:20' },
  { id: 'N8', tag: '维护', title: '月度账单已出账', content: '2026-07 全行账单合计 ¥1,926 万（六部门分摊），可在 计量运营 → 月度账单 导出 CSV', time: '昨日 09:00' },
];
const fmtWan = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return fmt(n);
};
const fmtYuan = (n: number) => `¥${fmt(Math.round(n))}`;

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

/** 6.1 运营驾驶舱（规范 6.1）/ 九章：运维大盘（view=ops，同一套数据口径） */
export default function Dashboard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { timeRange, frozen } = useApp();

  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [resources, setResources] = useState<ComputeResource[]>([]);
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [tokenSeries, setTokenSeries] = useState<{ t: string; input: number; output: number; cacheHit: number }[]>([]);
  const [trend, setTrend] = useState<{ t: string; gpuUtil: number; ttftP50: number; avgP95: number }[]>([]);
  const [deptTco, setDeptTco] = useState<{ deptId: string; deptName: string; tco: number; tokens: number }[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [appRank, setAppRank] = useState<{ appId: string; name: string; tokens: number; tco: number }[]>([]);
  const [modelRank, setModelRank] = useState<{ assetId: string; name: string; calls: number; tco: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiDetail, setKpiDetail] = useState<{ title: string; rows: [string, string][] } | null>(null);
  /* 消息通知轮播（会话内关闭记录，不持久化） */
  const [closedNotices, setClosedNotices] = useState<Set<string>>(() => new Set());
  const [noticeIdx, setNoticeIdx] = useState(0);
  const [noticePaused, setNoticePaused] = useState(false);
  const visibleNotices = useMemo(() => NOTICES.filter((n) => !closedNotices.has(n.id)), [closedNotices]);
  const curNotice = visibleNotices.length > 0 ? visibleNotices[Math.min(noticeIdx, visibleNotices.length - 1)] : null;
  useEffect(() => {
    if (noticePaused || visibleNotices.length <= 1) return;
    const t = window.setInterval(() => setNoticeIdx((i) => (i + 1) % visibleNotices.length), 5000);
    return () => clearInterval(t);
  }, [noticePaused, visibleNotices.length]);
  const [saving, setSaving] = useState<{ savedCost: number; savedPct: number } | null>(null);
  const [grays, setGrays] = useState<GrayRelease[]>([]);
  const [costModel, setCostModel] = useState<CostModelConfig | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      api.getApps(),
      api.getAssets(),
      api.getResources(),
      api.getAlerts(),
      api.getTokenSeries(),
      api.getTrendSeries(),
      api.getDeptTco(),
      api.getSummary(),
      api.getAppTcoRank(),
      api.getModelTcoRank(),
    ]).then(([a, m, r, al, ts, tr, dt, su, ar, mr]) => {
      setApps(a);
      setAssets(m);
      setResources(r);
      setAlerts(al);
      setTokenSeries(ts);
      setTrend(tr);
      setDeptTco(dt);
      setSummary(su);
      setAppRank(ar);
      setModelRank(mr);
      setLoading(false);
    });
    api.getRoutingSaving().then((s) => setSaving({ savedCost: s.savedCost, savedPct: s.savedPct }));
    api.getGrayReleases().then(setGrays);
    api.getCostModelConfig().then(setCostModel);
  };

  // 首次加载 + 时间档位切换联动
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // 轮询（规范 6.1.5：实时 10s / 其余 60s；frozen 暂停）
  useEffect(() => {
    if (frozen) return;
    const interval = setInterval(reload, timeRange === 'REALTIME' ? 10_000 : 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, frozen]);

  /* ---------------- 全行聚合（口径见规范 8.1，来源 getPlatformSummary） ---------------- */
  const kpi = useMemo(() => {
    const s = summary ?? {
      requests: 0, inputTokens: 0, outputTokens: 0, gpuHours: 0, tco: 0, gpuUtil: 0,
      abnormal: 0, degraded: 0, blocked: 0, circuitOpen: 0,
    };
    return {
      totalRequests: s.requests,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      gpuUtil: s.gpuUtil,
      tco: s.tco,
      abnormal: s.abnormal,
      degraded: s.degraded,
      blocked: s.blocked,
      circuitOpen: s.circuitOpen,
    };
  }, [summary]);

  const rankApps = useMemo(() => appRank.map((r) => ({ ...r, id: r.appId })), [appRank]);
  const rankModels = useMemo(() => modelRank.map((r) => ({ ...r, id: r.assetId })), [modelRank]);

  const kpiCards: {
    label: string;
    value: string;
    unit?: string;
    hint: string;
    delta?: number;
    tone?: 'default' | 'danger' | 'success';
  }[] = [
    { label: '全行请求量', value: fmtWan(kpi.totalRequests), unit: '次/日', hint: '口径：成功+失败+重试请求总次数（近 24h）', delta: 12.4 },
    { label: '输入 Token', value: fmtWan(kpi.inputTokens), unit: 'Tokens', hint: '口径：近 24h 输入 Token 总量', delta: 8.1 },
    { label: '输出 Token', value: fmtWan(kpi.outputTokens), unit: 'Tokens', hint: '口径：近 24h 输出 Token 总量', delta: 5.7 },
    { label: 'GPU 利用率', value: `${kpi.gpuUtil}`, unit: '%', hint: '口径：计算时间利用率（非显存占用）', delta: 3.2, tone: kpi.gpuUtil > 85 ? 'danger' : 'default' },
    { label: '今日预估 TCO', value: fmtYuan(kpi.tco), hint: '口径：四类成本之和，含/不含失败重试见计量页开关', delta: 6.9 },
    { label: '今日异常', value: `${kpi.abnormal}`, hint: `含 ${kpi.degraded} 次降级 / ${kpi.blocked} 次阻断 / ${kpi.circuitOpen} 次熔断`, delta: -4.2, tone: kpi.abnormal > 0 ? 'danger' : 'success' },
  ];

  const openKpiDetail = (card: (typeof kpiCards)[number]) => {
    const rows: [string, string][] = [];
    if (card.label === '今日异常') {
      rows.push(['降级请求', `${kpi.degraded}`]);
      rows.push(['阻断请求', `${kpi.blocked}`]);
      rows.push(['熔断记录', `${kpi.circuitOpen}`]);
      rows.push(['成功率', `${summary?.successRate ?? 99.3}%`]);
    } else if (card.label === '今日预估 TCO') {
      const tco = kpi.tco || 1;
      // 与「计量与运营 → 成本模型」同一套可配置权重（九章：成本模型可配置）
      const w = costModel?.weights ?? { infra: 35, compute: 40, license: 15, external: 10 };
      rows.push(['基础设施成本', fmtYuan(tco * (w.infra / 100))]);
      rows.push(['推理计算成本', fmtYuan(tco * (w.compute / 100))]);
      rows.push(['软件许可成本', fmtYuan(tco * (w.license / 100))]);
      rows.push(['外部调用成本', fmtYuan(tco * (w.external / 100))]);
      rows.push(['合计（四类之和）', fmtYuan(tco)]);
    } else if (card.label === '全行请求量') {
      for (const r of rankApps.slice(0, 5)) rows.push([r.name, `${fmtWan(r.tokens)} Tokens`]);
    } else {
      rows.push(['口径说明', card.hint]);
      rows.push(['当前值', `${card.value}${card.unit ?? ''}`]);
    }
    setKpiDetail({ title: `${card.label} · 构成明细`, rows });
  };

  const onNodeClick = (kind: 'app' | 'model' | 'resource', id: string) => {
    if (kind === 'model') navigate(`/assets?assetId=${encodeURIComponent(id)}`);
    if (kind === 'app') navigate(`/metering?appId=${encodeURIComponent(id)}`);
    if (kind === 'resource') navigate(`/routing?resourceId=${encodeURIComponent(id)}`);
  };

  /** P1-6 运营简报一键导出（管理层一页纸结论） */
  const exportBriefing = () => {
    const s = summary;
    if (!s) return;
    const lines = [
      `MAAS 平台运营简报（${new Date().toLocaleDateString('zh-CN')}）`,
      '====================================',
      '一、总体运行',
      `  近 24h 请求量：${s.requests.toLocaleString()} 次，成功率 ${s.successRate}%，P95 时延 ${s.p95}ms`,
      `  输入/输出 Token：${(s.inputTokens / 100_000_000).toFixed(2)} 亿 / ${(s.outputTokens / 100_000_000).toFixed(2)} 亿，缓存命中率 ${s.cacheHitRate}%`,
      `  GPU 利用率：${s.gpuUtil}%（纳管 ${s.nodes} 节点 / ${s.pools} 资源池）`,
      '二、成本与收益',
      `  今日预估 TCO：¥${s.tco.toLocaleString()}（四类成本分摊口径）`,
      '  本月语义路由节省：¥274 万（-42.7%，对比全量旗舰模型口径）',
      '三、风险与安全',
      `  今日异常 ${s.abnormal} 起（降级 ${s.degraded} / 阻断 ${s.blocked} / 熔断 ${s.circuitOpen}），待处置告警 ${s.alertOpen} 条`,
      `  安全事件 ${s.securityEvents} 起（脱敏 ${s.maskedEvents} / 严重 ${s.criticalEvents}）`,
      '四、治理事项',
      `  待审批策略 ${s.approvalPending} 条；生产模型 ${s.prodModels}/${s.models}；在用应用 ${s.apps} 个`,
      '  风险管理部配额超限停发（恢复审批中）；零售银行总部配额预警（89%）',
      '五、灰度进展',
      '  Fin-Qwen-14B-SFT v3.2：A/B 对照阶段（20% 流量）；Fin-Qwen-14B-INT4 v1.0：5% 切流中',
      '====================================',
      '口径说明：管理驾驶舱与运维大盘共用同一套底层数据（规范 8.1）；本简报由平台自动生成。',
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maas-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 视图分支：侧边栏子菜单驱动 URL 参数（?view=ops），函数包裹避免 TS 收窄 */
  const isOpsView = () => params.get('view') === 'ops';
  if (isOpsView()) {
    return <OpsDashboard />;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 消息通知区（规范 6.1.6 / 七章）：单行轮播，悬停暂停，可单条关闭 */}
      {curNotice && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-border-default bg-bg-panel px-3 py-2 text-xs"
          onMouseEnter={() => setNoticePaused(true)}
          onMouseLeave={() => setNoticePaused(false)}
        >
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${NOTICE_TAG_CLS[curNotice.tag]}`}>{curNotice.tag}</span>
          <span key={curNotice.id} className="min-w-0 flex-1 truncate text-text-secondary" style={{ animation: 'maas-fade-up 0.3s cubic-bezier(0.22,1,0.36,1)' }}>
            <span className="font-medium text-text-primary">{curNotice.title}</span>：{curNotice.content}
          </span>
          <span className="num shrink-0 text-[10px] text-text-secondary/60">{curNotice.time}</span>
          <span className="num shrink-0 rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary/70">
            {Math.min(noticeIdx, visibleNotices.length - 1) + 1}/{visibleNotices.length}
          </span>
          <span className="flex shrink-0 items-center">
            <button
              onClick={() => setNoticeIdx((i) => (i - 1 + visibleNotices.length) % visibleNotices.length)}
              aria-label="上一条通知"
              className="rounded p-0.5 text-text-secondary/60 transition-colors hover:text-text-primary"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => setNoticeIdx((i) => (i + 1) % visibleNotices.length)}
              aria-label="下一条通知"
              className="rounded p-0.5 text-text-secondary/60 transition-colors hover:text-text-primary"
            >
              <ChevronRight size={13} />
            </button>
          </span>
          <button
            onClick={() => setClosedNotices((prev) => new Set(prev).add(curNotice.id))}
            aria-label="关闭当前通知"
            className="shrink-0 rounded p-0.5 text-text-secondary/60 transition-colors hover:text-text-primary"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* 管理指标条（P1-7：大领导考核口径）+ 简报导出（P1-6） */}
      <div className="grid grid-cols-12 gap-3">
        {/* SLA 达成率：大数字 + 环比 + 达标进度条 */}
        <div className="panel col-span-4 flex flex-col p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">SLA 达成率</span>
            <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">目标 ≥99%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="num text-2xl font-semibold leading-none text-success">99.3<span className="ml-0.5 text-sm font-normal">%</span></span>
            <span className="num text-xs text-success">▲ 0.2% 环比</span>
          </div>
          <div className="mt-auto pt-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-border-default/40">
              <div className="h-full rounded-full bg-success" style={{ width: '99.3%' }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-secondary">
              <span>P0/P1 时延与成功率达标占比</span>
              <span className="font-medium text-success">已达标</span>
            </div>
          </div>
        </div>

        {/* 日预算执行率：大数字 + 超阈状态 + 带阈值线进度条 */}
        <div className="panel col-span-4 flex flex-col p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">日预算执行率</span>
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">预警阈值 85%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="num text-2xl font-semibold leading-none text-danger">91.2<span className="ml-0.5 text-sm font-normal">%</span></span>
            <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">已超阈值</span>
          </div>
          <div className="mt-auto pt-2.5">
            <div className="relative h-1.5 overflow-hidden rounded-full bg-border-default/40">
              <div className="h-full rounded-full bg-danger" style={{ width: '91.2%' }} />
              <span className="absolute top-0 h-full w-0.5 bg-warning" style={{ left: '85%' }} aria-hidden />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-secondary">
              <span>今日 <span className="num font-medium text-text-primary">{fmtYuan(summary?.tco ?? 684000)}</span></span>
              <span>日预算 <span className="num font-medium text-text-primary">{fmtYuan(750000)}</span></span>
            </div>
          </div>
        </div>

        <button
          onClick={exportBriefing}
          className="panel hover-lift col-span-4 flex items-center gap-3 p-3.5 text-left transition-all hover:border-primary/60"
          title="自动生成管理层一页纸简报并下载"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary"><FileDown size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-text-secondary">管理层一页纸 · 一键导出</span>
            <span className="block text-sm font-semibold text-text-primary">生成运营简报</span>
            <span className="block truncate text-[10px] text-text-secondary/70">总体运行 / 成本收益 / 风险安全 / 治理事项 / 灰度进展</span>
          </span>
          <ChevronRight size={14} className="shrink-0 text-text-secondary/50" />
        </button>
      </div>

      {/* KPI 条（规范 6.1.2/6.1.3：一行 6 个重点指标） */}
      <div className="grid grid-cols-6 gap-3">
        {kpiCards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.unit}
            hint={c.hint}
            delta={c.delta}
            tone={c.tone}
            onClick={() => openKpiDetail(c)}
          />
        ))}
      </div>

      {/* 今日运营简报（M10：可点击跳转处置） */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => navigate('/metering?tab=stats')} className="panel group flex items-center gap-3 p-3 text-left transition-colors hover:border-primary/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-success/40 bg-success/10 text-success"><Coins size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-text-secondary">本月语义路由节省</span>
            <span className="num block text-lg font-semibold text-success">¥{fmt(Math.round(saving?.savedCost ?? 143733))}<span className="ml-1 text-xs font-normal">-{saving?.savedPct ?? 43.6}%</span></span>
          </span>
          <ChevronRight size={14} className="text-text-secondary/50 group-hover:text-primary" />
        </button>
        <button onClick={() => navigate('/assets?tab=release')} className="panel group flex items-center gap-3 p-3 text-left transition-colors hover:border-primary/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-primary/40 bg-primary/10 text-primary"><Rocket size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-text-secondary">灰度发布进展</span>
            <span className="block truncate text-sm text-text-primary">
              {grays.length > 0 ? `${grays.length} 个任务进行中 · ${grays[0].assetName} ${grays[0].percent}%` : '暂无灰度任务'}
            </span>
          </span>
          <ChevronRight size={14} className="text-text-secondary/50 group-hover:text-primary" />
        </button>
        <button onClick={() => navigate('/security')} className="panel group flex items-center gap-3 p-3 text-left transition-colors hover:border-primary/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-danger/40 bg-danger/10 text-danger"><ShieldCheck size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-text-secondary">今日安全拦截</span>
            <span className="num block text-lg font-semibold text-danger">{summary?.securityEvents ?? 0}<span className="ml-1 text-xs font-normal text-text-secondary">含 {summary?.blocked ?? 0} 阻断 / {summary?.maskedEvents ?? 0} 脱敏</span></span>
          </span>
          <ChevronRight size={14} className="text-text-secondary/50 group-hover:text-primary" />
        </button>
      </div>

      {/* 中部：左资源负载 / 中拓扑 / 右风险成本（12 列栅格） */}
      <div className="grid grid-cols-12 gap-3">
        {/* 左侧资源与负载 */}
        <div className="col-span-3 flex flex-col gap-3">
          <Panel title="算力利用率趋势" height={240} extra={<span className="text-xs text-text-secondary">近 24h</span>}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d7be5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2d7be5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-default)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="gpuUtil" name="GPU利用率%" stroke="#2d7be5" fill="url(#gpuGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Token 消耗（输入/输出/缓存命中）" height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tokenSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d7be5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2d7be5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-default)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="input" name="输入 Token" stroke="#2d7be5" fill="url(#inGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="output" name="输出 Token" stroke="#10b981" fill="none" strokeWidth={2} />
                <Area type="monotone" dataKey="cacheHit" name="缓存命中" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* 中央拓扑 */}
        <div className="col-span-6">
          <Topology apps={apps} models={assets} resources={resources} summary={summary} onNodeClick={onNodeClick} />
        </div>

        {/* 右侧风险与成本 */}
        <div className="col-span-3 flex flex-col gap-3">
          <Panel title="风险态势" height={240} extra={<span className="text-xs text-text-secondary">近 24h</span>}>
            <div className="grid grid-cols-3 gap-2">
              <RiskNum icon={<ShieldAlert size={16} />} label="阻断" value={kpi.blocked} tone="danger" onClick={() => navigate('/security')} />
              <RiskNum icon={<Siren size={16} />} label="降级" value={kpi.degraded} tone="warning" onClick={() => navigate('/security')} />
              <RiskNum icon={<AlertOctagon size={16} />} label="熔断" value={kpi.circuitOpen} tone="danger" onClick={() => navigate('/security')} />
            </div>
            <div className="mt-3 space-y-1.5">
              {alerts.slice(0, 2).map((a) => (
                <div key={a.alertId} className="flex items-center justify-between gap-2 rounded border border-border-default bg-panel-soft px-2 py-1.5 text-xs">
                  <span className="truncate text-text-secondary">{a.title}</span>
                  <StatusTag status={a.alertStatus} ns="Alert" size="sm" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="今日预估 TCO 与部门分布" height={240}>
            <ResponsiveContainer width="100%" height="60%">
              <PieChart>
                <Pie data={deptTco} dataKey="tco" nameKey="deptName" innerRadius="52%" outerRadius="80%" paddingAngle={2}>
                  {deptTco.map((_, i) => (
                    <Cell key={i} fill={['#2d7be5', '#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#6b5ce7'][i % 6]} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} formatter={(v) => fmtYuan(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center text-sm">
              合计 <span className="num font-semibold text-primary">{fmtYuan(kpi.tco)}</span>
            </div>
          </Panel>
        </div>
      </div>

      {/* 底部排行（规范 6.1.2） */}
      <div className="grid grid-cols-2 gap-3">
        <RankTable
          title="重点应用 · 按 TCO"
          columns={['应用', 'Token 消耗', 'TCO']}
          rows={rankApps.map((r) => [r.name, fmtWan(r.tokens), fmtYuan(r.tco)])}
        />
        <RankTable
          title="重点模型 · 按 TCO"
          columns={['模型', '调用次数', 'TCO']}
          rows={rankModels.map((r) => [r.name, fmt(r.calls), fmtYuan(r.tco)])}
        />
      </div>

      {/* KPI 下钻 Drawer（规范 6.1.5） */}
      <Drawer open={!!kpiDetail} onClose={() => setKpiDetail(null)} title={kpiDetail?.title ?? ''}>
        {kpiDetail && (
          <div className="space-y-1.5">
            {kpiDetail.rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2 text-sm">
                <span className="text-text-secondary">{k}</span>
                <span className="num">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function RiskNum({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'danger' | 'warning';
  onClick?: () => void;
}) {
  const cls = tone === 'danger' ? 'text-danger border-danger/40 bg-danger/5' : 'text-warning border-warning/40 bg-warning/5';
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded border px-2 py-2 transition-colors hover:brightness-125 ${cls}`}
    >
      {icon}
      <span className="num text-xl font-semibold leading-none">{value}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function RankTable({ title, columns, rows }: { title: string; columns: string[]; rows: [string, string, string][] }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <EmptyState text="暂无排行数据" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              {columns.map((c) => (
                <th key={c} className="pb-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border-default/40 last:border-0">
                <td className="py-1.5 text-text-primary">{r[0]}</td>
                <td className="num py-1.5 text-text-secondary">{r[1]}</td>
                <td className="num py-1.5 text-primary">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
