import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, SkipForward, GitBranch, Gauge, ListChecks } from 'lucide-react';
import type { ExecutedPolicyItem, RouterLog } from '../../types';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { api } from '../../services/api';

const POLICY_TYPE_LABEL: Record<string, string> = {
  ROUTING: '调度策略',
  COMPUTE: '资源策略',
  MODEL: '模型策略',
  SECURITY: '安全策略',
  METERING: '运营策略',
};

/** 请求链路阶段（规范 6.3.6：鉴权→前置护栏→路由→推理→后置护栏→响应） */
interface TraceStage {
  name: string;
  status: 'ok' | 'warn' | 'fail' | 'skip';
  durationMs: number;
  detail: string;
}

/** 降级边界解析（规范 9.2 降级边界表） */
interface FallbackBoundary {
  type: string;
  label: string;
  supported: string[]; // 支持的 requestMode
}

function parseFallback(reason: string): FallbackBoundary | null {
  if (reason.startsWith('FALLBACK_SWITCH_SECONDARY')) return { type: 'FALLBACK_SWITCH_SECONDARY', label: '切换备用模型', supported: ['SYNC', 'ASYNC', 'STREAM'] };
  if (reason.startsWith('FALLBACK_SWITCH_SMALL')) return { type: 'FALLBACK_SWITCH_SMALL', label: '切换小模型', supported: ['SYNC', 'ASYNC', 'STREAM'] };
  if (reason.startsWith('FALLBACK_TRUNCATE_CONTEXT')) return { type: 'FALLBACK_TRUNCATE_CONTEXT', label: '截断上下文', supported: ['SYNC', 'ASYNC', 'STREAM'] };
  if (reason.startsWith('FALLBACK_LIMIT_CONCURRENCY')) return { type: 'FALLBACK_LIMIT_CONCURRENCY', label: '降低并发', supported: ['SYNC', 'ASYNC', 'STREAM'] };
  if (reason.startsWith('FALLBACK_TO_ASYNC')) return { type: 'FALLBACK_TO_ASYNC', label: '转异步', supported: ['SYNC'] };
  if (reason.startsWith('FALLBACK_TO_HUMAN')) return { type: 'FALLBACK_TO_HUMAN', label: '转人工', supported: ['SYNC', 'ASYNC', 'STREAM'] };
  return null;
}

/** 基于 traceId 的确定性阶段耗时拆分（各阶段占比 × 总耗时） */
function splitDuration(traceId: string, total: number): number[] {
  const ratio = [0.06, 0.08, 0.12, 0.55, 0.09, 0.1];
  const seed = traceId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const jitter = ratio.map((r, i) => r * (0.8 + ((seed * (i + 3)) % 40) / 100));
  const sum = jitter.reduce((a, b) => a + b, 0);
  return jitter.map((r) => Math.round((total * r) / sum));
}

/** 构造请求阶段时间线（阶段顺序固定，失败阶段高亮） */
function buildStages(log: RouterLog): TraceStage[] {
  const durations = splitDuration(log.traceId, log.totalDurationMs);
  const stageNames = ['鉴权', '前置护栏', '路由', '推理', '后置护栏', '响应'];
  const blocked = log.status === 'BLOCKED';
  const degraded = log.status === 'DEGRADED';
  return stageNames.map((name, i) => {
    let status: TraceStage['status'] = 'ok';
    let detail = '通过';
    if (name === '前置护栏' && blocked) {
      status = 'fail';
      detail = log.decision.routeReason;
    } else if (name === '路由' && degraded) {
      status = 'warn';
      detail = `${log.decision.routeReason}；降级：${log.decision.fallbackReason}`;
    } else if (name === '推理' && (blocked || degraded)) {
      status = blocked ? 'skip' : 'warn';
      detail = blocked ? '请求已被前置护栏阻断，未进入推理' : '降级实例承载推理';
    }
    return { name, status, durationMs: durations[i] ?? 0, detail };
  });
}

function StageRow({ stage, isLast }: { stage: TraceStage; isLast: boolean }) {
  const iconMap = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle, skip: SkipForward } as const;
  const toneMap = { ok: 'text-success', warn: 'text-warning', fail: 'text-danger', skip: 'text-text-secondary' } as const;
  const labelMap = { ok: '通过', warn: '降级/降速', fail: '阻断', skip: '未执行' } as const;
  const Icon = iconMap[stage.status];
  const tone = toneMap[stage.status];
  return (
    <div className="relative flex gap-3">
      {!isLast && <span className="absolute left-[7px] top-6 h-full w-px bg-border-default" aria-hidden />}
      <Icon size={15} className={`mt-0.5 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">
            {stage.name}
            {stage.status !== 'ok' && <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${tone} bg-current/10`}>{labelMap[stage.status]}</span>}
          </span>
          <span className="num shrink-0 text-xs text-text-secondary">{stage.durationMs}ms</span>
        </div>
        {stage.detail !== '通过' && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{stage.detail}</p>}
      </div>
    </div>
  );
}

/** 6.3 单请求 Rationale 白盒（时间线 + 决策树 + 候选比较 + 降级边界 + 执行策略清单） */
export default function RationaleDrawer({ log, onClose }: { log: RouterLog | null; onClose: () => void }) {
  const stages = useMemo(() => (log ? buildStages(log) : []), [log]);
  const [executed, setExecuted] = useState<ExecutedPolicyItem[]>([]);

  /** 六章：证明一次请求实际执行了哪些策略 */
  useEffect(() => {
    if (log) {
      api.getExecutedPolicies(log.traceId).then(setExecuted);
    } else {
      setExecuted([]);
    }
  }, [log?.traceId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!log) return null;
  const { decision } = log;
  const fallback = decision.fallbackTriggered ? parseFallback(decision.fallbackReason) : null;
  const fallbackSupported = fallback ? fallback.supported.includes(log.requestMode) : null;
  const scoreDim = [
    { key: 'scoreLatency', label: '时延' },
    { key: 'scoreCost', label: '成本' },
    { key: 'scoreRisk', label: '风险' },
    { key: 'scoreLoad', label: '负载' },
  ] as const;

  return (
    <Drawer open={!!log} onClose={onClose} title={`路由白盒 · ${log.traceId}`} width={560}>
      <div className="space-y-4">
        {/* 请求主体信息 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info k="应用" v={log.appId} />
          <Info k="租户" v={log.tenantId} />
          <Info k="业务场景" v={log.businessScenario} />
          <Info k="任务类型" v={log.taskType} />
          <Info k="数据等级" v={log.dataLevel} />
          <Info k="请求模式" v={log.requestMode} />
          <Info k="SLA" v={log.slaLevel} />
          <Info k="预算档" v={log.budgetClass} />
          <Info k="输入 Token" v={`${log.promptTokens.toLocaleString()}`} />
          <Info k="上下文长度" v={`${log.contextLength.toLocaleString()}`} />
        </div>

        {/* 请求状态 */}
        <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
          <span className="text-sm text-text-secondary">请求状态</span>
          <StatusTag status={log.status} ns="RouterLog" />
          <span className="num text-xs text-text-secondary">总耗时 {log.totalDurationMs}ms</span>
        </div>

        {/* 降级边界（规范 9.2：展示降级类型 + 当前 requestMode 是否支持） */}
        {fallback && (
          <div className={`rounded border px-3 py-2.5 text-sm ${fallbackSupported ? 'border-warning/40 bg-warning/5' : 'border-danger/40 bg-danger/5'}`}>
            <div className="flex items-center gap-2 font-medium text-text-primary">
              <AlertTriangle size={15} className={fallbackSupported ? 'text-warning' : 'text-danger'} />
              降级类型：{fallback.label}
            </div>
            <div className={`mt-1 text-xs ${fallbackSupported ? 'text-warning' : 'text-danger'}`}>
              {fallbackSupported ? `当前请求模式 ${log.requestMode} 支持该降级边界` : `当前请求模式 ${log.requestMode} 不支持该降级边界（仅 ${fallback.supported.join(' / ')} 可转换）`}
            </div>
            <div className="mt-1.5 text-xs text-text-secondary">{log.decision.fallbackReason}</div>
          </div>
        )}

        {/* 链路时间线（阶段顺序：鉴权→前置护栏→路由→推理→后置护栏→响应） */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <GitBranch size={13} /> 请求链路（Timeline）
          </div>
          <div className="rounded border border-border-default bg-panel-soft p-3">
            {stages.map((s, i) => (
              <StageRow key={s.name} stage={s} isLast={i === stages.length - 1} />
            ))}
          </div>
        </section>

        {/* 路由决策：四维评分 */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Gauge size={13} /> 四维评分（口径 8.2）
          </div>
          <div className="grid grid-cols-4 gap-2">
            {scoreDim.map((d) => (
              <div key={d.key} className="rounded border border-border-default bg-panel-soft px-2 py-2 text-center">
                <div className="text-xs text-text-secondary">{d.label}</div>
                <div className="num mt-1 text-lg font-semibold text-primary">{decision[d.key]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 决策树 / 候选模型比较（必须展示淘汰原因） */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">候选模型比较（含淘汰原因）</span>
            {decision.selectedModel && (
              <span className="text-xs text-success">已选中：{decision.selectedModel}@{decision.selectedVersion}</span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">模型</th>
                <th className="pb-2 font-medium">版本</th>
                <th className="pb-2 font-medium">综合分</th>
                <th className="pb-2 font-medium">淘汰原因</th>
              </tr>
            </thead>
            <tbody>
              {decision.candidateModels.map((c) => {
                const selected = c.assetId === decision.selectedModel;
                return (
                  <tr
                    key={c.assetId}
                    className={`border-b border-border-default/40 last:border-0 ${selected ? 'bg-success/5' : ''}`}
                  >
                    <td className="py-2">
                      <span className={selected ? 'text-success' : 'text-text-primary'}>{c.assetId}</span>
                      {selected && <span className="ml-1.5 text-xs text-success">← 选中</span>}
                    </td>
                    <td className="num py-2 text-text-secondary">{c.version}</td>
                    <td className="num py-2">{c.score === null ? '—' : c.score}</td>
                    <td className={`py-2 text-xs ${c.eliminateReason ? 'text-danger' : 'text-text-secondary'}`}>
                      {c.eliminateReason || '综合分最高，进入派发'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 rounded border border-border-default bg-panel-soft p-2.5 text-xs leading-relaxed text-text-secondary">
            决策摘要：{decision.routeReason}
          </p>
          {decision.selectedPool && (
            <p className="mt-1.5 text-xs text-text-secondary">
              派发目标：{decision.selectedEngine} 引擎 / {decision.selectedPool} / {decision.selectedNode}
            </p>
          )}
        </section>

        {/* 执行策略清单（六章：策略治理 —— 证明本次请求实际命中/执行了哪些策略） */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <ListChecks size={13} /> 本次请求执行策略清单（策略治理五类策略）
          </div>
          <div className="space-y-1.5">
            {executed.map((e) => (
              <div key={e.policyId} className="rounded border border-border-default bg-panel-soft px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      e.policyType === 'ROUTING' ? 'bg-primary/10 text-primary'
                      : e.policyType === 'SECURITY' ? 'bg-danger/10 text-danger'
                      : e.policyType === 'METERING' ? 'bg-warning/10 text-warning'
                      : e.policyType === 'MODEL' ? 'bg-success/10 text-success'
                      : 'bg-border-default/40 text-text-secondary'
                    }`}>
                      {POLICY_TYPE_LABEL[e.policyType]}
                    </span>
                    <span className="font-medium text-text-primary">{e.policyName}</span>
                    <span className="font-mono text-[10px] text-text-secondary">{e.policyId}</span>
                  </span>
                  {e.matched ? (
                    <span className="flex items-center gap-1 text-[10px] text-success"><CheckCircle2 size={11} /> 命中执行</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-text-secondary"><SkipForward size={11} /> 未命中</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{e.effect}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-text-secondary/70">口径：策略执行记录与路由决策同源留痕，可在策略治理按策略反查全部命中请求。</p>
        </section>
      </div>
    </Drawer>
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
