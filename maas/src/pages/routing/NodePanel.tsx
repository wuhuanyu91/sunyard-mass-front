import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, TrendingUp, Wrench } from 'lucide-react';
import { api } from '../../services/api';
import type { ComputeResource, HeatCell, Instance, NodeConfig } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import Drawer from '../../components/ui/Drawer';
import { EmptyState } from '../../components/ui/EmptyState';
import { ToggleSwitch, Segmented, Slider, Stepper } from '../../components/ui/Controls';
import { ConfirmDialog, BTN_PRIMARY, BTN_GHOST, BTN_DANGER } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const POOL_LABEL: Record<string, string> = {
  'POOL-H20': 'H20 生产池',
  'POOL-L20': 'L20 生产池',
  'POOL-4090': '4090 开发池',
  'POOL-ASCEND': '昇腾 NPU 池',
  'POOL-MUXI': '沐曦国产池',
  'POOL-CPU': 'CPU 池',
  'POOL-RENTAL': '外部租赁池',
};

/** 池 → 承载实例（按部署拓扑关联） */
const POOL_INSTANCES: Record<string, string[]> = {
  'POOL-H20': ['INS-QWEN72-01'],
  'POOL-L20': ['INS-QWEN14-01', 'INS-FIN14-01', 'INS-OCR-01'],
  'POOL-4090': ['INS-FIN14Q-01', 'INS-INTENT-01'],
  'POOL-ASCEND': ['INS-VOICE-01'],
  'POOL-CPU': ['INS-OCR-01'],
  'POOL-RENTAL': ['INS-EXT-01'],
};

const HEAT_HOURS = Array.from({ length: 12 }, (_, i) => i * 2);

function heatTone(u: number) {
  if (u >= 85) return 'bg-[#dc2626] text-white'; // 高热：实色深红（两主题下白字均可读）
  if (u >= 70) return 'bg-[#b45309] text-white'; // 偏高：实色深橙
  if (u >= 50) return 'bg-primary/40 text-text-primary';
  return 'bg-panel-soft text-text-secondary';
}

/** 调度算力 · 节点管理：资源池分组拓扑、节点维护/编排操作、热区分析与容量规划 */
export default function NodePanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [resources, setResources] = useState<ComputeResource[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ComputeResource | null>(null);
  const [nodeCfg, setNodeCfg] = useState<NodeConfig | null>(null);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [maintTarget, setMaintTarget] = useState<ComputeResource | null>(null);

  useEffect(() => {
    Promise.all([api.getResources(), api.getInstances(), api.getHeatmapData()]).then(([r, i, h]) => {
      setResources(r);
      setInstances(i);
      setHeat(h);
      setLoading(false);
    });
  }, []);

  /** 选中节点时加载其编排配置（vGPU/量化/副本） */
  useEffect(() => {
    if (selectedNode) {
      api.getNodeConfig(selectedNode.resourceId).then(setNodeCfg);
    } else {
      setNodeCfg(null);
    }
  }, [selectedNode]);

  const pools = useMemo(() => {
    const map = new Map<string, ComputeResource[]>();
    for (const r of resources) {
      const arr = map.get(r.pool) ?? [];
      arr.push(r);
      map.set(r.pool, arr);
    }
    return [...map.entries()];
  }, [resources]);

  const heatRows = useMemo(() => {
    const nodes = [...new Set(heat.map((c) => c.node))];
    return nodes.map((node) => ({
      node,
      pool: heat.find((c) => c.node === node)?.pool ?? '',
      cells: HEAT_HOURS.map((h) => heat.find((c) => c.node === node && c.hour === h)?.utilization ?? 0),
    }));
  }, [heat]);

  const hotAdvice = useMemo(() => {
    const avgByNode = heatRows.map((row) => ({
      node: row.node,
      pool: row.pool,
      avg: row.cells.reduce((a, b) => a + b, 0) / row.cells.length,
    }));
    return [...avgByNode].sort((a, b) => b.avg - a.avg).slice(0, 2);
  }, [heatRows]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="调度算力" title="节点管理" desc="算力节点统一管理：资源池分组拓扑、节点维护/编排操作、热区分析与容量规划" />

      {/* 异构资源池拓扑（6.4.2：按 pool 分组，点击节点查看详情） */}
      <Panel title={`异构资源池（共 ${pools.length} 池 · ${resources.length} 节点，按 pool 分组）`} height={300}>
        <div className="grid h-full grid-cols-3 gap-3 overflow-auto">
          {pools.map(([pool, nodes]) => (
            <div key={pool} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-secondary">{POOL_LABEL[pool] ?? pool}</span>
                <span className="num text-text-secondary/70">{nodes.length} 节点</span>
              </div>
              {nodes.map((r) => (
                <button
                  key={r.resourceId}
                  onClick={() => setSelectedNode(r)}
                  className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-left text-xs transition-colors hover:brightness-125 ${
                    r.status === 'NODE_FAULT' || r.status === 'INSTANCE_FAULT'
                      ? 'border-danger/50 bg-danger/10 pulse-danger'
                      : r.status === 'HOT' || r.status === 'QUEUED' || r.status === 'DEGRADED'
                        ? 'border-warning/40 bg-warning/5'
                        : 'border-border-default bg-panel-soft'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-text-primary">{r.node}</span>
                    <span className="num text-xs text-text-secondary/70">
                      {r.resourceType} · 利用率 {r.utilization}% · 队列 {r.queueDepth}
                    </span>
                  </span>
                  <StatusTag status={r.status} ns="Resource" size="sm" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      {/* 热区分析（6.4.2 / 6.4.5：热区表 + 错峰建议） */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="节点热区分析（近 24h）" className="col-span-12" height={260}>
          <div className="flex h-full flex-col">
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default text-left text-text-secondary">
                    <th className="pb-1.5 pr-2 font-medium">节点</th>
                    {HEAT_HOURS.map((h) => (
                      <th key={h} className="num px-1 pb-1.5 text-center font-medium">{String(h).padStart(2, '0')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatRows.map((row) => (
                    <tr key={row.node} className="border-b border-border-default/30 last:border-0">
                      <td className="py-1.5 pr-2 text-text-primary">{row.node}</td>
                      {row.cells.map((u, i) => (
                        <td key={i} className="px-1 py-1">
                          <div className={`num flex h-6 items-center justify-center rounded ${heatTone(u)}`} title={`${row.node} ${HEAT_HOURS[i]}:00 利用率 ${u}%`}>
                            {u}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {hotAdvice.map((a) => (
                <div key={a.node} className="flex items-start gap-2 rounded border border-warning/25 bg-warning/5 px-2.5 py-2 text-xs">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-warning" />
                  <span className="text-text-secondary">
                    <span className="font-medium text-text-primary">{a.node}</span> 近 24h 平均利用率 {Math.round(a.avg)}%，建议将该池部分批量任务错峰至 00-06 时低峰窗口
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* 容量预测与扩容建议（P2-13：基于热区趋势的容量规划） */}
      <Panel title="容量预测与扩容建议" extra={<span className="text-xs text-text-secondary">基于近 24h 热区趋势外推 · 供容量规划参考</span>}>
        <div className="grid grid-cols-2 gap-2">
          {hotAdvice.map((a) => {
            const projected = Math.min(99, Math.round(a.avg * 1.18));
            const needExpand = projected > 85;
            return (
              <div key={a.node} className="flex items-center justify-between rounded border border-border-default bg-panel-soft p-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-text-primary">
                    <TrendingUp size={14} className={needExpand ? 'text-danger' : 'text-success'} />
                    <span className="font-mono">{a.node}</span>
                    <span className="text-xs text-text-secondary">{a.pool}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    当前均值 {Math.round(a.avg)}%，预测下月峰值 <b className={needExpand ? 'text-danger' : 'text-success'}>{projected}%</b>
                    {needExpand ? `，建议 ${a.pool === 'POOL-H20' ? '+4 张 H20' : '+2 张 ' + (POOL_LABEL[a.pool] ?? '')}，或先行启用租赁池削峰` : '，容量充足，无需扩容'}
                  </p>
                </div>
                {needExpand && (
                  <button
                    disabled={readOnly}
                    onClick={async () => {
                      await api.requestExpansion(a.pool, `${a.node} 预测下月峰值 ${projected}%，需扩容`);
                      notify.success(`扩容工单已提交（${a.pool}），已推送算力采购流程`);
                    }}
                    className={BTN_GHOST}
                    title={readOnly ? '只读模式下写操作已禁用' : ''}
                  >
                    生成扩容工单
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 节点详情 Drawer（6.4.5：节点承载实例 + 告警 + 维护/编排操作） */}
      <Drawer open={!!selectedNode} onClose={() => setSelectedNode(null)} title={selectedNode ? `${selectedNode.node} · 资源详情` : ''} width={520}>
        {selectedNode && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info k="资源 ID" v={selectedNode.resourceId} />
              <Info k="类型" v={`${selectedNode.resourceType} · ${selectedNode.vendor} ${selectedNode.architecture}`} />
              <Info k="集群 / 池" v={`${selectedNode.cluster} / ${POOL_LABEL[selectedNode.pool] ?? selectedNode.pool}`} />
              <Info k="状态" v={''} tag={<StatusTag status={selectedNode.status} ns="Resource" />} />
              <Info k="显存" v={`${selectedNode.vramUsed} / ${selectedNode.vramTotal} GB`} />
              <Info k="实例数 / 队列" v={`${selectedNode.instanceCount} / ${selectedNode.queueDepth}`} />
            </div>

            <section>
              <div className="mb-2 text-xs font-medium text-text-secondary">承载实例（{POOL_INSTANCES[selectedNode.pool]?.length ?? 0}）</div>
              <div className="space-y-1.5">
                {(POOL_INSTANCES[selectedNode.pool] ?? [])
                  .map((id) => instances.find((ins) => ins.instanceId === id))
                  .filter((ins): ins is Instance => !!ins)
                  .map((ins) => (
                    <div key={ins.instanceId} className="rounded border border-border-default bg-panel-soft px-2.5 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-text-primary">{ins.instanceId}</span>
                        <span className="num text-text-secondary">{ins.assetId}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-text-secondary">
                        <span>引擎 {ins.engineType}</span>
                        <span>部署 {ins.deployMode}</span>
                        <span>量化 {ins.quantizationType}</span>
                        <span>KV Cache {ins.kvCacheEnabled ? '开' : '关'}</span>
                        <span className="num">TTFT P50 {ins.ttftMs}ms</span>
                        <span className="num">P95 {ins.avgLatencyMs}ms</span>
                        <span className="num">{ins.tokensPerSec} tok/s</span>
                        <span className="num">命中率 {ins.cacheHitRate}%</span>
                      </div>
                    </div>
                  ))}
                {(POOL_INSTANCES[selectedNode.pool] ?? []).length === 0 && <EmptyState text="该池暂无部署实例" />}
              </div>
            </section>

            {/* 节点维护操作（P1-9：隔离维护/恢复上线） */}
            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  <Wrench size={13} className="text-warning" /> 节点维护操作
                </span>
                {selectedNode.status === 'MAINTENANCE' ? (
                  <button disabled={readOnly} onClick={() => setMaintTarget(selectedNode)} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                    恢复上线
                  </button>
                ) : (
                  <button disabled={readOnly} onClick={() => setMaintTarget(selectedNode)} className={BTN_DANGER} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                    隔离维护
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
                {selectedNode.status === 'MAINTENANCE'
                  ? '当前已隔离：新请求不再调度至该节点，恢复后重新参与调度。'
                  : '隔离后新请求不再调度至该节点，在途请求完成后排空；适用于固件升级/硬件检修，全程留痕。'}
              </p>
            </div>

            {/* 节点编排写操作（P17/P18：vGPU 切分 / 量化 / 扩缩容） */}
            {nodeCfg && selectedNode.resourceType === 'GPU' && (
              <section className="rounded border border-primary/30 bg-primary/5 p-3">
                <div className="mb-3 text-xs font-medium text-primary">资源编排操作（保存需重启实例生效）</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-primary">vGPU 切分（最小 1% 算力 / 256MB 显存步长，P18）</span>
                    <ToggleSwitch checked={nodeCfg.vgpuEnabled} onChange={(v) => setNodeCfg({ ...nodeCfg, vgpuEnabled: v })} />
                  </div>
                  {nodeCfg.vgpuEnabled && (
                    <>
                      <div>
                        <label className="mb-1 flex justify-between text-xs text-text-secondary">
                          <span>算力切分比例</span>
                          <span className="num">单卡可切 {Math.floor(100 / nodeCfg.vgpuPercent)} 片</span>
                        </label>
                        <Slider value={nodeCfg.vgpuPercent} onChange={(v) => setNodeCfg({ ...nodeCfg, vgpuPercent: v })} min={1} max={100} unit="%" disabled={readOnly} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-text-secondary">单片显存（256MB 步长）</label>
                        <Slider value={Math.round(nodeCfg.vgpuVramMb / 256)} onChange={(v) => setNodeCfg({ ...nodeCfg, vgpuVramMb: v * 256 })} min={1} max={Math.max(1, Math.floor((selectedNode.vramTotal * 1024) / 256))} unit="×256MB" disabled={readOnly} />
                      </div>
                      <p className="rounded border border-success/30 bg-success/5 px-2 py-1.5 text-[11px] text-success">
                        收益预估：同规格模型切分前需 3 卡 → 切分后 1~2 卡即可承载（单卡承载模型数 8 倍+）
                      </p>
                    </>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">量化配置（FP16 / INT8 / INT4）</label>
                    <Segmented
                      options={[
                        { value: 'FP16', label: 'FP16' },
                        { value: 'INT8', label: 'INT8' },
                        { value: 'INT4', label: 'INT4' },
                      ]}
                      value={nodeCfg.quantization}
                      onChange={(v) => setNodeCfg({ ...nodeCfg, quantization: v as NodeConfig['quantization'] })}
                    />
                    <p className="mt-1 text-[11px] text-text-secondary">
                      显存节省：{nodeCfg.quantization === 'FP16' ? '0%' : nodeCfg.quantization === 'INT8' ? '约 50%' : '约 75%'}
                      {nodeCfg.quantization === 'INT4' && <span className="text-warning">；精度可能下降，建议先在评测集验证</span>}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs text-text-secondary">推理副本数（1~32）</label>
                      <div className="mt-1">
                        <Stepper value={nodeCfg.replicas} onChange={(v) => setNodeCfg({ ...nodeCfg, replicas: v })} min={1} max={32} />
                      </div>
                    </div>
                    <div className="text-right">
                      <label className="block text-xs text-text-secondary">扩展至租赁池</label>
                      <div className="mt-1 flex items-center justify-end gap-2">
                        {nodeCfg.extendRental && <span className="text-[10px] text-warning">将产生租赁费用</span>}
                        <ToggleSwitch checked={nodeCfg.extendRental} onChange={(v) => setNodeCfg({ ...nodeCfg, extendRental: v })} />
                      </div>
                    </div>
                  </div>
                  <button disabled={readOnly} onClick={() => setRestartConfirm(true)} className={`w-full ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                    保存并重启实例生效
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </Drawer>

      {/* 节点维护确认（P1-9） */}
      <ConfirmDialog
        open={!!maintTarget}
        level={maintTarget?.status === 'MAINTENANCE' ? 'info' : 'warning'}
        title={maintTarget?.status === 'MAINTENANCE' ? '恢复节点上线' : '隔离节点维护'}
        message={
          maintTarget?.status === 'MAINTENANCE' ? (
            <>将恢复 <b>{maintTarget?.node}</b> 上线，重新参与调度；建议先确认维护已完成、自检通过。</>
          ) : (
            <>将隔离 <b>{maintTarget?.node}</b>（{POOL_LABEL[maintTarget?.pool ?? ''] ?? ''}）：新请求不再调度至该节点，在途请求完成后排空；该池剩余容量 {(resources.filter((r) => r.pool === maintTarget?.pool && r.status !== 'MAINTENANCE').length - 1)} 节点承接。</>
          )
        }
        confirmText={maintTarget?.status === 'MAINTENANCE' ? '确认恢复' : '确认隔离'}
        onCancel={() => setMaintTarget(null)}
        onConfirm={async () => {
          if (!maintTarget) return;
          const toMaint = maintTarget.status !== 'MAINTENANCE';
          await api.setNodeMaintenance(maintTarget.resourceId, toMaint);
          notify.success(`${maintTarget.node} 已${toMaint ? '隔离维护（新请求不再调度）' : '恢复上线'}`);
          setMaintTarget(null);
          setSelectedNode({ ...maintTarget, status: toMaint ? 'MAINTENANCE' : 'RUNNING' });
          setResources((rs) => rs.map((r) => (r.resourceId === maintTarget.resourceId ? { ...r, status: toMaint ? 'MAINTENANCE' : 'RUNNING' } : r)));
        }}
      />

      {/* 重启确认 */}
      <ConfirmDialog
        open={restartConfirm}
        level="warning"
        title="应用节点配置"
        message={<>配置下发需<b className="text-warning">重启该节点推理实例</b>，预计耗时 2 分钟，期间该节点请求将自动调度至其他节点。</>}
        onCancel={() => setRestartConfirm(false)}
        onConfirm={async () => {
          if (!nodeCfg || !selectedNode) return;
          await api.saveNodeConfig(nodeCfg);
          setRestartConfirm(false);
          notify.success(`${selectedNode.node} 配置已保存，实例重启中（预计 2 分钟）`);
        }}
      />
    </div>
  );
}

function Info({ k, v, tag }: { k: string; v: string; tag?: React.ReactNode }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      {tag ?? <div className="num truncate text-sm">{v}</div>}
    </div>
  );
}
