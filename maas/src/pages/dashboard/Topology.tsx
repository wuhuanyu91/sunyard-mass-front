import { useMemo } from 'react';
import { ArrowRight, Server, Box, AppWindow, Router } from 'lucide-react';
import type { ApplicationRegistry, ComputeResource, ModelAsset } from '../../types';
import type { PlatformSummary } from '../../services/api';
import { getStatusMeta } from '../../components/ui/statusMap';
import type { StatusNs } from '../../components/ui/statusMap';
import Panel from '../../components/ui/Panel';

/**
 * 中央全行资源态势拓扑（规范 6.1.2 / 6.1.5）
 * 四层流水线：应用 → 调度网关 → 模型 → 算力
 * 节点颜色随状态：蓝=正常 绿=高命中/优化 黄=负载偏高 红=故障/熔断（配合图标）
 * 流量摘要来自全行聚合口径（PlatformSummary）
 */
export default function Topology({
  apps,
  models,
  resources,
  summary,
  onNodeClick,
}: {
  apps: ApplicationRegistry[];
  models: ModelAsset[];
  resources: ComputeResource[];
  summary?: PlatformSummary | null;
  onNodeClick: (kind: 'app' | 'model' | 'resource', id: string) => void;
}) {
  const nodeTone = (status: string, ns?: StatusNs) => {
    const t = getStatusMeta(status, ns).tone;
    return t === 'danger'
      ? 'border-danger bg-danger/10 text-danger pulse-danger'
      : t === 'warning'
        ? 'border-warning bg-warning/10 text-warning'
        : t === 'success'
          ? 'border-success bg-success/10 text-success'
          : 'border-primary/50 bg-primary/5 text-primary';
  };

  const modelTone = (m: ModelAsset) => {
    if (m.lifecycleStatus === 'ARCHIVED') return 'border-text-secondary/30 bg-panel-soft text-text-secondary';
    if (m.lifecycleStatus === 'GRAY') return 'border-warning bg-warning/10 text-warning';
    return 'border-success/50 bg-success/5 text-success';
  };

  const flow = useMemo(
    () => ({
      qps: summary?.qps ?? 0,
      inPerHour: Math.round((summary?.inputTokens ?? 0) / 24),
      outPerHour: Math.round((summary?.outputTokens ?? 0) / 24),
      p95: summary?.p95 ?? 0,
    }),
    [summary],
  );

  return (
    <Panel title="全行资源态势" height="100%">
      <div className="flex h-full flex-col">
        {/* 数据流摘要条 */}
        <div className="mb-3 flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2 text-xs text-text-secondary">
          <span>
            实时吞吐 <span className="num text-text-primary">{flow.qps.toLocaleString()}</span> req/s
          </span>
          <span>
            输入 <span className="num text-primary">{(flow.inPerHour / 10_000).toFixed(1)} 万</span>/h
          </span>
          <span>
            输出 <span className="num text-success">{(flow.outPerHour / 10_000).toFixed(1)} 万</span>/h
          </span>
          <span>
            P95 <span className="num text-warning">{flow.p95}ms</span>
          </span>
        </div>

        {/* 四层链路（标题顶对齐 / 节点堆垂直居中 / 箭头与节点中线对齐） */}
        <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_auto_0.95fr_auto_1.15fr_auto_1.15fr] items-stretch gap-2">
          {/* 应用层 */}
          <Layer title="业务应用" icon={<AppWindow size={14} />} count={`${apps.filter((a) => a.status === 'ACTIVE').length}/${apps.length}`}>
            {apps.slice(0, 5).map((a) => (
              <Node key={a.appId} label={a.appName} toneClass={nodeTone(a.status)} onClick={() => onNodeClick('app', a.appId)} />
            ))}
          </Layer>
          <Arrow />
          {/* 网关层 */}
          <Layer title="调度网关" icon={<Router size={14} />} count="1">
            <Node
              label="多约束路由"
              toneClass="border-primary bg-primary/15 text-primary"
              sub="评分+限流+降级"
              onClick={() => onNodeClick('app', 'gateway')}
            />
          </Layer>
          <Arrow />
          {/* 模型层 */}
          <Layer title="模型资产" icon={<Box size={14} />} count={`${models.filter((m) => m.lifecycleStatus !== 'ARCHIVED').length}/${models.length}`}>
            {models.slice(0, 5).map((m) => (
              <Node key={m.assetId} label={m.assetName} toneClass={modelTone(m)} onClick={() => onNodeClick('model', m.assetId)} />
            ))}
          </Layer>
          <Arrow />
          {/* 算力层 */}
          {/* 算力层：口径 = 在线节点/总数，与运维大盘一致 */}
          <Layer title="算力节点" icon={<Server size={14} />} count={`${resources.filter((r) => r.status === 'RUNNING').length}/${resources.length}`}>
            {resources.slice(0, 5).map((r) => (
              <Node key={r.resourceId} label={r.node} toneClass={nodeTone(r.status, 'Resource')} sub={`${r.utilization}%`} onClick={() => onNodeClick('resource', r.resourceId)} />
            ))}
          </Layer>
        </div>
      </div>
    </Panel>
  );
}

function Layer({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      {/* 标题行：四层顶对齐，右侧带规模徽标 */}
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {icon}
        {title}
        {count && <span className="num ml-auto text-[10px] text-text-secondary/60">{count}</span>}
      </div>
      {/* 节点堆：垂直居中，与左右列节点中线对齐 */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">{children}</div>
    </div>
  );
}

function Node({
  label,
  sub,
  toneClass,
  onClick,
}: {
  label: string;
  sub?: string;
  toneClass: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-full items-center justify-between gap-2 rounded border px-2 text-left text-xs transition-colors hover:brightness-125 ${toneClass}`}
    >
      <span className="truncate">{label}</span>
      {sub && <span className="num shrink-0 opacity-80">{sub}</span>}
    </button>
  );
}

/** 链路箭头：顶部留白与层标题等高，箭头落在节点堆中线上 */
function Arrow() {
  return (
    <div className="flex flex-col">
      <span className="h-6 shrink-0" aria-hidden />
      <div className="flex min-h-0 flex-1 items-center">
        <ArrowRight size={16} className="text-text-secondary/50" />
      </div>
    </div>
  );
}
