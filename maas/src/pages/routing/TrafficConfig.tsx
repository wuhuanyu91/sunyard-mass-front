import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, RotateCcw, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import { api } from '../../services/api';
import type { ApiKey, ApplicationRegistry, ModelAsset, RateLimitRule, RoutingRuleSet } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { ToggleSwitch, CopyButton, Segmented } from '../../components/ui/Controls';
import { Field, INPUT_CLS, SELECT_CLS } from '../../components/ui/Bits';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');

const DEPT_OPTIONS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

type TrafficView = 'key' | 'limit' | 'route';

const VIEW_TITLE: Record<TrafficView, string> = {
  key: '密钥管理',
  limit: '限流策略',
  route: '场景路由',
};

const VIEW_DESC: Record<TrafficView, string> = {
  key: '应用凭证统一管理：创建/重置/停用/删除，变更均需审批并留痕',
  limit: 'QPS + Token 双维限流规则，支持按全局/部门/应用/Key 维度指定',
  route: '场景级模型白名单、降级目标与时延上限配置，保存即生成控制面策略走审批',
};

/** M2 流量管控配置（P14：按子菜单拆为 API Key 管理 / 限流策略 / 场景路由规则） */
export default function TrafficConfig({ view = 'key' }: { view?: TrafficView }) {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [scenes, setScenes] = useState<RoutingRuleSet[]>([]);
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () =>
    Promise.all([api.getApiKeys(), api.getRateLimitRules(), api.getRoutingRuleSets(), api.getApps(), api.getAssets()]).then(([k, r, s, ap, as_]) => {
      setKeys(k);
      setRules(r);
      setScenes(s);
      setApps(ap);
      setAssets(as_);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  /* ---------- API Key 弹窗态 ---------- */
  const [keyDialog, setKeyDialog] = useState<{ mode: 'create' | 'edit'; data: ApiKey | null } | null>(null);
  const [resetResult, setResetResult] = useState<{ keyId: string; newKey: string; saved: boolean } | null>(null);
  const [resetTarget, setResetTarget] = useState<ApiKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

  /* ---------- 限流规则弹窗态 ---------- */
  const [ruleDialog, setRuleDialog] = useState<{ data: RateLimitRule | null } | null>(null);
  const [ruleDelete, setRuleDelete] = useState<RateLimitRule | null>(null);

  /* ---------- 场景规则编辑 ---------- */
  const [sceneEdit, setSceneEdit] = useState<RoutingRuleSet | null>(null);

  const appName = useMemo(() => Object.fromEntries(apps.map((a) => [a.appId, a.appName])), [apps]);
  const assetName = useMemo(() => Object.fromEntries(assets.map((a) => [a.assetId, a.assetName])), [assets]);
  const deptName = (id: string) => DEPT_OPTIONS.find((d) => d.value === id)?.label ?? id;

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="panel h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="调度算力 / 流量管控" title={VIEW_TITLE[view]} desc={VIEW_DESC[view]} />
      {/* ================= API Key 管理（P14） ================= */}
      {view === 'key' && (
      <Panel
        title="密钥管理"
        extra={
          <div className="flex items-center gap-2">
            <span className="num text-xs text-text-secondary">{keys.length} 个密钥 · {keys.filter((k) => k.status === 'ENABLED').length} 个启用</span>
            <button onClick={() => setKeyDialog({ mode: 'create', data: null })} disabled={readOnly} title={readOnly ? '只读模式下写操作已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
              <Plus size={13} /> 新建 Key
            </button>
          </div>
        }
      >
        {keys.length === 0 ? (
          <EmptyState text="暂无 API Key，点击右上角「新建 Key」创建第一个密钥" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">Key</th>
                <th className="pb-2 font-medium">描述</th>
                <th className="pb-2 font-medium">归属</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 font-medium">环境</th>
                <th className="pb-2 font-medium">使用 / 额度</th>
                <th className="pb-2 font-medium">最近调用来源</th>
                <th className="pb-2 font-medium">限流规则</th>
                <th className="pb-2 font-medium">有效期</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const exhausted = k.callQuota > 0 && k.usedCount >= k.callQuota;
                return (
                  <tr key={k.keyId} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft">
                    <td className="py-2">
                      <span className="flex items-center gap-1 font-mono text-xs text-primary">
                        {k.keyMasked}
                        <CopyButton text={k.keyFull} title="复制完整 Key" />
                      </span>
                    </td>
                    <td className="py-2 text-xs text-text-secondary">{k.desc}</td>
                    <td className="py-2 text-xs text-text-secondary">
                      {deptName(k.ownerDept)}
                      <span className="text-text-secondary/60"> / {appName[k.appId] ?? k.appId}</span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          checked={k.status === 'ENABLED'}
                          title={k.status === 'ENABLED' ? '点击禁用' : '点击启用'}
                          onChange={async () => {
                            await api.toggleApiKey(k.keyId);
                            notify.success(`API Key ${k.keyMasked} 已${k.status === 'ENABLED' ? '禁用' : '启用'}`);
                            reload();
                          }}
                        />
                        <StatusTag status={k.status} ns="KeyStatus" size="sm" />
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${k.env === 'PROD' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>{k.env === 'PROD' ? '生产' : '测试'}</span>
                    </td>
                    <td className="num py-2 text-xs">
                      {fmt(k.usedCount)} / {k.callQuota === 0 ? '不限' : fmt(k.callQuota)}
                      {exhausted && <span className="ml-1.5 rounded bg-danger/15 px-1 text-[10px] font-bold text-danger">已耗尽</span>}
                    </td>
                    <td className="py-2">
                      <span className="font-mono text-xs text-text-secondary" title="最近调用来源 IP（异常来源可在审计日志中追溯）">{k.lastUsedIp || '—'}</span>
                    </td>
                    <td className="py-2 text-xs">
                      {k.rateLimitRuleId ? (
                        <span className="font-mono text-warning">{rules.find((r) => r.ruleId === k.rateLimitRuleId)?.name ?? k.rateLimitRuleId}</span>
                      ) : (
                        <span className="text-text-secondary/50">未挂载</span>
                      )}
                    </td>
                    <td className="num py-2 text-xs text-text-secondary">{k.expireAt ?? '永久'}</td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title="编辑" disabled={readOnly} onClick={() => setKeyDialog({ mode: 'edit', data: k })} className="rounded p-1 text-text-secondary transition-colors hover:text-primary disabled:opacity-40">
                          <Pencil size={13} />
                        </button>
                        <button title="重置 Key" disabled={readOnly} onClick={() => setResetTarget(k)} className="rounded p-1 text-text-secondary transition-colors hover:text-warning disabled:opacity-40">
                          <RotateCcw size={13} />
                        </button>
                        <button title="删除" disabled={readOnly} onClick={() => setDeleteTarget(k)} className="rounded p-1 text-text-secondary transition-colors hover:text-danger disabled:opacity-40">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      )}

      {/* ================= 限流策略配置（P14/P29） ================= */}
      {view === 'limit' && (
        <Panel
          title="限流策略（QPS + Token 双维）"
          extra={
            <button onClick={() => setRuleDialog({ data: null })} disabled={readOnly} title={readOnly ? '只读模式下写操作已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
              <Plus size={13} /> 新建规则
            </button>
          }
        >
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.ruleId} className="rounded border border-border-default bg-panel-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={r.enabled}
                      title={r.enabled ? '停用规则' : '启用规则'}
                      onChange={async () => {
                        await api.toggleRateLimitRule(r.ruleId);
                        notify.success(`限流规则「${r.name}」已${r.enabled ? '停用' : '启用'}`);
                        reload();
                      }}
                    />
                    <span className={`text-sm font-medium ${r.enabled ? 'text-text-primary' : 'text-text-secondary/60 line-through'}`}>{r.name}</span>
                    <span className="rounded border border-border-default bg-bg-page px-1.5 py-0.5 text-[10px] text-text-secondary">
                      {r.targetType === 'GLOBAL' ? '全局' : r.targetType === 'DEPT' ? `部门 ${deptName(r.targetId)}` : r.targetType === 'APP' ? `应用 ${appName[r.targetId] ?? r.targetId}` : `Key ${keys.find((k) => k.keyId === r.targetId)?.keyMasked ?? r.targetId}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="num text-xs text-warning" title="近 24h 命中次数（联动限流命中记录）">命中 {r.hits24h}</span>
                    <button disabled={readOnly} onClick={() => setRuleDialog({ data: r })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑">
                      <Pencil size={13} />
                    </button>
                    <button disabled={readOnly} onClick={() => setRuleDelete(r)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40" title="删除">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="num mt-2 grid grid-cols-5 gap-1.5 text-center text-xs">
                  <LimitCell label="请求频率" value={`${fmt(r.qpsPerMin)}/min`} />
                  <LimitCell label="输入 Token" value={fmt(r.inputTokenLimit)} />
                  <LimitCell label="输出 Token" value={fmt(r.outputTokenLimit)} />
                  <LimitCell label="并发数" value={fmt(r.concurrency)} />
                  <LimitCell label="超限行为" value={r.overAction === 'REJECT' ? '拒绝(429)' : r.overAction === 'QUEUE' ? '排队等待' : '降级模型'} />
                </div>
                {r.ipWhitelist.length > 0 && (
                  <p className="mt-1.5 truncate font-mono text-[10px] text-text-secondary">
                    IP 白名单：{r.ipWhitelist.join('，')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ================= 场景路由规则（P11） ================= */}
      {view === 'route' && (
        <Panel title="场景路由（信贷 / 风控 / 营销 / 客服）" extra={<span className="text-xs text-text-secondary">保存即生成控制面策略走审批</span>}>
          <div className="grid grid-cols-2 gap-2">
            {scenes.map((s) => (
              <div key={s.sceneKey} className="flex flex-col rounded border border-border-default bg-panel-soft p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    <RouteIcon size={14} className="text-primary" /> {s.sceneName}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${s.priority === 'P0' ? 'bg-danger/15 text-danger' : s.priority === 'P1' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'}`}>{s.priority}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-text-secondary">
                  <p>
                    允许模型：
                    {s.allowedModels.map((m) => (
                      <span key={m} className="mr-1 rounded bg-bg-page px-1 py-0.5 font-mono text-[10px] text-primary">{assetName[m] ?? m}</span>
                    ))}
                  </p>
                  <p>降级目标：<span className="text-warning">{assetName[s.fallbackModel] ?? s.fallbackModel}</span></p>
                  <p>时延上限：<span className="num text-text-primary">{fmt(s.latencyCeilMs)}ms</span></p>
                  <p className="text-text-secondary/60">{s.policyId ? `已关联策略 ${s.policyId}` : '未生成控制面策略'}</p>
                </div>
                <button onClick={() => setSceneEdit(s)} disabled={readOnly} className={`mt-auto flex items-center justify-center gap-1 pt-2 ${BTN_GHOST} w-full`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                  <Pencil size={12} /> 编辑规则
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ================= 弹窗区 ================= */}
      {keyDialog && (
        <KeyFormDialog
          mode={keyDialog.mode}
          initial={keyDialog.data}
          apps={apps}
          assets={assets}
          rules={rules}
          onClose={() => setKeyDialog(null)}
          onSaved={(isNew) => {
            setKeyDialog(null);
            notify.success(isNew ? 'API Key 已创建' : 'API Key 已更新');
            reload();
          }}
        />
      )}

      {/* 重置 Key：警告确认 → 新 Key 仅展示一次 */}
      <ConfirmDialog
        open={!!resetTarget}
        level="warning"
        title="重置 API Key"
        message={
          <>
            重置后旧 Key <b className="font-mono text-text-primary">{resetTarget?.keyMasked}</b> <b className="text-danger">立即失效</b>，所有使用该 Key 的调用方需同步更新。确定重置？
          </>
        }
        confirmText="生成新 Key"
        onCancel={() => setResetTarget(null)}
        onConfirm={async () => {
          if (!resetTarget) return;
          const { newKey } = await api.resetApiKey(resetTarget.keyId);
          setResetTarget(null);
          setResetResult({ keyId: resetTarget.keyId, newKey, saved: false });
          reload();
        }}
      />

      {resetResult && (
        <Modal
          open
          onClose={() => resetResult.saved && setResetResult(null)}
          width={460}
          title={
            <span className="flex items-center gap-2 text-success">
              <KeyRound size={15} /> 新 Key 已生成
            </span>
          }
          footer={
            <button
              onClick={() => setResetResult(null)}
              disabled={!resetResult.saved}
              className={`disabled:opacity-40 ${BTN_PRIMARY}`}
              title={!resetResult.saved ? '请先复制并保存 Key' : ''}
            >
              我已保存，关闭
            </button>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">该 Key 仅展示一次，关闭后不可再次查看，请立即复制保存。</p>
            <div className="flex items-center gap-2 rounded border border-border-default bg-bg-page px-3 py-2">
              <code className="flex-1 break-all font-mono text-xs text-success">{resetResult.newKey}</code>
              <CopyButton text={resetResult.newKey} title="复制新 Key" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={resetResult.saved} onChange={(e) => setResetResult({ ...resetResult, saved: e.target.checked })} className="accent-[#2d7be5]" />
              我已复制并妥善保存新 Key
            </label>
          </div>
        </Modal>
      )}

      {/* 删除 Key：danger + 输入后 4 位确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        level="danger"
        title="删除 API Key"
        confirmWord={deleteTarget?.keyMasked.slice(-4)}
        message={
          <>
            将删除密钥 <b className="font-mono">{deleteTarget?.keyMasked}</b>（{deleteTarget?.desc}），删除后关联调用立即拒绝且不可恢复。
          </>
        }
        confirmText="确认删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteApiKey(deleteTarget.keyId);
          notify.success(`API Key ${deleteTarget.keyMasked} 已删除`);
          setDeleteTarget(null);
          reload();
        }}
      />

      {ruleDialog && (
        <RuleFormDialog
          initial={ruleDialog.data}
          apps={apps}
          keys={keys}
          onClose={() => setRuleDialog(null)}
          onSaved={(name, isNew) => {
            setRuleDialog(null);
            notify.success(`限流规则「${name}」已${isNew ? '创建' : '保存'}`);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!ruleDelete}
        level="danger"
        title="删除限流规则"
        confirmWord={ruleDelete?.name}
        message={<>删除规则「{ruleDelete?.name}」后，其限流防护立即失效，可能导致流量突增冲击后端。</>}
        confirmText="确认删除"
        onCancel={() => setRuleDelete(null)}
        onConfirm={async () => {
          if (!ruleDelete) return;
          await api.deleteRateLimitRule(ruleDelete.ruleId);
          notify.success(`限流规则「${ruleDelete.name}」已删除`);
          setRuleDelete(null);
          reload();
        }}
      />

      {sceneEdit && (
        <SceneFormDialog
          initial={sceneEdit}
          assets={assets}
          onClose={() => setSceneEdit(null)}
          onSaved={(name) => {
            setSceneEdit(null);
            notify.info(`场景规则「${name}」已保存，已生成控制面策略提交审批`);
            reload();
          }}
        />
      )}
    </div>
  );
}

function LimitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-bg-page px-1 py-1.5">
      <div className="text-[10px] text-text-secondary">{label}</div>
      <div className="mt-0.5 text-text-primary">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* API Key 表单弹窗                                                     */
/* ------------------------------------------------------------------ */

function KeyFormDialog({
  mode,
  initial,
  apps,
  assets,
  rules,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial: ApiKey | null;
  apps: ApplicationRegistry[];
  assets: ModelAsset[];
  rules: RateLimitRule[];
  onClose: () => void;
  onSaved: (isNew: boolean) => void;
}) {
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [dept, setDept] = useState(initial?.ownerDept ?? 'DEPT-TECH');
  const [appId, setAppId] = useState(initial?.appId ?? '');
  const [expire, setExpire] = useState<'PERM' | '30' | '90' | '365'>(initial ? (initial.expireAt === null ? 'PERM' : '90') : '90');
  const [quota, setQuota] = useState(String(initial?.callQuota ?? 0));
  const [models, setModels] = useState<string[]>(initial?.allowedModels ?? []);
  const [ruleId, setRuleId] = useState(initial?.rateLimitRuleId ?? '');
  const [env, setEnv] = useState<'PROD' | 'TEST'>(initial?.env ?? 'PROD');
  const [touched, setTouched] = useState(false);

  const deptApps = apps.filter((a) => a.deptId === dept);
  const errors = {
    desc: desc.trim().length < 2 || desc.trim().length > 50 ? '描述需 2~50 字' : '',
    appId: !appId ? '请选择归属应用' : '',
    quota: /^\d+$/.test(quota) && Number(quota) <= 100_000_000 ? '' : '额度为 0~100,000,000 整数（0=不限）',
    models: models.length === 0 ? '至少选择 1 个可用模型' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  const expireAt = () => {
    if (expire === 'PERM') return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(expire));
    return d.toISOString().slice(0, 10);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={mode === 'create' ? '新建 API Key' : `编辑 API Key · ${initial?.keyMasked}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.saveApiKey({
                keyId: initial?.keyId,
                desc: desc.trim(),
                ownerDept: dept,
                appId,
                status: initial?.status ?? 'ENABLED',
                expireAt: expireAt(),
                callQuota: Number(quota),
                allowedModels: models,
                rateLimitRuleId: ruleId || null,
                lastUsedAt: initial?.lastUsedAt ?? null,
                env,
                lastUsedIp: initial?.lastUsedIp ?? '',
              });
              onSaved(mode === 'create');
            }}
            className={BTN_PRIMARY}
          >
            {mode === 'create' ? '创建' : '保存'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="描述" required error={touched ? errors.desc : ''} hint="2~50 字">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className={INPUT_CLS} placeholder="如：智能客服生产密钥" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="归属部门" required>
            <select
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setAppId('');
              }}
              className={SELECT_CLS}
            >
              {DEPT_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="归属应用" required error={touched ? errors.appId : ''}>
            <select value={appId} onChange={(e) => setAppId(e.target.value)} className={SELECT_CLS}>
              <option value="">请选择</option>
              {deptApps.map((a) => (
                <option key={a.appId} value={a.appId}>{a.appName}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="有效期">
            <Segmented
              options={[
                { value: '30', label: '30天' },
                { value: '90', label: '90天' },
                { value: '365', label: '365天' },
                { value: 'PERM', label: '永久' },
              ]}
              value={expire}
              onChange={(v) => setExpire(v as typeof expire)}
            />
          </Field>
          <Field label="使用环境" hint="测试/生产密钥隔离管理">
            <Segmented
              options={[
                { value: 'PROD', label: '生产' },
                { value: 'TEST', label: '测试' },
              ]}
              value={env}
              onChange={(v) => setEnv(v as 'PROD' | 'TEST')}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="调用额度" error={touched ? errors.quota : ''} hint="0=不限">
            <input value={quota} onChange={(e) => setQuota(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
          <Field label="挂载限流规则" hint="可为空">
            <select value={ruleId} onChange={(e) => setRuleId(e.target.value)} className={SELECT_CLS}>
              <option value="">不挂载</option>
              {rules.map((r) => (
                <option key={r.ruleId} value={r.ruleId}>{r.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="可用模型服务" required error={touched ? errors.models : ''} hint="至少 1 个">
          <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-auto rounded border border-border-default bg-bg-page p-2">
            {assets.map((a) => (
              <label key={a.assetId} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={models.includes(a.assetId)}
                  onChange={(e) => setModels(e.target.checked ? [...models, a.assetId] : models.filter((m) => m !== a.assetId))}
                  className="accent-[#2d7be5]"
                />
                <span className="truncate">{a.assetName}</span>
                <span className="num ml-auto shrink-0 text-text-secondary/60">¥{a.costPer1kTokens}/K</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 限流规则表单弹窗                                                     */
/* ------------------------------------------------------------------ */

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

function RuleFormDialog({
  initial,
  apps,
  keys,
  onClose,
  onSaved,
}: {
  initial: RateLimitRule | null;
  apps: ApplicationRegistry[];
  keys: ApiKey[];
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [targetType, setTargetType] = useState<RateLimitRule['targetType']>(initial?.targetType ?? 'APP');
  const [targetId, setTargetId] = useState(initial?.targetId ?? '');
  const [qps, setQps] = useState(String(initial?.qpsPerMin ?? 60));
  const [inTok, setInTok] = useState(String(initial?.inputTokenLimit ?? 32768));
  const [outTok, setOutTok] = useState(String(initial?.outputTokenLimit ?? 8192));
  const [conc, setConc] = useState(String(initial?.concurrency ?? 20));
  const [ips, setIps] = useState<string[]>(initial?.ipWhitelist ?? []);
  const [overAction, setOverAction] = useState<RateLimitRule['overAction']>(initial?.overAction ?? 'REJECT');
  const [touched, setTouched] = useState(false);

  const inRange = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
  const errors = {
    name: name.trim().length < 2 || name.trim().length > 30 ? '规则名需 2~30 字' : '',
    target: targetType !== 'GLOBAL' && !targetId ? '请选择作用对象' : '',
    qps: inRange(qps, 1, 10000) ? '' : '范围 1~10,000 次/分钟',
    inTok: inRange(inTok, 1024, 1000000) ? '' : '范围 1,024~1,000,000',
    outTok: inRange(outTok, 512, 256000) ? '' : '范围 512~256,000',
    conc: inRange(conc, 1, 1000) ? '' : '范围 1~1,000',
  };
  const invalid = Object.values(errors).some(Boolean);
  const overlap = targetType !== 'GLOBAL' && targetId && !initial && false; // 保留占位（冲突提示逻辑可扩展）

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={initial ? `编辑限流规则 · ${initial.name}` : '新建限流规则'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.saveRateLimitRule({
                ruleId: initial?.ruleId ?? '',
                name: name.trim(),
                targetType,
                targetId: targetType === 'GLOBAL' ? '*' : targetId,
                enabled: initial?.enabled ?? true,
                qpsPerMin: Number(qps),
                inputTokenLimit: Number(inTok),
                outputTokenLimit: Number(outTok),
                concurrency: Number(conc),
                ipWhitelist: ips,
                overAction,
                hits24h: initial?.hits24h ?? 0,
              });
              onSaved(name.trim(), !initial);
            }}
            className={BTN_PRIMARY}
          >
            保存规则
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {overlap && <p className="text-xs text-warning">与已有规则作用对象重叠，更具体的规则优先生效</p>}
        <Field label="规则名称" required error={touched ? errors.name : ''} hint="2~30 字">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：智能客服限流" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="作用对象类型" required>
            <Segmented
              options={[
                { value: 'GLOBAL', label: '全局' },
                { value: 'APP', label: '应用' },
                { value: 'DEPT', label: '部门' },
                { value: 'API_KEY', label: 'Key' },
              ]}
              value={targetType}
              onChange={(v) => {
                setTargetType(v as RateLimitRule['targetType']);
                setTargetId('');
              }}
            />
          </Field>
          {targetType !== 'GLOBAL' && (
            <Field label="目标" required error={touched ? errors.target : ''}>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={SELECT_CLS}>
                <option value="">请选择</option>
                {targetType === 'APP' && apps.map((a) => <option key={a.appId} value={a.appId}>{a.appName}</option>)}
                {targetType === 'DEPT' && DEPT_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                {targetType === 'API_KEY' && keys.map((k) => <option key={k.keyId} value={k.keyId}>{k.keyMasked}（{k.desc}）</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="请求频率（次/每分钟）" required error={touched ? errors.qps : ''} hint="1~10,000">
            <input value={qps} onChange={(e) => setQps(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
          <Field label="并发连接数" required error={touched ? errors.conc : ''} hint="1~1,000">
            <input value={conc} onChange={(e) => setConc(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
          <Field label="输入 Token 上限 / 单请求" required error={touched ? errors.inTok : ''}>
            <input value={inTok} onChange={(e) => setInTok(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
          <Field label="输出 Token 上限 / 单请求" required error={touched ? errors.outTok : ''}>
            <input value={outTok} onChange={(e) => setOutTok(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
        </div>
        <Field label="IP 白名单" hint="IP 或 CIDR，回车添加；留空=不限制">
          <TagEditorIp tags={ips} onChange={setIps} />
        </Field>
        <Field label="超限行为" required>
          <Segmented
            options={[
              { value: 'REJECT', label: '拒绝(429)' },
              { value: 'QUEUE', label: '排队等待' },
              { value: 'DOWNGRADE', label: '降级低成本模型' },
            ]}
            value={overAction}
            onChange={(v) => setOverAction(v as RateLimitRule['overAction'])}
          />
        </Field>
      </div>
    </Modal>
  );
}

function TagEditorIp({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (!IP_RE.test(v)) {
      setErr('格式错误：需为 IPv4 或 CIDR（如 10.20.0.0/16）');
      return;
    }
    if (tags.includes(v)) {
      setErr('已存在重复条目');
      return;
    }
    if (tags.length >= 100) {
      setErr('最多 100 条');
      return;
    }
    setErr('');
    onChange([...tags, v]);
    setInput('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-border-default bg-bg-page p-1.5">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-primary/60 hover:text-danger">✕</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="如 10.20.0.0/16，回车添加"
          className="min-w-28 flex-1 bg-transparent px-1 py-0.5 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/50"
        />
      </div>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 场景路由规则表单                                                     */
/* ------------------------------------------------------------------ */

function SceneFormDialog({
  initial,
  assets,
  onClose,
  onSaved,
}: {
  initial: RoutingRuleSet;
  assets: ModelAsset[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [priority, setPriority] = useState<RoutingRuleSet['priority']>(initial.priority);
  const [allowed, setAllowed] = useState<string[]>(initial.allowedModels);
  const [fallback, setFallback] = useState(initial.fallbackModel);
  const [latency, setLatency] = useState(String(initial.latencyCeilMs));

  const latOk = /^\d+$/.test(latency) && Number(latency) >= 200 && Number(latency) <= 10000;
  const invalid = allowed.length === 0 || !fallback || !latOk;

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={`编辑场景规则 · ${initial.sceneName}`}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.saveRoutingRuleSet({ ...initial, priority, allowedModels: allowed, fallbackModel: fallback, latencyCeilMs: Number(latency) });
              onSaved(initial.sceneName);
            }}
            className={BTN_PRIMARY}
          >
            保存并提交审批
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="业务优先级" required>
          <Segmented
            options={[
              { value: 'P0', label: 'P0' },
              { value: 'P1', label: 'P1' },
              { value: 'P2', label: 'P2' },
              { value: 'P3', label: 'P3' },
            ]}
            value={priority}
            onChange={(v) => setPriority(v as RoutingRuleSet['priority'])}
          />
        </Field>
        <Field label="允许模型范围" required hint="至少 1 个">
          <div className="grid max-h-32 grid-cols-2 gap-1.5 overflow-auto rounded border border-border-default bg-bg-page p-2">
            {assets.map((a) => (
              <label key={a.assetId} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={allowed.includes(a.assetId)}
                  onChange={(e) => setAllowed(e.target.checked ? [...allowed, a.assetId] : allowed.filter((m) => m !== a.assetId))}
                  className="accent-[#2d7be5]"
                />
                {a.assetName}
              </label>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="降级目标模型" required>
            <select value={fallback} onChange={(e) => setFallback(e.target.value)} className={SELECT_CLS}>
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>{a.assetName}</option>
              ))}
            </select>
          </Field>
          <Field label="时延上限（ms）" required error={latOk ? '' : '范围 200~10,000'}>
            <input value={latency} onChange={(e) => setLatency(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
        </div>
        <p className="rounded border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">保存后将生成 POL-ROUTING 策略并提交策略治理审批，审批通过后分钟级下发全网网关。</p>
      </div>
    </Modal>
  );
}
