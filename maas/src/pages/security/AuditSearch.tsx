import { useEffect, useState } from 'react';
import { Search, Database, Download } from 'lucide-react';
import { api } from '../../services/api';
import type { RouterLog, TenantRetention } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { Segmented } from '../../components/ui/Controls';
import { BTN_GHOST } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';

const fmt = (n: number) => n.toLocaleString('zh-CN');

/** M9.5 调用审计（P40：多维检索 + 租户数据留存） */
export default function AuditSearch() {
  const notify = useNotify();
  const [logs, setLogs] = useState<RouterLog[]>([]);
  const [retentions, setRetentions] = useState<TenantRetention[]>([]);
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState('trace');
  const [query, setQuery] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [results, setResults] = useState<RouterLog[] | null>(null);
  const [selected, setSelected] = useState<RouterLog | null>(null);
  const [exportOpen, setExportOpen] = useState<TenantRetention | null>(null);

  useEffect(() => {
    Promise.all([api.getRouterLogs(), api.getTenantRetentions()]).then(([l, t]) => {
      setLogs(l);
      setRetentions(t);
      setLoading(false);
    });
  }, []);

  /** 客户ID / 业务单号 mock 映射：按 userId 或 traceId 哈希匹配 */
  const doSearch = () => {
    const q = query.trim();
    if (!q) return;
    const maxMs = timeRange === '1h' ? 3600_000 : timeRange === '24h' ? 86400_000 : 7 * 86400_000;
    const now = Date.now();
    const pool = logs.filter((l) => now - new Date(l.createdAt).getTime() <= maxMs);
    let hits: RouterLog[];
    if (dim === 'trace') {
      hits = pool.filter((l) => l.traceId.toLowerCase() === q.toLowerCase());
    } else if (dim === 'customer') {
      hits = pool.filter((l) => l.userId.toLowerCase() === q.toLowerCase() || l.userId === `U-${q.replace(/\D/g, '')}`);
      if (hits.length === 0) hits = pool.slice(0, 3); // mock：展示该客户近期链路样本
    } else {
      hits = pool.filter((l) => l.requestId.toLowerCase() === q.toLowerCase());
      if (hits.length === 0) hits = pool.slice(3, 6);
    }
    setResults(hits);
    if (hits.length === 0) notify.info('未检索到匹配记录，请确认时间范围');
  };

  const stageNames = ['鉴权', '前置护栏', '路由', '推理', '后置护栏', '响应'];

  if (loading) {
    return <div className="panel h-72 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="安全审计"
        title="调用审计"
        desc="按 TraceID / 客户ID / 业务单号全链路检索调用记录；留存策略与检索行为均留痕。"
      />
      {/* 多维检索（P40） */}
      <Panel title="全链路检索（TraceID / 客户ID / 业务单号）">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { value: 'trace', label: 'TraceID' },
              { value: 'customer', label: '客户ID' },
              { value: 'order', label: '业务单号' },
            ]}
            value={dim}
            onChange={(v) => {
              setDim(v);
              setResults(null);
            }}
          />
          <div className="relative flex-1" style={{ minWidth: 260 }}>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder={dim === 'trace' ? '如 TR-20260803-999001' : dim === 'customer' ? '如 U-3007 或 3007' : '如 REQ-90012'}
              className="w-full rounded border border-border-default bg-bg-page py-2 pl-8 pr-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
            />
          </div>
          <Segmented
            options={[
              { value: '1h', label: '近 1h' },
              { value: '24h', label: '近 24h' },
              { value: '7d', label: '近 7d' },
            ]}
            value={timeRange}
            onChange={setTimeRange}
          />
          <button onClick={doSearch} className={BTN_GHOST}>检索</button>
        </div>

        <div className="mt-3">
          {results === null ? (
            <p className="text-xs text-text-secondary">按客户维度可回溯该客户全部调用链路（网关路由 → 算力调度 → 模型推理 → 结果返回）；示例：U-3007 / TR-20260803-999001</p>
          ) : results.length === 0 ? (
            <EmptyState text="时间范围内未检索到匹配记录" />
          ) : (
            <div className="space-y-1.5">
              {results.map((l) => (
                <button
                  key={l.traceId}
                  onClick={() => setSelected(l)}
                  className="flex w-full items-center justify-between gap-2 rounded border border-border-default bg-panel-soft px-3 py-2 text-left text-xs transition-colors hover:border-primary/40"
                >
                  <span className="font-mono text-primary">{l.traceId}</span>
                  <span className="flex items-center gap-2 text-text-secondary">
                    {l.appId} · {l.userId} · {l.businessScenario}
                    <StatusTag status={l.status} ns="RouterLog" size="sm" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* 租户数据留存（P40） */}
      <Panel title="租户数据与日志留存（独立留存）">
        <div className="grid grid-cols-3 gap-3">
          {retentions.map((t) => (
            <div key={t.tenantId} className="rounded border border-border-default bg-panel-soft p-3.5">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-primary" />
                <span className="text-sm font-medium text-text-primary">{t.tenantName}</span>
              </div>
              <div className="mt-2.5 space-y-1 text-xs text-text-secondary">
                <p>留存周期：<b className="num text-text-primary">{t.retentionDays} 天</b></p>
                <p>存储策略：{t.storagePolicy}</p>
                <p>日志量：<b className="num text-text-primary">{fmt(t.logCount)}</b> 条</p>
              </div>
              <button onClick={() => setExportOpen(t)} className={`mt-3 flex w-full items-center justify-center gap-1 ${BTN_GHOST}`}>
                <Download size={12} /> 导出审计包
              </button>
            </div>
          ))}
        </div>
      </Panel>

      {/* 链路时间线 Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={`全链路时间线 · ${selected?.traceId ?? ''}`} width={520}>
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <StatusTag status={selected.status} ns="RouterLog" />
              <span className="num text-xs text-text-secondary">总耗时 {selected.totalDurationMs}ms · 客户 {selected.userId}</span>
            </div>
            <div className="rounded border border-border-default bg-panel-soft p-3">
              {stageNames.map((name, i) => {
                const blocked = selected.status === 'BLOCKED';
                const degraded = selected.status === 'DEGRADED';
                let tone = 'text-success';
                let tag = '通过';
                if (name === '前置护栏' && blocked) { tone = 'text-danger'; tag = '阻断'; }
                if (name === '路由' && degraded) { tone = 'text-warning'; tag = '降级'; }
                if (name === '推理' && blocked) { tone = 'text-text-secondary'; tag = '未执行'; }
                const ms = Math.round((selected.totalDurationMs * [0.06, 0.08, 0.12, 0.55, 0.09, 0.1][i]));
                return (
                  <div key={name} className="flex items-center justify-between border-b border-border-default/40 py-2 last:border-0">
                    <span className={`flex items-center gap-2 text-sm ${tone}`}>
                      <span className={`h-2 w-2 rounded-full ${tone === 'text-success' ? 'bg-success' : tone === 'text-warning' ? 'bg-warning' : tone === 'text-danger' ? 'bg-danger' : 'bg-border-default'}`} />
                      {name}
                      <span className="text-xs opacity-80">{tag}</span>
                    </span>
                    <span className="num text-xs text-text-secondary">{ms}ms</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-secondary">链路口径与智能路由白盒一致：鉴权 → 前置护栏 → 路由 → 推理 → 后置护栏 → 响应。</p>
          </div>
        )}
      </Drawer>

      {/* 审计导出 */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setExportOpen(null)} aria-hidden />
          <div role="dialog" aria-label="导出审计包" className="relative w-[440px] rounded-xl border border-border-default bg-bg-panel p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Download size={15} className="text-primary" /> 导出审计包 · {exportOpen.tenantName}
            </div>
            <div className="mt-3 space-y-2 text-xs text-text-secondary">
              <p>导出范围：该租户近 {exportOpen.retentionDays} 天留存日志（{fmt(exportOpen.logCount)} 条）。</p>
              <p className="rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-warning">脱敏说明：MASKED/HASH_ONLY 事件仅导出摘要与哈希；用户 ID 按租户隔离规则脱敏。</p>
              <p>导出包内附 manifest.sha256 签名清单，导入方可校验防篡改。</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setExportOpen(null)} className={BTN_GHOST}>取消</button>
              <button
                onClick={() => {
                  setExportOpen(null);
                  notify.success('审计包已生成并归档至审计留存服务');
                }}
                className="rounded bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
