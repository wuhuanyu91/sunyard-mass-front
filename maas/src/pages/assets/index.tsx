import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, GitFork, ShieldAlert, FlaskConical, Ban } from 'lucide-react';
import { api } from '../../services/api';
import type { AssetType, EvalResult, LifecycleStatus, ModelAsset, SourceType } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { EmptyState } from '../../components/ui/EmptyState';
import ModelConnections from './ModelConnections';
import ModelPlaza from './ModelPlaza';
import ReleaseArchive from './ReleaseArchive';
import Playground from './Playground';
import BenefitPanel from './BenefitPanel';

const fmtYuan = (n: number) => `¥${n.toLocaleString('zh-CN')}`;

const TYPE_LABEL: Record<AssetType, string> = {
  BASE_LLM: '基础大模型',
  SMALL_LLM: '小模型',
  MULTIMODAL: '多模态',
  OCR: 'OCR',
  VOICE: '语音',
  EXTERNAL: '外部模型',
};
const SOURCE_LABEL: Record<SourceType, string> = {
  OPEN_SOURCE: '开源',
  PROPRIETARY: '自研',
  THIRD_PARTY: '三方',
};
const DERIVATION_LABEL: Record<string, string> = {
  SFT: 'SFT 微调',
  DISTILLATION: '蒸馏',
  QUANTIZATION: '量化',
  NONE: '原始',
};

/** 6.6 模型资产中心（V4：页内 Tab 已上提为侧边栏子菜单，本页按 URL 参数渲染对应视图） */
export default function Assets() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'ledger');

  useEffect(() => {
    setTab(params.get('tab') ?? 'ledger');
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      {tab === 'conn' ? <ModelConnections /> : tab === 'plaza' ? <ModelPlaza /> : tab === 'playground' ? <Playground /> : tab === 'benefit' ? <BenefitPanel /> : tab === 'release' ? <ReleaseArchive /> : <AssetsOverview onOpenGray={() => navigate('/assets?tab=release')} />}
    </div>
  );
}

/** 6.6 资产台账（原模型资产页） */
function AssetsOverview({ onOpenGray }: { onOpenGray: () => void }) {
  const [params] = useSearchParams();
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [evals, setEvals] = useState<EvalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ModelAsset | null>(null);
  const [typeFilter, setTypeFilter] = useState<AssetType | 'ALL'>('ALL');
  const [lifeFilter, setLifeFilter] = useState<LifecycleStatus | 'ALL'>('ALL');
  const [offlineCheck, setOfflineCheck] = useState<ModelAsset | null>(null);

  useEffect(() => {
    Promise.all([api.getAssets(), api.getEvals()]).then(([as_, ev]) => {
      setAssets(as_);
      setEvals(ev);
      setLoading(false);
      const pre = params.get('assetId');
      if (pre) {
        const hit = as_.find((a) => a.assetId === pre);
        if (hit) setSelected(hit);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      assets.filter((a) => (typeFilter === 'ALL' || a.assetType === typeFilter) && (lifeFilter === 'ALL' || a.lifecycleStatus === lifeFilter)),
    [assets, typeFilter, lifeFilter],
  );

  const evalsOf = (assetId: string) => evals.filter((e) => e.assetId === assetId);

  /** 血缘链（沿 baseModelId 追溯至根） */
  const lineage = (m: ModelAsset): ModelAsset[] => {
    const chain: ModelAsset[] = [m];
    let cur: ModelAsset | undefined = m;
    const seen = new Set<string>();
    while (cur.baseModelId && !seen.has(cur.baseModelId)) {
      seen.add(cur.baseModelId);
      cur = assets.find((a) => a.assetId === cur!.baseModelId);
      if (!cur) break;
      chain.unshift(cur);
    }
    return chain;
  };

  if (loading) {
    return <div className="panel h-40 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="资产台账" desc="全平台模型全生命周期台账：登记 → 测试 → 灰度 → 生产 → 归档，变更操作均留痕可审计" />
      {/* 筛选条（6.6.2 多维筛选） */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          options={[
            { value: 'ALL', label: '全部类型' },
            ...(Object.keys(TYPE_LABEL) as AssetType[]).map((v) => ({ value: v, label: TYPE_LABEL[v] })),
          ]}
          current={typeFilter}
          onChange={(v) => setTypeFilter(v as AssetType | 'ALL')}
        />
        <span className="mx-1 h-4 w-px bg-border-default" aria-hidden />
        <FilterChips
          options={[
            { value: 'ALL', label: '全部生命周期' },
            { value: 'DRAFT', label: '登记' },
            { value: 'TESTING', label: '测试' },
            { value: 'GRAY', label: '灰度' },
            { value: 'PRODUCTION', label: '生产' },
            { value: 'ROLLBACK', label: '回滚' },
            { value: 'OFFLINE', label: '下线中' },
            { value: 'ARCHIVED', label: '归档' },
          ]}
          current={lifeFilter}
          onChange={(v) => setLifeFilter(v as LifecycleStatus | 'ALL')}
        />
        <span className="ml-auto text-xs text-text-secondary">{filtered.length} 个模型资产</span>
      </div>

      {/* 模型台账（6.6.2 DataTable） */}
      <Panel height={420}>
        {filtered.length === 0 ? (
          <EmptyState text="当前筛选条件下无模型资产" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">模型</th>
                <th className="pb-2 font-medium">类型</th>
                <th className="pb-2 font-medium">来源</th>
                <th className="pb-2 font-medium">生命周期</th>
                <th className="pb-2 font-medium">风险</th>
                <th className="pb-2 font-medium">版本</th>
                <th className="pb-2 font-medium">成本</th>
                <th className="pb-2 font-medium">P95 时延</th>
                <th className="pb-2 font-medium">成功率</th>
                <th className="pb-2 font-medium">在用应用</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.assetId}
                  onClick={() => setSelected(a)}
                  className="cursor-pointer border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft"
                >
                  <td className="py-2">
                    <span className="text-primary">{a.assetName}</span>
                    <span className="ml-1.5 font-mono text-xs text-text-secondary">{a.assetId}</span>
                  </td>
                  <td className="py-2 text-text-secondary">{TYPE_LABEL[a.assetType]}</td>
                  <td className="py-2 text-text-secondary">{SOURCE_LABEL[a.sourceType]}</td>
                  <td className="py-2">
                    <StatusTag status={a.lifecycleStatus} ns="Lifecycle" size="sm" />
                  </td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${a.riskLevel === 'A' ? 'bg-danger/10 text-danger' : a.riskLevel === 'B' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                      {a.riskLevel}
                    </span>
                  </td>
                  <td className="num py-2 text-text-secondary">{a.version}</td>
                  <td className="num py-2">{fmtYuan(a.costPer1kTokens)}/K</td>
                  <td className="num py-2 text-text-secondary">{a.avgLatencyMs}ms</td>
                  <td className="num py-2 text-text-secondary">{a.successRate}%</td>
                  <td className="num py-2">{a.activeApps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* 模型画像 Drawer（6.6.2 画像卡片 + 血缘 + 评测 + 运行回流） */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.assetName} · 模型画像` : ''} width={560}>
        {selected && (
          <div className="space-y-4">
            {/* 基础信息 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info k="资产 ID" v={selected.assetId} mono />
              <Info k="资产编码" v={selected.assetCode} mono />
              <Info k="类型 / 来源" v={`${TYPE_LABEL[selected.assetType]} / ${SOURCE_LABEL[selected.sourceType]}`} />
              <Info k="衍生方式" v={DERIVATION_LABEL[selected.derivationType]} />
              <Info k="负责人 / 部门" v={`${selected.maintainer} / ${selected.ownerDept}`} />
              <Info k="风险 / 安全等级" v={`${selected.riskLevel} / ${selected.securityLevel}`} />
              <Info k="上下文窗口" v={`${selected.contextWindow.toLocaleString()} tokens`} />
              <Info k="版本" v={selected.version} />
            </div>
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <span className="text-sm text-text-secondary">生命周期</span>
              <StatusTag status={selected.lifecycleStatus} ns="Lifecycle" />
            </div>

            {/* 血缘链（6.6.2 / 9.4） */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <GitFork size={13} /> 模型血缘链
              </div>
              <div className="flex flex-wrap items-center gap-1.5 rounded border border-border-default bg-panel-soft p-3">
                {lineage(selected).map((m, i) => (
                  <div key={m.assetId} className="flex items-center gap-1.5">
                    <div className={`rounded border px-2 py-1 text-xs ${m.assetId === selected.assetId ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border-default bg-bg-page text-text-secondary'}`}>
                      {m.assetName}
                      <span className="ml-1 font-mono text-[10px] opacity-70">{m.version}</span>
                    </div>
                    {i < lineage(selected).length - 1 && <ArrowRight size={12} className="text-text-secondary/50" />}
                  </div>
                ))}
              </div>
            </section>

            {/* 评测与准入（6.6.2 EvalResult） */}
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <FlaskConical size={13} /> 评测结果
              </div>
              {evalsOf(selected.assetId).length === 0 ? (
                <EmptyState text="暂无评测记录" />
              ) : (
                <div className="space-y-2">
                  {evalsOf(selected.assetId).map((e) => (
                    <div key={e.evalId} className="rounded border border-border-default bg-panel-soft p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-primary">
                          {e.evalType === 'ADMISSION' ? '准入评测' : e.evalType === 'A_B' ? 'A/B 评测' : '周期评测'} · {e.evalDataset}
                        </span>
                        <StatusTag status={e.reviewConclusion} size="sm" />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-text-secondary">
                        <span>准确率 <b className="num text-text-primary">{e.accuracy}%</b></span>
                        <span>幻觉率 <b className="num text-text-primary">{e.hallucinationRate}%</b></span>
                        <span>合规率 <b className="num text-text-primary">{e.complianceRate}%</b></span>
                        <span>工具调用 <b className="num text-text-primary">{e.toolCallSuccessRate}%</b></span>
                        <span>长上下文 <b className="num text-text-primary">{e.longContextScore}</b></span>
                        <span>成本评分 <b className="num text-text-primary">{e.costScore}</b></span>
                      </div>
                      <div className="mt-1 text-text-secondary">
                        审核人：{e.reviewedBy || '待审核'} · {e.reviewedAt ? new Date(e.reviewedAt).toLocaleString('zh-CN') : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 运行数据回流（6.6.2） */}
            <section>
              <div className="mb-2 text-xs font-medium text-text-secondary">运行数据回流</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="成本 / 1K Token" value={fmtYuan(selected.costPer1kTokens)} />
                <Metric label="P95 时延" value={`${selected.avgLatencyMs}ms`} />
                <Metric label="成功率" value={`${selected.successRate}%`} />
              </div>
            </section>

            {/* 灰度 / A/B 参数（规范 6.6.5：灰度范围、流量比例、生效时间、观察指标、回滚阈值） */}
            {selected.lifecycleStatus === 'GRAY' && (
              <section>
                <div className="mb-2 text-xs font-medium text-text-secondary">灰度 / A/B 参数（模型策略 POL-MODEL-003）</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info k="灰度范围" v="应用 APP-RISK（信贷风控）" />
                  <Info k="流量比例" v="20%（可逐步放量）" />
                  <Info k="生效时间" v="2026-08-01 起" />
                  <Info k="观察指标" v="accuracy / latency / compliance" />
                  <Info k="回滚阈值" v="成功率 < 97% 或 P95 > 1200ms 自动回滚" />
                  <Info k="策略版本" v="v1（灰度中，修改将写入控制面并走审批）" />
                </div>
                <p className="mt-1.5 text-xs text-text-secondary">灰度参数修改 = 修改模型策略（规范 6.6.5：保存时提示该变更将写入策略治理模型策略并走审批）</p>
                <button
                  onClick={() => {
                    setSelected(null);
                    onOpenGray();
                  }}
                  className="mt-2 w-full rounded border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/20"
                >
                  打开灰度发布控制台 →
                </button>
              </section>
            )}

            {/* 下线依赖检查（6.6：下线前检查 activeApps） */}
            <button
              onClick={() => setOfflineCheck(selected)}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              <Ban size={14} /> 发起下线（先检查依赖）
            </button>
          </div>
        )}
      </Drawer>

      {/* 下线依赖检查 Dialog（6.6：依赖检查闭环） */}
      {offlineCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOfflineCheck(null)} aria-hidden />
          <div role="dialog" aria-label="下线依赖检查" className="relative w-[440px] rounded-xl border border-border-default bg-bg-panel p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert size={15} className="text-danger" /> 下线依赖检查 · {offlineCheck.assetName}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
                <span className="text-text-secondary">在用应用数</span>
                <span className={`num text-lg font-semibold ${offlineCheck.activeApps > 0 ? 'text-danger' : 'text-success'}`}>{offlineCheck.activeApps}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
                <span className="text-text-secondary">推理实例</span>
                <span className="num text-text-primary">1</span>
              </div>
              <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
                <span className="text-text-secondary">引用策略</span>
                <span className="num text-text-primary">1 条（POL-MODEL-003）</span>
              </div>
            </div>
            {offlineCheck.activeApps > 0 ? (
              <div className="mt-3 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                检测到 {offlineCheck.activeApps} 个在用应用依赖，下线将中断线上流量。<b>禁止直接下线</b>。请先在策略治理停用关联路由策略，并完成应用侧迁移后重试。
              </div>
            ) : (
              <div className="mt-3 rounded border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
                无在用依赖，可执行下线（需审批）。
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOfflineCheck(null)} className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                关闭
              </button>
              <button
                disabled={offlineCheck.activeApps > 0}
                className="rounded bg-danger/15 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                确认下线（需审批）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChips({
  options,
  current,
  onChange,
}: {
  options: { value: string; label: string }[];
  current: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded border px-2 py-1 text-xs transition-colors ${
            current === o.value ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border-default bg-bg-panel text-text-secondary hover:text-text-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      <div className={`truncate text-sm ${mono ? 'font-mono text-xs' : 'num'}`}>{v}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2 py-2">
      <div className="num text-sm font-semibold text-text-primary">{value}</div>
      <div className="mt-0.5 text-xs text-text-secondary">{label}</div>
    </div>
  );
}
