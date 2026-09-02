import { useEffect, useMemo, useState } from 'react';
import { Plug, Plus, Pencil, Trash2, Zap, Eye, EyeOff, Loader2, Boxes, Server, Gauge } from 'lucide-react';
import { api } from '../../services/api';
import type { PlatformSummary } from '../../services/api';
import type { ModelConnection } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { Segmented, Stepper } from '../../components/ui/Controls';
import { Field, INPUT_CLS, SELECT_CLS, TagEditor } from '../../components/ui/Bits';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const PROVIDER_URL: Record<string, string> = {
  OpenRouter: 'https://openrouter.ai/api/v1',
  阿里云百炼: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  火山引擎: 'https://ark.cn-beijing.volces.com/api/v3',
  自定义: '',
};

const PROVIDER_MODELS: Record<string, string[]> = {
  OpenRouter: ['anthropic/claude-4.6-opus', 'openai/gpt-5', 'deepseek/deepseek-v3'],
  阿里云百炼: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'text-embedding-v3'],
  火山引擎: ['doubao-pro-256k', 'doubao-lite-32k', 'doubao-embedding'],
  自定义: [],
};

const CARD_TYPES = ['H20', 'L20', '4090D', '昇腾910B', 'B300'];
const SOURCE_LABEL: Record<ModelConnection['source'], string> = { CLOUD: '云端', LOCAL: '本地', RENTAL: '租赁' };

/** M7.1 统一模型接入（P37） */
export default function ModelConnections() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [conns, setConns] = useState<ModelConnection[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ data: ModelConnection | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelConnection | null>(null);

  const reload = () =>
    Promise.all([api.getConnections(), api.getSummary()]).then(([c, s]) => {
      setConns(c);
      setSummary(s);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  const cloudCount = useMemo(() => conns.filter((c) => c.source === 'CLOUD').length, [conns]);

  const doTest = async (c: ModelConnection) => {
    setTestingId(c.connId);
    const { ok, latencyMs } = await api.testConnection(c.connId);
    setTestingId(null);
    if (ok) notify.success(`「${c.name}」连通正常，时延 ${latencyMs}ms`);
    else notify.error(`「${c.name}」连通失败，请检查 API Key / 地址配置`);
    reload();
  };

  if (loading) {
    return <div className="panel h-64 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="模型接入" desc="云端/本地/租赁模型连接统一管理，支持连通测试与凭证维护" />
      {/* 顶部汇总条（P37 截图口径） */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryKpi icon={<Boxes size={16} />} label="纳管模型" value={`${summary?.models ?? 128}`} unit="个" hint="含云端/本地/租赁全部模型" />
        <SummaryKpi icon={<Server size={16} />} label="GPU / NPU 服务器" value={`${summary?.nodes ?? 128}`} unit="台" hint="全量纳管节点" />
        <SummaryKpi icon={<Gauge size={16} />} label="平均利用率" value={`${summary?.gpuUtil ?? 80}`} unit="%" hint="时间加权利用率" />
      </div>

      <div className="mock-data">
      <Panel
        title={`模型接入列表（云端 ${cloudCount} / 本地 ${conns.filter((c) => c.source === 'LOCAL').length} / 租赁 ${conns.filter((c) => c.source === 'RENTAL').length}）`}
        extra={
          <button onClick={() => setDialog({ data: null })} disabled={readOnly} title={readOnly ? '只读模式下写操作已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
            <Plus size={13} /> 接入模型
          </button>
        }
      >
        {conns.length === 0 ? (
          <EmptyState text="暂无接入配置，点击右上角「接入模型」添加云端/本地/租赁算力" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">接入名称</th>
                <th className="pb-2 font-medium">来源</th>
                <th className="pb-2 font-medium">供应商 / 算力</th>
                <th className="pb-2 font-medium">模型类型</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 font-medium">最近检测</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {conns.map((c) => (
                <tr key={c.connId} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft">
                  <td className="py-2.5">
                    <span className="font-medium text-text-primary">{c.name}</span>
                    {c.assetId && <span className="ml-1.5 rounded bg-success/10 px-1 text-[10px] text-success">已登记资产 {c.assetId}</span>}
                  </td>
                  <td className="py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${c.source === 'CLOUD' ? 'bg-primary/10 text-primary' : c.source === 'LOCAL' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {SOURCE_LABEL[c.source]}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-text-secondary">
                    {c.source === 'CLOUD' ? (
                      <>
                        {c.provider}
                        <span className="ml-1 font-mono text-text-secondary/60">{c.apiKeyMasked}</span>
                      </>
                    ) : (
                      <span className="num">{c.nodes} 节点 · {c.cardType}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-text-secondary">{c.modelType}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <StatusTag status={c.status} ns="Conn" size="sm" />
                      {c.latencyMs !== null && <span className="num text-[10px] text-text-secondary">{c.latencyMs}ms</span>}
                    </div>
                  </td>
                  <td className="num py-2.5 text-xs text-text-secondary">
                    {new Date(c.lastCheckAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => doTest(c)} disabled={readOnly || testingId === c.connId} title={readOnly ? '只读模式下写操作已禁用' : '测试连通性'} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                        {testingId === c.connId ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} 测试
                      </button>
                      <button disabled={readOnly} onClick={() => setDialog({ data: c })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑">
                        <Pencil size={13} />
                      </button>
                      <button disabled={readOnly} onClick={() => setDeleteTarget(c)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40" title="删除">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      </div>

      {dialog && <ConnFormDialog initial={dialog.data} onClose={() => setDialog(null)} onSaved={(isNew, name) => { setDialog(null); notify.success(`接入「${name}」已${isNew ? '创建' : '保存'}，可点击「测试」验证连通性`); reload(); }} />}

      <ConfirmDialog
        open={!!deleteTarget}
        level="danger"
        title="删除模型接入"
        confirmWord={deleteTarget?.name}
        message={
          deleteTarget?.assetId ? (
            <>该接入已关联在用资产 <b className="font-mono text-warning">{deleteTarget.assetId}</b>，删除后将同时下线该资产并中断相关调用。</>
          ) : (
            <>删除接入「{deleteTarget?.name}」后配置不可恢复。</>
          )
        }
        confirmText="确认删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteConnection(deleteTarget.connId);
          notify.success(`接入「${deleteTarget.name}」已删除`);
          setDeleteTarget(null);
          reload();
        }}
      />
    </div>
  );
}

function SummaryKpi({ icon, label, value, unit, hint }: { icon: React.ReactNode; label: string; value: string; unit: string; hint: string }) {
  return (
    <div className="panel flex items-center gap-3 p-3" title={hint}>
      <div className="flex h-10 w-10 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-text-secondary">{label}</div>
        <div className="num text-2xl font-semibold text-text-primary">
          {value}
          <span className="ml-1 text-xs font-normal text-text-secondary">{unit}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 接入表单弹窗（云端 / 本地 / 租赁）                                    */
/* ------------------------------------------------------------------ */

function ConnFormDialog({ initial, onClose, onSaved }: { initial: ModelConnection | null; onClose: () => void; onSaved: (isNew: boolean, name: string) => void }) {
  const [source, setSource] = useState<ModelConnection['source']>(initial?.source ?? 'CLOUD');
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState(initial?.provider ?? '阿里云百炼');
  const [modelType, setModelType] = useState(initial?.modelType ?? '文本生成');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? PROVIDER_URL['阿里云百炼']);
  const [nodes, setNodes] = useState(initial?.nodes ?? 1);
  const [cardType, setCardType] = useState(initial?.cardType ?? 'H20');
  const [rentalSource, setRentalSource] = useState(initial?.provider ?? 'CloudA');
  const [touched, setTouched] = useState(false);

  const isCloud = source === 'CLOUD';
  const urlOk = !isCloud || /^https:\/\/.+\..+/.test(baseUrl);
  const keyOk = !isCloud || (initial ? true : apiKey.trim().length >= 8);
  const errors = {
    name: name.trim().length < 2 || name.trim().length > 40 ? '名称需 2~40 字' : '',
    baseUrl: urlOk ? '' : '需以 https:// 开头的合法地址',
    apiKey: keyOk ? '' : 'API Key 至少 8 字符',
  };
  const invalid = Object.values(errors).some(Boolean);

  return (
    <Modal
      open
      onClose={onClose}
      width={540}
      title={initial ? `编辑接入 · ${initial.name}` : '接入模型'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              setTouched(true);
              if (invalid) return;
              await api.saveConnection({
                connId: initial?.connId ?? '',
                name: name.trim(),
                source,
                provider: isCloud ? provider : source === 'LOCAL' ? '行内数据中心' : rentalSource,
                modelType,
                apiKeyMasked: isCloud ? (initial?.apiKeyMasked || `sk-****${apiKey.slice(-4)}`) : '',
                baseUrl: isCloud ? baseUrl : '',
                nodes: isCloud ? 0 : nodes,
                cardType: isCloud ? '' : cardType,
                status: initial?.status ?? 'TESTING',
                latencyMs: initial?.latencyMs ?? null,
                assetId: initial?.assetId ?? null,
                lastCheckAt: initial?.lastCheckAt ?? new Date().toISOString(),
                createdAt: initial?.createdAt ?? new Date().toISOString(),
              });
              onSaved(!initial, name.trim());
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="算力来源" required>
          <Segmented
            options={[
              { value: 'CLOUD', label: '云端模型' },
              { value: 'LOCAL', label: '本地算力' },
              { value: 'RENTAL', label: '租赁算力' },
            ]}
            value={source}
            onChange={(v) => setSource(v as ModelConnection['source'])}
          />
        </Field>
        <Field label="接入名称" required error={touched ? errors.name : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder={isCloud ? '如：阿里云百炼-Qwen-Max' : '如：本地 H20 生产集群'} />
        </Field>

        {isCloud ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="供应商" required>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    if (PROVIDER_URL[e.target.value]) setBaseUrl(PROVIDER_URL[e.target.value]);
                  }}
                  className={SELECT_CLS}
                >
                  {Object.keys(PROVIDER_URL).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="模型类型" required>
                <select value={modelType} onChange={(e) => setModelType(e.target.value)} className={SELECT_CLS}>
                  {['文本生成', 'Embedding', '图像生成', 'OCR', '语音'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="API Key" required error={touched ? errors.apiKey : ''} hint={initial ? '留空=沿用原 Key' : ''}>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`${INPUT_CLS} pr-9`}
                  placeholder={initial ? '••••••••（已保存）' : '输入供应商 API Key'}
                />
                <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary" aria-label="显示/隐藏">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="API Base URL" required error={touched ? errors.baseUrl : ''}>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={`${INPUT_CLS} font-mono text-xs`} placeholder="https://…" />
            </Field>
            <Field label="模型清单" hint="回车添加，或从供应商拉取">
              <ProviderModelFetcher provider={provider} />
            </Field>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {source === 'RENTAL' && (
                <Field label="租赁商" required>
                  <select value={rentalSource} onChange={(e) => setRentalSource(e.target.value)} className={SELECT_CLS}>
                    {['CloudA', 'CloudB', '国产云商'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="节点数" required hint="1~512">
                <Stepper value={nodes} onChange={setNodes} min={1} max={512} />
              </Field>
              <Field label="卡型" required>
                <select value={cardType} onChange={(e) => setCardType(e.target.value)} className={SELECT_CLS}>
                  {CARD_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
              <Plug size={12} className="mr-1 inline text-primary" />
              本地/租赁算力接入后将由弹性算力中心统一纳管，支持 vGPU 切分与池化调度。
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

/** 模型清单拉取（模拟）：展示可拉取的示例模型 chips */
function ProviderModelFetcher({ provider }: { provider: string }) {
  const [fetched, setFetched] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => {
          setLoading(true);
          setTimeout(() => {
            setFetched(PROVIDER_MODELS[provider] ?? []);
            setLoading(false);
          }, 1000);
        }}
        className={`flex items-center gap-1 ${BTN_GHOST}`}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} {loading ? '拉取中…' : `从 ${provider} 拉取模型列表`}
      </button>
      {fetched.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fetched.map((m) => (
            <span key={m} className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-xs text-success">{m}</span>
          ))}
        </div>
      )}
      <TagEditor tags={[]} onChange={() => {}} placeholder="也可手动输入模型名，回车添加" />
    </div>
  );
}
