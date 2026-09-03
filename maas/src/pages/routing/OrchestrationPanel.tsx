import { useEffect, useMemo, useState } from 'react';
import { Layers, SlidersHorizontal, Database, Zap, Check, Rocket, ListTodo, Plus, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { BatchTask, EngineVersionInfo, HeatCell, KvCacheGovernance, ModelAsset, OrchestrationConfig } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Banner from '../../components/ui/Banner';
import { ConfirmDialog, BTN_PRIMARY, BTN_GHOST, Modal } from '../../components/ui/Modal';
import { ToggleSwitch, Segmented, Slider } from '../../components/ui/Controls';
import { TagEditor, Field, INPUT_CLS, SELECT_CLS } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';
import { HeteroSchedPanel } from './HeteroPanel';

const DEPTS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

const TASK_STATUS: Record<BatchTask['status'], { label: string; cls: string }> = {
  QUEUED: { label: '排队中', cls: 'bg-primary/10 text-primary' },
  RUNNING: { label: '执行中', cls: 'bg-warning/10 text-warning' },
  DONE: { label: '已完成', cls: 'bg-success/10 text-success' },
  CANCELLED: { label: '已取消', cls: 'bg-border-default/40 text-text-secondary' },
};

/** M4.2 资源编排面板（P17-P22） */
export default function OrchestrationPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [config, setConfig] = useState<OrchestrationConfig | null>(null);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [adopted, setAdopted] = useState<string[]>([]);
  const [kv, setKv] = useState<KvCacheGovernance | null>(null);
  const [engines, setEngines] = useState<EngineVersionInfo[]>([]);
  const [upgradeTarget, setUpgradeTarget] = useState<EngineVersionInfo | null>(null);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BatchTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getOrchestration(), api.getAssets(), api.getHeatmapData(), api.getKvGovernance(), api.getEngineVersions(), api.getBatchTasks()]).then(([c, a, h, k, e, bt]) => {
      setConfig(c);
      setAssets(a);
      setHeat(h);
      setKv(k);
      setEngines(e);
      setTasks(bt);
      setLoading(false);
    });
  }, []);

  const dirty = useMemo(() => true, []); // 策略修改后保存即生效

  const hotNodes = useMemo(() => {
    const nodes = [...new Set(heat.map((c) => c.node))];
    return nodes
      .map((node) => {
        const cells = heat.filter((c) => c.node === node);
        const avg = cells.reduce((s, c) => s + c.utilization, 0) / cells.length;
        return { node, pool: cells[0]?.pool ?? '', avg: Math.round(avg) };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2);
  }, [heat]);

  if (loading || !config) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-56 animate-pulse" />
        ))}
      </div>
    );
  }

  const smallModels = assets.filter((a) => a.assetType === 'SMALL_LLM' || a.assetType === 'OCR' || a.assetType === 'VOICE');

  const save = async () => {
    await api.saveOrchestration(config);
    notify.success('资源编排配置已下发至全部推理节点');
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="调度算力" title="资源编排" desc="推理引擎版本、批处理队列、KV Cache 治理与异构调度策略编排配置" />
      {/* 异构调度策略（厂商级：国产化优先等） */}
      <HeteroSchedPanel />

      <div className="grid grid-cols-2 gap-3">
        {/* -------- 混部配置 -------- */}
        <Panel title="大小模型混部" height={260}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text-primary">
                <Layers size={14} className="text-primary" /> 启用混部（小模型与大模型同卡部署）
              </span>
              <ToggleSwitch checked={config.mixDeploy} onChange={(v) => setConfig({ ...config, mixDeploy: v })} />
            </div>
            {config.mixDeploy && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">混部亲和规则（可同卡的小模型）</label>
                  <TagEditor
                    tags={config.mixAffinity.map((id) => assets.find((a) => a.assetId === id)?.assetName ?? id)}
                    onChange={(names) =>
                      setConfig({
                        ...config,
                        mixAffinity: names.map((n) => smallModels.find((a) => a.assetName === n)?.assetId ?? n),
                      })
                    }
                    validate={(v) => (smallModels.some((a) => a.assetName === v) ? null : '请选择列表中的小模型')}
                    disabled={readOnly}
                  />
                  <p className="mt-1 text-[10px] text-text-secondary">可选：{smallModels.map((a) => a.assetName).join(' / ')}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">显存预留（大模型保护带）：{config.vramReserve}%</label>
                  <Slider value={config.vramReserve} onChange={(v) => setConfig({ ...config, vramReserve: v })} min={5} max={30} unit="%" disabled={readOnly} />
                </div>
              </>
            )}
          </div>
        </Panel>

        {/* -------- 优先级隔离 -------- */}
        <Panel title="优先级隔离" height={260}>
          <div className="space-y-3">
            {(['P0', 'P1', 'P2'] as const).map((p) => (
              <div key={p}>
                <label className="mb-1 flex justify-between text-xs text-text-secondary">
                  <span className={p === 'P0' ? 'font-medium text-danger' : p === 'P1' ? 'text-warning' : ''}>{p} 队列权重</span>
                  <span className="num">{config.weights[p]}</span>
                </label>
                <Slider value={config.weights[p]} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, [p]: v } })} min={1} max={10} disabled={readOnly} />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border-default pt-2">
              <span className="text-xs text-text-secondary">低优任务自动降速排队</span>
              <ToggleSwitch checked={config.lowPrioritySlow} onChange={(v) => setConfig({ ...config, lowPrioritySlow: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">允许 P0 抢占低优资源</span>
              <ToggleSwitch checked={config.p0Preempt} onChange={(v) => setConfig({ ...config, p0Preempt: v })} />
            </div>
          </div>
        </Panel>

        {/* -------- 连续批处理与 KV 缓存 -------- */}
        <Panel title="连续批处理与 KV 缓存" height={300}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text-primary">
                <Database size={14} className="text-success" /> 连续批处理（Continuous Batching）
              </span>
              <ToggleSwitch checked={config.continuousBatch} onChange={(v) => setConfig({ ...config, continuousBatch: v })} />
            </div>
            {config.continuousBatch && (
              <div>
                <label className="mb-1 block text-xs text-text-secondary">批大小上限（1~512）</label>
                <Slider value={config.maxBatch} onChange={(v) => setConfig({ ...config, maxBatch: v })} min={1} max={512} step={1} disabled={readOnly} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">前缀 KV 缓存</span>
              <ToggleSwitch checked={config.kvCache} onChange={(v) => setConfig({ ...config, kvCache: v })} />
            </div>
            {config.kvCache && (
              <div className="space-y-2">
                <Segmented
                  options={[
                    { value: 'ROUND_ROBIN', label: '轮询调度' },
                    { value: 'SEMANTIC', label: '语义感知负载均衡' },
                  ]}
                  value={config.kvStrategy}
                  onChange={(v) => setConfig({ ...config, kvStrategy: v as OrchestrationConfig['kvStrategy'] })}
                />
                {config.kvStrategy === 'SEMANTIC' ? (
                  <Banner tone="info">语义感知路由：同场景请求聚合至同实例，缓存命中率 25% → 50%+</Banner>
                ) : (
                  <p className="text-xs text-text-secondary">轮询调度下命中率约 25% 且波动较大，建议切换语义感知。</p>
                )}
              </div>
            )}
          </div>
        </Panel>

        {/* -------- 投机解码 -------- */}
        <Panel title="投机解码" height={300}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text-primary">
                <Zap size={14} className="text-warning" /> 启用投机解码（草稿模型一次生成多 Token）
              </span>
              <ToggleSwitch checked={config.speculative} onChange={(v) => setConfig({ ...config, speculative: v })} />
            </div>
            {config.speculative && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">草稿模型（EAGLE 系列）</label>
                  <select
                    value={config.draftModel}
                    onChange={(e) => setConfig({ ...config, draftModel: e.target.value })}
                    className="w-full rounded border border-border-default bg-bg-page px-2.5 py-2 text-sm text-text-primary"
                  >
                    {['EAGLE-Qwen-14B-Draft', 'EAGLE-Qwen-72B-Draft', 'EAGLE-Fin-14B-Draft'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <Banner tone="info">Agent 多轮上下文场景收益最大：生成速度提升 2~3 倍，显存开销 +8%。</Banner>
              </>
            )}
            <div className="rounded border border-border-default bg-panel-soft p-3 text-xs leading-relaxed text-text-secondary">
              <SlidersHorizontal size={13} className="mb-1 text-primary" />
              推理加速四大支柱：模型调优 / 资源调度 / 推理加速 / 成本可视化。AI Coding 场景优化后并发 30→200（6.7 倍），成本降低 70~80%。
            </div>
          </div>
        </Panel>
      </div>

      {/* -------- KV 缓存治理（八章：租户隔离/敏感禁存/有效期/审计） -------- */}
      {kv && (
        <Panel title="KV 缓存治理（金融数据敏感约束）" height={200} extra={<span className="num text-xs text-text-secondary">近 24h 命中 {fmtWan(kv.hitTokens24h)} Tokens · 节省推理成本约 {kv.savedCostPct}%</span>}>
          <div className="grid grid-cols-4 gap-3">
            <KvToggle label="租户间缓存隔离" desc="不同部门/租户的前缀缓存严格隔离，禁止跨租户命中" checked={kv.tenantIsolation} onChange={async (v) => { const next = { ...kv, tenantIsolation: v }; setKv(next); await api.saveKvGovernance(next); notify.success(`租户缓存隔离已${v ? '开启' : '关闭'}`); }} />
            <KvToggle label="敏感数据禁存" desc="L3 及以上数据等级的请求不写入缓存" checked={kv.forbidSensitive} onChange={async (v) => { const next = { ...kv, forbidSensitive: v }; setKv(next); await api.saveKvGovernance(next); notify.success(`敏感数据禁存已${v ? '开启' : '关闭'}`); }} />
            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-primary">缓存有效期 TTL</span>
                <span className="num text-primary">{kv.ttlMin}min</span>
              </div>
              <div className="mt-2">
                <Slider value={kv.ttlMin} onChange={(v) => setKv({ ...kv, ttlMin: v })} min={10} max={720} step={10} disabled={readOnly} />
              </div>
              <button
                disabled={readOnly}
                onClick={async () => { await api.saveKvGovernance(kv); notify.success(`缓存 TTL 已保存：${kv.ttlMin} 分钟`); }}
                className={`mt-2 w-full ${BTN_GHOST}`}
              >
                保存 TTL
              </button>
            </div>
            <KvToggle label="命中计量与审计" desc="缓存命中 Token 单独计量，使用记录可审计追溯" checked={kv.auditEnabled} onChange={async (v) => { const next = { ...kv, auditEnabled: v }; setKv(next); await api.saveKvGovernance(next); notify.success(`缓存审计已${v ? '开启' : '关闭'}`); }} />
          </div>
        </Panel>
      )}

      {/* -------- 推理引擎版本管理（13.3：开源引擎治理） -------- */}
      <Panel title="推理引擎版本管理（vLLM / SGLang）" height={190} extra={<span className="text-xs text-text-secondary">版本跟踪 · 升级评估 · 灰度验证 · 异常回退</span>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">引擎</th>
              <th className="pb-2 font-medium">当前版本</th>
              <th className="pb-2 font-medium">最新版本</th>
              <th className="pb-2 font-medium">承载实例</th>
              <th className="pb-2 font-medium">升级状态</th>
              <th className="pb-2 font-medium">升级评估 / 风险提示</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {engines.map((e) => (
              <tr key={e.engineId} className="border-b border-border-default/40 last:border-0">
                <td className="py-2 font-mono text-primary">{e.engine}</td>
                <td className="num py-2">{e.version}</td>
                <td className="num py-2 text-text-secondary">{e.latestVersion}</td>
                <td className="num py-2 text-text-secondary">{e.instances} 个</td>
                <td className="py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${e.upgradeStatus === 'UP_TO_DATE' ? 'bg-success/10 text-success' : e.upgradeStatus === 'GRAY_VERIFY' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                    {e.upgradeStatus === 'UP_TO_DATE' ? '已是最新' : e.upgradeStatus === 'GRAY_VERIFY' ? '灰度验证中' : '可升级'}
                  </span>
                </td>
                <td className="py-2 text-xs text-text-secondary" title={e.riskNote}>
                  <span className="line-clamp-2 max-w-96">{e.releaseNote}</span>
                </td>
                <td className="py-2 text-right">
                  {e.upgradeStatus === 'UPGRADE_AVAILABLE' && (
                    <button disabled={readOnly} onClick={() => setUpgradeTarget(e)} className={`inline-flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                      <Rocket size={12} /> 发起升级
                    </button>
                  )}
                  {e.upgradeStatus === 'GRAY_VERIFY' && (
                    <button
                      disabled={readOnly}
                      onClick={async () => {
                        await api.finishEngineUpgrade(e.engineId);
                        notify.success(`${e.engine} 升级完成：灰度验证通过，已全量生效 ${e.latestVersion}`);
                        api.getEngineVersions().then(setEngines);
                      }}
                      className={`inline-flex items-center gap-1 ${BTN_GHOST}`}
                      title={readOnly ? '只读模式下写操作已禁用' : '灰度验证通过，确认升级完成'}
                    >
                      <Check size={12} /> 确认升级完成
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* -------- 批量推理任务队列（P2-15：错峰排队，对标硅基流动批量推理） -------- */}
      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <ListTodo size={14} className="text-primary" /> 批量推理任务队列（错峰调度）
          </span>
        }
        extra={
          <div className="flex items-center gap-2">
            <span className="num text-xs text-text-secondary">排队 {tasks.filter((t) => t.status === 'QUEUED').length} · 执行中 {tasks.filter((t) => t.status === 'RUNNING').length}</span>
            <button disabled={readOnly} onClick={() => setTaskDialog(true)} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
              <Plus size={12} /> 提交任务
            </button>
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">任务</th>
              <th className="pb-2 font-medium">部门</th>
              <th className="pb-2 font-medium">模型</th>
              <th className="pb-2 font-medium">优先级</th>
              <th className="pb-2 font-medium">错峰窗口</th>
              <th className="pb-2 font-medium">批量条数</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.taskId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                <td className="py-2 text-text-primary">
                  {t.name}
                  <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{t.taskId}</span>
                </td>
                <td className="py-2 text-xs text-text-secondary">{DEPTS.find((d) => d.value === t.deptId)?.label ?? t.deptId}</td>
                <td className="py-2 text-xs text-text-secondary">{assets.find((a) => a.assetId === t.assetId)?.assetName ?? t.assetId}</td>
                <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${t.priority === 'P2' ? 'bg-warning/10 text-warning' : 'bg-border-default/40 text-text-secondary'}`}>{t.priority}</span></td>
                <td className="num py-2 text-xs">{t.window}</td>
                <td className="num py-2">{t.rows.toLocaleString()}</td>
                <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${TASK_STATUS[t.status].cls}`}>{TASK_STATUS[t.status].label}</span></td>
                <td className="py-2 text-right">
                  {(t.status === 'QUEUED' || t.status === 'RUNNING') && (
                    <button disabled={readOnly} onClick={() => setCancelTarget(t)} className={`inline-flex items-center gap-1 ${BTN_GHOST}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                      <XCircle size={12} /> 取消
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-text-secondary/70">离线批量任务仅允许在错峰窗口（低峰时段）调度，优先级 P2/P3，不占用 P0/P1 在线资源（在线与离线任务优先级隔离）。</p>
      </Panel>

      {/* -------- 错峰调度采纳 -------- */}
      <Panel title="错峰调度建议（联动热区分析）">
        <div className="grid grid-cols-2 gap-2">
          {hotNodes.map((n) => {
            const done = adopted.includes(n.node);
            return (
              <div key={n.node} className="flex items-center justify-between rounded border border-border-default bg-panel-soft p-3">
                <div>
                  <span className="font-mono text-sm text-text-primary">{n.node}</span>
                  <span className="ml-2 text-xs text-text-secondary">{n.pool} · 近 24h 均值利用率 <b className={n.avg > 70 ? 'text-warning' : 'text-text-primary'}>{n.avg}%</b></span>
                  <p className="mt-0.5 text-xs text-text-secondary">建议：低价值批任务迁移至 00-06 低峰窗口，预计利用率降至 55%</p>
                </div>
                <button
                  disabled={readOnly || done}
                  onClick={async () => {
                    await api.adoptPeakShift(n.node);
                    setAdopted((prev) => [...prev, n.node]);
                    notify.success(`已采纳 ${n.node} 错峰建议，调度任务已生成`);
                  }}
                  className={done ? BTN_GHOST : BTN_PRIMARY}
                  title={readOnly ? '只读模式下写操作已禁用' : ''}
                >
                  {done ? (
                    <span className="flex items-center gap-1 text-success"><Check size={12} /> 已采纳</span>
                  ) : (
                    '采纳建议'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* -------- 保存条 -------- */}
      <div className="flex items-center justify-between rounded border border-border-default bg-bg-panel px-4 py-2.5">
        <span className="text-xs text-text-secondary">配置修改将在保存后分钟级下发全部推理节点（共 110 节点），并写入操作留痕</span>
        <button onClick={save} disabled={readOnly || !dirty} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
          保存并下发
        </button>
      </div>

      {/* 引擎升级确认（先灰度验证，异常可回退） */}
      <ConfirmDialog
        open={!!upgradeTarget}
        level="warning"
        title="发起引擎升级"
        message={<>将 {upgradeTarget?.engine} 从 <b>{upgradeTarget?.version}</b> 升级至 <b className="text-primary">{upgradeTarget?.latestVersion}</b>。<br />{upgradeTarget?.riskNote}</>}
        confirmText="发起灰度升级"
        onCancel={() => setUpgradeTarget(null)}
        onConfirm={async () => {
          if (!upgradeTarget) return;
          await api.startEngineUpgrade(upgradeTarget.engineId);
          notify.success(`${upgradeTarget.engine} 升级已发起，灰度验证中（异常将自动回退原版本）`);
          setUpgradeTarget(null);
          api.getEngineVersions().then(setEngines);
        }}
      />

      {/* 批量任务取消确认 */}
      <ConfirmDialog
        open={!!cancelTarget}
        level="warning"
        title="取消批量任务"
        message={<>取消 <b>{cancelTarget?.name}</b>（{cancelTarget?.rows.toLocaleString()} 条）：已完成部分保留计量，未执行部分不再调度。</>}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          await api.cancelBatchTask(cancelTarget.taskId);
          notify.success(`批量任务「${cancelTarget.name}」已取消`);
          setCancelTarget(null);
          api.getBatchTasks().then(setTasks);
        }}
      />

      {/* 提交批量任务弹窗 */}
      {taskDialog && <BatchTaskDialog assets={assets} onClose={() => setTaskDialog(false)} onSaved={() => { setTaskDialog(false); api.getBatchTasks().then(setTasks); }} />}
  );
}

/** 提交批量任务表单 */
function BatchTaskDialog({ assets, onClose, onSaved }: { assets: ModelAsset[]; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState('DEPT-TECH');
  const [assetId, setAssetId] = useState(assets[0]?.assetId ?? '');
  const [priority, setPriority] = useState<'P2' | 'P3'>('P3');
  const [windowSel, setWindowSel] = useState('00:00-06:00');
  const [rows, setRows] = useState('10000');

  const nameOk = name.trim().length >= 4 && name.trim().length <= 40;
  const rowsOk = /^\d+$/.test(rows) && Number(rows) >= 100 && Number(rows) <= 10_000_000;
  const invalid = !nameOk || !rowsOk || !assetId;

  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title="提交批量推理任务"
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.submitBatchTask({ name: name.trim(), deptId, assetId, priority, window: windowSel, rows: Number(rows) });
              notify.success(`批量任务「${name.trim()}」已提交，将在错峰窗口调度`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            提交
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="任务名称" required error={name && !nameOk ? '4~40 字' : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：存量客户营销文案批量生成" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="提交部门" required>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={SELECT_CLS}>
              {DEPTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="模型" required>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={SELECT_CLS}>
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>{a.assetName}（¥{a.costPer1kTokens}/K）</option>
              ))}
            </select>
          </Field>
          <Field label="优先级" required hint="批量任务仅 P2/P3">
            <Segmented
              options={[
                { value: 'P2', label: 'P2' },
                { value: 'P3', label: 'P3' },
              ]}
              value={priority}
              onChange={(v) => setPriority(v as 'P2' | 'P3')}
            />
          </Field>
          <Field label="错峰窗口" required>
            <select value={windowSel} onChange={(e) => setWindowSel(e.target.value)} className={SELECT_CLS}>
              {['00:00-06:00', '22:00-06:00', '12:00-14:00'].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="批量条数" required error={rows && !rowsOk ? '范围 100 ~ 10,000,000' : ''}>
          <input value={rows} onChange={(e) => setRows(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
        </Field>
        <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">任务将在所选错峰窗口内按优先级排队执行；高峰时段不占用 P0/P1 在线资源，计量计入提交部门。</p>
      </div>
    </Modal>
  );
}

const fmtWan = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n % 10_000 === 0 ? 0 : 1)} 万`;
  return n.toLocaleString('zh-CN');
};

/** KV 治理开关卡 */
function KvToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <ToggleSwitch checked={checked} onChange={onChange} />
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">{desc}</p>
    </div>
  );
}
