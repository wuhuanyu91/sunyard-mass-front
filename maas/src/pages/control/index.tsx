import { useEffect, useMemo, useState } from 'react';
import { FileDiff, Plus, Rocket, Undo2, CheckCircle2, XCircle, Megaphone } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationRegistry, ModelAsset, OperationRecord, Policy, PolicyStatus, PolicyType } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import Drawer from '../../components/ui/Drawer';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST, BTN_DANGER, BTN_SUCCESS } from '../../components/ui/Modal';
import { Field, INPUT_CLS, SELECT_CLS, OperationTimeline, ProgressBar, useCountdown } from '../../components/ui/Bits';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  ROUTING: '调度策略',
  COMPUTE: '资源策略',
  MODEL: '模型策略',
  SECURITY: '安全策略',
  METERING: '计量策略',
};

const TYPE_DESC: Record<PolicyType, string> = {
  ROUTING: '场景路由、降级目标、时延上限',
  COMPUTE: '资源池、副本数、vGPU 切分',
  MODEL: '灰度比例、A/B 对照、回滚阈值',
  SECURITY: '护栏策略引用、数据等级管控',
  METERING: 'Token 配额、限流规则引用',
};

const STATUS_FILTERS: (PolicyStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'GRAY', 'ACTIVE', 'ROLLBACK', 'INACTIVE'];

/** M1 策略治理台（五类策略集中管理：创建→审批→发布→回滚，全程留痕） */
export default function ControlPlane() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [records, setRecords] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<PolicyType | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Policy | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<{ policy: Policy; approve: boolean } | null>(null);
  const [publishTarget, setPublishTarget] = useState<Policy | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<Policy | null>(null);
  const [rollbackCountdown, startRollbackCountdown] = useCountdown();

  const reload = () =>
    Promise.all([api.getPolicies(), api.getApps(), api.getAssets(), api.getOperationRecords()]).then(([p, ap, as_, r]) => {
      setPolicies(p);
      setApps(ap);
      setAssets(as_);
      setRecords(r);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(
    () => policies.filter((p) => (statusFilter === 'ALL' || p.status === statusFilter) && (typeFilter === 'ALL' || p.policyType === typeFilter)),
    [policies, statusFilter, typeFilter],
  );

  const pendingCount = policies.filter((p) => p.status === 'PENDING_APPROVAL').length;

  if (loading) {
    return <div className="panel h-72 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 管理页标准页头：主 CTA 新建策略 */}
      <PageHeader
        crumb="策略治理"
        title="策略治理台"
        desc="调度 / 资源 / 模型 / 安全 / 运营五类策略的集中管理：创建→审批→发布→回滚，一处配置全局生效，变更全程留痕。"
        actions={
          <button onClick={() => setWizardOpen(true)} disabled={readOnly} title={readOnly ? '只读模式下写操作已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
            <Plus size={13} /> 新建策略
          </button>
        }
      />

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-2 py-1 text-xs transition-colors ${statusFilter === s ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border-default bg-bg-panel text-text-secondary hover:text-text-primary'}`}
            >
              {s === 'ALL' ? '全部' : getStatusLabel(s)}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PolicyType | 'ALL')} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
          <option value="ALL">全部类型</option>
          {(Object.keys(POLICY_TYPE_LABEL) as PolicyType[]).map((t) => (
            <option key={t} value={t}>{POLICY_TYPE_LABEL[t]}</option>
          ))}
        </select>
        {pendingCount > 0 && <span className="rounded bg-warning/15 px-2 py-1 text-xs text-warning">{pendingCount} 条待审批</span>}
        <span className="ml-auto text-xs text-text-secondary">发布分钟级下发全部网关节点（12 节点）并事件广播</span>
      </div>

      {/* 策略列表 */}
      <Panel height="100%">
        {filtered.length === 0 ? (
          <EmptyState text="当前筛选条件下无策略，点击「新建策略」创建" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">策略名称</th>
                <th className="pb-2 font-medium">类型</th>
                <th className="pb-2 font-medium">作用域</th>
                <th className="pb-2 font-medium">版本</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 font-medium">生效状态</th>
                <th className="pb-2 font-medium">最近发布</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.policyId} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft">
                  <td className="py-2.5">
                    <button onClick={() => setSelected(p)} className="text-left text-primary hover:underline">{p.policyName}</button>
                    <div className="font-mono text-[10px] text-text-secondary">{p.policyId}</div>
                  </td>
                  <td className="py-2.5 text-text-secondary">{POLICY_TYPE_LABEL[p.policyType]}</td>
                  <td className="num py-2.5 text-xs text-text-secondary">{p.scopeType}:{p.scopeValue}</td>
                  <td className="num py-2.5">v{p.version}</td>
                  <td className="py-2.5"><StatusTag status={p.status} ns="Policy" /></td>
                  <td className="py-2.5 text-xs">
                    {p.status === 'ACTIVE' ? (
                      <span className="text-success">已下发 12 节点</span>
                    ) : p.status === 'PENDING_APPROVAL' ? (
                      <span className="text-warning">待审批</span>
                    ) : (
                      <span className="text-text-secondary/60">未生效</span>
                    )}
                  </td>
                  <td className="num py-2.5 text-xs text-text-secondary">
                    {p.lastPublishedAt ? new Date(p.lastPublishedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'DRAFT' && (
                        <button
                          disabled={readOnly}
                          onClick={async () => {
                            await api.submitPolicy(p.policyId);
                            notify.info(`策略「${p.policyName}」已提交审批（顶栏待办联动）`);
                            reload();
                          }}
                          className={BTN_PRIMARY}
                          title={readOnly ? '只读模式下写操作已禁用' : '提交审批'}
                        >
                          提交审批
                        </button>
                      )}
                      {p.status === 'PENDING_APPROVAL' && (
                        <>
                          <button disabled={readOnly} onClick={() => setApproveTarget({ policy: p, approve: true })} className={`flex items-center gap-1 ${BTN_SUCCESS}`}>
                            <CheckCircle2 size={12} /> 通过
                          </button>
                          <button disabled={readOnly} onClick={() => setApproveTarget({ policy: p, approve: false })} className={BTN_GHOST}>
                            <XCircle size={12} className="inline" /> 驳回
                          </button>
                        </>
                      )}
                      {(p.status === 'ACTIVE' || p.status === 'ROLLBACK' || p.status === 'INACTIVE') && (
                        <button disabled={readOnly} onClick={() => setPublishTarget(p)} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                          <Rocket size={12} /> {p.status === 'ACTIVE' ? '重新发布' : '发布'}
                        </button>
                      )}
                      {p.status === 'ACTIVE' && p.rollbackVersion > 0 && (
                        <button disabled={readOnly} onClick={() => setRollbackTarget(p)} className={`flex items-center gap-1 ${BTN_DANGER}`}>
                          <Undo2 size={12} /> 回滚 v{p.rollbackVersion}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* 回滚 SLA 进度 */}
      {rollbackCountdown > 0 && (
        <div className="rounded border border-danger/40 bg-danger/5 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-danger">
            <span>回滚执行中（SLA ≤3 分钟，模拟加速）… {rollbackCountdown}s</span>
          </div>
          <div className="mt-2"><ProgressBar pct={((180 - rollbackCountdown) / 180) * 100} tone="danger" /></div>
        </div>
      )}

      {/* ============ 弹窗区 ============ */}
      {wizardOpen && <PolicyWizard apps={apps} assets={assets} policies={policies} onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); reload(); }} />}

      {approveTarget && <ApproveDialog target={approveTarget} onClose={() => setApproveTarget(null)} onDone={() => { setApproveTarget(null); reload(); }} />}

      <ConfirmDialog
        open={!!publishTarget}
        level="warning"
        title="发布策略"
        message={
          <>
            将发布 <b>{publishTarget?.policyName}</b>（v{publishTarget?.version}）至全部网关节点（12 节点），<b className="text-primary">分钟级生效</b>，并发布事件广播。
          </>
        }
        confirmText="确认发布"
        onCancel={() => setPublishTarget(null)}
        onConfirm={async () => {
          if (!publishTarget) return;
          await api.publishPolicy(publishTarget.policyId);
          notify.success(`策略 ${publishTarget.policyName} 已发布，事件广播已推送运营控制台`);
          setPublishTarget(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={!!rollbackTarget}
        level="danger"
        title="回滚策略"
        confirmWord={rollbackTarget?.policyName}
        message={<>将 <b>{rollbackTarget?.policyName}</b> 回滚至 v{rollbackTarget?.rollbackVersion}，SLA ≤3 分钟内生效；当前版本配置将被覆盖。</>}
        confirmText="立即回滚"
        onCancel={() => setRollbackTarget(null)}
        onConfirm={async () => {
          if (!rollbackTarget) return;
          const name = rollbackTarget.policyName;
          setRollbackTarget(null);
          startRollbackCountdown(180);
          await api.rollbackPolicy(rollbackTarget.policyId);
          // 倒计时展示后完成提示（模拟加速：3 秒后结束）
          setTimeout(() => notify.success(`策略 ${name} 已回滚完成（用时 2.8s ≤ SLA 3 分钟）`), 3000);
          reload();
        }}
      />

      {/* ============ 详情 Drawer（规则 + diff + 留痕） ============ */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={`${selected?.policyName ?? ''} · 详情`} width={540}>
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info k="策略 ID" v={selected.policyId} />
              <Info k="作用域" v={`${selected.scopeType}: ${selected.scopeValue}`} />
              <Info k="优先级" v={`${selected.priority}`} />
              <Info k="版本" v={`v${selected.version}（可回滚 v${selected.rollbackVersion}）`} />
              <Info k="创建人" v={selected.createdBy} />
              <Info k="审批人" v={selected.approvedBy || '待审批'} />
            </div>

            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="mb-1.5 text-xs text-text-secondary">影响面预估</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info k="受影响应用" v={scopeImpact(selected, apps, assets, policies).apps} />
                <Info k="受影响模型" v={scopeImpact(selected, apps, assets, policies).models} />
                <Info k="受影响租户" v={scopeImpact(selected, apps, assets, policies).tenants} />
                <Info k="策略冲突" v={scopeImpact(selected, apps, assets, policies).conflict} />
              </div>
            </div>

            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-text-secondary">
                <FileDiff size={13} /> 规则配置（JSON）
              </div>
              <pre className="max-h-56 overflow-auto text-xs leading-relaxed text-success">{JSON.stringify(selected.rules, null, 2)}</pre>
            </div>

            <OperationTimeline records={records.filter((r) => r.targetId === selected.policyId)} title="策略变更留痕" />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function getStatusLabel(s: PolicyStatus): string {
  const map: Record<PolicyStatus, string> = { DRAFT: '草稿', PENDING_APPROVAL: '待审批', GRAY: '灰度中', ACTIVE: '生效', ROLLBACK: '回滚中', INACTIVE: '停用', ARCHIVED: '归档' };
  return map[s];
}

/* ------------------------------------------------------------------ */
/* 审批弹窗（意见必填 ≥5 字）                                           */
/* ------------------------------------------------------------------ */

function ApproveDialog({ target, onClose, onDone }: { target: { policy: Policy; approve: boolean }; onClose: () => void; onDone: () => void }) {
  const notify = useNotify();
  const [opinion, setOpinion] = useState('');
  const ok = opinion.trim().length >= 5;
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={target.approve ? `审批通过 · ${target.policy.policyName}` : `审批驳回 · ${target.policy.policyName}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={!ok}
            onClick={async () => {
              await api.approvePolicy(target.policy.policyId, target.approve, opinion.trim());
              notify.success(target.approve ? `策略 ${target.policy.policyName} 审批通过，可发布` : `策略 ${target.policy.policyName} 已驳回，退回草稿`);
              onDone();
            }}
            className={target.approve ? BTN_SUCCESS : BTN_DANGER}
          >
            {target.approve ? '确认通过' : '确认驳回'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
          {target.policy.policyName}（{POLICY_TYPE_LABEL[target.policy.policyType]}）· 作用域 {target.policy.scopeType}:{target.policy.scopeValue} · v{target.policy.version}
        </p>
        <Field label="审批意见" required error={opinion && !ok ? '至少 5 字' : ''}>
          <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} rows={3} className={INPUT_CLS} placeholder={target.approve ? '如：规则评审通过，准予发布' : '如：时延上限设置过松，请调整后重新提交'} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 新建策略向导（三步）                                                 */
/* ------------------------------------------------------------------ */

function PolicyWizard({ apps, assets, policies, onClose, onCreated }: { apps: ApplicationRegistry[]; assets: ModelAsset[]; policies: Policy[]; onClose: () => void; onCreated: () => void }) {
  const notify = useNotify();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<PolicyType | null>(null);
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<Policy['scopeType']>('GLOBAL');
  const [scopeValue, setScopeValue] = useState('*');
  const [priority, setPriority] = useState('60');
  /* 动态规则参数 */
  const [ruleModel, setRuleModel] = useState('');
  const [ruleGray, setRuleGray] = useState('20');
  const [ruleSuccess, setRuleSuccess] = useState('97');
  const [ruleLatency, setRuleLatency] = useState('1200');
  const [ruleQuota, setRuleQuota] = useState('30000');
  const [rulePool, setRulePool] = useState('POOL-H20');
  const [ruleReplicas, setRuleReplicas] = useState('4');
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length >= 2 && name.trim().length <= 30;
  const prioOk = /^\d+$/.test(priority) && Number(priority) >= 1 && Number(priority) <= 100;
  const step2Valid =
    nameOk && prioOk &&
    (type === 'ROUTING' ? !!ruleModel && /^\d+$/.test(ruleLatency) : type === 'MODEL' ? !!ruleModel && /^\d+$/.test(ruleGray) && Number(ruleGray) >= 1 && Number(ruleGray) <= 100 : type === 'COMPUTE' ? /^\d+$/.test(ruleReplicas) : true);

  const buildRules = (): Record<string, unknown> => {
    switch (type) {
      case 'ROUTING':
        return { primaryModel: ruleModel, fallbackMode: 'SWITCH_SECONDARY', latencyCeilMs: Number(ruleLatency) };
      case 'MODEL':
        return { allowedAssetIds: [ruleModel], grayRule: { ratio: Number(ruleGray) / 100 }, rollbackThreshold: { successRate: Number(ruleSuccess) / 100 } };
      case 'COMPUTE':
        return { resourcePool: rulePool, quotaValue: Number(ruleReplicas) };
      case 'SECURITY':
        return { guardrailPolicy: 'GD-003', tenantBoundary: 'STRICT' };
      case 'METERING':
        return { tokenQuota: Number(ruleQuota) * 10_000, warnThreshold: 0.8 };
      default:
        return {};
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={
        <span className="flex items-center gap-2">
          <Megaphone size={14} className="text-primary" /> 新建策略（步骤 {step}/3）
        </span>
      }
      footer={
        <>
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2)} className={BTN_GHOST}>上一步</button>
          )}
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          {step < 3 ? (
            <button
              disabled={step === 1 ? !type : !step2Valid}
              onClick={() => {
                setTouched(true);
                setStep((s) => (s + 1) as 2 | 3);
              }}
              className={BTN_PRIMARY}
            >
              下一步
            </button>
          ) : (
            <button
              onClick={async () => {
                if (!type) return;
                const policyId = `POL-${type}-${String(Date.now()).slice(-5)}`;
                await api.createPolicy({
                  policyId,
                  policyType: type,
                  policyName: name.trim(),
                  scopeType,
                  scopeValue,
                  priority: Number(priority),
                  status: 'PENDING_APPROVAL',
                  effectiveTime: new Date().toISOString(),
                  expireTime: new Date(Date.now() + 365 * 86400_000).toISOString(),
                  version: 1,
                  createdBy: '平台管理员',
                  approvedBy: '',
                  lastPublishedAt: '',
                  rollbackVersion: 0,
                  rules: buildRules(),
                });
                notify.info(`策略「${name.trim()}」已创建并提交审批（顶栏待办 +1）`);
                onCreated();
              }}
              className={BTN_PRIMARY}
            >
              提交审批
            </button>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(POLICY_TYPE_LABEL) as PolicyType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded border p-3 text-left transition-colors ${type === t ? 'border-primary/60 bg-primary/10' : 'border-border-default bg-panel-soft hover:border-primary/30'}`}
            >
              <div className={`text-sm font-medium ${type === t ? 'text-primary' : 'text-text-primary'}`}>{POLICY_TYPE_LABEL[t]}</div>
              <div className="mt-1 text-xs text-text-secondary">{TYPE_DESC[t]}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && type && (
        <div className="space-y-3">
          <Field label="策略名称" required error={touched && !nameOk ? '名称需 2~30 字' : ''}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder={`如：${TYPE_DESC[type]}`} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="作用域类型" required>
              <select value={scopeType} onChange={(e) => { setScopeType(e.target.value as Policy['scopeType']); setScopeValue(e.target.value === 'GLOBAL' ? '*' : ''); }} className={SELECT_CLS}>
                {['GLOBAL', 'TENANT', 'DEPT', 'APP', 'MODEL'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="作用域目标" required>
              {scopeType === 'GLOBAL' ? (
                <input value="*（全局）" disabled className={INPUT_CLS} />
              ) : scopeType === 'APP' ? (
                <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={SELECT_CLS}>
                  <option value="">请选择</option>
                  {apps.map((a) => <option key={a.appId} value={a.appId}>{a.appName}</option>)}
                </select>
              ) : scopeType === 'MODEL' ? (
                <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={SELECT_CLS}>
                  <option value="">请选择</option>
                  {assets.map((a) => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
                </select>
              ) : (
                <input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={INPUT_CLS} placeholder="如 DEPT-TECH" />
              )}
            </Field>
            <Field label="优先级" required error={touched && !prioOk ? '1~100' : ''}>
              <input value={priority} onChange={(e) => setPriority(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
            </Field>
          </div>

          {/* 按类型动态规则 */}
          {(type === 'ROUTING' || type === 'MODEL') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={type === 'ROUTING' ? '主模型' : '目标资产'} required>
                <select value={ruleModel} onChange={(e) => setRuleModel(e.target.value)} className={SELECT_CLS}>
                  <option value="">请选择</option>
                  {assets.map((a) => <option key={a.assetId} value={a.assetId}>{a.assetName}</option>)}
                </select>
              </Field>
              {type === 'ROUTING' ? (
                <Field label="时延上限（ms）" required>
                  <input value={ruleLatency} onChange={(e) => setRuleLatency(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
                </Field>
              ) : (
                <Field label="灰度比例（%）" required hint="1~100">
                  <input value={ruleGray} onChange={(e) => setRuleGray(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
                </Field>
              )}
              {type === 'MODEL' && (
                <Field label="回滚阈值：成功率（%）" required>
                  <input value={ruleSuccess} onChange={(e) => setRuleSuccess(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
                </Field>
              )}
            </div>
          )}
          {type === 'COMPUTE' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="资源池" required>
                <select value={rulePool} onChange={(e) => setRulePool(e.target.value)} className={SELECT_CLS}>
                  {['POOL-H20', 'POOL-L20', 'POOL-4090', 'POOL-ASCEND', 'POOL-RENTAL'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="副本数" required>
                <input value={ruleReplicas} onChange={(e) => setRuleReplicas(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
              </Field>
            </div>
          )}
          {type === 'METERING' && (
            <Field label="Token 配额（单位：万）" required>
              <input value={ruleQuota} onChange={(e) => setRuleQuota(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
            </Field>
          )}
          {type === 'SECURITY' && (
            <p className="rounded border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">安全策略引用全行底线护栏策略 GD-003（违法/不良信息拦截），租户边界 STRICT。</p>
          )}
        </div>
      )}

      {step === 3 && type && (
        <div className="space-y-3">
          {/* 冲突检测（六章：处理不同策略之间的冲突） */}
          {(() => {
            const conflicts = policies.filter((q) => q.policyType === type && scopeOverlap(scopeType, scopeValue, q.scopeType, q.scopeValue));
            return conflicts.length > 0 ? (
              <p className="rounded border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                ⚠ 冲突提示：与 {conflicts.map((c) => `${c.policyName}（${c.policyId}）`).join('、')} 存在同类型作用域重叠；发布后优先级高者（priority 数值大）生效，请确认优先级设置。
              </p>
            ) : (
              <p className="rounded border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">✓ 冲突检测通过：无同类型策略作用域重叠</p>
            );
          })()}
          <div className="rounded border border-border-default bg-panel-soft p-3">
            <div className="mb-1.5 text-xs font-medium text-text-secondary">影响面预估</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
              <p>类型：<b className="text-text-primary">{POLICY_TYPE_LABEL[type]}</b></p>
              <p>作用域：<b className="text-text-primary">{scopeType}:{scopeValue || '—'}</b></p>
              <p>受影响应用：<b className="text-text-primary">{scopeType === 'GLOBAL' ? `${apps.length} 个（全行）` : scopeType === 'APP' ? '1 个' : '按作用域推算'}</b></p>
              <p>受影响模型：<b className="text-text-primary">{type === 'MODEL' ? '1 个' : `${assets.length} 个候选`}</b></p>
            </div>
          </div>
          <div className="rounded border border-border-default bg-panel-soft p-3">
            <div className="mb-2 text-xs font-medium text-text-secondary">规则预览（提交后可在详情查看 JSON）</div>
            <pre className="max-h-40 overflow-auto text-xs leading-relaxed text-success">{JSON.stringify(buildRules(), null, 2)}</pre>
          </div>
          <p className="text-xs text-text-secondary">提交后进入审批队列（顶栏「审批待办」联动），审批通过方可发布；发布分钟级下发全网并事件广播。</p>
        </div>
      )}
    </Modal>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      <div className="num truncate text-sm">{v}</div>
    </div>
  );
}

/** 作用域重叠判定（六章冲突处理）：GLOBAL 与任何重叠；同类型+同目标重叠 */
export function scopeOverlap(ta: Policy['scopeType'], va: string, tb: Policy['scopeType'], vb: string): boolean {
  if (ta === 'GLOBAL' || tb === 'GLOBAL') return true;
  return ta === tb && va === vb;
}

/** 影响面预估 + 真实冲突检测（规范 6.2.5 / 六章策略治理） */
function scopeImpact(p: Policy, apps: ApplicationRegistry[], assets: ModelAsset[], all: Policy[]) {
  const conflicts = all.filter((q) => q.policyId !== p.policyId && q.policyType === p.policyType && scopeOverlap(p.scopeType, p.scopeValue, q.scopeType, q.scopeValue));
  const conflictText = conflicts.length > 0 ? `⚠ 与 ${conflicts.map((c) => c.policyId).join('、')} 重叠，按优先级生效` : '无冲突';
  switch (p.scopeType) {
    case 'GLOBAL':
      return { apps: `${apps.length} 个应用（全行）`, models: `${assets.length} 个模型资产`, tenants: '全行租户（含 6 个条线）', conflict: conflictText };
    case 'APP': {
      const app = apps.find((a) => a.appId === p.scopeValue);
      return { apps: `1 个（${p.scopeValue}）`, models: '按策略主/备模型范围', tenants: app ? app.owner : '—', conflict: conflictText };
    }
    case 'MODEL': {
      const model = assets.find((a) => a.assetId === p.scopeValue);
      return { apps: `${model?.activeApps ?? 0} 个应用`, models: `1 个（${p.scopeValue}）`, tenants: model ? model.ownerDept : '—', conflict: conflictText };
    }
    case 'DEPT':
      return { apps: `${p.scopeValue} 下全部应用`, models: '该部门可用模型', tenants: '该部门租户', conflict: conflictText };
    case 'TENANT':
      return { apps: `${p.scopeValue} 下全部应用`, models: '租户内模型', tenants: `1 个（${p.scopeValue}）`, conflict: conflictText };
    default:
      return { apps: '—', models: '—', tenants: '—', conflict: conflictText };
  }
}
