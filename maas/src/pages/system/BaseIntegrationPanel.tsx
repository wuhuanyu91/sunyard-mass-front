import { useEffect, useState } from 'react';
import { Link2, Play, Radio, RefreshCw, Save, Send, Ticket as TicketIcon } from 'lucide-react';
import { api } from '../../services/api';
import type { BaseIntegration, IntegrationLog, IntegrationStatus, TicketType } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { BTN_GHOST, BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const INT_STATUS: Record<IntegrationStatus, { label: string; cls: string; dot: string }> = {
  PENDING: { label: '待对接', cls: 'text-text-secondary', dot: 'bg-text-secondary/40' },
  CONNECTED: { label: '已连通', cls: 'text-success', dot: 'bg-success' },
  UNREACHABLE: { label: '不可达', cls: 'text-danger', dot: 'bg-danger' },
  DISABLED: { label: '未启用', cls: 'text-text-secondary', dot: 'bg-text-secondary/40' },
  UNCONFIGURED: { label: '未配置', cls: 'text-warning', dot: 'bg-warning' },
  ERROR: { label: '异常', cls: 'text-danger', dot: 'bg-danger' },
};

/** 系统管理 · 行内底座对接：IAM / 4A / 监控 / 告警 / 工单 对接配置与联动动作 */
export default function BaseIntegrationPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [list, setList] = useState<BaseIntegration[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { endpoint: string; remark: string }>>({});
  const [alertId, setAlertId] = useState('');
  const [ticket, setTicket] = useState<{ type: TicketType; title: string; content: string; from: string; deptName: string }>({
    type: 'PROBLEM', title: '', content: '', from: '', deptName: '信息科技部',
  });

  const reload = () => {
    Promise.all([api.getIntegrations(), api.getIntegrationLogs()]).then(([l, g]) => {
      setList(l); setLogs(g); setLoading(false);
    });
  };
  useEffect(() => { reload(); }, []);

  const setBusyAs = (k: string | null) => setBusy(k);

  const save = (it: BaseIntegration) => {
    const draft = editing[it.code] ?? { endpoint: it.endpoint ?? '', remark: it.remark ?? '' };
    setBusyAs('save-' + it.code);
    api.saveIntegration({ code: it.code, name: it.name, type: it.type, endpoint: draft.endpoint || null, enabled: it.enabled, remark: draft.remark || null })
      .then(() => { notify.success(`对接点 ${it.name} 配置已保存`); setBusyAs(null); reload(); })
      .catch(() => setBusyAs(null));
  };

  const toggleEnabled = (it: BaseIntegration) => {
    const next = it.enabled === 1 ? 0 : 1;
    setBusyAs('en-' + it.code);
    api.saveIntegration({ code: it.code, name: it.name, type: it.type, endpoint: it.endpoint, enabled: next, remark: it.remark })
      .then(() => { notify.success(next === 1 ? `已启用 ${it.name} 外部对接（真实外呼）` : `已关闭 ${it.name} 外部对接`); setBusyAs(null); reload(); })
      .catch(() => setBusyAs(null));
  };

  const test = (it: BaseIntegration) => {
    setBusyAs('test-' + it.code);
    api.testIntegration(it.code).then((r: Record<string, unknown>) => {
      const st = String(r.status ?? '');
      if (st === 'CONNECTED') notify.success(`${it.name} 连通性测试通过（${r.latencyMs ?? 0}ms）`);
      else notify.info(`${it.name}：${r.message ?? st}`);
      setBusyAs(null); reload();
    }).catch(() => setBusyAs(null));
  };

  const sync = () => {
    setBusyAs('sync');
    api.syncIam().then((r: Record<string, unknown>) => {
      notify.success(`IAM 账号同步完成：${r.syncedUserCount} 条（${r.mode === 'EXTERNAL' ? '真实外呼' : '本地闭环'}）`);
      setBusyAs(null); reload();
    }).catch(() => setBusyAs(null));
  };

  const push = () => {
    setBusyAs('push');
    api.pushMonitor().then(() => { notify.success('监控指标快照已推送（本地闭环/行内监控平台）'); setBusyAs(null); reload(); })
      .catch(() => setBusyAs(null));
  };

  const forward = () => {
    const id = alertId.trim();
    if (!id) { notify.info('请输入安全事件 ID'); return; }
    setBusyAs('forward');
    api.forwardAlert(id).then((r: Record<string, unknown>) => {
      notify.success(`告警已转发为工单 ${r.ticketId}`);
      setAlertId(''); setBusyAs(null); reload();
    }).catch(() => setBusyAs(null));
  };

  const createTicket = () => {
    if (!ticket.title.trim() || !ticket.content.trim() || !ticket.from.trim()) { notify.info('请填写工单标题、描述与提交人'); return; }
    setBusyAs('ticket');
    api.createIntegrationTicket({ ...ticket, title: ticket.title.trim(), content: ticket.content.trim(), from: ticket.from.trim() })
      .then((r: Record<string, unknown>) => { notify.success(`工单 ${r.ticketId} 已下发至行内工单系统（本地闭环）`); setBusyAs(null); reload(); })
      .catch(() => setBusyAs(null));
  };

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="行内底座对接"
        desc="与行内统一底座/运营管理体系对接：IAM 统一身份认证、4A 运维审计、统一监控平台、告警平台、工单系统。外部对接为配置门控——配置地址并启用后真实外呼，未配置时以本地闭环保证演示可跑通。"
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {list.map((it) => {
          const st = INT_STATUS[it.status] ?? INT_STATUS.PENDING;
          const draft = editing[it.code] ?? { endpoint: it.endpoint ?? '', remark: it.remark ?? '' };
          const toggleBusy = busy === 'en-' + it.code;
          const testBusy = busy === 'test-' + it.code;
          const saveBusy = busy === 'save-' + it.code;
          return (
            <div key={it.code} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 size={16} className="text-primary/70" />
                  <span className="text-sm font-medium text-text-primary">{it.name}</span>
                  <span className="rounded bg-bg-panel-soft px-1.5 py-0.5 text-[10px] text-text-secondary">{it.type}</span>
                </div>
                <span className={`flex items-center gap-1.5 text-xs ${st.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                </span>
              </div>

              <label className="text-[11px] text-text-secondary">对接地址（行内系统 endpoint）</label>
              <input
                value={draft.endpoint}
                onChange={(e) => setEditing((p) => ({ ...p, [it.code]: { ...draft, endpoint: e.target.value } }))}
                placeholder="https://iam.internal.example/api  （留空=未联调）"
                className="w-full rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
              />
              <label className="text-[11px] text-text-secondary">备注</label>
              <input
                value={draft.remark ?? ''}
                onChange={(e) => setEditing((p) => ({ ...p, [it.code]: { ...draft, remark: e.target.value } }))}
                placeholder="对接说明"
                className="w-full rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
              />

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button disabled={readOnly || saveBusy} onClick={() => save(it)} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                  <Save size={12} /> {saveBusy ? '保存中…' : '保存'}
                </button>
                <button disabled={readOnly || testBusy} onClick={() => test(it)} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                  <Radio size={12} className={testBusy ? 'animate-pulse' : ''} /> {testBusy ? '测试中…' : '连通性测试'}
                </button>
                <label className="ml-auto flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={it.enabled === 1} disabled={readOnly || toggleBusy} onChange={() => toggleEnabled(it)} />
                  启用真实外呼
                </label>
              </div>
              {it.lastSyncAt && (
                <div className="text-[10px] text-text-secondary/70">最近同步：{it.lastSyncAt}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 联动动作 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="IAM 账号同步" extra={<button disabled={readOnly || busy === 'sync'} onClick={sync} className={`flex items-center gap-1 ${BTN_PRIMARY}`}><Play size={12} /> {busy === 'sync' ? '同步中…' : '立即同步'}</button>}>
          <p className="text-xs leading-relaxed text-text-secondary">将平台账号与行内统一身份认证对齐；未配置外部地址时取本地账号数（本地闭环），启用后真实拉取/推送。</p>
        </Panel>
        <Panel title="监控指标推送" extra={<button disabled={readOnly || busy === 'push'} onClick={push} className={`flex items-center gap-1 ${BTN_PRIMARY}`}><Send size={12} /> {busy === 'push' ? '推送中…' : '推送快照'}</button>}>
          <p className="text-xs leading-relaxed text-text-secondary">将平台运行指标（账号数/安全事件数）推送至行内统一监控平台；本地闭环落对接日志，启用后推送到采集 agent。</p>
        </Panel>
        <Panel title="告警转发工单" extra={<button disabled={readOnly || busy === 'forward'} onClick={forward} className={`flex items-center gap-1 ${BTN_PRIMARY}`}><TicketIcon size={12} /> {busy === 'forward' ? '转发中…' : '转发'}</button>}>
          <input value={alertId} onChange={(e) => setAlertId(e.target.value)} placeholder="安全事件 ID（如 SEC-xxx）" className="w-full rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          <p className="mt-2 text-[11px] leading-relaxed text-text-secondary/70">将平台安全告警实时转发至行内告警平台并生成工单（演示环境落入本地工单列表）。</p>
        </Panel>
      </div>

      {/* 工单下发 */}
      <Panel title="工单下发（对接行内工单系统）">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">工单类型</label>
            <select value={ticket.type} onChange={(e) => setTicket({ ...ticket, type: e.target.value as TicketType })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
              <option value="PROBLEM">问题报修</option>
              <option value="REQUEST">资源需求</option>
              <option value="SUGGEST">优化建议</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">提交部门</label>
            <select value={ticket.deptName} onChange={(e) => setTicket({ ...ticket, deptName: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
              {['信息科技部', '零售银行总部', '公司银行总部', '风险管理部', '运营管理部', '金融市场部'].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-secondary">工单标题</label>
            <input value={ticket.title} onChange={(e) => setTicket({ ...ticket, title: e.target.value })} placeholder="一句话描述问题/诉求" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-secondary">详细描述</label>
            <textarea value={ticket.content} onChange={(e) => setTicket({ ...ticket, content: e.target.value })} rows={3} placeholder="问题描述/影响范围/预期目标" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">提交人</label>
            <input value={ticket.from} onChange={(e) => setTicket({ ...ticket, from: e.target.value })} placeholder="如：刘凯" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div className="flex items-end">
            <button disabled={readOnly || busy === 'ticket'} onClick={createTicket} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
              <TicketIcon size={12} /> {busy === 'ticket' ? '下发中…' : '下发工单'}
            </button>
          </div>
        </div>
      </Panel>

      {/* 对接事件日志 */}
      <Panel
        title="对接事件日志"
        extra={<button disabled={loading} onClick={reload} className={`flex items-center gap-1 ${BTN_GHOST}`}><RefreshCw size={12} /> 刷新</button>}
      >
        <div className="space-y-1.5">
          {logs.length === 0 && <p className="py-4 text-center text-xs text-text-secondary">暂无对接事件</p>}
          {logs.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-bg-panel-soft px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{g.intCode}</span>
                <span className="font-medium text-text-primary">{g.action}</span>
                <span className={g.status === 'OK' ? 'text-success' : 'text-danger'}>{g.status}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-secondary/70">
                {g.latencyMs != null && <span>{g.latencyMs}ms</span>}
                <span className="max-w-[260px] truncate">{g.message}</span>
                <span className="num">{g.createdAt?.replace('T', ' ').slice(0, 19)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
