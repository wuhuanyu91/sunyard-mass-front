import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { User, Clock, CheckCircle2, XCircle, Boxes, FlaskConical, Gauge, ScrollText, RotateCcw, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import type { Announcement, ApiKey, ModelRecommend, MyApplication, PersonalTrendPoint, PersonalUsage, QuotaProfile } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import StatusTag from '../../components/ui/StatusTag';
import { Tabs } from '../../components/ui/Controls';
import { ProgressBar, QuotaBar } from '../../components/ui/Bits';
import { BTN_GHOST } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';
import { useSearchParams } from 'react-router-dom';

const KIND_LABEL: Record<MyApplication['kind'], string> = {
  MODEL_ACCESS: '模型接入',
  QUOTA_ADJUST: '配额调整',
  QUOTA_RESUME: '配额恢复',
  API_KEY: 'API Key',
};

const ANN_LABEL: Record<Announcement['type'], { label: string; cls: string }> = {
  MAINTENANCE: { label: '维护通告', cls: 'bg-warning/10 text-warning' },
  BROADCAST: { label: '事件广播', cls: 'bg-danger/10 text-danger' },
  NOTICE: { label: '公告', cls: 'bg-primary/10 text-primary' },
};

/** 快捷服务（业务员高频自助动作） */
const QUICK_ACTIONS = [
  { label: '模型广场', desc: '发现模型 · 发起接入', icon: Boxes, to: '/assets?tab=plaza' },
  { label: '模型体验', desc: '在线试用 · 双模对比', icon: FlaskConical, to: '/assets?tab=playground' },
  { label: '配额管理', desc: '查部门配额 · 提交调整', icon: Gauge, to: '/metering?tab=quota' },
  { label: '调用日志', desc: '自查本人调用记录', icon: ScrollText, to: '/metering?tab=logs' },
];

const TREND_TOOLTIP = {
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

/** 当前用户画像（业务员视角：零售银行总部 · 陈晓） */
const ME = { userId: 'U-3001', name: '陈晓', deptId: 'DEPT-RETAIL', deptName: '零售银行总部', role: '部门查看（BIZ_VIEWER）' };

/** P0-3 + P1-10 个人中心：业务员自助门户 + 申请人进度中心 */
export default function Workbench() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'usage');
  const navigate = useNavigate();
  const notify = useNotify();
  const { readOnly } = useApp();
  const [personals, setPersonals] = useState<PersonalUsage[]>([]);
  const [quotas, setQuotas] = useState<QuotaProfile[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [applies, setApplies] = useState<MyApplication[]>([]);
  const [trend, setTrend] = useState<PersonalTrendPoint[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [recommends, setRecommends] = useState<ModelRecommend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = params.get('tab');
    if (t) setTab(t);
  }, [params]);

  const loadApplies = () => api.getMyApplications().then(setApplies);

  useEffect(() => {
    Promise.all([
      api.getPersonalUsage(),
      api.getQuotas(),
      api.getApiKeys(),
      api.getMyApplications(),
      api.getPersonalTrend(),
      api.getAnnouncements(),
      api.getModelRecommends(),
    ]).then(([p, q, k, a, t, an, r]) => {
      setPersonals(p);
      setQuotas(q);
      setKeys(k);
      setApplies(a);
      setTrend(t);
      setAnns(an);
      setRecommends(r);
      setLoading(false);
    });
  }, []);

  const me = useMemo(() => personals.find((p) => p.userId === ME.userId), [personals]);
  const myDeptQuota = useMemo(() => quotas.find((q) => q.deptId === ME.deptId), [quotas]);
  const myKeys = useMemo(() => keys.filter((k) => k.ownerDept === ME.deptId), [keys]);
  const trendSum = useMemo(() => trend.reduce((acc, d) => ({ tokens: acc.tokens + d.tokens, cost: acc.cost + d.cost }), { tokens: 0, cost: 0 }), [trend]);

  /** 驳回单重新提交（生成新单走审批，原单保留可追溯） */
  const resubmit = (a: MyApplication) => {
    api.resubmitApplication(a.applyId).then(() => {
      notify.success('已重新提交，进入审批流程');
      loadApplies();
    });
  };

  if (loading) {
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
      {/* 管理页标准页头 */}
      <PageHeader
        crumb="个人中心"
        title="个人任务中心"
        desc="用量自查与趋势、快捷自助入口、平台公告与成本优化建议；申请进度统一跟踪，驳回可重新提交。"
      />

      {/* 身份条 */}
      <div className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-panel px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <User size={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {ME.name} <span className="ml-1 font-mono text-xs font-normal text-text-secondary">{ME.userId}</span>
          </div>
          <div className="text-xs text-text-secondary">{ME.deptName} · 角色：{ME.role}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setTab('usage')} className={BTN_GHOST}>我的用量</button>
          <button onClick={() => setTab('applies')} className={BTN_GHOST}>我的申请</button>
        </div>
      </div>

      {/* 快捷服务（高频自助动作直达） */}
      <div className="grid grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => navigate(qa.to)}
            className="hover-lift panel flex items-center gap-3 p-3 text-left transition-colors hover:border-primary/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <qa.icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text-primary">{qa.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-text-secondary">{qa.desc}</span>
            </span>
            <ArrowRight size={14} className="ml-auto shrink-0 text-text-secondary/50" />
          </button>
        ))}
      </div>

      <Tabs
        tabs={[
          { key: 'usage', label: '我的用量' },
          { key: 'applies', label: '我的申请', badge: applies.filter((a) => a.status === 'PENDING').length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'usage' ? (
        <>
          {/* 个人用量概览条（窄指标条） */}
          <KpiStrip
            items={[
              { label: '本人 Token 用量（近 24h）', value: me ? `${(me.tokens / 10000).toFixed(0)} 万` : '—', unit: 'Tokens' },
              { label: '折算费用（近 24h）', value: `¥${me?.cost.toLocaleString() ?? '—'}` },
              { label: '近 14 天累计用量', value: `${(trendSum.tokens / 10000).toFixed(0)} 万`, unit: 'Tokens' },
              { label: '本部门可用 Key', value: `${myKeys.filter((k) => k.status === 'ENABLED').length} 个启用` },
            ]}
          />

          <div className="grid grid-cols-12 gap-3">
            {/* 我的用量趋势（近 14 天） */}
            <Panel title="我的用量趋势（近 14 天）" className="col-span-7" extra={<span className="num text-xs text-text-secondary">累计 {(trendSum.tokens / 10000).toFixed(0)} 万 Tokens · ¥{trendSum.cost.toLocaleString()}</span>}>
              <ResponsiveContainer width="100%" height={185}>
                <AreaChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="wbTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border-default)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 10000}万`} />
                  <Tooltip {...TREND_TOOLTIP} formatter={(v) => `${Number(v).toLocaleString()} Tokens`} />
                  <Area type="monotone" dataKey="tokens" name="用量" stroke="#2563eb" strokeWidth={2} fill="url(#wbTrend)" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="pt-1 text-[11px] text-text-secondary/70">按自然日汇总本人调用 Token，周末回落为正常办公节律；费用按模型单价折算。</p>
            </Panel>

            {/* 与我相关的公告 */}
            <Panel title="平台公告" className="col-span-5" extra={<span className="num text-xs text-text-secondary">{anns.length} 条</span>}>
              <div className="space-y-2">
                {anns.slice(0, 3).map((a) => (
                  <div key={a.annId} className="rounded border border-border-default bg-panel-soft px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ANN_LABEL[a.type].cls}`}>{ANN_LABEL[a.type].label}</span>
                      <span className="truncate text-xs font-medium text-text-primary">{a.title}</span>
                      {a.pinned && <span className="shrink-0 rounded bg-danger/10 px-1 text-[10px] text-danger">置顶</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary">{a.content}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* 部门配额余量 */}
            <Panel title="本部门配额余量（月度）" className="col-span-5">
              {myDeptQuota ? (
                <div className="space-y-3">
                  <QuotaBar used={myDeptQuota.usedTokens} total={myDeptQuota.monthTokenQuota} />
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>状态：<StatusTag status={myDeptQuota.status} ns="Quota" size="sm" /></span>
                    <span>预警阈值 {myDeptQuota.warnThreshold}%</span>
                  </div>
                  {myDeptQuota.status !== 'NORMAL' && (
                    <p className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                      部门配额异常可能影响您的调用，可在「我的申请」中查看恢复/调整进度。
                    </p>
                  )}
                  <button onClick={() => navigate('/metering?tab=quota')} className={BTN_GHOST}>查看部门配额详情 →</button>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">暂无配额数据</p>
              )}
            </Panel>

            {/* 行为标签分布 */}
            <Panel title="我的调用行为分布（行为分析引擎）" className="col-span-7">
              <div className="space-y-2.5">
                {(me?.tagDist ?? []).map((t) => (
                  <div key={t.tag}>
                    <div className="flex justify-between text-xs">
                      <span className={t.tag === '业务办公' ? 'text-success' : t.tag === '开发调试' ? 'text-primary' : 'text-warning'}>{t.tag}</span>
                      <span className="num text-text-secondary">{t.pct}%</span>
                    </div>
                    <div className="mt-1"><ProgressBar pct={t.pct} tone={t.tag === '业务办公' ? 'success' : t.tag === '开发调试' ? 'primary' : 'danger'} /></div>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-text-secondary/70">行为分析引擎基于调用内容抽样分类，结果用于部门用量审计，个人可自查；如有异议可向部门管理员申诉。</p>
              </div>
            </Panel>
          </div>

          {/* 成本优化建议（平台级模型替换建议，业务员可反馈采纳意向） */}
          <Panel title="成本优化建议（与我部门相关场景）" extra={<span className="text-xs text-text-secondary">基于调用量 / 成本 / 效果分析</span>}>
            <div className="space-y-2">
              {recommends.slice(0, 3).map((r) => (
                <div key={r.recId} className="flex items-center gap-3 rounded border border-border-default bg-panel-soft px-3 py-2 text-xs">
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{r.scene}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-text-secondary">
                    <span className="truncate">{r.currentModel}</span>
                    <ArrowRight size={12} className="shrink-0 text-text-secondary/50" />
                    <span className="truncate font-medium text-text-primary">{r.recommendModel}</span>
                  </span>
                  <span className="num shrink-0 text-success">预计省 ¥{(r.estSaving / 10000).toFixed(0)} 万/月</span>
                  <button onClick={() => navigate('/metering?tab=stats')} className={`${BTN_GHOST} shrink-0`}>查看测算</button>
                </div>
              ))}
            </div>
          </Panel>

          {/* 本部门 Key 视图（脱敏） */}
          <Panel title="本部门 API Key（个人视图仅可见脱敏信息）">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">Key</th>
                  <th className="pb-2 font-medium">描述</th>
                  <th className="pb-2 font-medium">环境</th>
                  <th className="pb-2 font-medium">状态</th>
                  <th className="pb-2 font-medium">使用 / 额度</th>
                </tr>
              </thead>
              <tbody>
                {myKeys.map((k) => (
                  <tr key={k.keyId} className="border-b border-border-default/40 last:border-0">
                    <td className="py-2 font-mono text-xs text-primary">{k.keyMasked}</td>
                    <td className="py-2 text-xs text-text-secondary">{k.desc}</td>
                    <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] ${k.env === 'PROD' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>{k.env === 'PROD' ? '生产' : '测试'}</span></td>
                    <td className="py-2"><StatusTag status={k.status} ns="KeyStatus" size="sm" /></td>
                    <td className="num py-2 text-xs">{k.usedCount.toLocaleString()} / {k.callQuota === 0 ? '不限' : k.callQuota.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      ) : (
        /* ---------- 我的申请（申请人进度中心） ---------- */
        <Panel title="我的申请（统一进度跟踪）" extra={<span className="num text-xs text-text-secondary">{applies.length} 条 · 待审批 {applies.filter((a) => a.status === 'PENDING').length}</span>}>
          <div className="space-y-2.5">
            {applies.map((a) => (
              <div key={a.applyId} className="rounded border border-border-default bg-panel-soft p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${a.kind === 'MODEL_ACCESS' ? 'bg-success/10 text-success' : a.kind === 'API_KEY' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                      {KIND_LABEL[a.kind]}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{a.title}</span>
                    <span className="num font-mono text-[10px] text-text-secondary/60">{a.applyId}</span>
                  </div>
                  {a.status === 'PENDING' ? (
                    <span className="flex items-center gap-1 text-xs text-warning"><Clock size={12} /> 审批中</span>
                  ) : a.status === 'APPROVED' ? (
                    <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 size={12} /> 已通过</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-danger"><XCircle size={12} /> 已驳回</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-text-secondary">申请理由：{a.reason}</p>
                {/* 进度时间线 */}
                <div className="mt-2.5 flex items-center gap-1 text-[11px]">
                  <Step done label="提交申请" time={a.submitAt} />
                  <span className="h-px w-8 bg-border-default" aria-hidden />
                  <Step done={a.status !== 'PENDING'} active={a.status === 'PENDING'} label="审批中" time={a.status === 'PENDING' ? '' : a.approveAt ?? ''} />
                  <span className="h-px w-8 bg-border-default" aria-hidden />
                  <Step done={a.status === 'APPROVED'} failed={a.status === 'REJECTED'} label={a.status === 'REJECTED' ? '已驳回' : '完成'} time={a.approveAt ?? ''} />
                </div>
                {a.opinion && (
                  <p className={`mt-2 rounded px-3 py-1.5 text-xs ${a.status === 'REJECTED' ? 'bg-danger/5 text-danger' : 'bg-success/5 text-success'}`}>审批意见：{a.opinion}</p>
                )}
                {a.status === 'REJECTED' && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => resubmit(a)}
                      disabled={readOnly}
                      className={`${BTN_GHOST} flex items-center gap-1`}
                      title={readOnly ? '只读模式下写操作已禁用' : '按审批意见完善后重新提交，生成新单走审批'}
                    >
                      <RotateCcw size={12} /> 重新提交
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-text-secondary/70">提示：模型接入申请在「模型资产 → 模型广场」发起；配额相关申请在「计量运营 → 配额管理」发起，均自动汇总至此。</p>
        </Panel>
      )}
    </div>
  );
}

function Step({ done, failed, active, label, time }: { done?: boolean; failed?: boolean; active?: boolean; label: string; time: string }) {
  const cls = failed ? 'border-danger/50 bg-danger/10 text-danger' : done ? 'border-success/50 bg-success/10 text-success' : active ? 'border-warning/50 bg-warning/10 text-warning' : 'border-border-default bg-bg-page text-text-secondary';
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${cls}`}>
      {done && <CheckCircle2 size={10} />}
      {label}
      {time && <span className="num opacity-70">{new Date(time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
    </span>
  );
}
