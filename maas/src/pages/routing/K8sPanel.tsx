import { useEffect, useState } from 'react';
import { Boxes, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { K8sCluster, K8sPod } from '../../types';
import Panel from '../../components/ui/Panel';
import { ProgressBar } from '../../components/ui/Bits';
import { BTN_GHOST } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const POD_STATUS: Record<K8sPod['status'], { label: string; cls: string }> = {
  RUNNING: { label: 'Running', cls: 'bg-success/10 text-success' },
  PENDING: { label: 'Pending', cls: 'bg-warning/10 text-warning' },
  RESTART: { label: '重启中', cls: 'bg-primary/10 text-primary' },
};

/**
 * K8s 容器编排：GPU 算力上部署 LLM 推理服务的底座视图。
 * 集群（Volcano 批调度 + GPU Operator 纳管）→ 推理服务 Pod（模型实例的运行形态）。
 */
export default function K8sPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [clusters, setClusters] = useState<K8sCluster[]>([]);
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getK8sClusters(), api.getK8sPods()]).then(([c, p]) => {
      setClusters(c);
      setPods(p);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="panel h-64 animate-pulse" />;

  return (
    <div className="mock-data">
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Boxes size={14} className="text-primary" /> K8s 容器编排（LLM 推理服务底座）
        </span>
      }
      extra={<span className="text-xs text-text-secondary">Volcano 批调度 · GPU Operator 纳管 · 模型实例即服务</span>}
    >
      {/* 集群概览 */}
      <div className="grid grid-cols-3 gap-3">
        {clusters.map((c) => (
          <div key={c.clusterId} className="rounded border border-border-default bg-panel-soft p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{c.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.status === 'HEALTHY' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {c.status === 'HEALTHY' ? '健康' : '降级'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-text-secondary">
              <span className={`rounded px-1 py-0.5 ${c.env === 'PROD' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>{c.env === 'PROD' ? '生产' : '开发'}</span>
              <span className="num font-mono">{c.k8sVersion}</span>
              <span>{c.scheduler}</span>
            </div>
            <div className="mt-2 text-[10px] text-text-secondary">{c.gpuOperator}</div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-text-secondary">
                <span>GPU 分配 {c.gpuAllocated}/{c.gpuTotal}</span>
                <span className="num">{Math.round((c.gpuAllocated / c.gpuTotal) * 100)}%</span>
              </div>
              <div className="mt-1">
                <ProgressBar pct={Math.round((c.gpuAllocated / c.gpuTotal) * 100)} tone={c.gpuAllocated / c.gpuTotal >= 0.85 ? 'danger' : 'primary'} />
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-text-secondary/70">工作节点 {c.nodes} 台</div>
          </div>
        ))}
      </div>

      {/* 推理服务 Pod */}
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">服务（Deployment）</th>
            <th className="pb-2 font-medium">命名空间</th>
            <th className="pb-2 font-medium">模型</th>
            <th className="pb-2 font-medium">引擎</th>
            <th className="pb-2 font-medium">副本</th>
            <th className="pb-2 font-medium">GPU 申请</th>
            <th className="pb-2 font-medium">状态</th>
            <th className="pb-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {pods.map((p) => (
            <tr key={p.podId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
              <td className="py-2 font-mono text-xs text-primary">{p.service}</td>
              <td className="py-2 font-mono text-xs text-text-secondary">{p.ns}</td>
              <td className="py-2 text-xs text-text-primary">{p.assetName}</td>
              <td className="py-2 text-xs text-text-secondary">{p.engine}</td>
              <td className="num py-2 text-xs">{p.replicas}</td>
              <td className="num py-2 text-xs text-text-secondary">{p.gpuReq}</td>
              <td className="py-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${POD_STATUS[p.status].cls}`}>{POD_STATUS[p.status].label}</span>
                {p.restarts > 0 && <span className="num ml-1.5 text-[10px] text-text-secondary/60">重启 {p.restarts}</span>}
              </td>
              <td className="py-2">
                <div className="flex justify-end">
                  <button
                    disabled={readOnly}
                    onClick={() => api.restartPod(p.podId).then(() => notify.success(`${p.service} 滚动重启已下发`))}
                    className={`flex items-center gap-1 ${BTN_GHOST}`}
                    title={readOnly ? '只读模式下写操作已禁用' : '滚动重启：副本逐个替换，不中断服务'}
                  >
                    <RefreshCw size={12} /> 滚动重启
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pt-2 text-[11px] text-text-secondary/70">模型实例以 Deployment 形态运行于 K8s，GPU 由设备插件直通（vGPU 切分在节点池层完成）；扩容/缩容联动容量预测，灰度命名空间隔离切流。</p>
    </Panel>
    </div>
  );
}
