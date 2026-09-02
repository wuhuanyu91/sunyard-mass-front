import { useEffect, useMemo, useState } from 'react';
import { Rocket, Undo2, Archive, PlayCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ArchivedModel, ArchiveRules, GrayRelease } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST, BTN_DANGER, BTN_SUCCESS } from '../../components/ui/Modal';
import { Slider, ToggleSwitch } from '../../components/ui/Controls';
import { StepBar, ProgressBar, useCountdown } from '../../components/ui/Bits';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const STEPS = ['提交发布', '灰度切流', 'A/B 对照', '放量或回滚', '版本归档'];
const REASON_LABEL: Record<ArchivedModel['reason'], string> = {
  NO_CALL_90D: '90天无调用',
  REPLACED: '版本被替代',
  COMPLIANCE: '合规下线',
  MANUAL: '人工标记',
};

/** M8 发布与归档（P34 灰度五步 + P35 下线归档） */
export default function ReleaseArchive() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [releases, setReleases] = useState<GrayRelease[]>([]);
  const [archived, setArchived] = useState<ArchivedModel[]>([]);
  const [rules, setRules] = useState<ArchiveRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');

  const reload = () =>
    Promise.all([api.getGrayReleases(), api.getArchivedModels(), api.getArchiveRules()]).then(([g, a, r]) => {
      setReleases(g);
      setArchived(a);
      setRules(r);
      if (!activeId && g.length > 0) setActiveId(g[0].releaseId);
      setLoading(false);
    });

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const release = useMemo(() => releases.find((r) => r.releaseId === activeId) ?? null, [releases, activeId]);

  /* 切流参数 */
  const [percent, setPercent] = useState(5);
  const [scope, setScope] = useState<string[]>([]);
  const [countdown, startCountdown] = useCountdown();
  const [applying, setApplying] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [reviveTarget, setReviveTarget] = useState<ArchivedModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedModel | null>(null);
  const [scoreTarget, setScoreTarget] = useState<ArchivedModel | null>(null);

  useEffect(() => {
    if (release) {
      setPercent(release.percent || 5);
      setScope(release.scope);
    }
  }, [activeId, release?.releaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !rules) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="panel h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mock-data flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="发布归档" desc="灰度发布五步管控（提交 → 切流 → A/B 对照 → 放量/回滚 → 归档），下线模型统一归档可追溯" />
      {/* ================= 灰度发布控制台（P34） ================= */}
      <Panel
        title="灰度发布控制台"
        extra={
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">灰度任务：</span>
            <select value={activeId} onChange={(e) => setActiveId(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary">
              {releases.map((r) => (
                <option key={r.releaseId} value={r.releaseId}>
                  {r.assetName} {r.version}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {!release ? (
          <EmptyState text="暂无灰度任务：在资产台账中对 GRAY 状态模型发起灰度即可" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StepBar steps={STEPS} current={release.step} />
              <span className="num text-xs text-text-secondary">当前比例 {release.percent}% · 发起于 {new Date(release.startedAt).toLocaleDateString('zh-CN')}</span>
            </div>

            {/* 步骤 2：灰度切流 */}
            {release.step === 2 && (
              <div className="rounded border border-border-default bg-panel-soft p-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  <Rocket size={14} className="text-primary" /> 灰度切流（最小 1%，分钟级生效）
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">灰度比例（档位吸附）</label>
                    <Slider value={percent} onChange={setPercent} min={1} max={50} marks={[1, 5, 10, 20, 50]} unit="%" disabled={readOnly} />
                    <label className="mb-1 mt-3 block text-xs text-text-secondary">灰度范围（应用/部门）</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['APP-RISK（风控报告生成）', 'APP-CREDIT（信贷审批助手）', 'DEPT-RISK（风险管理部）', 'DEPT-CORP（公司银行总部）'].map((s) => (
                        <button
                          key={s}
                          disabled={readOnly}
                          onClick={() => setScope((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                          className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${scope.includes(s) ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border-default text-text-secondary hover:text-text-primary'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    {countdown > 0 ? (
                      <div className="rounded border border-primary/40 bg-primary/5 p-3 text-center">
                        <div className="num text-2xl font-semibold text-primary">{countdown}s</div>
                        <div className="mt-1 text-xs text-text-secondary">切流生效中…</div>
                        <div className="mt-2"><ProgressBar pct={((60 - countdown) / 60) * 100} /></div>
                      </div>
                    ) : (
                      <>
                        <button
                          disabled={readOnly || applying || scope.length === 0}
                          title={readOnly ? '只读模式下写操作已禁用' : ''}
                          onClick={async () => {
                            setApplying(true);
                            await api.advanceGray(release.releaseId, { percent, scope });
                            setApplying(false);
                            startCountdown(60);
                            notify.success(`灰度切流已应用：${percent}% → ${scope.join('、')}（分钟级生效）`);
                            reload();
                          }}
                          className={`${BTN_PRIMARY} flex items-center justify-center gap-1.5 py-2.5`}
                        >
                          {applying ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />} 应用切流
                        </button>
                        <button
                          disabled={readOnly}
                          onClick={async () => {
                            await api.advanceGray(release.releaseId, { step: 3 });
                            notify.info('已进入 A/B 对照阶段，指标实时对比中');
                            reload();
                          }}
                          className={BTN_GHOST}
                        >
                          进入 A/B 对照 →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 步骤 3：A/B 对照 */}
            {release.step === 3 && (
              <div className="rounded border border-border-default bg-panel-soft p-4">
                <div className="mb-3 text-sm font-medium text-text-primary">A/B 对照（现网 vs 灰度，自动标优胜）</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                      <th className="pb-2 font-medium">指标</th>
                      <th className="pb-2 font-medium">现网版本</th>
                      <th className="pb-2 font-medium">灰度版本 {release.version}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['准确率', release.abMetrics.accuracy, '%', true],
                        ['平均时延', release.abMetrics.latencyMs, 'ms', false],
                        ['合规率', release.abMetrics.compliance, '%', true],
                        ['成本/1K Token', release.abMetrics.costPer1k, ' 元', false],
                      ] as [string, [number, number], string, boolean][]
                    ).map(([name, [a, b], unit, higherBetter]) => {
                      const bWins = higherBetter ? b > a : b < a;
                      return (
                        <tr key={name} className="border-b border-border-default/40 last:border-0">
                          <td className="py-2 text-text-secondary">{name}</td>
                          <td className={`num py-2 ${!bWins ? 'font-semibold text-success' : 'text-text-primary'}`}>
                            {a}{unit} {!bWins && '✓'}
                          </td>
                          <td className={`num py-2 ${bWins ? 'font-semibold text-success' : 'text-text-primary'}`}>
                            {b}{unit} {bWins && '✓'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-between">
                  <p className="rounded border border-success/30 bg-success/5 px-3 py-1.5 text-xs text-success">综合结论：灰度版本准确率与合规率占优，建议放量</p>
                  <div className="flex gap-2">
                    <button
                      disabled={readOnly}
                      onClick={async () => {
                        await api.advanceGray(release.releaseId, { step: 4 });
                        notify.info('已进入放量阶段');
                        reload();
                      }}
                      className={BTN_PRIMARY}
                    >
                      确认进入放量 →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 步骤 4：放量或回滚 */}
            {release.step === 4 && (
              <div className="rounded border border-border-default bg-panel-soft p-4">
                <div className="mb-3 text-sm font-medium text-text-primary">放量或回滚（回滚 SLA ≤3 分钟）</div>
                {release.percent === 0 ? (
                  <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">已执行回滚：流量已 100% 切回现网版本，本次发布终止。</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={readOnly || release.percent >= 50}
                      onClick={async () => {
                        await api.advanceGray(release.releaseId, { percent: 50 });
                        notify.info('已放量至 50%（已写入控制面 MODEL 策略，审批通过后生效）');
                        reload();
                      }}
                      className={BTN_PRIMARY}
                    >
                      放量 50%
                    </button>
                    <button
                      disabled={readOnly}
                      onClick={async () => {
                        await api.advanceGray(release.releaseId, { percent: 100, step: 5 });
                        notify.success('已放量至 100%，版本自动转归档');
                        reload();
                      }}
                      className={BTN_SUCCESS}
                    >
                      放量 100% 并完成
                    </button>
                    <button disabled={readOnly || rollingBack} onClick={() => setRollbackConfirm(true)} className={`flex items-center gap-1 ${BTN_DANGER}`}>
                      {rollingBack ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} 一键回滚
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 步骤 5：归档 */}
            {release.step === 5 && (
              <div className="flex items-center justify-between rounded border border-success/40 bg-success/5 p-4">
                <div>
                  <div className="text-sm font-semibold text-success">✓ 发布完成 · 版本已归档</div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {release.assetName} {release.version} 已全量生效，历史版本保留可回滚；运行数据将持续回流至资产画像。
                  </p>
                </div>
                <Archive size={22} className="text-success" />
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-12 gap-3">
        {/* ================= 归档列表（P35） ================= */}
        <Panel title="下线归档管理" className="col-span-8" extra={<span className="num text-xs text-text-secondary">{archived.length} 个已归档</span>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">模型</th>
                <th className="pb-2 font-medium">下线原因</th>
                <th className="pb-2 font-medium">归档时间</th>
                <th className="pb-2 font-medium">保留策略</th>
                <th className="pb-2 font-medium">价值评分</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((m) => (
                <tr key={m.assetId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                  <td className="py-2">
                    <span className="text-text-primary">{m.assetName}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{m.assetId}</span>
                  </td>
                  <td className="py-2">
                    <span className="rounded bg-bg-page px-1.5 py-0.5 text-xs text-text-secondary">{REASON_LABEL[m.reason]}</span>
                  </td>
                  <td className="num py-2 text-xs text-text-secondary">{new Date(m.archivedAt).toLocaleDateString('zh-CN')}</td>
                  <td className="py-2">
                    {m.retention === 'PERMANENT' ? (
                      <span className="rounded border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-xs text-danger">监管模型 · 永久留存</span>
                    ) : (
                      <span className="rounded border border-border-default bg-panel-soft px-1.5 py-0.5 text-xs text-text-secondary">文件保留 24 个月</span>
                    )}
                  </td>
                  <td className="py-2">
                    <button onClick={() => setScoreTarget(m)} title="查看评分依据">
                      <StatusTag status={m.valueScore} ns="ValueScore" size="sm" />
                    </button>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button disabled={readOnly} onClick={() => setReviveTarget(m)} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                        一键复活
                      </button>
                      <button
                        disabled={readOnly || m.retention === 'PERMANENT'}
                        onClick={() => setDeleteTarget(m)}
                        className={BTN_DANGER}
                        title={m.retention === 'PERMANENT' ? '监管模型永久留存，不可删除' : readOnly ? '只读模式下写操作已禁用' : ''}
                      >
                        永久删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* ================= 自动触发规则 ================= */}
        <Panel title="自动下线触发规则" className="col-span-4">
          <div className="space-y-3">
            <RuleSwitch
              label="90 天无调用 → 自动建议下线"
              checked={rules.noCall90d}
              onChange={async (v) => {
                await api.saveArchiveRules({ ...rules, noCall90d: v });
                notify.success('归档规则已保存');
                reload();
              }}
            />
            <RuleSwitch
              label="版本被替代 → 自动建议归档"
              checked={rules.replaced}
              onChange={async (v) => {
                await api.saveArchiveRules({ ...rules, replaced: v });
                notify.success('归档规则已保存');
                reload();
              }}
            />
            <RuleSwitch
              label="合规名单变更 → 自动下线"
              checked={rules.compliance}
              onChange={async (v) => {
                await api.saveArchiveRules({ ...rules, compliance: v });
                notify.success('归档规则已保存');
                reload();
              }}
            />
            <p className="rounded border border-border-default bg-panel-soft px-3 py-2 text-xs leading-relaxed text-text-secondary">
              命中规则的模型将在资产台账展示「建议下线」徽标，实际下线仍需走依赖检查与审批；监管类模型一律永久留存、不可删除。
            </p>
          </div>
        </Panel>
      </div>

      {/* ================= 弹窗区 ================= */}
      <ConfirmDialog
        open={rollbackConfirm}
        level="danger"
        title="灰度一键回滚"
        confirmWord={release?.assetName}
        message={<>将回滚 <b>{release?.assetName} {release?.version}</b> 的灰度流量，SLA ≤3 分钟内 100% 切回现网版本，本次发布终止。</>}
        confirmText="立即回滚"
        onCancel={() => setRollbackConfirm(false)}
        onConfirm={async () => {
          if (!release) return;
          setRollingBack(true);
          setRollbackConfirm(false);
          await api.rollbackGray(release.releaseId);
          setRollingBack(false);
          notify.success(`${release.assetName} 已回滚（耗时 2.4s ≤ SLA 3 分钟）`);
          reload();
        }}
      />

      <ConfirmDialog
        open={!!reviveTarget}
        level="warning"
        title="复活归档模型"
        message={<><b>{reviveTarget?.assetName}</b> 将恢复至下线前状态并重新占用算力资源（需重新通过容量评估）。</>}
        onCancel={() => setReviveTarget(null)}
        onConfirm={async () => {
          if (!reviveTarget) return;
          await api.reviveArchived(reviveTarget.assetId);
          notify.success(`${reviveTarget.assetName} 已复活，回到资产台账`);
          setReviveTarget(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        level="danger"
        title="永久删除归档模型"
        confirmWord={deleteTarget?.assetName}
        message={<>物理删除 <b>{deleteTarget?.assetName}</b> 的模型文件与权重（含微调数据集），<b className="text-danger">不可恢复</b>。</>}
        confirmText="永久删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteArchived(deleteTarget.assetId);
          notify.success(`${deleteTarget.assetName} 已永久删除`);
          setDeleteTarget(null);
          reload();
        }}
      />

      {/* 评分依据弹窗 */}
      {scoreTarget && (
        <Modal open onClose={() => setScoreTarget(null)} width={440} title={`资产价值评分 · ${scoreTarget.assetName}`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <span className="text-sm text-text-secondary">综合评级</span>
              <StatusTag status={scoreTarget.valueScore} ns="ValueScore" />
            </div>
            {(
              [
                ['算力成本（权重 30%）', scoreTarget.scoreDetail.cost],
                ['业务转化（权重 40%）', scoreTarget.scoreDetail.conversion],
                ['风险识别准确率（权重 30%）', scoreTarget.scoreDetail.riskAcc],
              ] as [string, number][]
            ).map(([label, v]) => (
              <div key={label}>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">{label}</span>
                  <span className="num text-text-primary">{v}</span>
                </div>
                <div className="mt-1"><ProgressBar pct={v} tone={v >= 70 ? 'success' : v >= 40 ? 'primary' : 'danger'} /></div>
              </div>
            ))}
            <p className="text-xs text-text-secondary">评分公式：算力成本 × 业务转化 × 风险识别准确率；A 战略 / B 核心 / C 通用 / D 候选下线。</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RuleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2.5">
      <span className="text-sm text-text-primary">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
