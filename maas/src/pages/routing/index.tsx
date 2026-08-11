import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RoutingPanel from './RoutingPanel';
import ComputePanel from './ComputePanel';
import NodePanel from './NodePanel';
import QueuePanel from './QueuePanel';
import K8sPanel from './K8sPanel';
import TrafficConfig from './TrafficConfig';
import EmergencyConsole from './EmergencyConsole';
import OrchestrationPanel from './OrchestrationPanel';
import PageHeader from '../../components/ui/PageHeader';

/** 调度与算力（规范 4.2.3）：页内 Tab 已上提为侧边栏子菜单，本页仅按 URL 参数渲染对应视图 */
export default function Routing() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'routing' | 'compute'>(params.get('view') === 'compute' ? 'compute' : 'routing');
  const [routingSub, setRoutingSub] = useState(params.get('tab') ?? 'overview');
  const [computeSub, setComputeSub] = useState(params.get('ctab') ?? 'overview');

  /** URL 参数为唯一导航源（侧边栏子菜单/页内跳转均驱动 URL），无参时回落总览 */
  useEffect(() => {
    setTab(params.get('view') === 'compute' ? 'compute' : 'routing');
    setRoutingSub(params.get('tab') ?? 'overview');
    setComputeSub(params.get('ctab') ?? 'overview');
  }, [params]);

  const view = params.get('view');

  return (
    <div className="flex flex-col gap-3">
      {view === 'nodes' ? (
        <NodePanel />
      ) : view === 'k8s' ? (
        <>
          <PageHeader crumb="调度算力" title="K8s 集群" desc="模型推理服务容器化底座：集群纳管（Volcano 批调度 + GPU Operator）、Pod 运行视图与滚动重启" />
          <K8sPanel />
        </>
      ) : view === 'queue' ? (
        <QueuePanel />
      ) : tab === 'routing' ? (
        routingSub === 'traffic' ? <TrafficConfig view={(params.get('tview') as 'key' | 'limit' | 'route') ?? 'key'} /> : routingSub === 'emergency' ? <EmergencyConsole /> : <RoutingPanel />
      ) : computeSub === 'orch' ? (
        <OrchestrationPanel />
      ) : (
        <ComputePanel />
      )}
    </div>
  );
}
