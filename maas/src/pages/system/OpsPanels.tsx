import { Fragment, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageSquareReply, Plus, RefreshCw, Save } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformService, SysTicket, SystemParams, TicketType } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/Bits';
import { Stepper, ToggleSwitch } from '../../components/ui/Controls';
import { Modal, BTN_GHOST, BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const SVC_STATUS: Record<PlatformService['status'], { label: string; cls: string; dot: string }> = {
  RUNNING: { label: '运行中', cls: 'text-success', dot: 'bg-success' },
  DEGRADED: { label: '性能降级', cls: 'text-warning', dot: 'bg-warning' },
  DOWN: { label: '故障', cls: 'text-danger', dot: 'bg-danger' },
};

/** 系统管理 · 平台监控：分布式平台视角（各组件多副本跨节点部署，30 秒级拨测），支持手动重新拨测 */
export function MonitorPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [svcs, setSvcs] = useState<PlatformService[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const reload = () => api.getPlatformServices().then((s) => { setSvcs(s); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const rescan = () => {
    setScanning(true);
    api.rescanServices().then(() => {
      reload();
      setScanning(false);
      notify.success('全量拨测完成，探测结果已刷新');
    });
  };

  const healthy = svcs.filter((s) => s.status === 'RUNNING').length;
  const totalReplicas = svcs.reduce((n, s) => n + s.replicas, 0);
  const readyReplicas = svcs.reduce((n, s) => n + s.readyReplicas, 0);

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="平台监控"
        desc="分布式平台视角：网关集群/注册中心/计量/审计/队列/K8s 控制面，多副本跨节点部署，30 秒级拨测，异常联动告警规则。"
      />
      <div className="flex items-center justify-between">
        <span className="num text-xs text-text-secondary">服务健康 {healthy}/{svcs.length} · 副本就绪 {readyReplicas}/{totalReplicas} · 拨测周期 30s</span>
        <button disabled={readOnly || scanning} onClick={rescan} className={`flex items-center gap-1 ${BTN_GHOST}`} title={readOnly ? '只读模式下写操作已禁用' : '手动触发全量服务拨测'}>
          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} /> {scanning ? '拨测中…' : '重新拨测'}
        </button>
      </div>

      {/* 平台组件拓扑：按请求处理链路排列，展示各组件副本分布 */}
      <Panel title="平台组件拓扑 · 副本分布">
        <div className="flex flex-wrap items-center gap-1.5">
          {svcs.map((s, i) => {
            const st = SVC_STATUS[s.status];
            return (
              <Fragment key={s.svcId}>
                {i > 0 && <span aria-hidden className="text-[11px] text-text-secondary/40">→</span>}
                <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${s.status === 'RUNNING' ? 'border-border-default bg-panel-soft' : 'border-warning/40 bg-warning/5'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${s.status === 'RUNNING' ? '' : 'animate-pulse'}`} />
                  <span className="text-xs font-medium text-text-primary">{s.name}</span>
                  <span className={`num text-[10px] ${s.readyReplicas === s.replicas ? 'text-text-secondary' : 'text-warning'}`}>{s.readyReplicas}/{s.replicas} 副本</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-text-secondary/70">副本数 = 分布节点数：组件多副本跨节点部署，任一节点故障自动摘除并重调度，业务无感。K8s 控制面与算力集群详情见 调度算力 → 算力总览。</p>
      </Panel>

      {/* 服务卡片：副本就绪 / 时延 / 负载 + 节点分布 */}
      <div className="grid grid-cols-3 gap-3">
        {svcs.map((s) => {
          const st = SVC_STATUS[s.status];
          return (
            <div key={s.svcId} className="panel flex flex-col gap-2.5 p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <span className={`relative flex h-2 w-2 ${s.status === 'RUNNING' ? '' : 'animate-pulse'}`}>
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${st.dot}`} />
                  </span>
                  {s.name}
                </span>
                <span className={`text-xs ${st.cls}`}>{st.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-bg-panel-soft py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{s.readyReplicas}/{s.replicas}</div>
                  <div className="text-[10px] text-text-secondary">副本就绪</div>
                </div>
                <div className="rounded bg-bg-panel-soft py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{s.latencyMs}ms</div>
                  <div className="text-[10px] text-text-secondary">探测时延</div>
                </div>
                <div className="rounded bg-bg-panel-soft py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{Math.max(s.cpuPct, s.memPct)}%</div>
                  <div className="text-[10px] text-text-secondary">负载峰值</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.nodes.map((n) => (
                  <span key={n} className={`num rounded px-1.5 py-0.5 font-mono text-[10px] ${s.readyReplicas === s.replicas ? 'bg-bg-panel-soft text-text-secondary' : 'bg-warning/10 text-warning'}`}>{n}</span>
                ))}
              </div>
              <ProgressBar pct={Math.max(s.cpuPct, s.memPct)} tone={Math.max(s.cpuPct, s.memPct) >= 75 ? 'danger' : 'primary'} />
              <div className="flex items-center justify-between text-[10px] text-text-secondary/70">
                <span>连续运行 {s.uptime}</span>
                <span className="num font-mono">{s.version}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-text-secondary/70">服务健康 {healthy}/{svcs.length}，副本就绪 {readyReplicas}/{totalReplicas}；拨测由行内监控平台代理执行，本视图只读聚合，处置入口在运维值班流程。</p>
    </>
  );
}

const TICKET_TYPE: Record<SysTicket['type'], { label: string; cls: string }> = {
  PROBLEM: { label: '问题', cls: 'bg-danger/10 text-danger' },
  REQUEST: { label: '需求', cls: 'bg-primary/10 text-primary' },
  SUGGEST: { label: '建议', cls: 'bg-success/10 text-success' },
};
const TICKET_STATUS: Record<SysTicket['status'], { label: string; cls: string }> = {
  OPEN: { label: '待处理', cls: 'bg-danger/10 text-danger' },
  PROCESSING: { label: '处理中', cls: 'bg-warning/10 text-warning' },
  RESOLVED: { label: '已解决', cls: 'bg-success/10 text-success' },
};

/** 系统管理 · 工单反馈：部门用户问题/需求/建议闭环（新建 → 回复 → 结单） */
export function TicketPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [tickets, setTickets] = useState<SysTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ type: TicketType; title: string; content: string; from: string; deptName: string }>({ type: 'PROBLEM', title: '', content: '', from: '', deptName: '信息科技部' });
  const [formErr, setFormErr] = useState('');

  const reload = () => api.getSysTickets().then((t) => { setTickets(t); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const openCount = useMemo(() => tickets.filter((t) => t.status !== 'RESOLVED').length, [tickets]);

  const submitReply = (t: SysTicket) => {
    const text = replyText.trim();
    if (!text) return;
    api.replyTicket(t.ticketId, text).then(() => {
      notify.success(`工单 ${t.ticketId} 已回复`);
      setReplying(null);
      setReplyText('');
      reload();
    });
  };

  const resolve = (t: SysTicket) => {
    api.resolveTicket(t.ticketId).then(() => {
      notify.success(`工单 ${t.ticketId} 已结单`);
      reload();
    });
  };

  const submitCreate = () => {
    if (!form.title.trim()) { setFormErr('请输入工单标题'); return; }
    if (!form.content.trim()) { setFormErr('请输入问题描述'); return; }
    if (!form.from.trim()) { setFormErr('请输入提交人'); return; }
    api.createTicket({ ...form, title: form.title.trim(), content: form.content.trim(), from: form.from.trim() }).then(() => {
      notify.success('工单已创建，进入待处理队列');
      setCreating(false);
      setForm({ type: 'PROBLEM', title: '', content: '', from: '', deptName: '信息科技部' });
      setFormErr('');
      reload();
    });
  };

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="工单反馈"
        desc="部门用户的问题/需求/建议统一入口：回复处理 → 结单留痕，超时未响应联动告警规则。"
      />
      <Panel
        title="工单列表"
        extra={
          <div className="flex items-center gap-2">
            <span className="num text-xs text-text-secondary">{tickets.length} 条 · 未结 {openCount}</span>
            <button disabled={readOnly} onClick={() => { setCreating(true); setFormErr(''); }} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : '代部门用户登记工单'}>
              <Plus size={12} /> 新建工单
            </button>
          </div>
        }
      >
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <div key={t.ticketId} className="rounded border border-border-default bg-panel-soft p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TICKET_TYPE[t.type].cls}`}>{TICKET_TYPE[t.type].label}</span>
                  <span className="truncate text-sm font-medium text-text-primary">{t.title}</span>
                  <span className="num shrink-0 font-mono text-[10px] text-text-secondary/60">{t.ticketId}</span>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${TICKET_STATUS[t.status].cls}`}>{TICKET_STATUS[t.status].label}</span>
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">{t.content}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-text-secondary/70">
                <span>提交人：{t.from}（{t.deptName}）</span>
                <span className="num">{new Date(t.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {t.reply && (
                <p className="mt-2 rounded bg-primary/5 px-3 py-1.5 text-xs text-text-primary">处理回复：{t.reply}</p>
              )}
              {replying === t.ticketId ? (
                <div className="mt-2 flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    placeholder="填写处理回复…"
                    className="flex-1 rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button disabled={readOnly || !replyText.trim()} onClick={() => submitReply(t)} className={BTN_PRIMARY}>提交回复</button>
                    <button onClick={() => { setReplying(null); setReplyText(''); }} className={BTN_GHOST}>取消</button>
                  </div>
                </div>
              ) : (
                t.status !== 'RESOLVED' && (
                  <div className="mt-2 flex gap-1.5">
                    <button disabled={readOnly} onClick={() => { setReplying(t.ticketId); setReplyText(t.reply); }} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                      <MessageSquareReply size={12} /> 回复
                    </button>
                    <button disabled={readOnly} onClick={() => resolve(t)} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                      <CheckCircle2 size={12} /> 结单
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* 新建工单（代部门用户登记，正式渠道为门户自助提交） */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="新建工单"
        width={460}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => setCreating(false)}>取消</button>
            <button className={BTN_PRIMARY} onClick={submitCreate}>提交工单</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">工单类型</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TicketType })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                <option value="PROBLEM">问题报修</option>
                <option value="REQUEST">资源需求</option>
                <option value="SUGGEST">优化建议</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">提交部门</label>
              <select value={form.deptName} onChange={(e) => setForm({ ...form, deptName: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                {['信息科技部', '零售银行总部', '公司银行总部', '风险管理部', '运营管理部', '金融市场部'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">工单标题</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="一句话描述问题/诉求" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">详细描述</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="含发生时间、影响范围、复现步骤（问题类）或预期目标（需求类）" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">提交人</label>
            <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="如：刘凯" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          {formErr && <p className="text-xs text-danger">{formErr}</p>}
        </div>
      </Modal>
    </>
  );
}

/** 系统管理 · 系统参数：安全合规基线（认证安全/审计合规/通知公告，对标银行业监管要求） */
export function ParamsPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [p, setP] = useState<SystemParams | null>(null);
  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSystemParams().then((v) => { setP(v); setOrigin(JSON.stringify(v)); });
  }, []);

  const dirty = useMemo(() => p !== null && JSON.stringify(p) !== origin && origin !== '', [p, origin]);

  const save = () => {
    if (!p) return;
    setSaving(true);
    api.saveSystemParams(p).then(() => {
      setSaving(false);
      setOrigin(JSON.stringify(p));
      notify.success('系统参数已保存，即时生效');
    });
  };

  const toggleChannel = (c: 'SITE' | 'MAIL' | 'SMS') => {
    if (!p) return;
    const has = p.notifyChannels.includes(c);
    setP({ ...p, notifyChannels: has ? p.notifyChannels.filter((x) => x !== c) : [...p.notifyChannels, c] });
  };

  if (!p) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="系统参数"
        desc="平台安全合规基线参数：认证安全/审计合规/通知公告，覆盖密码策略、会话、IP 白名单、脱敏、审计审批等，对标银行业监管要求。"
      />
      <Panel
        title="安全与合规基线"
        extra={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warning">有未保存的参数变更</span>}
            <button disabled={readOnly || !dirty || saving} onClick={save} className={BTN_PRIMARY}>
              <Save size={12} className="mr-1 inline" /> 保存并生效
            </button>
          </div>
        }
      >
        {/* 认证安全 */}
        <div className="mb-2 text-xs font-medium text-text-secondary">认证安全</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">密码最小长度</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">监管基线 ≥10 位</div>
            </div>
            <Stepper value={p.pwdMinLen} onChange={(v) => setP({ ...p, pwdMinLen: v })} min={8} max={32} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">密码须含特殊字符</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">提升口令抗爆破能力</div>
            </div>
            <ToggleSwitch checked={p.pwdNeedSpecial} onChange={(v) => setP({ ...p, pwdNeedSpecial: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">会话超时（分钟）</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">无操作自动退出登录</div>
            </div>
            <Stepper value={p.sessionTimeoutMin} onChange={(v) => setP({ ...p, sessionTimeoutMin: v })} min={5} max={120} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">管理员强制双因素</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">ADMIN 以上角色登录须 MFA</div>
            </div>
            <ToggleSwitch checked={p.mfaRequired} onChange={(v) => setP({ ...p, mfaRequired: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">连续失败锁定阈值（次）</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">超过即锁定账号并告警</div>
            </div>
            <Stepper value={p.loginFailLock} onChange={(v) => setP({ ...p, loginFailLock: v })} min={3} max={10} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">密码历史不可重复（次）</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">0 = 不校验历史密码</div>
            </div>
            <Stepper value={p.pwdHistoryNoRepeat} onChange={(v) => setP({ ...p, pwdHistoryNoRepeat: v })} min={0} max={10} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">登录 IP 白名单</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">行内网段才可登录平台</div>
            </div>
            <ToggleSwitch checked={p.ipWhitelistEnabled} onChange={(v) => setP({ ...p, ipWhitelistEnabled: v })} />
          </div>
        </div>

        {/* 审计合规 */}
        <div className="mb-2 mt-6 text-xs font-medium text-text-secondary">审计合规</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">审计留存（天）</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">监管要求 ≥180 天，不可低于基线</div>
            </div>
            <Stepper value={p.auditRetentionDays} onChange={(v) => setP({ ...p, auditRetentionDays: v })} min={180} max={3650} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">审计导出审批</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">导出审计日志须审批留痕</div>
            </div>
            <ToggleSwitch checked={p.auditExportApproval} onChange={(v) => setP({ ...p, auditExportApproval: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">操作日志明细级别</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">明细含请求/响应摘要，摘要仅操作概要</div>
            </div>
            <select
              value={p.opLogDetailLevel}
              onChange={(e) => setP({ ...p, opLogDetailLevel: e.target.value as SystemParams['opLogDetailLevel'] })}
              className="rounded border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:border-primary/60"
            >
              <option value="DETAIL">明细</option>
              <option value="SUMMARY">摘要</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">数据脱敏</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">响应与日志敏感字段自动打码</div>
            </div>
            <ToggleSwitch checked={p.dataMasking} onChange={(v) => setP({ ...p, dataMasking: v })} />
          </div>
        </div>

        {/* 通知与公告 */}
        <div className="mb-2 mt-6 text-xs font-medium text-text-secondary">通知与公告</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">通知渠道</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">配额预警/告警触达方式，可多选</div>
            </div>
            <div className="flex items-center gap-3">
              {([['SITE', '站内'], ['MAIL', '邮件'], ['SMS', '短信']] as const).map(([c, label]) => (
                <label key={c} className="flex items-center gap-1 text-xs text-text-secondary">
                  <ToggleSwitch checked={p.notifyChannels.includes(c)} onChange={() => toggleChannel(c)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">登录页公告</div>
              <div className="mt-0.5 text-[11px] text-text-secondary">登录页展示平台维护/合规公告</div>
            </div>
            <ToggleSwitch checked={p.loginAnnounceEnabled} onChange={(v) => setP({ ...p, loginAnnounceEnabled: v })} />
          </div>
        </div>
        <p className="pt-3 text-[11px] text-text-secondary/70">参数变更即时生效并写操作日志；审计留存低于 180 天将被拦截，保障监管检查可回溯。</p>
      </Panel>
    </>
  );
}
