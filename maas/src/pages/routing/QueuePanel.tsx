import { useEffect, useMemo, useState } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { BatchTask, PriorityQueueItem } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import Banner from '../../components/ui/Banner';
import { Modal, BTN_GHOST, BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const TASK_STATUS: Record<BatchTask['status'], { label: string; cls: string }> = {
  QUEUED: { label: '排队中', cls: 'bg-warning/10 text-warning' },
  RUNNING: { label: '运行中', cls: 'bg-primary/10 text-primary' },
  DONE: { label: '已完成', cls: 'bg-success/10 text-success' },
  CANCELLED: { label: '已取消', cls: 'bg-panel-soft text-text-secondary' },
};

const DEPT_MAP: Record<string, string> = {
  'DEPT-TECH': '信息科技部',
  'DEPT-RETAIL': '零售银行总部',
  'DEPT-CORP': '公司银行总部',
  'DEPT-RISK': '风险管理部',
  'DEPT-OPS': '运营管理部',
  'DEPT-INVEST': '金融市场部',
};

const ASSET_MAP: Record<string, string> = {
  'AST-QWEN-14B-BASE': 'Qwen-14B-Instruct',
  'AST-QWEN-72B-BASE': 'Qwen-72B-Instruct',
  'AST-FIN-QWEN-14B-SFT': 'Fin-Qwen-14B-SFT',
  'AST-OCR-DOC': 'OCR-Doc-V3',
  'AST-EXT-MARKETING': '第三方营销模型',
  'AST-INTENT-MINI': 'MiniLM-Intent',
};

/** 调度算力 · 队列调度：优先级队列分层视图 + 批量推理任务（错峰窗口）管理 */
export default function QueuePanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [queue, setQueue] = useState<PriorityQueueItem[]>([]);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState<Omit<BatchTask, 'taskId' | 'status' | 'submitAt'>>({
    name: '',
    deptId: 'DEPT-RETAIL',
    assetId: 'AST-QWEN-14B-BASE',
    priority: 'P3',
    window: '00:00-06:00',
    rows: 10_000,
  });

  const reload = () =>
    Promise.all([api.getQueueData(), api.getBatchTasks()]).then(([q, t]) => {
      setQueue(q);
      setTasks(t);
      setLoading(false);
    });
  useEffect(() => {
    reload();
  }, []);

  const p0 = queue.find((q) => q.priorityClass === 'P0');
  const p0Squeezed = !!p0 && p0.maxWaitMs > 500; // 规范 6.4.5：高优先级等待超阈值横幅
  const runningCount = useMemo(() => tasks.filter((t) => t.status === 'RUNNING').length, [tasks]);

  const submitTask = () => {
    if (!form.name.trim()) { setFormErr('请输入任务名称'); return; }
    if (!(form.rows > 0)) { setFormErr('请输入有效数据量'); return; }
    api.submitBatchTask({ ...form, name: form.name.trim() }).then(() => {
      notify.success('批量任务已提交，进入错峰队列');
      setCreating(false);
      setFormErr('');
      setForm({ name: '', deptId: 'DEPT-RETAIL', assetId: 'AST-QWEN-14B-BASE', priority: 'P3', window: '00:00-06:00', rows: 10_000 });
      reload();
    });
  };

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
      <PageHeader crumb="调度算力" title="队列调度" desc="优先级队列分层视图与批量推理任务管理：P0 保障、错峰窗口调度、运行状态跟踪" />

      {/* 优先级队列（6.4.2 / 6.4.5） */}
      <Panel title="优先级队列" extra={<span className="text-xs text-text-secondary">P0 等待超阈值触发横幅告警</span>}>
        {p0Squeezed && (
          <Banner tone="warning">高优先级队列等待超阈值（P0 maxWait {p0?.maxWaitMs}ms &gt; 500ms），已被 P1/P2 抢占挤压</Banner>
        )}
        <div className="grid grid-cols-3 gap-3">
          {queue.map((q) => (
            <div key={q.priorityClass} className={`flex flex-col justify-between rounded border p-3 ${q.priorityClass === 'P0' ? 'border-danger/30 bg-danger/5' : q.priorityClass === 'P1' ? 'border-warning/25 bg-warning/5' : 'border-border-default bg-panel-soft'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">{q.priorityClass}</span>
                <span className={`num text-xs ${q.priorityClass === 'P0' ? 'text-danger' : q.priorityClass === 'P1' ? 'text-warning' : 'text-text-secondary'}`}>
                  {q.queued} 排队
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
                <div className="flex justify-between"><span>运行中</span><span className="num">{q.running}</span></div>
                <div className="flex justify-between"><span>平均等待</span><span className="num">{q.avgWaitMs}ms</span></div>
                <div className="flex justify-between"><span>最长等待</span><span className="num">{q.maxWaitMs}ms</span></div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-secondary/70">队列分层视图：P0/P1 关键业务优先派发，P2 批量任务错峰至低峰窗口执行。</p>
      </Panel>

      {/* 批量推理任务（P2-15：错峰窗口 + 取消） */}
      <Panel
        title={`批量推理任务 · ${tasks.length} 个（运行中 ${runningCount}）`}
        extra={
          <button
            disabled={readOnly}
            onClick={() => { setCreating(true); setFormErr(''); }}
            className={`flex items-center gap-1 ${BTN_PRIMARY}`}
            title={readOnly ? '只读模式下写操作已禁用' : '提交批量任务（自动进入错峰窗口）'}
          >
            <Plus size={12} /> 新建批量任务
          </button>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">任务名称</th>
              <th className="pb-2 font-medium">提交部门</th>
              <th className="pb-2 font-medium">模型</th>
              <th className="pb-2 font-medium">优先级</th>
              <th className="pb-2 font-medium">错峰窗口</th>
              <th className="pb-2 font-medium">数据量</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 font-medium">提交时间</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.taskId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                <td className="py-2">
                  <div className="text-xs text-text-primary">{t.name}</div>
                  <div className="num font-mono text-[10px] text-text-secondary/60">{t.taskId}</div>
                </td>
                <td className="py-2 text-xs text-text-secondary">{DEPT_MAP[t.deptId] ?? t.deptId}</td>
                <td className="py-2 text-xs text-text-primary">{ASSET_MAP[t.assetId] ?? t.assetId}</td>
                <td className="py-2">
                  <span className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.priority === 'P1' ? 'bg-danger/10 text-danger' : t.priority === 'P2' ? 'bg-warning/10 text-warning' : 'bg-panel-soft text-text-secondary'}`}>{t.priority}</span>
                </td>
                <td className="num py-2 font-mono text-xs text-text-secondary">{t.window}</td>
                <td className="num py-2 text-xs text-text-primary">{t.rows.toLocaleString('zh-CN')} 条</td>
                <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${TASK_STATUS[t.status].cls}`}>{TASK_STATUS[t.status].label}</span></td>
                <td className="num py-2 text-xs text-text-secondary">
                  {new Date(t.submitAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-2">
                  <div className="flex justify-end">
                    {(t.status === 'QUEUED' || t.status === 'RUNNING') && (
                      <button
                        disabled={readOnly}
                        onClick={() => api.cancelBatchTask(t.taskId).then(() => { notify.success(`任务 ${t.taskId} 已取消`); reload(); })}
                        className={`flex items-center gap-1 ${BTN_GHOST}`}
                        title={readOnly ? '只读模式下写操作已禁用' : '取消任务：未执行部分不再调度'}
                      >
                        <XCircle size={12} /> 取消
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-2 text-[11px] text-text-secondary/70">批量任务在低峰窗口（22:00-06:00）执行，不挤占实时推理；取消后未执行部分不再调度，全程留痕。</p>
      </Panel>

      {/* 新建批量任务 */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="新建批量任务"
        width={460}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => setCreating(false)}>取消</button>
            <button className={BTN_PRIMARY} onClick={submitTask}>提交任务</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-secondary">任务名称</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：月末对账文档批量抽取" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">提交部门</label>
              <select value={form.deptId} onChange={(e) => setForm({ ...form, deptId: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                {Object.entries(DEPT_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">推理模型</label>
              <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                {Object.entries(ASSET_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">优先级</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as BatchTask['priority'] })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                <option value="P1">P1 高优</option>
                <option value="P2">P2 中优</option>
                <option value="P3">P3 低优</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">错峰窗口</label>
              <select value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                <option value="00:00-06:00">00:00-06:00</option>
                <option value="22:00-06:00">22:00-06:00</option>
                <option value="20:00-24:00">20:00-24:00</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-secondary">数据量（条）</label>
            <input type="number" min={1} value={form.rows} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60" />
          </div>
          {formErr && <p className="text-xs text-danger">{formErr}</p>}
          <p className="text-[11px] leading-relaxed text-text-secondary/70">提交后任务进入对应优先级队列，在错峰窗口内由调度器执行；低优任务可被 P0/P1 抢占。</p>
        </div>
      </Modal>
    </div>
  );
}
