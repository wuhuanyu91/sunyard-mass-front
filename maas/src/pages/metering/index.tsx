import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Download, FileText, Repeat, Activity, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary, DeptTco } from '../../services/api';
import type { ApplicationRegistry, MeteringRecord, ModelAsset, OptimizeAdvice } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import Banner from '../../components/ui/Banner';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { EmptyState } from '../../components/ui/EmptyState';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtYuan = (n: number) => `¥${fmt(Math.round(n))}`;
const fmtWan = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return fmt(n);
};

const PAGE_SIZE = 10;

const DEPT_NAME: Record<string, string> = {
  'DEPT-RETAIL': '零售银行总部',
  'DEPT-CORP': '公司银行总部',
  'DEPT-TECH': '信息科技部',
  'DEPT-RISK': '风险管理部',
  'DEPT-OPS': '运营管理部',
  'DEPT-INVEST': '金融市场部',
};

import QuotaPanel from './QuotaPanel';
import ModelStats from './ModelStats';
import CallLogs from './CallLogs';
import AppRegistry from './AppRegistry';
import MonthlyBilling from './MonthlyBilling';
import CostModelPanel from './CostModelPanel';

/** 6.5 计量运营中心（页内 Tab 已上提为侧边栏子菜单，本页按 URL 参数渲染对应视图） */
export default function Metering() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'overview');

  useEffect(() => {
    setTab(params.get('tab') ?? 'overview');
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      {tab === 'quota' ? <QuotaPanel /> : tab === 'stats' ? <ModelStats /> : tab === 'logs' ? <CallLogs /> : tab === 'apps' ? <AppRegistry /> : tab === 'billing' ? <MonthlyBilling /> : tab === 'cost' ? <CostModelPanel /> : <MeteringOverview />}
    </div>
  );
}

/** 6.5 计量台账（原计量总览页） */
function MeteringOverview() {
  const [params] = useSearchParams();
  const { readOnly, tenantId } = useApp();
  const [metering, setMetering] = useState<MeteringRecord[]>([]);
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [advice, setAdvice] = useState<OptimizeAdvice[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [deptTco, setDeptTco] = useState<DeptTco[]>([]);
  const [appRank, setAppRank] = useState<{ appId: string; name: string; tokens: number; tco: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryIncluded, setRetryIncluded] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [appFilter, setAppFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [billDetail, setBillDetail] = useState<MeteringRecord | null>(null);
  const [adviceDetail, setAdviceDetail] = useState<OptimizeAdvice | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [calib, setCalib] = useState(false);

  useEffect(() => {
    Promise.all([api.getMetering(), api.getApps(), api.getAssets(), api.getOptimizeAdvice(), api.getSummary(), api.getDeptTco(), api.getAppTcoRank()]).then(
      ([me, ap, as_, ad, su, dt, ar]) => {
        setMetering(me);
        setApps(ap);
        setAssets(as_);
        setAdvice(ad);
        setSummary(su);
        setDeptTco(dt);
        setAppRank(ar);
        setLoading(false);
        const pre = params.get('appId');
        if (pre) setAppFilter(pre);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appName = useMemo(() => Object.fromEntries(apps.map((a) => [a.appId, a.appName])), [apps]);
  const assetName = useMemo(() => Object.fromEntries(assets.map((a) => [a.assetId, a.assetName])), [assets]);

  /** 单条流水成本（受"失败重试是否计入"开关影响，规范 6.5.5） */
  const costOf = (m: MeteringRecord): number => {
    if (m.success || retryIncluded) return m.tcoTotal;
    const unit = (assets.find((a) => a.assetId === m.assetId)?.costPer1kTokens ?? 0.25) / 1000;
    return m.tcoTotal - (m.retryTokens + m.failureTokens) * unit;
  };

  const kpi = useMemo(() => {
    const s = summary ?? { inputTokens: 0, outputTokens: 0, cacheHitTokens: 0, gpuHours: 0, requests: 0, tco: 0 };
    // 失败/重试计入开关：全行口径中失败/重试 Token 约占 1.8%（规范 6.5.5）
    const tco = retryIncluded ? Math.round(s.tco * 1.018) : s.tco;
    return { input: s.inputTokens, output: s.outputTokens, cacheHit: s.cacheHitTokens, gpu: s.gpuHours, calls: s.requests, tco };
  }, [summary, retryIncluded]);

  const deptRank = useMemo(() => deptTco, [deptTco]);

  /** 旭日图数据：外环=部门 TCO（全行量级），内环=全行 Top 应用（颜色随所属部门，半透明区分层级） */
  const DEPT_COLORS = ['#2d7be5', '#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#6b5ce7'];
  const sunburst = useMemo(() => {
    const outer = deptRank.map((d, i) => ({
      key: d.deptId,
      name: d.deptName,
      value: Math.round(d.tco),
      fill: DEPT_COLORS[i % 6],
    }));
    // 部门 → 外环色映射，内环应用继承部门色（修复原内环与背景同色不可见问题）
    const deptColor: Record<string, string> = Object.fromEntries(deptRank.map((d, i) => [d.deptId, DEPT_COLORS[i % 6]]));
    const inner = appRank.map((r) => {
      const app = apps.find((a) => a.appId === r.appId);
      const base = (app && deptColor[app.deptId]) || '#94a3b8';
      return { key: r.appId, name: r.name, value: Math.round(r.tco), fill: base };
    });
    return { outer, inner };
  }, [deptRank, appRank, apps]);

  const filtered = useMemo(() => {
    const list = metering.filter(
      (m) =>
        (tenantId === 'GLOBAL' || m.tenantId === tenantId) &&
        (!deptFilter || m.deptId === deptFilter) &&
        (!appFilter || m.appId === appFilter),
    );
    return [...list].sort((a, b) => b.billId.localeCompare(a.billId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metering, tenantId, deptFilter, appFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [deptFilter, appFilter]);

  const toggleRetry = () => {
    setRetryIncluded((v) => !v);
    setCalib(true); // 口径变更提示（规范 6.5.5：记录口径变更）
  };

  const acceptAdvice = (a: OptimizeAdvice) => {
    setAdvice((list) =>
      list.map((x) => (x.adviceId === a.adviceId ? { ...x, status: 'ACCEPTED' as const, workOrderId: `WO-20260803-${String(100 + list.length)}` } : x)),
    );
  };

  /** 建议闭环推进（9.5）：采纳→执行→验证→关闭 */
  const progressAdvice = async (a: OptimizeAdvice) => {
    await api.progressAdvice(a.adviceId);
    const next = await api.getOptimizeAdvice();
    setAdvice(next);
  };

  const adviceNextLabel: Partial<Record<OptimizeAdvice['status'], string>> = {
    ACCEPTED: '标记已执行',
    EXECUTED: '验证收益',
    VERIFIED: '关闭归档',
  };

  if (loading) {
    return <div className="panel h-16 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 管理页标准页头 */}
      <PageHeader
        crumb="计量运营"
        title="计量台账"
        desc="Token 与卡时计量、成本四类分摊、账单流水与口径管理；失败/重试计入口径可切换，变更全程留痕。"
        actions={
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
          >
            <Download size={12} /> 导出日报
          </button>
        }
      />

      {/* 口径变更横幅（6.5.6） */}
      {calib && <Banner tone="warning">计量口径变更已生效：失败/重试{' '}{retryIncluded ? '已计入' : '未计入'}成本，TCO 与排行已即时重算（留痕）</Banner>}

      {/* 指标概览条（窄指标条，不再使用大屏 KPI 卡） */}
      <KpiStrip
        items={[
          { label: '输入 Token', value: fmtWan(kpi.input), unit: 'Tokens', hint: '近 24h 输入 Token（含失败/重试按开关）' },
          { label: '输出 Token', value: fmtWan(kpi.output), unit: 'Tokens', tone: 'text-success', hint: '近 24h 输出 Token' },
          { label: '缓存命中', value: fmtWan(kpi.cacheHit), unit: 'Tokens', tone: 'text-warning', hint: 'Token 级缓存命中' },
          { label: '卡时', value: fmt(kpi.gpu), unit: 'GPU·h', hint: '卡时=GPU 卡数×计算时长' },
          { label: '调用量', value: fmt(kpi.calls), unit: '次', hint: '成功+失败+重试请求总次数' },
          { label: 'TCO', value: fmtYuan(kpi.tco), tone: 'text-danger', hint: '四类成本之和（含/不含失败重试由开关控制）' },
        ]}
      />

      {/* 失败/重试开关（6.5.5） */}
      <div className="flex items-center justify-between rounded border border-border-default bg-bg-panel px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Repeat size={14} className="text-warning" />
          失败/重试是否计入成本（默认不计入；切换后 TCO 与排行即时重算并留痕）
        </div>
        <button
          onClick={toggleRetry}
          role="switch"
          aria-checked={retryIncluded}
          className={`relative h-6 w-11 rounded-full transition-colors ${retryIncluded ? 'bg-primary/60' : 'bg-border-default'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-text-primary transition-all ${retryIncluded ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* 部门排行 + TCO 旭日图（6.5.2） */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="部门 / 业务线排行（点击下钻账单）" className="col-span-5" height={300}>
          {deptRank.length === 0 ? (
            <EmptyState text="暂无部门数据" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">部门</th>
                  <th className="pb-2 font-medium">Token 消耗</th>
                  <th className="pb-2 font-medium">TCO</th>
                  <th className="pb-2 font-medium">占比</th>
                </tr>
              </thead>
              <tbody>
                {deptRank.map((d) => (
                  <tr
                    key={d.deptId}
                    onClick={() => {
                      setDeptFilter(deptFilter === d.deptId ? '' : d.deptId);
                      setAppFilter('');
                    }}
                    className={`cursor-pointer border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft ${deptFilter === d.deptId ? 'bg-primary/5' : ''}`}
                  >
                    <td className="py-2">
                      <span className={deptFilter === d.deptId ? 'text-primary' : 'text-text-primary'}>{d.deptName}</span>
                      {deptFilter === d.deptId && <span className="ml-1.5 text-xs text-primary">筛选生效</span>}
                    </td>
                    <td className="num py-2 text-text-secondary">{fmtWan(d.tokens)}</td>
                    <td className="num py-2 text-text-primary">{fmtYuan(d.tco)}</td>
                    <td className="num py-2 text-xs text-text-secondary">
                      {kpi.tco ? `${(d.tco / kpi.tco * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="TCO 分摊分析（旭日图：部门 → Top 应用）" className="col-span-7" height={300}>
          <div className="flex h-full gap-2">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sunburst.inner} dataKey="value" nameKey="name" innerRadius="38%" outerRadius="62%" paddingAngle={1} isAnimationActive={false} fillOpacity={0.55} stroke="var(--color-bg-page)">
                    {sunburst.inner.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                  <Pie data={sunburst.outer} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="94%" paddingAngle={1} isAnimationActive={false} stroke="var(--color-bg-page)">
                    {sunburst.outer.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.55)' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                    formatter={(v) => fmtYuan(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex w-44 shrink-0 flex-col gap-1.5 overflow-auto text-xs">
              {sunburst.outer.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-text-secondary">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.fill }} />
                    {d.name}
                  </span>
                  <span className="num shrink-0 text-text-primary">{fmtYuan(d.value)}</span>
                </div>
              ))}
              <div className="mt-1 border-t border-border-default pt-1.5 text-text-secondary/80">内环 · Top 应用（色随部门）</div>
              {sunburst.inner.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-text-secondary">
                    <span className="h-2 w-2 shrink-0 rounded-sm opacity-60" style={{ background: d.fill }} />
                    {d.name}
                  </span>
                  <span className="num shrink-0 text-text-primary">{fmtYuan(d.value)}</span>
                </div>
              ))}
              <div className="mt-1 border-t border-border-default pt-1.5 text-text-secondary">
                成本按四类拆分；悬停扇区查看数值并自动增亮
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* 账单流水（主体台账：筛选 + 分页 + 明细 Drawer） */}
      <Panel
        title={`账单流水${deptFilter ? ` · ${DEPT_NAME[deptFilter] ?? deptFilter}` : ''}${appFilter ? ` · ${appName[appFilter] ?? appFilter}` : ''}${tenantId !== 'GLOBAL' ? ` · ${tenantId.replace('TENANT-', '')}` : ''}`}
        height={320}
        extra={
          <span className="num text-xs text-text-secondary">当前窗口 {filtered.length} 条 · 近 24h 全行全量 {fmt(summary?.requests ?? 0)} 条</span>
        }
      >
        {pageRows.length === 0 ? (
          <EmptyState text="当前筛选范围内无账单流水" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">账单号</th>
                  <th className="pb-2 font-medium">TraceID</th>
                  <th className="pb-2 font-medium">应用</th>
                  <th className="pb-2 font-medium">模型</th>
                  <th className="pb-2 font-medium">输入/输出 Token</th>
                  <th className="pb-2 font-medium">缓存命中</th>
                  <th className="pb-2 font-medium">卡时</th>
                  <th className="pb-2 font-medium">TCO</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr
                    key={m.billId}
                    onClick={() => setBillDetail(m)}
                    className={`cursor-pointer border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft ${!m.success ? 'bg-danger/5' : ''}`}
                  >
                    <td className="py-2 font-mono text-xs text-primary">{m.billId}</td>
                    <td className="py-2 font-mono text-xs text-text-secondary">{m.traceId}</td>
                    <td className="py-2 text-xs text-text-secondary">{appName[m.appId] ?? m.appId}</td>
                    <td className="py-2 text-xs text-text-secondary">{assetName[m.assetId] ?? m.assetId}</td>
                    <td className="num py-2">{fmt(m.promptTokens)} / {fmt(m.completionTokens)}</td>
                    <td className="num py-2 text-warning">{fmt(m.cacheHitTokens)}</td>
                    <td className="num py-2 text-text-secondary">{m.gpuHours} h</td>
                    <td className={`num py-2 ${!m.success ? 'text-danger' : 'text-text-primary'}`}>{fmtYuan(costOf(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                当前窗口 {filtered.length} 条 · 第 {page}/{pageCount} 页
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* 成本优化建议（6.5.4 / 9.5 闭环） */}
      <Panel title="成本优化建议" height={240} extra={<span className="text-xs text-text-secondary">识别 → 建议 → 采纳 → 执行 → 验证 → 关闭</span>}>
        {advice.length === 0 ? (
          <EmptyState text="暂无优化建议" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {advice.map((a) => (
              <div key={a.adviceId} className="flex flex-col justify-between rounded border border-border-default bg-panel-soft p-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">{a.title}</span>
                    <StatusTag status={a.status} size="sm" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">{a.description}</p>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="num text-lg font-semibold text-success">¥{fmt(a.estimatedSaving)}</div>
                    <div className="text-xs text-text-secondary">预估月节省</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAdviceDetail(a)}
                      className="flex items-center gap-1 rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
                    >
                      <FileText size={12} /> 依据
                    </button>
                    {a.status === 'IDENTIFIED' && !readOnly && (
                      <button
                        onClick={() => acceptAdvice(a)}
                        className="flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-1 text-xs text-success transition-colors hover:bg-success/20"
                      >
                        <CheckCircle2 size={12} /> 采纳
                      </button>
                    )}
                    {adviceNextLabel[a.status] && !readOnly && (
                      <button
                        onClick={() => progressAdvice(a)}
                        className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                        title="推进闭环：执行 → 验证 → 关闭"
                      >
                        <Repeat size={12} /> {adviceNextLabel[a.status]}
                      </button>
                    )}
                    {a.workOrderId && (
                      <span className="flex items-center gap-1 font-mono text-xs text-warning">工单 {a.workOrderId}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 账单明细 Drawer（6.5.4：可跳 Trace） */}
      <Drawer open={!!billDetail} onClose={() => setBillDetail(null)} title={`账单明细 · ${billDetail?.billId ?? ''}`}>
        {billDetail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <BillInfo k="TraceID" v={billDetail.traceId} mono />
              <BillInfo k="应用 / 部门" v={`${appName[billDetail.appId] ?? billDetail.appId} / ${DEPT_NAME[billDetail.deptId] ?? billDetail.deptId}`} />
              <BillInfo k="模型" v={`${assetName[billDetail.assetId] ?? billDetail.assetId}@${billDetail.modelVersion}`} />
              <BillInfo k="请求状态" v={billDetail.success ? '成功（计入成功口径）' : '失败/降级（不计入成功口径）'} />
              <BillInfo k="输入 / 输出 Token" v={`${fmt(billDetail.promptTokens)} / ${fmt(billDetail.completionTokens)}`} />
              <BillInfo k="缓存命中 / 失败 / 重试 Token" v={`${fmt(billDetail.cacheHitTokens)} / ${fmt(billDetail.failureTokens)} / ${fmt(billDetail.retryTokens)}`} />
              <BillInfo k="卡时 / 实例时长" v={`${billDetail.gpuHours} h / ${billDetail.instanceHours} h`} />
              <BillInfo k="排队等待" v={`${fmt(billDetail.queueWaitMs)} ms`} />
            </div>
            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="mb-2 text-xs text-text-secondary">成本四类拆分（元）</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <CostCell label="基础设施" value={fmtYuan(billDetail.costInfra)} />
                <CostCell label="推理计算" value={fmtYuan(billDetail.costCompute)} />
                <CostCell label="软件许可" value={fmtYuan(billDetail.costLicense)} />
                <CostCell label="外部调用" value={fmtYuan(billDetail.costExternal)} />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border-default pt-2">
                <span className="text-xs text-text-secondary">TCO（四类之和）</span>
                <span className="num text-base font-semibold text-primary">{fmtYuan(costOf(billDetail))}</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              关联提示：此流水可反查路由白盒（TraceID {billDetail.traceId}），跳转目标为 6.3 智能路由白盒页。
            </p>
          </div>
        )}
      </Drawer>

      {/* 建议依据 Drawer（9.5：禁止无依据建议） */}
      <Drawer open={!!adviceDetail} onClose={() => setAdviceDetail(null)} title={`建议依据 · ${adviceDetail?.title ?? ''}`} width={520}>
        {adviceDetail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <span className="text-sm text-text-secondary">预估月节省</span>
              <span className="num text-lg font-semibold text-success">¥{fmt(adviceDetail.estimatedSaving)}</span>
            </div>
            {adviceDetail.basis.map((b, i) => (
              <div key={i} className="rounded border border-border-default bg-panel-soft p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Activity size={12} /> 依据 {i + 1}：{b.data}
                </div>
                <div className="mt-1.5 text-sm">
                  <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">{b.metric}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{b.calc}</p>
              </div>
            ))}
            <p className="text-xs text-text-secondary">建议采纳后生成工单并流转至策略治理。</p>
          </div>
        )}
      </Drawer>

      {/* 导出 Dialog（6.5.4：展示字段范围 + 脱敏说明） */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExportOpen(false)} aria-hidden />
          <div role="dialog" aria-label="导出日报" className="relative w-[420px] rounded-xl border border-border-default bg-bg-panel p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Download size={15} className="text-primary" /> 导出计量日报
            </div>
            <div className="mt-3 space-y-2 text-xs text-text-secondary">
              <p>导出范围：当前筛选（部门 / 应用）内全部账单流水（{filtered.length} 条）。</p>
              <p>导出字段：账单号、TraceID、应用、模型、输入/输出 Token、缓存命中、卡时、四类成本、TCO。</p>
              <p className="rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-warning">
                脱敏说明：TraceID 将按租户隔离脱敏（外部审计导出按 L2 规则打码），TCO 金额保留 2 位小数。
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setExportOpen(false)} className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                取消
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  window.alert('日报 CSV 已生成（含字段范围与脱敏规则），将推送至报表服务与部门负责人邮箱');
                }}
                className="rounded bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillInfo({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      <div className={`truncate text-sm ${mono ? 'font-mono text-xs' : 'num'}`}>{v}</div>
    </div>
  );
}

function CostCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-bg-page px-2 py-1.5">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="num mt-0.5 text-sm text-text-primary">{value}</div>
    </div>
  );
}
