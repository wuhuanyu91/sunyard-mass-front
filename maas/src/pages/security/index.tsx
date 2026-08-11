import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, FileLock2, Download, Eye, EyeOff, Hash } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { AlertAction, PlatformAlert, RouterLog, SecurityEvent } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import Banner from '../../components/ui/Banner';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal, BTN_PRIMARY, BTN_GHOST, BTN_SUCCESS } from '../../components/ui/Modal';
import { Field, INPUT_CLS, OperationTimeline } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import GuardrailConfigPanel from './GuardrailConfig';
import AuditSearch from './AuditSearch';
import AuditLogCenter from './AuditLogCenter';
import QualityAlertPanel from './QualityAlertPanel';
import MembersPanel from './MembersPanel';
import TenantPanel from './TenantPanel';
import { useApp } from '../../store/app';

const EVENT_TYPE_LABEL: Record<string, string> = {
  PROMPT_INJECTION: '提示注入',
  VIOLATION: '违规内容',
  MASKING: '敏感脱敏',
  UNAUTHORIZED: '越权',
  ABNORMAL: '异常行为',
};
const STAGE_LABEL: Record<string, string> = {
  INPUT: '输入护栏',
  OUTPUT: '输出护栏',
  TOOL: '工具护栏',
  KNOWLEDGE: '知识库护栏',
};
const STORE_LABEL: Record<string, string> = {
  FULL: '全文存储',
  MASKED: '脱敏存储',
  HASH_ONLY: '仅存哈希',
};
const LEVEL_COLOR: Record<string, string> = {
  INFO: '#2d7be5',
  WARN: '#f59e0b',
  ERROR: '#ef4444',
  CRITICAL: '#ef4444',
};

/** 租户 × 角色权限矩阵（6.7.2：RBAC 视图） */
const TENANT_MATRIX: { tenant: string; roles: { role: string; level: 'full' | 'partial' | 'none'; note: string }[] }[] = [
  { tenant: 'TENANT-RETAIL', roles: [{ role: 'ADMIN', level: 'full', note: '全量' }, { role: 'OPERATOR', level: 'full', note: '全量' }, { role: 'MODEL_OWNER', level: 'partial', note: '本租户模型' }, { role: 'AUDITOR', level: 'partial', note: '本租户审计' }, { role: 'BIZ_VIEWER', level: 'none', note: '无' }] },
  { tenant: 'TENANT-CORP', roles: [{ role: 'ADMIN', level: 'partial', note: '租户管理员' }, { role: 'OPERATOR', level: 'partial', note: '租户运营' }, { role: 'MODEL_OWNER', level: 'partial', note: '本租户模型' }, { role: 'AUDITOR', level: 'none', note: '无' }, { role: 'BIZ_VIEWER', level: 'full', note: '部门视图' }] },
  { tenant: 'TENANT-TECH', roles: [{ role: 'ADMIN', level: 'full', note: '平台管理员' }, { role: 'OPERATOR', level: 'full', note: '全量' }, { role: 'MODEL_OWNER', level: 'full', note: '全量' }, { role: 'AUDITOR', level: 'full', note: '全量' }, { role: 'BIZ_VIEWER', level: 'partial', note: '信息科技部视图' }] },
];

/** 6.7 安全运行中心（V4：页内 Tab 已上提为侧边栏子菜单，本页按 URL 参数渲染对应视图） */
export default function Security() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'posture');

  useEffect(() => {
    setTab(params.get('tab') ?? 'posture');
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      {tab === 'guardrail' ? (
        <GuardrailConfigPanel view={(params.get('gview') as 'conn' | 'policy' | 'res') ?? 'conn'} />
      ) : tab === 'tenant' ? (
        <TenantPanel />
      ) : tab === 'audit' ? (
        <AuditSearch />
      ) : tab === 'auditlog' ? (
        <AuditLogCenter />
      ) : tab === 'alertrule' ? (
        <QualityAlertPanel />
      ) : (
        <SecurityOverview />
      )}
    </div>
  );
}

/** 6.7 安全态势（原安全页） */
function SecurityOverview() {
  const { tenantId, readOnly } = useApp();
  const notify = useNotify();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [logs, setLogs] = useState<RouterLog[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<RouterLog | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [alertActions, setAlertActions] = useState<AlertAction[]>([]);
  const [alertDialog, setAlertDialog] = useState<{ alert: PlatformAlert; action: AlertAction['action'] } | null>(null);
  const [alertNote, setAlertNote] = useState('');

  useEffect(() => {
    Promise.all([api.getSecurityEvents(), api.getAlerts(), api.getRouterLogs(), api.getSummary(), api.getAlertActions()]).then(([ev, al, lg, su, aa]) => {
      setEvents(ev);
      setAlerts(al);
      setLogs(lg);
      setSummary(su);
      setAlertActions(aa);
      setLoading(false);
    });
  }, []);

  /** 告警处置（十一章闭环）：提交意见 → 状态流转 → 留痕 */
  const submitAlertAction = async () => {
    if (!alertDialog || alertNote.trim().length < 5) return;
    await api.alertAction(alertDialog.alert.alertId, alertDialog.action, alertNote.trim());
    const label = alertDialog.action === 'ACK' ? '已确认' : alertDialog.action === 'RESOLVE_START' ? '已转入处置中' : '已关闭';
    notify.success(`告警「${alertDialog.alert.title}」${label}，处置记录已留痕`);
    setAlertDialog(null);
    setAlertNote('');
    const [al, aa] = await Promise.all([api.getAlerts(), api.getAlertActions()]);
    setAlerts(al);
    setAlertActions(aa);
  };

  const stats = useMemo(() => {
    const s = summary ?? { securityEvents: 0, maskedEvents: 0, criticalEvents: 0, blocked: 0 };
    const levelDist = [
      { name: 'INFO', value: 17 },
      { name: 'WARN', value: 18 },
      { name: 'ERROR', value: 2 },
      { name: 'CRITICAL', value: 1 },
    ];
    return { total: s.securityEvents, blocked: s.blocked, masked: s.maskedEvents, critical: s.criticalEvents, levelDist };
  }, [summary]);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) => (tenantId === 'GLOBAL' || e.tenantId === tenantId) && (typeFilter === 'ALL' || e.eventType === typeFilter),
      ),
    [events, tenantId, typeFilter],
  );

  const searchTrace = (raw: string) => {
    const traceId = raw.trim();
    if (!traceId) return;
    const hit = logs.find((l) => l.traceId === traceId);
    if (hit) setSelectedTrace(hit);
    else window.alert(`未检索到该 TraceID：${traceId}，请确认时间范围`);
  };

  /** 展示是否需解锁（MASKED/HASH_ONLY 摘要模式，规范 6.7.5） */
  const isLocked = (e: SecurityEvent) => e.logStorageType !== 'FULL' && !unlocked.has(e.securityEventId);

  if (loading) {
    return <div className="panel h-40 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 管理页标准页头 */}
      <PageHeader
        crumb="安全审计"
        title="安全态势"
        desc="护栏拦截事件、风险告警处置与租户权限的统一管控入口；解锁与处置全程留痕。"
        actions={
          <button onClick={() => setExportOpen(true)} className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20">
            <Download size={12} /> 导出审计包
          </button>
        }
      />

      {/* 态势概览条（窄指标条；等级分布以文字呈现） */}
      <KpiStrip
        items={[
          { label: '事件总数（近 24h）', value: `${stats.total}`, hint: '近 24h 安全事件' },
          { label: '拦截', value: `${stats.blocked}`, tone: 'text-danger', hint: '已阻断请求' },
          { label: '脱敏', value: `${stats.masked}`, tone: 'text-warning', hint: '输出已脱敏' },
          { label: '严重/错误', value: `${stats.critical}`, tone: 'text-danger', hint: 'ERROR + CRITICAL' },
          { label: '待处置告警', value: `${alerts.filter((a) => a.alertStatus === 'OPEN').length}`, tone: 'text-warning', hint: '告警处置队列待办' },
        ]}
        extra={
          <div className="text-xs text-text-secondary">
            等级分布：
            {stats.levelDist.map((l) => (
              <span key={l.name} className="num ml-2">
                <span style={{ color: LEVEL_COLOR[l.name] }}>{l.name}</span> {l.value}
              </span>
            ))}
          </div>
        }
      />

      {/* 租户权限矩阵（6.7.2 TenantMatrix） */}
      <Panel title="多租户 / RBAC 权限矩阵" height={200}>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-left text-text-secondary">
                <th className="pb-2 pr-3 font-medium">租户</th>
                {['ADMIN', 'OPERATOR', 'MODEL_OWNER', 'AUDITOR', 'BIZ_VIEWER'].map((r) => (
                  <th key={r} className="px-2 pb-2 text-center font-medium">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TENANT_MATRIX.map((row) => (
                <tr key={row.tenant} className="border-b border-border-default/30 last:border-0">
                  <td className="py-2 pr-3 font-mono text-text-primary">{row.tenant}</td>
                  {row.roles.map((r) => (
                    <td key={r.role} className="px-2 py-2 text-center">
                      <span
                        title={r.note}
                        className={`inline-block rounded px-1.5 py-0.5 ${
                          r.level === 'full'
                            ? 'bg-success/15 text-success'
                            : r.level === 'partial'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-panel-soft text-text-secondary/50'
                        }`}
                      >
                        {r.level === 'full' ? '●' : r.level === 'partial' ? '◐' : '○'} {r.note}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 成员与权限管理（P1-8：RBAC 可编辑） */}
      <MembersPanel />

      {/* 护栏拦截面板 + Trace 查询（6.7.2） */}
      <div className="grid grid-cols-12 gap-3">
        <Panel
          title={`安全护栏拦截（${tenantId === 'GLOBAL' ? `近 24h 全量 ${summary?.securityEvents ?? 0} 起` : `租户 ${tenantId.replace('TENANT-', '')} 事件 ${filteredEvents.length} 起`} · 展示最新事件）`}
          className="col-span-8"
          height={320}
          extra={
            <div className="flex items-center gap-1 rounded border border-border-default bg-bg-page p-0.5">
              {(['ALL', 'PROMPT_INJECTION', 'MASKING', 'UNAUTHORIZED', 'ABNORMAL', 'VIOLATION'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${typeFilter === t ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {t === 'ALL' ? '全部' : EVENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          }
        >
          {filteredEvents.length === 0 ? (
            <EmptyState text="当前筛选下无安全事件" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">时间</th>
                  <th className="pb-2 font-medium">事件类型</th>
                  <th className="pb-2 font-medium">等级</th>
                  <th className="pb-2 font-medium">阶段</th>
                  <th className="pb-2 font-medium">规则</th>
                  <th className="pb-2 font-medium">动作</th>
                  <th className="pb-2 font-medium">存储</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr
                    key={e.securityEventId}
                    onClick={() => setSelectedEvent(e)}
                    className="cursor-pointer border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft"
                  >
                    <td className="num py-2 text-xs text-text-secondary">
                      {new Date(e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 text-text-primary">{EVENT_TYPE_LABEL[e.eventType]}</td>
                    <td className="py-2">
                      <StatusTag status={e.eventLevel} ns="Severity" size="sm" />
                    </td>
                    <td className="py-2 text-xs text-text-secondary">{STAGE_LABEL[e.guardrailStage]}</td>
                    <td className="py-2">
                      <span className="font-mono text-xs text-text-secondary">{e.ruleId}</span>
                      <span className="ml-1 text-xs text-text-secondary/70">{e.ruleName}</span>
                    </td>
                    <td className="py-2">
                      {e.blocked ? (
                        <StatusTag status="BLOCKED" ns="RouterLog" size="sm" />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                          <FileLock2 size={11} /> 脱敏
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-text-secondary">{STORE_LABEL[e.logStorageType]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Trace 查询时间线" className="col-span-4" height={320}>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                name="trace-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchTrace(query)}
                placeholder="输入 TraceID 查看完整调用链"
                className="min-w-0 flex-1 rounded border border-border-default bg-bg-page px-3 py-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/60 focus:border-primary/60"
                aria-label="TraceID 查询"
              />
              <button
                onClick={() => searchTrace(query)}
                className="flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/20"
              >
                <Search size={13} /> 查询
              </button>
            </div>
            <div className="flex-1 space-y-1.5 overflow-auto">
              {logs.filter((l) => l.status !== 'SUCCESS').slice(0, 4).map((l) => (
                <button
                  key={l.traceId}
                  onClick={() => setSelectedTrace(l)}
                  className="flex w-full items-center justify-between gap-2 rounded border border-border-default bg-panel-soft px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
                >
                  <span className="truncate font-mono text-text-primary">{l.traceId}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-text-secondary">{l.appId}</span>
                    <StatusTag status={l.status} ns="RouterLog" size="sm" />
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              异常 Trace 快捷检索（含锚定阻断 TR-20260803-888002）
            </p>
          </div>
        </Panel>
      </div>

      {/* 告警处置工作队列（确认→处置→关闭，全程留痕） */}
      <Panel title="风险告警处置队列" extra={<span className="text-xs text-text-secondary">待处置 {alerts.filter((a) => a.alertStatus === 'OPEN').length} · 处置记录 {alertActions.length}</span>}>
        {alerts.length === 0 ? (
          <EmptyState text="暂无告警" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">等级</th>
                <th className="pb-2 font-medium">告警</th>
                <th className="pb-2 font-medium">关联 Trace</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 text-right font-medium">处置</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.alertId} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft">
                  <td className="py-2 align-top"><StatusTag status={a.eventLevel} ns="Severity" size="sm" /></td>
                  <td className="py-2 align-top">
                    <div className="text-text-primary">{a.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{a.detail}</div>
                  </td>
                  <td className="py-2 align-top">
                    {a.traceId ? (
                      <button
                        onClick={() => {
                          const hit = logs.find((l) => l.traceId === a.traceId);
                          if (hit) setSelectedTrace(hit);
                        }}
                        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {a.traceId}
                      </button>
                    ) : (
                      <span className="text-xs text-text-secondary">—</span>
                    )}
                  </td>
                  <td className="py-2 align-top"><StatusTag status={a.alertStatus} ns="Alert" size="sm" /></td>
                  <td className="py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      {a.alertStatus === 'OPEN' && (
                        <button disabled={readOnly} onClick={() => { setAlertDialog({ alert: a, action: 'ACK' }); setAlertNote(''); }} className={BTN_GHOST} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                          确认
                        </button>
                      )}
                      {(a.alertStatus === 'OPEN' || a.alertStatus === 'ACKNOWLEDGED') && (
                        <button disabled={readOnly} onClick={() => { setAlertDialog({ alert: a, action: 'RESOLVE_START' }); setAlertNote(''); }} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                          开始处置
                        </button>
                      )}
                      {(a.alertStatus === 'ACKNOWLEDGED' || a.alertStatus === 'RESOLVING') && (
                        <button disabled={readOnly} onClick={() => { setAlertDialog({ alert: a, action: 'CLOSE' }); setAlertNote(''); }} className={BTN_SUCCESS} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                          关闭告警
                        </button>
                      )}
                      {a.alertStatus === 'CLOSED' && <span className="text-[10px] text-text-secondary">处置完成（可审计追溯）</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* 处置记录留痕 */}
        {alertActions.length > 0 && (
          <div className="mt-2 border-t border-border-default pt-2">
            <OperationTimeline records={alertActions.map((x) => ({ opId: x.actionId, opType: x.action === 'ACK' ? '确认告警' : x.action === 'RESOLVE_START' ? '开始处置' : '关闭告警', operator: x.operator, targetId: x.alertId, detail: x.note, createdAt: x.createdAt }))} title="处置留痕" />
          </div>
        )}
      </Panel>

      {/* 事件详情 Drawer（6.7.4：拦截原因 + 解锁留痕） */}
      <Drawer open={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={`安全事件 · ${selectedEvent?.securityEventId ?? ''}`} width={520}>
        {selectedEvent && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <EvInfo k="TraceID" v={selectedEvent.traceId} mono />
              <EvInfo k="主体" v={`${selectedEvent.tenantId} / ${selectedEvent.userId}`} />
              <EvInfo k="应用 / 模型" v={`${selectedEvent.appId} / ${selectedEvent.assetId}`} />
              <EvInfo k="事件类型 / 阶段" v={`${EVENT_TYPE_LABEL[selectedEvent.eventType]} / ${STAGE_LABEL[selectedEvent.guardrailStage]}`} />
              <EvInfo k="命中规则" v={`${selectedEvent.ruleId} · ${selectedEvent.ruleName}`} mono />
              <EvInfo k="存储策略" v={`${STORE_LABEL[selectedEvent.logStorageType]} · 签名 ${selectedEvent.hashSignature}`} mono />
            </div>

            {/* 摘要模式：敏感内容需解锁（6.7.5） */}
            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">拦截原因（{selectedEvent.reasonCode}）</span>
                {selectedEvent.logStorageType !== 'FULL' && (
                  <button
                    onClick={() => setUnlocked((s) => new Set(s).add(selectedEvent.securityEventId))}
                    disabled={isLocked(selectedEvent) === false}
                    className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                      isLocked(selectedEvent)
                        ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
                        : 'border-success/40 bg-success/10 text-success'
                    }`}
                  >
                    {isLocked(selectedEvent) ? <Eye size={12} /> : <EyeOff size={12} />}
                    {isLocked(selectedEvent) ? '解锁查看（留痕）' : '已解锁'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-primary">
                {isLocked(selectedEvent) ? (
                  <span className="text-warning">该事件存储策略为 {STORE_LABEL[selectedEvent.logStorageType]}，原文摘要需按权限解锁（解锁操作将写入审计留痕）</span>
                ) : (
                  selectedEvent.reasonText
                )}
              </p>
            </div>

            {/* HASH_ONLY 异常态（6.7.6） */}
            {selectedEvent.logStorageType === 'HASH_ONLY' && (
              <Banner tone="warning">
                <span className="flex items-center gap-1.5"><Hash size={13} /> 该事件仅存哈希，不可查看原文；签名 {selectedEvent.hashSignature} 可用于防篡改校验</span>
              </Banner>
            )}
          </div>
        )}
      </Drawer>

      {/* Trace 时间线 Drawer（6.7.5：阶段耗时 + 执行结果 + 关联安全事件） */}
      <Drawer open={!!selectedTrace} onClose={() => setSelectedTrace(null)} title={`全链路时间线 · ${selectedTrace?.traceId ?? ''}`} width={560}>
        {selectedTrace && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <span className="text-sm text-text-secondary">请求状态</span>
              <StatusTag status={selectedTrace.status} ns="RouterLog" />
              <span className="num text-xs text-text-secondary">总耗时 {selectedTrace.totalDurationMs}ms</span>
            </div>
            <StageTimeline log={selectedTrace} />
            {events.filter((e) => e.traceId === selectedTrace.traceId).length > 0 && (
              <section>
                <div className="mb-2 text-xs font-medium text-text-secondary">关联安全事件</div>
                {events
                  .filter((e) => e.traceId === selectedTrace.traceId)
                  .map((e) => (
                    <div key={e.securityEventId} className="mb-1.5 flex items-center justify-between rounded border border-border-default bg-panel-soft px-2.5 py-2 text-xs">
                      <span className="text-text-primary">{EVENT_TYPE_LABEL[e.eventType]} · {STAGE_LABEL[e.guardrailStage]}</span>
                      <span className="flex items-center gap-2">
                        <StatusTag status={e.eventLevel} ns="Severity" size="sm" />
                        <button onClick={() => setSelectedEvent(e)} className="text-primary underline-offset-2 hover:underline">查看详情</button>
                      </span>
                    </div>
                  ))}
              </section>
            )}
          </div>
        )}
      </Drawer>

      {/* 审计导出 Dialog（6.7.4：范围/字段/脱敏/签名） */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExportOpen(false)} aria-hidden />
          <div role="dialog" aria-label="导出审计包" className="relative w-[460px] rounded-xl border border-border-default bg-bg-panel p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Download size={15} className="text-primary" /> 导出审计包（合规）
            </div>
            <div className="mt-3 space-y-2 text-xs text-text-secondary">
              <p>导出范围：近 24h 全部安全事件与异常 Trace（{summary?.securityEvents ?? events.length} 起事件）。</p>
              <p>字段清单：securityEventId、traceId、tenantId、userId、appId、assetId、eventType、eventLevel、guardrailStage、ruleId、reasonCode、masked、blocked、logStorageType、hashSignature、createdAt。</p>
              <p className="rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-warning">
                脱敏说明：MASKED/HASH_ONLY 事件原文不导出，仅导出摘要与哈希；userId 按租户隔离脱敏。
              </p>
              <p className="rounded border border-border-default bg-panel-soft px-2 py-1.5">
                签名校验：导出包内附 manifest.sha256（对所有导出行签名），导入方可校验防篡改。
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setExportOpen(false)} className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                取消
              </button>
              <button
                onClick={() => {
                  setExportOpen(false);
                  window.alert('审计包已生成（含 manifest.sha256 签名清单），已归档至审计留存服务并同步至合规系统');
                }}
                className="rounded bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 告警处置意见弹窗（意见必填 ≥5 字，写入留痕） */}
      {alertDialog && (
        <Modal
          open
          onClose={() => setAlertDialog(null)}
          width={460}
          title={`${alertDialog.action === 'ACK' ? '确认告警' : alertDialog.action === 'RESOLVE_START' ? '开始处置' : '关闭告警'} · ${alertDialog.alert.title}`}
          footer={
            <>
              <button onClick={() => setAlertDialog(null)} className={BTN_GHOST}>取消</button>
              <button onClick={submitAlertAction} disabled={alertNote.trim().length < 5} className={BTN_PRIMARY}>
                提交
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
              {alertDialog.alert.detail}
              {alertDialog.alert.traceId && <> · 关联 Trace <span className="font-mono text-primary">{alertDialog.alert.traceId}</span></>}
            </p>
            <Field label="处置意见" required error={alertNote && alertNote.trim().length < 5 ? '至少 5 字（写入审计留痕）' : ''}>
              <textarea value={alertNote} onChange={(e) => setAlertNote(e.target.value)} rows={3} className={INPUT_CLS} placeholder="如：已定位为客服高峰限流，已协调扩容，预计 30 分钟恢复" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StageTimeline({ log }: { log: RouterLog }) {
  const stages = useMemo(() => {
    const names = ['鉴权', '前置护栏', '路由', '推理', '后置护栏', '响应'];
    const ratio = [0.06, 0.08, 0.12, 0.55, 0.09, 0.1];
    const seed = log.traceId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const jitter = ratio.map((r, i) => r * (0.8 + ((seed * (i + 3)) % 40) / 100));
    const sum = jitter.reduce((a, b) => a + b, 0);
    const blocked = log.status === 'BLOCKED';
    const degraded = log.status === 'DEGRADED';
    return names.map((name, i) => {
      let status: 'ok' | 'warn' | 'fail' | 'skip' = 'ok';
      let detail = '通过';
      if (name === '前置护栏' && blocked) { status = 'fail'; detail = log.decision.routeReason; }
      if (name === '路由' && degraded) { status = 'warn'; detail = `${log.decision.routeReason}；降级：${log.decision.fallbackReason}`; }
      if (name === '推理' && blocked) { status = 'skip'; detail = '请求已被前置护栏阻断，未进入推理'; }
      return { name, status, ms: Math.round((log.totalDurationMs * jitter[i]) / sum), detail };
    });
  }, [log]);

  const tone: Record<string, string> = { ok: 'text-success', warn: 'text-warning', fail: 'text-danger', skip: 'text-text-secondary' };
  const label: Record<string, string> = { ok: '通过', warn: '降级/降速', fail: '阻断', skip: '未执行' };

  return (
    <section>
      <div className="mb-2 text-xs font-medium text-text-secondary">请求链路（Timeline）</div>
      <div className="rounded border border-border-default bg-panel-soft p-3">
        {stages.map((s, i) => (
          <div key={s.name} className="relative flex gap-3">
            {i < stages.length - 1 && <span className="absolute left-[7px] top-6 h-full w-px bg-border-default" aria-hidden />}
            <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${tone[s.status]}`} style={{ borderColor: 'currentColor' }} />
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {s.name}
                  {s.status !== 'ok' && <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${tone[s.status]} bg-current/10`}>{label[s.status]}</span>}
                </span>
                <span className="num shrink-0 text-xs text-text-secondary">{s.ms}ms</span>
              </div>
              {s.detail !== '通过' && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{s.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvInfo({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      <div className={`truncate text-sm ${mono ? 'font-mono text-xs' : 'num'}`}>{v}</div>
    </div>
  );
}
