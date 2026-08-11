import { useEffect, useMemo, useState } from 'react';
import { Search, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import type { BehaviorTag, CallLog } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Drawer from '../../components/ui/Drawer';
import StatusTag from '../../components/ui/StatusTag';
import { Segmented } from '../../components/ui/Controls';
import { EmptyState } from '../../components/ui/EmptyState';
import { BTN_GHOST } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';

const PAGE_SIZE = 20;
const TAG_CLS: Record<BehaviorTag, string> = {
  业务办公: 'bg-success/10 text-success',
  开发调试: 'bg-primary/10 text-primary',
  私人娱乐: 'bg-warning/10 text-warning',
  疑似违规: 'bg-danger/10 text-danger',
};

/** M6.2 调用日志（P41） */
export default function CallLogs() {
  const notify = useNotify();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [modelFilter, setModelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [keyQuery, setKeyQuery] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CallLog | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    api.getCallLogs().then((l) => {
      setLogs(l);
      setLoading(false);
    });
  }, []);

  const models = useMemo(() => [...new Set(logs.map((l) => l.model))], [logs]);

  const filtered = useMemo(() => {
    const maxMs = timeRange === '1h' ? 3600_000 : timeRange === '24h' ? 86400_000 : 7 * 86400_000;
    const now = Date.now();
    return logs.filter(
      (l) =>
        now - new Date(l.ts).getTime() <= maxMs &&
        (modelFilter === 'ALL' || l.model === modelFilter) &&
        (statusFilter === 'ALL' || l.status === statusFilter) &&
        (tagFilter === 'ALL' || l.behaviorTag === tagFilter) &&
        (!keyQuery.trim() || l.apiKeyMasked.toLowerCase().includes(keyQuery.trim().toLowerCase())),
    );
  }, [logs, timeRange, modelFilter, statusFilter, tagFilter, keyQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [timeRange, modelFilter, statusFilter, tagFilter, keyQuery]);

  /** 脱敏展示：身份证/手机号/卡号打码；解锁后展示原文 */
  const mask = (text: string) => text.replace(/\d{6,}/g, '***');

  if (loading) {
    return <div className="panel h-72 animate-pulse" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="调用日志"
        desc="全量调用日志检索：按 TraceID / 应用 / 模型 / 状态过滤，支持脱敏查看与链路下钻。"
      />
      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={[
            { value: '1h', label: '近 1h' },
            { value: '24h', label: '近 24h' },
            { value: '7d', label: '近 7d' },
          ]}
          value={timeRange}
          onChange={setTimeRange}
        />
        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
          <option value="ALL">全部模型</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
          <option value="ALL">全部状态</option>
          <option value="SUCCESS">成功</option>
          <option value="RATE_LIMITED">限流</option>
          <option value="BLOCKED">拦截</option>
          <option value="FAILED">失败</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
          <option value="ALL">全部行为标签</option>
          <option value="业务办公">业务办公</option>
          <option value="开发调试">开发调试</option>
          <option value="私人娱乐">私人娱乐</option>
          <option value="疑似违规">疑似违规</option>
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={keyQuery}
            onChange={(e) => setKeyQuery(e.target.value)}
            placeholder="按 API Key 检索"
            className="w-48 rounded border border-border-default bg-bg-page py-1.5 pl-7 pr-2 font-mono text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
          />
        </div>
        <span className="num ml-auto text-xs text-text-secondary">命中 {filtered.length} 条</span>
      </div>

      {/* 日志表（P41 列结构） */}
      <Panel height={480}>
        {rows.length === 0 ? (
          <EmptyState text="当前筛选条件下无调用日志" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="pb-2 font-medium">调用时间</th>
                  <th className="pb-2 font-medium">状态</th>
                  <th className="pb-2 font-medium">API Key</th>
                  <th className="pb-2 font-medium">路由名称</th>
                  <th className="pb-2 font-medium">模型</th>
                  <th className="pb-2 font-medium">提供商</th>
                  <th className="pb-2 font-medium">应用类型</th>
                  <th className="pb-2 font-medium">行为分析</th>
                  <th className="pb-2 font-medium">输入/输出 Token</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.logId} onClick={() => { setDetail(l); setUnlocked(false); }} className="cursor-pointer border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                    <td className="num py-2 text-xs text-text-secondary">
                      {new Date(l.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusTag status={l.status} ns="CallLog" size="sm" />
                        <span className="num text-[10px] text-text-secondary/60">{l.statusCode}</span>
                      </div>
                    </td>
                    <td className="py-2 font-mono text-xs text-text-secondary">{l.apiKeyMasked}</td>
                    <td className="py-2 text-xs text-text-secondary">{l.routeName}</td>
                    <td className="py-2 text-xs text-primary">{l.model}</td>
                    <td className="py-2 text-xs text-text-secondary">{l.provider}</td>
                    <td className="py-2 text-xs text-text-secondary">{l.appType}</td>
                    <td className="py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TAG_CLS[l.behaviorTag]}`}>{l.behaviorTag}</span>
                    </td>
                    <td className="num py-2 text-xs">
                      {l.inputTokens.toLocaleString()} / {l.outputTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center justify-between">
              <span className="num text-xs text-text-secondary">第 {page}/{pageCount} 页 · 每页 {PAGE_SIZE} 条</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={BTN_GHOST}>上一页</button>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className={BTN_GHOST}>下一页</button>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* 详情 Drawer：内容审计（默认脱敏，AUDITOR 可解锁留痕） */}
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={`调用日志 · ${detail?.logId ?? ''}`} width={520}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <LogInfo k="状态 / 状态码" v={`${detail.status} / ${detail.statusCode}`} />
              <LogInfo k="API Key" v={detail.apiKeyMasked} mono />
              <LogInfo k="路由 / 模型" v={`${detail.routeName} / ${detail.model}`} />
              <LogInfo k="提供商 / 应用" v={`${detail.provider} / ${detail.appType}`} />
              <LogInfo k="输入 / 输出 Token" v={`${detail.inputTokens.toLocaleString()} / ${detail.outputTokens.toLocaleString()}`} />
              <LogInfo k="行为分析" v={detail.behaviorTag} />
            </div>

            {detail.behaviorTag === '疑似违规' && (
              <p className="flex items-center gap-1.5 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                <ShieldAlert size={13} /> 该调用被行为分析引擎标记为疑似违规，已同步安全运行中心处置队列
              </p>
            )}

            <div className="rounded border border-border-default bg-panel-soft p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">请求内容（内容审计）</span>
                <button
                  onClick={() => {
                    if (!unlocked) notify.info('原文解锁查看已写入审计留痕');
                    setUnlocked(!unlocked);
                  }}
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${unlocked ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'}`}
                >
                  {unlocked ? <EyeOff size={12} /> : <Eye size={12} />}
                  {unlocked ? '恢复脱敏' : '解锁原文（留痕）'}
                </button>
              </div>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{unlocked ? detail.requestContent : mask(detail.requestContent)}</pre>
              <div className="mt-2 text-xs font-medium text-text-secondary">响应内容</div>
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{unlocked ? detail.responseContent : mask(detail.responseContent)}</pre>
            </div>
            <p className="text-xs text-text-secondary">默认按 L2 规则脱敏（证件号/手机号/卡号打码）；MASKED/HASH_ONLY 存储策略事件原文需按 AUDITOR 权限解锁。</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function LogInfo({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border-default bg-panel-soft px-2.5 py-1.5">
      <div className="text-xs text-text-secondary">{k}</div>
      <div className={`truncate text-sm ${mono ? 'font-mono text-xs' : 'num'}`}>{v}</div>
    </div>
  );
}
