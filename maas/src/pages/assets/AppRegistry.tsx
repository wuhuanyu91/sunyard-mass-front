import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, Plus, Power, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationRegistry, AppStatus, DataLevel, SlaLevel } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { EmptyState } from '../../components/ui/EmptyState';
import { useNotify } from '../../components/ui/Toast';

const STATUS_MAP: Record<number, AppStatus> = { 1: 'ACTIVE', 2: 'SUSPENDED', '0': 'OFFLINE' };
const STATUS_LABEL: Record<AppStatus, string> = { ACTIVE: '已启用', SUSPENDED: '已停用', OFFLINE: '已下线' };
const SLA_OPTIONS: SlaLevel[] = ['P0', 'P1', 'P2'];
const DATA_OPTIONS: DataLevel[] = ['L1', 'L2', 'L3'];

const DEPT_OPTIONS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

export default function AppRegistry() {
  const notify = useNotify();
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<{ app: ApplicationRegistry; apiKey: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const refresh = () => {
    setLoading(true);
    api.getApps().then((list) => {
      setApps(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleToggle = (appId: string) => {
    api.toggleApp(appId).then(() => {
      notify.success('应用状态已切换');
      refresh();
    }).catch((e: Error) => notify.error(e.message));
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => notify.success('API Key 已复制到剪贴板'));
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="模型资产 / 应用注册"
        title="应用注册管理"
        desc="注册新应用、获取 API Key、管理应用状态。创建应用后系统将自动生成 app_id 和 API Key，将 API Key 配置到智能体请求头即可调用 MAS。"
      />

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">共 {apps.length} 个已注册应用</span>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <RefreshCw size={13} /> 刷新
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded bg-primary/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary"
          >
            <Plus size={13} /> 新建应用
          </button>
        </div>
      </div>

      {/* 应用列表 */}
      <Panel height={420}>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-text-secondary">加载中...</div>
        ) : apps.length === 0 ? (
          <EmptyState text="暂无已注册应用，点击「新建应用」开始注册" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                <th className="pb-2 font-medium">应用 ID</th>
                <th className="pb-2 font-medium">应用名称</th>
                <th className="pb-2 font-medium">归属部门</th>
                <th className="pb-2 font-medium">负责人</th>
                <th className="pb-2 font-medium">SLA</th>
                <th className="pb-2 font-medium">数据等级</th>
                <th className="pb-2 font-medium">月度配额</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.appId} className="border-b border-border-default/40 transition-colors last:border-0 hover:bg-panel-soft">
                  <td className="py-2.5 font-mono text-xs text-primary">{a.appId}</td>
                  <td className="py-2.5">
                    <span className="font-medium text-text-primary">{a.appName}</span>
                  </td>
                  <td className="py-2.5 text-text-secondary">
                    {DEPT_OPTIONS.find(d => d.value === a.deptId)?.label ?? a.deptId}
                  </td>
                  <td className="py-2.5 text-text-secondary">{a.owner}</td>
                  <td className="py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      a.slaLevel === 'P0' ? 'bg-danger/10 text-danger' :
                      a.slaLevel === 'P1' ? 'bg-warning/10 text-warning' :
                      'bg-success/10 text-success'
                    }`}>
                      {a.slaLevel}
                    </span>
                  </td>
                  <td className="py-2.5 text-text-secondary">{a.dataLevel}</td>
                  <td className="py-2.5 num text-text-secondary">
                    {a.quotaToken > 0 ? `${(a.quotaToken / 10000_0000).toFixed(1)}亿` : '不限'}
                  </td>
                  <td className="py-2.5">
                    <StatusTag status={a.status} ns="App" size="sm" />
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleToggle(a.appId)}
                      className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
                        a.status === 'ACTIVE'
                          ? 'border-danger/40 text-danger hover:bg-danger/10'
                          : 'border-success/40 text-success hover:bg-success/10'
                      }`}
                      title={a.status === 'ACTIVE' ? '停用应用' : '启用应用'}
                    >
                      <Power size={12} />
                      {a.status === 'ACTIVE' ? '停用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* 新建应用对话框 */}
      {createOpen && (
        <CreateAppDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(app, apiKey) => {
            setCreateOpen(false);
            setNewlyCreated({ app, apiKey });
            setShowKey(true);
            refresh();
          }}
        />
      )}

      {/* API Key 展示对话框（创建成功后仅首次显示明文） */}
      {newlyCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setNewlyCreated(null); setShowKey(false); }} aria-hidden />
          <div role="dialog" aria-label="应用创建成功" className="relative w-[480px] rounded-xl border border-border-default bg-bg-panel p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">✓</span>
              应用创建成功
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
                <span className="text-text-secondary">应用 ID</span>
                <span className="font-mono text-xs font-semibold text-primary">{newlyCreated.app.appId}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
                <span className="text-text-secondary">应用名称</span>
                <span className="text-text-primary">{newlyCreated.app.appName}</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">API Key（仅本次可见，请妥善保存）</span>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded border border-warning/40 bg-warning/5 px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-text-primary">
                  {showKey ? newlyCreated.apiKey : newlyCreated.apiKey.substring(0, 12) + '••••••••••••'}
                </code>
                <button
                  onClick={() => handleCopyKey(newlyCreated.apiKey)}
                  className="flex items-center gap-1 rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  title="复制 API Key"
                >
                  <Copy size={12} /> 复制
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-warning">
                请复制并安全保存此 API Key，关闭后将无法再次查看明文。
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setNewlyCreated(null); setShowKey(false); }}
                className="rounded bg-primary/90 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary"
              >
                我已保存，关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 新建应用对话框 ---------------- */

function CreateAppDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (app: ApplicationRegistry, apiKey: string) => void;
}) {
  const notify = useNotify();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    appName: '',
    deptId: 'DEPT-TECH',
    ownerId: '',
    ownerEmail: '',
    slaLevel: 'P1' as SlaLevel,
    dataLevel: 'L2' as DataLevel,
    monthQuota: '',
    description: '',
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const canSubmit = form.appName.trim() && form.deptId && form.ownerId.trim();

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const app: ApplicationRegistry = {
      appId: '',
      appName: form.appName.trim(),
      deptId: form.deptId,
      owner: form.ownerId.trim(),
      businessScenario: form.description,
      dataLevel: form.dataLevel,
      slaLevel: form.slaLevel,
      quotaToken: form.monthQuota ? Number(form.monthQuota) : 0,
      quotaRequest: 0,
      costBudget: 0,
      status: 'ACTIVE' as AppStatus,
    };
    // 传递后端需要的额外字段
    const payload = {
      ...app,
      owner_id: form.ownerId.trim(),
      owner_email: form.ownerEmail.trim() || null,
      month_quota: form.monthQuota ? Number(form.monthQuota) : null,
      description: form.description || null,
    };
    api.saveApp(payload as unknown as ApplicationRegistry).then((result) => {
      const apiKey = (result as unknown as { apiKey?: string }).apiKey ?? '';
      if (apiKey) {
        onCreated(result as unknown as ApplicationRegistry, apiKey);
      } else {
        notify.success('应用创建成功');
        onClose();
      }
    }).catch((e: Error) => {
      notify.error(e.message);
      setSubmitting(false);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="新建应用" className="relative w-[520px] rounded-xl border border-border-default bg-bg-panel p-5 shadow-2xl">
        <div className="text-sm font-semibold text-text-primary">新建应用</div>
        <p className="mt-1 text-xs text-text-secondary">填写应用信息后提交，系统将自动生成 app_id 和 API Key。</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {/* 应用名称 */}
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-secondary">应用名称 <span className="text-danger">*</span></label>
            <input
              value={form.appName}
              onChange={e => set('appName', e.target.value)}
              placeholder="例如：智能客服、信贷审批助手"
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            />
          </div>

          {/* 归属部门 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">归属部门 <span className="text-danger">*</span></label>
            <select
              value={form.deptId}
              onChange={e => set('deptId', e.target.value)}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            >
              {DEPT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          {/* 负责人 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">负责人 <span className="text-danger">*</span></label>
            <input
              value={form.ownerId}
              onChange={e => set('ownerId', e.target.value)}
              placeholder="例如：zhang.san"
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            />
          </div>

          {/* 负责人邮箱 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">负责人邮箱</label>
            <input
              value={form.ownerEmail}
              onChange={e => set('ownerEmail', e.target.value)}
              placeholder="例如：zhang.san@nbcb.example"
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            />
          </div>

          {/* SLA 等级 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">SLA 等级</label>
            <select
              value={form.slaLevel}
              onChange={e => set('slaLevel', e.target.value)}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            >
              {SLA_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 数据等级 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">数据等级</label>
            <select
              value={form.dataLevel}
              onChange={e => set('dataLevel', e.target.value)}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            >
              {DATA_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* 月度配额 */}
          <div>
            <label className="mb-1 block text-xs text-text-secondary">月度配额（Token 数）</label>
            <input
              value={form.monthQuota}
              onChange={e => set('monthQuota', e.target.value)}
              placeholder="0 = 不限制"
              type="number"
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            />
          </div>

          {/* 应用描述 */}
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-text-secondary">应用描述</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="简要描述应用用途，例如：零售银行智能客服问答系统"
              rows={2}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="rounded bg-primary/90 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '创建中...' : '创建应用'}
          </button>
        </div>
      </div>
    </div>
  );
}
