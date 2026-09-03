import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Zap, Loader2, RefreshCw, BookMarked, Flag, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api';
import type { DetectModelInfo, DetectModule, GuardrailConfig, GuardrailPolicy, KeywordLibrary, ReportFeedback } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Banner from '../../components/ui/Banner';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { ToggleSwitch, Segmented } from '../../components/ui/Controls';
import { Field, INPUT_CLS, TagEditor } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const ACTION_LABEL: Record<GuardrailPolicy['action'], string> = { BLOCK: '阻断', MASK: '脱敏', ALERT: '告警' };
const MODULE_KEYS: { key: string; label: string }[] = [
  { key: 'ILLEGAL', label: '违法信息过滤' },
  { key: 'BAD_INFO', label: '不良信息过滤' },
  { key: 'MALCODE', label: '恶意代码识别' },
  { key: 'PRIVACY', label: '隐私信息拦截' },
  { key: 'PROXY_ANSWER', label: '模型代答' },
  { key: 'SESSION_BLOCK', label: '会话阻断' },
  { key: 'INJECTION', label: '防提示词注入' },
  { key: 'COMPLIANCE', label: '输入合规检测' },
  { key: 'ABUSE', label: '模型滥用检测' },
  { key: 'DDOS', label: 'DDOS 检测' },
];

type GuardView = 'conn' | 'policy' | 'res';

const VIEW_META: Record<GuardView, { title: string; desc: string }> = {
  conn: { title: '护栏接入', desc: '护栏服务地址与凭证配置、连通性测试与接入指引；关闭护栏需二次确认并留痕' },
  policy: { title: '安全策略', desc: '策略 = 检测模块组合 + 命中动作（阻断/脱敏/告警），绑定业务应用后生效' },
  res: { title: '检测资源', desc: '关键词库、检测模型与举报反馈的统一运营，支撑护栏能力持续调优' },
};

/** M9 护栏规则（P42-P44：按子菜单拆为 护栏接入 / 安全策略 / 检测资源） */
export default function GuardrailConfigPanel({ view = 'conn' }: { view?: GuardView }) {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [config, setConfig] = useState<GuardrailConfig | null>(null);
  const [policies, setPolicies] = useState<GuardrailPolicy[]>([]);
  const [modules, setModules] = useState<DetectModule[]>([]);
  const [libs, setLibs] = useState<KeywordLibrary[]>([]);
  const [detectModels, setDetectModels] = useState<DetectModelInfo[]>([]);
  const [reports, setReports] = useState<ReportFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [offConfirm, setOffConfirm] = useState(false);
  const [policyDialog, setPolicyDialog] = useState<{ data: GuardrailPolicy | null } | null>(null);
  const [policyDelete, setPolicyDelete] = useState<GuardrailPolicy | null>(null);
  const [libDialog, setLibDialog] = useState<{ data: KeywordLibrary | null } | null>(null);
  const [libDelete, setLibDelete] = useState<KeywordLibrary | null>(null);
  const [moduleOffConfirm, setModuleOffConfirm] = useState<DetectModule | null>(null);
  const [updatingLib, setUpdatingLib] = useState(false);

  /* 护栏接入表单态 */
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  const reload = () =>
    Promise.all([api.getGuardrailConfig(), api.getGuardrailPolicies(), api.getDetectModules(), api.getKeywordLibs(), api.getDetectModels(), api.getReportFeedbacks()]).then(([c, p, m, l, d, r]) => {
      setConfig(c);
      setPolicies(p);
      setModules(m);
      setLibs(l);
      setDetectModels(d);
      setReports(r);
      setApiUrl(c.apiUrl);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  /** 接入指引进度（三步） */
  const step1 = !!config?.enabled && !!config.apiUrl;
  const step2 = policies.length > 0;
  const step3 = policies.some((p) => p.bindApps.length > 0);

  if (loading || !config) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="panel h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  const urlOk = /^https:\/\/.+\..+/.test(apiUrl);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="安全审计 / 护栏规则" title={VIEW_META[view].title} desc={VIEW_META[view].desc} />
      {!config.enabled && (
        <Banner tone="danger">
          <ShieldCheck size={14} /> 安全护栏已关闭：所有请求将绕过内容安全检测，存在重大合规风险
        </Banner>
      )}

      {view === 'conn' && (
        /* ============ 护栏接入卡（P44） ============ */
        <Panel
          title="护栏接入配置"
          className="max-w-2xl"
          extra={
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">{config.enabled ? '已开启' : '已关闭'}</span>
              <ToggleSwitch
                checked={config.enabled}
                onChange={(v) => {
                  if (!v) setOffConfirm(true);
                  else {
                    api.saveGuardrailConfig({ ...config, enabled: true }).then(() => {
                      notify.success('安全护栏已开启');
                      reload();
                    });
                  }
                }}
              />
            </div>
          }
        >
          <div className="space-y-3">
            <Field label="护栏 API 地址" required error={urlOk ? '' : '需以 https:// 开头'}>
              <input
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setDirty(true);
                }}
                className={`${INPUT_CLS} font-mono text-xs`}
                placeholder="https://guardrail.example.com/api/v1"
              />
            </Field>
            <Field label="API Key" hint={config.apiKeyMasked ? '留空=沿用原 Key' : ''}>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setDirty(true);
                  }}
                  className={`${INPUT_CLS} pr-9`}
                  placeholder={config.apiKeyMasked ? `••••••（${config.apiKeyMasked}）` : '输入护栏服务 API Key'}
                />
                <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary" aria-label="显示/隐藏">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <div className="flex gap-2">
              <button
                disabled={!dirty || !urlOk || readOnly}
                title={readOnly ? '只读模式下写操作已禁用' : ''}
                onClick={async () => {
                  await api.saveGuardrailConfig({ ...config, apiUrl, apiKeyMasked: apiKey ? `gd-****${apiKey.slice(-4)}` : config.apiKeyMasked });
                  setDirty(false);
                  notify.success('护栏规则已保存');
                  reload();
                }}
                className={BTN_PRIMARY}
              >
                保存
              </button>
              <button
                disabled={testing || readOnly}
                onClick={async () => {
                  setTesting(true);
                  const { ok, textMs, mmMs } = await api.testGuardrail();
                  setTesting(false);
                  if (ok) notify.success(`连通正常：文本检测时延 ${textMs}ms / 多模态 ${mmMs}ms`);
                  else notify.error('连通失败：护栏服务未开启或地址不可达');
                }}
                className={BTN_GHOST}
              >
                {testing ? <Loader2 size={12} className="inline animate-spin" /> : <Zap size={12} className="inline" />} 测试连通性
              </button>
            </div>
            {/* 接入指引三步 */}
            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="mb-2 text-xs font-medium text-text-secondary">接入指引</div>
              <GuideStep n={1} done={step1} text="配置护栏 API 地址并保存" />
              <GuideStep n={2} done={step2} text="创建安全策略（检测模块 + 动作）" />
              <GuideStep n={3} done={step3} text="将策略绑定至业务应用" />
            </div>
          </div>
        </Panel>
      )}

      {view === 'policy' && (<>
        {/* ============ 安全策略列表（P44） ============ */}
        <Panel
          title="安全策略"
          extra={
            <button disabled={readOnly} onClick={() => setPolicyDialog({ data: null })} title={readOnly ? '只读模式下写操作已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
              <Plus size={13} /> 新建策略
            </button>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">接入 ID</th>
                <th className="pb-2 font-medium">策略名称</th>
                <th className="pb-2 font-medium">描述</th>
                <th className="pb-2 font-medium">模块数</th>
                <th className="pb-2 font-medium">动作</th>
                <th className="pb-2 font-medium">绑定应用</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.policyId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                  <td className="py-2 font-mono text-xs text-primary">{p.policyId}</td>
                  <td className="py-2 text-text-primary">{p.name}</td>
                  <td className="py-2 text-xs text-text-secondary">{p.desc}</td>
                  <td className="num py-2 text-text-secondary">{p.modules.length}</td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${p.action === 'BLOCK' ? 'bg-danger/10 text-danger' : p.action === 'MASK' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                      {ACTION_LABEL[p.action]}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-text-secondary">{p.bindApps.length > 0 ? `${p.bindApps.length} 个` : <span className="text-warning">未绑定</span>}</td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <button disabled={readOnly} onClick={() => setPolicyDialog({ data: p })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑">
                        <Pencil size={13} />
                      </button>
                      <button disabled={readOnly} onClick={() => setPolicyDelete(p)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40" title="删除">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* ============ 检测模块矩阵（P42） ============ */}
      <Panel title="检测模块（10 项，独立启停 + 灵敏度）" extra={<span className="num text-xs text-text-secondary">{modules.filter((m) => m.enabled).length}/10 已启用</span>}>
        <div className="grid grid-cols-5 gap-2">
          {modules.map((m) => (
            <div key={m.moduleKey} className={`rounded border p-2.5 transition-colors ${m.enabled ? 'border-border-default bg-panel-soft' : 'border-border-default/40 bg-bg-page opacity-70'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium text-text-primary" title={m.label}>{m.label}</span>
                <ToggleSwitch
                  checked={m.enabled}
                  onChange={(v) => {
                    if (!v && m.critical) setModuleOffConfirm(m);
                    else {
                      api.toggleDetectModule(m.moduleKey).then(() => {
                        notify.success(`检测模块「${m.label}」已${v ? '启用' : '停用'}`);
                        reload();
                      });
                    }
                  }}
                />
              </div>
              <div className="mt-2">
                <Segmented
                  options={[
                    { value: 'LOW', label: '低' },
                    { value: 'MED', label: '中' },
                    { value: 'HIGH', label: '高' },
                  ]}
                  value={m.sensitivity}
                  onChange={async (v) => {
                    await api.setModuleSensitivity(m.moduleKey, v as DetectModule['sensitivity']);
                    notify.success(`「${m.label}」灵敏度调整为 ${v === 'LOW' ? '低' : v === 'MED' ? '中' : '高'}`);
                    reload();
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </>)}

      {view === 'res' && (
      /* ============ 词库 + 检测模型 + 举报（P43） ============ */
      <div className="grid grid-cols-3 gap-3">
        <Panel
          title="关键词库管理"
          height={300}
          extra={
            <button disabled={readOnly} onClick={() => setLibDialog({ data: null })} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
              <Plus size={12} /> 自定义词库
            </button>
          }
        >
          <div className="space-y-2">
            {libs.map((l) => (
              <div key={l.libId} className="rounded border border-border-default bg-panel-soft p-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                    <BookMarked size={13} className={l.type === 'SYSTEM' ? 'text-primary' : 'text-success'} /> {l.name}
                  </span>
                  {l.type === 'SYSTEM' ? (
                    <button
                      disabled={updatingLib || readOnly}
                      onClick={async () => {
                        setUpdatingLib(true);
                        await api.updateSystemLib();
                        setUpdatingLib(false);
                        notify.success('系统词库已更新（新增 312 条）');
                        reload();
                      }}
                      className={BTN_GHOST}
                    >
                      {updatingLib ? <Loader2 size={12} className="inline animate-spin" /> : <RefreshCw size={12} className="inline" />} 更新词库
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button disabled={readOnly} onClick={() => setLibDialog({ data: l })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40">
                        <Pencil size={12} />
                      </button>
                      <button disabled={readOnly} onClick={() => setLibDelete(l)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="num mt-1 flex justify-between text-[10px] text-text-secondary">
                  <span>{l.version} · {l.wordCount.toLocaleString()} 条</span>
                  <span>更新 {new Date(l.updatedAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="检测模型管理" height={300}>
          <div className="space-y-2">
            {detectModels.map((d) => (
              <div key={d.modelId} className="flex items-center justify-between rounded border border-border-default bg-panel-soft p-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                    {d.name}
                    {d.isDefault && <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">默认</span>}
                  </div>
                  <div className="num mt-0.5 text-[10px] text-text-secondary">
                    {d.version} · 时延 {d.latencyMs}ms · <StatusTag status={d.status === 'RUNNING' ? 'RUNNING' : 'IDLE'} ns="Resource" size="sm" />
                  </div>
                </div>
                {!d.isDefault && (
                  <button
                    disabled={readOnly}
                    onClick={async () => {
                      await api.setDefaultDetectModel(d.modelId);
                      notify.success(`「${d.name}」已设为默认检测模型`);
                      reload();
                    }}
                    className={BTN_GHOST}
                  >
                    设为默认
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="举报反馈" height={300}>
          <div className="space-y-2">
            {reports.length === 0 && <p className="text-xs text-text-secondary">暂无举报反馈</p>}
            {reports.map((r) => (
              <div key={r.reportId} className="rounded border border-border-default bg-panel-soft p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 truncate text-xs text-text-primary">
                    <Flag size={12} className="shrink-0 text-warning" /> {r.content}
                  </span>
                  <StatusTag status={r.status} ns="Report" size="sm" />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-text-secondary">{r.source} · {new Date(r.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  {r.status === 'OPEN' && (
                    <div className="flex gap-1">
                      <button
                        disabled={readOnly}
                        onClick={async () => {
                          await api.handleReport(r.reportId, 'VALID');
                          notify.success('举报已判定有效，相关规则将加严');
                          reload();
                        }}
                        className="rounded border border-danger/40 bg-danger/5 px-1.5 py-0.5 text-[10px] text-danger hover:bg-danger/15 disabled:opacity-40"
                      >
                        有效
                      </button>
                      <button
                        disabled={readOnly}
                        onClick={async () => {
                          await api.handleReport(r.reportId, 'FALSE_POSITIVE');
                          notify.info('已判定为误报，将优化词库');
                          reload();
                        }}
                        className="rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-text-primary disabled:opacity-40"
                      >
                        误报
                      </button>
                      <button
                        disabled={readOnly}
                        onClick={async () => {
                          await api.handleReport(r.reportId, 'IGNORED');
                          reload();
                        }}
                        className="rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-text-primary disabled:opacity-40"
                      >
                        忽略
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      )}

      {/* ============ 弹窗区 ============ */}
      <ConfirmDialog
        open={offConfirm}
        level="danger"
        title="关闭安全护栏"
        confirmWord="关闭护栏"
        message={<>关闭后<b className="text-danger">所有请求将绕过内容安全检测</b>，违反金融监管合规要求，仅允许在演练环境短时操作。</>}
        confirmText="确认关闭"
        onCancel={() => setOffConfirm(false)}
        onConfirm={async () => {
          await api.saveGuardrailConfig({ ...config, enabled: false });
          setOffConfirm(false);
          notify.error('安全护栏已关闭，请尽快恢复');
          reload();
        }}
      />

      <ConfirmDialog
        open={!!moduleOffConfirm}
        level="warning"
        title={`停用核心检测模块`}
        message={<>「{moduleOffConfirm?.label}」为<b className="text-warning">核心合规模块</b>，停用后相关风险内容将不再拦截，可能引发监管问题。确定停用？</>}
        onCancel={() => setModuleOffConfirm(null)}
        onConfirm={async () => {
          if (!moduleOffConfirm) return;
          await api.toggleDetectModule(moduleOffConfirm.moduleKey);
          notify.success(`检测模块「${moduleOffConfirm.label}」已停用`);
          setModuleOffConfirm(null);
          reload();
        }}
      />

      {policyDialog && <PolicyFormDialog initial={policyDialog.data} onClose={() => setPolicyDialog(null)} onSaved={(name) => { setPolicyDialog(null); notify.success(`安全策略「${name}」已保存`); reload(); }} />}

      <ConfirmDialog
        open={!!policyDelete}
        level="danger"
        title="删除安全策略"
        confirmWord={policyDelete?.name}
        message={<>删除策略「{policyDelete?.name}」后，其绑定的 {policyDelete?.bindApps.length ?? 0} 个应用将失去对应防护。</>}
        confirmText="确认删除"
        onCancel={() => setPolicyDelete(null)}
        onConfirm={async () => {
          if (!policyDelete) return;
          await api.deleteGuardrailPolicy(policyDelete.policyId);
          notify.success(`安全策略「${policyDelete.name}」已删除`);
          setPolicyDelete(null);
          reload();
        }}
      />

      {libDialog && <LibFormDialog initial={libDialog.data} onClose={() => setLibDialog(null)} onSaved={(name) => { setLibDialog(null); notify.success(`词库「${name}」已保存`); reload(); }} />}

      <ConfirmDialog
        open={!!libDelete}
        level="danger"
        title="删除自定义词库"
        confirmWord={libDelete?.name}
        message={<>删除词库「{libDelete?.name}」（{libDelete?.wordCount} 条词条）后不可恢复。</>}
        confirmText="确认删除"
        onCancel={() => setLibDelete(null)}
        onConfirm={async () => {
          if (!libDelete) return;
          await api.deleteCustomLib(libDelete.libId);
          notify.success(`词库「${libDelete.name}」已删除`);
          setLibDelete(null);
          reload();
        }}
      />
  );
}

function GuideStep({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-xs last:mb-0">
      <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] ${done ? 'border-success/60 bg-success/15 text-success' : 'border-border-default text-text-secondary'}`}>
        {done ? '✓' : n}
      </span>
      <span className={done ? 'text-text-primary' : 'text-text-secondary'}>{text}</span>
    </div>
  );
}

/* ---------------- 安全策略表单 ---------------- */

function PolicyFormDialog({ initial, onClose, onSaved }: { initial: GuardrailPolicy | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  const [mods, setMods] = useState<string[]>(initial?.modules ?? []);
  const [action, setAction] = useState<GuardrailPolicy['action']>(initial?.action ?? 'BLOCK');
  const [bindApps, setBindApps] = useState<string[]>(initial?.bindApps ?? []);
  const [touched, setTouched] = useState(false);

  const APPS = [
    { id: 'APP-CSR', name: '智能客服' },
    { id: 'APP-CREDIT', name: '信贷审批助手' },
    { id: 'APP-AICODING', name: 'AI 代码助手' },
    { id: 'APP-RISK', name: '风控报告生成' },
    { id: 'APP-DOC', name: '合同文档抽取' },
    { id: 'APP-INVEST', name: '金融投研助手' },
  ];

  const errors = {
    name: name.trim().length < 2 || name.trim().length > 30 ? '名称需 2~30 字' : '',
    mods: mods.length === 0 ? '至少勾选 1 个检测模块' : '',
  };
  const invalid = Object.values(errors).some(Boolean);

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={initial ? `编辑安全策略 · ${initial.name}` : '新建安全策略'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.saveGuardrailPolicy({ policyId: initial?.policyId ?? '', name: name.trim(), desc: desc.trim(), modules: mods, action, bindApps });
              onSaved(name.trim());
            }}
            className={BTN_PRIMARY}
          >
            保存策略
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="策略名称" required error={touched ? errors.name : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：零售客服输出护栏" />
        </Field>
        <Field label="描述" hint="≤100 字">
          <input value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 100))} className={INPUT_CLS} />
        </Field>
        <Field label="检测模块" required error={touched ? errors.mods : ''}>
          <div className="grid grid-cols-2 gap-1.5 rounded border border-border-default bg-bg-page p-2">
            {MODULE_KEYS.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                <input type="checkbox" checked={mods.includes(m.key)} onChange={(e) => setMods(e.target.checked ? [...mods, m.key] : mods.filter((x) => x !== m.key))} className="accent-[#2d7be5]" />
                {m.label}
              </label>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="命中动作" required>
            <Segmented
              options={[
                { value: 'BLOCK', label: '阻断' },
                { value: 'MASK', label: '脱敏' },
                { value: 'ALERT', label: '告警' },
              ]}
              value={action}
              onChange={(v) => setAction(v as GuardrailPolicy['action'])}
            />
          </Field>
          <Field label="绑定应用" hint="可多选">
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto rounded border border-border-default bg-bg-page p-2">
              {APPS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setBindApps((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                  className={`rounded border px-1.5 py-0.5 text-xs transition-colors ${bindApps.includes(a.id) ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border-default text-text-secondary hover:text-text-primary'}`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 自定义词库表单 ---------------- */

function LibFormDialog({ initial, onClose, onSaved }: { initial: KeywordLibrary | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [words, setWords] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length >= 2 && name.trim().length <= 30;
  const wordOk = initial ? true : words.length > 0;
  const invalid = !nameOk || !wordOk;

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={initial ? `编辑词库 · ${initial.name}` : '新建自定义词库'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.saveCustomLib(name.trim(), initial ? initial.wordCount + words.length : words.length, initial?.libId);
              onSaved(name.trim());
            }}
            className={BTN_PRIMARY}
          >
            保存词库
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="词库名称" required error={touched && !nameOk ? '名称需 2~30 字' : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：金融违禁词库" />
        </Field>
        <Field label="词条录入" required={!initial} error={touched && !wordOk ? '至少录入 1 条词条' : ''} hint="回车添加，单词 ≤32 字，单库 ≤500 条，自动去重">
          <TagEditor tags={words} onChange={setWords} placeholder="输入敏感词后回车" validate={(v) => (v.length > 32 ? '单词超过 32 字' : null)} max={500} />
        </Field>
        {initial && <p className="text-xs text-text-secondary">当前词库已有 {initial.wordCount} 条词条，本次新增将追加。</p>}
      </div>
    </Modal>
  );
}
