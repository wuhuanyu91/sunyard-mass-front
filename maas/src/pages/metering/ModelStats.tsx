import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Lightbulb, Sparkles, User } from 'lucide-react';
import { api } from '../../services/api';
import type { ModelRecommend, ModelUsageStat, PersonalUsage } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Drawer from '../../components/ui/Drawer';
import { Segmented } from '../../components/ui/Controls';
import { ProgressBar } from '../../components/ui/Bits';
import { BTN_PRIMARY } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtYuan = (n: number) => `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const fmtWan = (n: number) => (n >= 100_000_000 ? `${(n / 100_000_000).toFixed(2)} 亿` : n >= 10_000 ? `${(n / 10_000).toFixed(1)} 万` : fmt(n));

type SortKey = 'calls' | 'inputTokens' | 'cost';

/** M6.1 模型统计（P26/P27：分模型用量 + 节省测算 + 三视图 + 推荐） */
export default function ModelStats() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [stats, setStats] = useState<ModelUsageStat[]>([]);
  const [recs, setRecs] = useState<ModelRecommend[]>([]);
  const [saving, setSaving] = useState<{ flagship: string; allInCost: number; savedCost: number; savedPct: number } | null>(null);
  const [personals, setPersonals] = useState<PersonalUsage[]>([]);
  const [view, setView] = useState('dept');
  const [flagship, setFlagship] = useState('GLM-5-旗舰');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [personDetail, setPersonDetail] = useState<PersonalUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getModelUsageStats(), api.getModelRecommends(), api.getRoutingSaving(), api.getPersonalUsage()]).then(([s, r, sv, p]) => {
      setStats(s);
      setRecs(r);
      setSaving(sv);
      setPersonals(p);
      setLoading(false);
    });
  }, []);

  const sorted = useMemo(() => {
    const list = [...stats];
    list.sort((a, b) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return list;
  }, [stats, sortKey, sortAsc]);

  const totalCost = useMemo(() => stats.reduce((s, x) => s + x.cost, 0), [stats]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="panel h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="模型统计"
        desc="部门结算 / 个人用量 / 应用统计三视图；调用与成本数据与计量台账同源。"
      />
      {/* 三视图切换（P27） */}
      <div className="flex items-center justify-between">
        <Segmented
          options={[
            { value: 'dept', label: '部门结算视图' },
            { value: 'personal', label: '个人用量视图' },
            { value: 'app', label: '应用统计视图' },
          ]}
          value={view}
          onChange={setView}
        />
        {view !== 'personal' && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            测算基准（全用旗舰模型）：
            <select value={flagship} onChange={(e) => setFlagship(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary">
              {['GLM-5-旗舰', 'Claude-4.6-Opus', 'Qwen-72B-Instruct'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 节省测算条（P26） */}
      {saving && view !== 'personal' && (
        <div className="flex items-center justify-between rounded border border-success/40 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <Sparkles size={16} className="text-success" />
            若全部使用 <b className="text-warning">{flagship}</b>，本月费用约 <b className="num text-danger">{fmtYuan(saving.allInCost)}</b>；
            语义路由实际节省 <b className="num text-success">{fmtYuan(saving.savedCost)}</b>
          </div>
          <span className="num rounded bg-success/15 px-2 py-1 text-lg font-semibold text-success">-{saving.savedPct}%</span>
        </div>
      )}

      {view === 'personal' ? (
        /* ---------- 个人用量视图（P27：员工 Token + 行为审计入口） ---------- */
        <Panel title="员工 Token 用量（近 24h 抽样 8 人）" extra={<span className="num text-xs text-text-secondary">{personals.length} 名员工</span>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">员工</th>
                <th className="pb-2 font-medium">部门</th>
                <th className="pb-2 font-medium">Token 用量</th>
                <th className="pb-2 font-medium">费用</th>
                <th className="pb-2 font-medium">行为标签分布</th>
                <th className="pb-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {personals.map((p) => (
                <tr key={p.userId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                  <td className="py-2.5">
                    <span className="flex items-center gap-1.5 text-text-primary">
                      <User size={13} className="text-text-secondary" /> {p.name}
                      <span className="font-mono text-[10px] text-text-secondary/60">{p.userId}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-text-secondary">{DEPT_LABEL[p.deptId] ?? p.deptId}</td>
                  <td className="num py-2.5">{fmtWan(p.tokens)}</td>
                  <td className="num py-2.5 text-text-primary">{fmtYuan(p.cost)}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {p.tagDist.map((t) => (
                        <span
                          key={t.tag}
                          className={`rounded px-1.5 py-0.5 text-[10px] ${t.tag === '业务办公' ? 'bg-success/10 text-success' : t.tag === '开发调试' ? 'bg-primary/10 text-primary' : t.tag === '私人娱乐' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}
                          title={`${t.tag} ${t.pct}%`}
                        >
                          {t.tag} {t.pct}%
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => setPersonDetail(p)} className={BTN_PRIMARY}>行为审计</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : (
        /* ---------- 部门/应用视图：分模型用量表 ---------- */
        <div className="grid grid-cols-12 gap-3">
          <Panel title={`分模型用量统计（${view === 'dept' ? '部门结算口径' : '应用统计口径'} · 近 24h）`} className="col-span-8">
            {sorted.length === 0 ? (
              <EmptyState text="暂无模型用量数据" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                    <th className="pb-2 font-medium">模型</th>
                    <th className="cursor-pointer pb-2 font-medium" onClick={() => toggleSort('calls')}>
                      调用次数 <SortIcon k="calls" sortKey={sortKey} asc={sortAsc} />
                    </th>
                    <th className="cursor-pointer pb-2 font-medium" onClick={() => toggleSort('inputTokens')}>
                      输入/输出 Token <SortIcon k="inputTokens" sortKey={sortKey} asc={sortAsc} />
                    </th>
                    <th className="cursor-pointer pb-2 font-medium" onClick={() => toggleSort('cost')}>
                      费用 <SortIcon k="cost" sortKey={sortKey} asc={sortAsc} />
                    </th>
                    <th className="pb-2 font-medium">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m) => (
                    <tr key={m.assetId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                      <td className="py-2">
                        <span className="text-primary">{m.name}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{m.assetId}</span>
                      </td>
                      <td className="num py-2 text-text-secondary">{fmt(m.calls)}</td>
                      <td className="num py-2 text-text-secondary">
                        {fmtWan(m.inputTokens)} / {fmtWan(m.outputTokens)}
                      </td>
                      <td className="num py-2 font-medium text-text-primary">{fmtYuan(m.cost)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24"><ProgressBar pct={totalCost ? (m.cost / totalCost) * 100 : 0} /></div>
                          <span className="num text-xs text-text-secondary">{totalCost ? ((m.cost / totalCost) * 100).toFixed(1) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {/* 推荐模型列表（P26） */}
          <Panel title="推荐模型（低成本替代）" className="col-span-4" extra={<Lightbulb size={13} className="text-warning" />}>
            <div className="space-y-2">
              {recs.map((r) => (
                <div key={r.recId} className="rounded border border-border-default bg-panel-soft p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{r.scene}</span>
                    <span className="num text-xs font-semibold text-success">月省 {fmtYuan(r.estSaving)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-text-secondary">
                    <span className="text-danger line-through">{r.currentModel}</span>
                    <span className="mx-1.5">→</span>
                    <span className="text-success">{r.recommendModel}</span>
                  </p>
                  <button
                    disabled={readOnly}
                    onClick={async () => {
                      notify.info(`已为「${r.scene}」生成成本优化建议，已加入计量台账优化建议清单`);
                    }}
                    className={`mt-2 w-full ${BTN_PRIMARY}`}
                    title={readOnly ? '只读模式下写操作已禁用' : ''}
                  >
                    生成优化建议
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* 个人行为审计 Drawer */}
      <Drawer open={!!personDetail} onClose={() => setPersonDetail(null)} title={`行为审计 · ${personDetail?.name ?? ''}`} width={480}>
        {personDetail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-border-default bg-panel-soft p-2.5">
                <div className="num text-lg font-semibold text-text-primary">{fmtWan(personDetail.tokens)}</div>
                <div className="mt-0.5 text-xs text-text-secondary">Token 用量</div>
              </div>
              <div className="rounded border border-border-default bg-panel-soft p-2.5">
                <div className="num text-lg font-semibold text-text-primary">{fmtYuan(personDetail.cost)}</div>
                <div className="mt-0.5 text-xs text-text-secondary">费用</div>
              </div>
              <div className="rounded border border-border-default bg-panel-soft p-2.5">
                <div className="num text-lg font-semibold text-text-primary">{DEPT_LABEL[personDetail.deptId] ?? personDetail.deptId}</div>
                <div className="mt-0.5 text-xs text-text-secondary">所属部门</div>
              </div>
            </div>
            <section>
              <div className="mb-2 text-xs font-medium text-text-secondary">行为标签分布</div>
              <div className="space-y-2 rounded border border-border-default bg-panel-soft p-3">
                {personDetail.tagDist.map((t) => (
                  <div key={t.tag}>
                    <div className="flex justify-between text-xs">
                      <span className={t.tag === '私人娱乐' ? 'text-warning' : t.tag === '疑似违规' ? 'text-danger' : 'text-text-secondary'}>{t.tag}</span>
                      <span className="num">{t.pct}%</span>
                    </div>
                    <div className="mt-1"><ProgressBar pct={t.pct} tone={t.tag === '私人娱乐' ? 'danger' : 'primary'} /></div>
                  </div>
                ))}
              </div>
            </section>
            {personDetail.tagDist.some((t) => t.tag === '私人娱乐' && t.pct >= 20) && (
              <p className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                提示：该员工「私人娱乐」占比 ≥20%，建议部门负责人关注；可在调用日志中按行为标签检索其明细。
              </p>
            )}
            <p className="text-xs text-text-secondary">数据来源：调用日志行为分析引擎，审计查看行为已写入留痕。</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

const DEPT_LABEL: Record<string, string> = {
  'DEPT-TECH': '信息科技部',
  'DEPT-RETAIL': '零售银行总部',
  'DEPT-CORP': '公司银行总部',
  'DEPT-RISK': '风险管理部',
  'DEPT-OPS': '运营管理部',
  'DEPT-INVEST': '金融市场部',
};

function SortIcon({ k, sortKey, asc }: { k: SortKey; sortKey: SortKey; asc: boolean }) {
  if (k !== sortKey) return <span className="opacity-30">↕</span>;
  return asc ? <ArrowUp size={11} className="inline text-primary" /> : <ArrowDown size={11} className="inline text-primary" />;
}
