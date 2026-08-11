import { useEffect, useMemo, useState } from 'react';
import { Coins, BellRing, RefreshCw, Pencil, Settings2, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationRegistry, CostAlertConfig, QuotaProfile, RateLimitRule } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Banner from '../../components/ui/Banner';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST, BTN_SUCCESS } from '../../components/ui/Modal';
import { ToggleSwitch, Segmented } from '../../components/ui/Controls';
import { Field, INPUT_CLS, QuotaBar, ProgressBar } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtYuan = (n: number) => `¥${fmt(Math.round(n))}`;
const fmtWanTok = (n: number) => (n >= 100_000_000 ? `${(n / 100_000_000).toFixed(2)} 亿` : `${(n / 10_000).toFixed(0)} 万`);

/** M5 配额管理（业务组 Token 配额 + 应用限流规则） */
export default function QuotaPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [quotas, setQuotas] = useState<QuotaProfile[]>([]);
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [costCfg, setCostCfg] = useState<CostAlertConfig | null>(null);
  const [costDialog, setCostDialog] = useState(false);

  const reload = () =>
    Promise.all([api.getQuotas(), api.getRateLimitRules(), api.getApps(), api.getCostAlertConfig()]).then(([q, r, a, cc]) => {
      setQuotas(q);
      setRules(r.filter((x) => x.targetType === 'APP'));
      setApps(a);
      setCostCfg(cc);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  const [quotaDialog, setQuotaDialog] = useState<QuotaProfile | null>(null);
  const [warnDialog, setWarnDialog] = useState<QuotaProfile | null>(null);
  const [stopConfirm, setStopConfirm] = useState<QuotaProfile | null>(null);
  const [resumeDialog, setResumeDialog] = useState<QuotaProfile | null>(null);
  const [resumeReview, setResumeReview] = useState<QuotaProfile | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const stopped = useMemo(() => quotas.filter((q) => q.status === 'STOPPED'), [quotas]);
  const warning = useMemo(() => quotas.filter((q) => q.status === 'WARNING'), [quotas]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="配额管理"
        desc="业务组 Token 配额、预警阈值与应用限流规则；调整、恢复申请均需审批并留痕。"
      />
      {stopped.length > 0 && (
        <Banner tone="danger" action={<span className="text-xs">恢复需管理员审批</span>}>
          <Coins size={14} /> {stopped.map((q) => q.deptName).join('、')} 已触发超限停发，其下所有请求将被拒绝
        </Banner>
      )}
      {warning.length > 0 && stopped.length === 0 && (
        <Banner tone="warning">
          <BellRing size={14} /> {warning.length} 个部门配额用量已超过预警阈值，请关注
        </Banner>
      )}

      {/* ============ 成本预警（六章运营策略：成本预警/超额动作） ============ */}
      {costCfg && (
        <Panel
          title="全行成本预警"
          height={130}
          extra={
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{costCfg.enabled ? '已启用' : '已停用'}</span>
              <ToggleSwitch
                checked={costCfg.enabled}
                onChange={async (v) => {
                  await api.saveCostAlertConfig({ ...costCfg, enabled: v });
                  notify.success(`成本预警已${v ? '启用' : '停用'}`);
                  reload();
                }}
              />
              <button disabled={readOnly} onClick={() => setCostDialog(true)} className={BTN_GHOST} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                <Settings2 size={12} className="inline" /> 配置
              </button>
            </div>
          }
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">今日成本 / 日预算</span>
                <span className="num text-text-primary">
                  {fmtYuan(costCfg.todayCost)} / {fmtYuan(costCfg.dailyBudget)}（{((costCfg.todayCost / costCfg.dailyBudget) * 100).toFixed(1)}%）
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar pct={(costCfg.todayCost / costCfg.dailyBudget) * 100} tone={costCfg.todayCost / costCfg.dailyBudget >= costCfg.warnPct / 100 ? 'danger' : 'primary'} />
              </div>
              <p className="mt-1.5 text-[11px] text-text-secondary">
                预警阈值 {costCfg.warnPct}% · 超额动作：{costCfg.overAction === 'ALERT_ONLY' ? '仅告警' : costCfg.overAction === 'DOWNGRADE' ? '自动降级低成本模型' : '触发全局限流'} · 通知：{costCfg.notifyChannels.join('/')}
              </p>
            </div>
            {costCfg.todayCost / costCfg.dailyBudget >= costCfg.warnPct / 100 && (
              <div className="shrink-0 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                已达预警线：请关注高消耗部门排行
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* ============ 业务组配额管理 ============ */}
      <Panel title="业务组 Token 配额（月度）" extra={<span className="num text-xs text-text-secondary">{quotas.length} 个业务组</span>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">部门</th>
              <th className="pb-2 font-medium">月度 Token 配额</th>
              <th className="pb-2 font-medium">已用 / 总额度</th>
              <th className="pb-2 font-medium">本月费用</th>
              <th className="pb-2 font-medium">超限即停</th>
              <th className="pb-2 font-medium">预警阈值</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {quotas.map((q) => (
              <tr key={q.deptId} className={`border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft ${q.status === 'STOPPED' ? 'bg-danger/5' : q.status === 'WARNING' ? 'bg-warning/5' : ''}`}>
                <td className="py-2.5 font-medium text-text-primary">{q.deptName}</td>
                <td className="num py-2.5 text-text-secondary">{fmtWanTok(q.monthTokenQuota)} Tokens</td>
                <td className="py-2.5"><QuotaBar used={q.usedTokens} total={q.monthTokenQuota} /></td>
                <td className="num py-2.5 text-text-primary">{fmtYuan(q.monthCost)}</td>
                <td className="py-2.5">
                  <ToggleSwitch
                    checked={q.overLimitStop}
                    title={q.overLimitStop ? '关闭超限即停' : '开启超限即停'}
                    onChange={() => {
                      if (!q.overLimitStop) {
                        setStopConfirm(q);
                      } else {
                        api.toggleQuotaStop(q.deptId).then(() => {
                          notify.success(`${q.deptName} 已关闭超限即停`);
                          reload();
                        });
                      }
                    }}
                  />
                </td>
                <td className="py-2.5">
                  <button disabled={readOnly} onClick={() => setWarnDialog(q)} className="num rounded border border-border-default px-1.5 py-0.5 text-xs text-text-secondary transition-colors hover:text-primary disabled:opacity-40" title="配置余额预警">
                    {q.warnThreshold}% · {q.notifyChannels.join('/')}
                  </button>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <StatusTag status={q.status} ns="Quota" size="sm" />
                    {q.resumePending && <span className="rounded bg-warning/15 px-1 text-[10px] text-warning">恢复审批中</span>}
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {q.status === 'STOPPED' && !q.resumePending && (
                      <button disabled={readOnly} onClick={() => setResumeDialog(q)} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                        <RefreshCw size={12} className="inline" /> 申请恢复
                      </button>
                    )}
                    {q.resumePending && (
                      <button disabled={readOnly} onClick={() => setResumeReview(q)} className={BTN_SUCCESS} title={readOnly ? '只读模式下写操作已禁用' : '管理员审批恢复申请'}>
                        <CheckCircle2 size={12} className="inline" /> 审批恢复
                      </button>
                    )}
                    <button disabled={readOnly} onClick={() => setQuotaDialog(q)} title={readOnly ? '只读模式下写操作已禁用' : '调整配额'} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40">
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* ============ 应用限流规则 ============ */}
      <Panel title="应用限流规则" extra={<span className="text-xs text-text-secondary">在「调度算力 → 流量管控」中统一维护，此处为应用维度视图</span>}>
        <div className="grid grid-cols-3 gap-2">
          {apps.map((a) => {
            const rs = rules.filter((r) => r.targetId === a.appId);
            return (
              <div key={a.appId} className="rounded border border-border-default bg-panel-soft p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{a.appName}</span>
                  <span className="font-mono text-[10px] text-text-secondary">{a.appId}</span>
                </div>
                {rs.length === 0 ? (
                  <p className="mt-2 text-xs text-text-secondary/60">未配置限流规则</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {rs.map((r) => (
                      <div key={r.ruleId} className="flex items-center justify-between rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs">
                        <span className={r.enabled ? 'text-text-primary' : 'text-text-secondary/60 line-through'}>{r.name}</span>
                        <span className="num text-text-secondary">
                          {fmt(r.qpsPerMin)}/min · 并发 {r.concurrency} · 命中 {r.hits24h}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ============ 弹窗区 ============ */}
      {quotaDialog && <QuotaFormDialog initial={quotaDialog} onClose={() => setQuotaDialog(null)} onSaved={() => { setQuotaDialog(null); reload(); }} />}
      {warnDialog && <WarnFormDialog initial={warnDialog} onClose={() => setWarnDialog(null)} onSaved={() => { setWarnDialog(null); reload(); }} />}

      <ConfirmDialog
        open={!!stopConfirm}
        level="warning"
        title="开启超限即停"
        message={<>开启后，<b>{stopConfirm?.deptName}</b> 月度 Token 用量一旦超限，该部门<b className="text-danger">所有模型请求将被自动拒绝</b>，直至配额调整或恢复审批通过。</>}
        onCancel={() => setStopConfirm(null)}
        onConfirm={async () => {
          if (!stopConfirm) return;
          await api.toggleQuotaStop(stopConfirm.deptId);
          notify.success(`${stopConfirm.deptName} 已开启超限即停`);
          setStopConfirm(null);
          reload();
        }}
      />

      {resumeDialog && <ResumeDialog initial={resumeDialog} onClose={() => setResumeDialog(null)} onSaved={() => { setResumeDialog(null); reload(); }} />}

      {/* 配额恢复审批弹窗（闭环②：审批落地，通过解除停发） */}
      {resumeReview && (
        <Modal
          open
          onClose={() => setResumeReview(null)}
          width={460}
          title={`审批配额恢复 · ${resumeReview.deptName}`}
          footer={
            <>
              <button onClick={() => setResumeReview(null)} className={BTN_GHOST}>取消</button>
              <button
                disabled={reviewNote.trim().length < 5}
                onClick={async () => {
                  await api.approveQuotaResume(resumeReview.deptId, false, reviewNote.trim());
                  notify.info(`${resumeReview.deptName} 恢复申请已驳回，保持停发`);
                  setResumeReview(null);
                  setReviewNote('');
                  reload();
                }}
                className={BTN_GHOST}
              >
                驳回
              </button>
              <button
                disabled={reviewNote.trim().length < 5}
                onClick={async () => {
                  await api.approveQuotaResume(resumeReview.deptId, true, reviewNote.trim());
                  notify.success(`${resumeReview.deptName} 恢复审批通过，已解除停发`);
                  setResumeReview(null);
                  setReviewNote('');
                  reload();
                }}
                className={BTN_PRIMARY}
              >
                通过并恢复
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              该部门当前已超限停发：已用 {fmtWanTok(resumeReview.usedTokens)} / 配额 {fmtWanTok(resumeReview.monthTokenQuota)}。通过后恢复请求放行，建议同步追加配额。
            </div>
            <Field label="审批意见" required error={reviewNote && reviewNote.trim().length < 5 ? '至少 5 字（写入留痕）' : ''}>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} className={INPUT_CLS} placeholder="如：同意恢复，已同步追加配额至 4,000 万" />
            </Field>
          </div>
        </Modal>
      )}

      {/* 成本预警配置弹窗 */}
      {costDialog && costCfg && <CostAlertDialog initial={costCfg} onClose={() => setCostDialog(false)} onSaved={() => { setCostDialog(false); reload(); }} />}
    </div>
  );
}

/* ---------------- 调整配额弹窗 ---------------- */

function QuotaFormDialog({ initial, onClose, onSaved }: { initial: QuotaProfile; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [quotaWan, setQuotaWan] = useState(String(Math.round(initial.monthTokenQuota / 10_000)));
  const [effect, setEffect] = useState<'NOW' | 'NEXT'>('NOW');
  const [reason, setReason] = useState('');

  const numOk = /^\d+$/.test(quotaWan) && Number(quotaWan) >= 1 && Number(quotaWan) <= 10_000_000;
  const reasonOk = reason.trim().length >= 5 && reason.trim().length <= 100;
  const invalid = !numOk || !reasonOk;

  return (
    <Modal
      open
      onClose={onClose}
      width={460}
      title={`调整配额 · ${initial.deptName}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.setQuota(initial.deptId, Number(quotaWan) * 10_000, reason.trim());
              notify.success(`${initial.deptName} 配额已调整为 ${fmt(Number(quotaWan))} 万 Token（${effect === 'NOW' ? '本月立即生效' : '次月生效'}）`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="月度 Token 配额（单位：万）" required error={numOk ? '' : '范围 1 万 ~ 1,000 亿'}>
          <input value={quotaWan} onChange={(e) => setQuotaWan(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
        </Field>
        <Field label="生效时间">
          <Segmented
            options={[
              { value: 'NOW', label: '本月立即生效' },
              { value: 'NEXT', label: '次月生效' },
            ]}
            value={effect}
            onChange={(v) => setEffect(v as 'NOW' | 'NEXT')}
          />
        </Field>
        <Field label="调整原因" required error={reason && !reasonOk ? '5~100 字（留痕必填）' : ''}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={INPUT_CLS} placeholder="说明调整原因，将写入操作留痕" />
        </Field>
        <div className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
          当前已用 <b className="num text-text-primary">{fmtWanTok(initial.usedTokens)}</b> Tokens；调整后进度条与状态即时重算。
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 余额预警配置弹窗 ---------------- */

function WarnFormDialog({ initial, onClose, onSaved }: { initial: QuotaProfile; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [threshold, setThreshold] = useState<80 | 90 | 95>(initial.warnThreshold);
  const [channels, setChannels] = useState<(typeof initial.notifyChannels)>(initial.notifyChannels);

  const toggle = (c: 'SITE' | 'MAIL' | 'SMS') => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const invalid = channels.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={`余额预警配置 · ${initial.deptName}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.setQuotaWarn(initial.deptId, threshold, channels);
              notify.success(`${initial.deptName} 预警配置已保存（阈值 ${threshold}%）`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="预警阈值（已用达此比例触发预警）">
          <Segmented
            options={[
              { value: '80', label: '80%' },
              { value: '90', label: '90%' },
              { value: '95', label: '95%' },
            ]}
            value={String(threshold)}
            onChange={(v) => setThreshold(Number(v) as 80 | 90 | 95)}
          />
        </Field>
        <Field label="通知渠道" required error={invalid ? '至少选择 1 个渠道' : ''}>
          <div className="flex gap-2">
            {([
              ['SITE', '站内信'],
              ['MAIL', '邮件'],
              ['SMS', '短信'],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded border border-border-default bg-bg-page px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input type="checkbox" checked={channels.includes(v)} onChange={() => toggle(v)} className="accent-[#2d7be5]" />
                {label}
              </label>
            ))}
          </div>
        </Field>
        <p className="text-xs text-text-secondary">触发预警后：页面横幅提示 + 顶栏告警铃铛 +1 + 按所选渠道推送给部门负责人。</p>
      </div>
    </Modal>
  );
}

/* ---------------- 恢复申请弹窗 ---------------- */

function ResumeDialog({ initial, onClose, onSaved }: { initial: QuotaProfile; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= 5;
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={`申请恢复 · ${initial.deptName}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={!ok}
            onClick={async () => {
              await api.requestQuotaResume(initial.deptId, reason.trim());
              notify.info(`${initial.deptName} 恢复申请已提交，等待管理员审批`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            提交申请
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {initial.deptName} 当前已超限（已用 {fmtWanTok(initial.usedTokens)} / 配额 {fmtWanTok(initial.monthTokenQuota)}），恢复前请求将持续被拒绝。
        </p>
        <Field label="恢复理由" required error={reason && !ok ? '至少 5 字' : ''}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={INPUT_CLS} placeholder="如：临时扩容已审批，或已完成配额追加申请" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- 成本预警配置弹窗（六章运营策略） ---------------- */

function CostAlertDialog({ initial, onClose, onSaved }: { initial: CostAlertConfig; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [budget, setBudget] = useState(String(initial.dailyBudget));
  const [warnPct, setWarnPct] = useState<80 | 90 | 95>(initial.warnPct as 80 | 90 | 95);
  const [overAction, setOverAction] = useState(initial.overAction);
  const [channels, setChannels] = useState(initial.notifyChannels);

  const budgetOk = /^\d+$/.test(budget) && Number(budget) >= 10000 && Number(budget) <= 100_000_000;
  const invalid = !budgetOk || channels.length === 0;
  const toggle = (c: 'SITE' | 'MAIL' | 'SMS') => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Modal
      open
      onClose={onClose}
      width={460}
      title="成本预警配置"
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.saveCostAlertConfig({ ...initial, dailyBudget: Number(budget), warnPct, overAction, notifyChannels: channels });
              notify.success(`成本预警已保存：预算 ${fmt(Number(budget))} 元/日，阈值 ${warnPct}%`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="全行日成本预算（元）" required error={budgetOk ? '' : '范围 10,000 ~ 100,000,000'}>
          <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
        </Field>
        <Field label="预警阈值（达到预算此比例触发预警）">
          <Segmented
            options={[
              { value: '80', label: '80%' },
              { value: '90', label: '90%' },
              { value: '95', label: '95%' },
            ]}
            value={String(warnPct)}
            onChange={(v) => setWarnPct(Number(v) as 80 | 90 | 95)}
          />
        </Field>
        <Field label="超额动作" required hint="与限流/降级体系联动">
          <Segmented
            options={[
              { value: 'ALERT_ONLY', label: '仅告警' },
              { value: 'DOWNGRADE', label: '自动降级低成本模型' },
              { value: 'RATE_LIMIT', label: '触发全局限流' },
            ]}
            value={overAction}
            onChange={(v) => setOverAction(v as CostAlertConfig['overAction'])}
          />
        </Field>
        <Field label="通知渠道" required error={channels.length === 0 ? '至少选择 1 个渠道' : ''}>
          <div className="flex gap-2">
            {([
              ['SITE', '站内信'],
              ['MAIL', '邮件'],
              ['SMS', '短信'],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded border border-border-default bg-bg-page px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input type="checkbox" checked={channels.includes(v)} onChange={() => toggle(v)} className="accent-[#2d7be5]" />
                {label}
              </label>
            ))}
          </div>
        </Field>
        <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
          预警触发后：顶栏告警 +1、配额页横幅提示、按渠道通知财务与平台运营；超额动作将写入运营策略并留痕。
        </p>
      </div>
    </Modal>
  );
}
