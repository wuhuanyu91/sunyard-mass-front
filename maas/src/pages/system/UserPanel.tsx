import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import { api } from '../../services/api';
import type { SysRoleKey, SysUser } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { ToggleSwitch } from '../../components/ui/Controls';
import { Modal, ConfirmDialog, BTN_GHOST, BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const ROLE_LABEL: Record<SysRoleKey, string> = {
  SUPER_ADMIN: '超级管理员',
  PLATFORM_ADMIN: '平台管理员',
  OPERATOR: '运维操作员',
  MODEL_OWNER: '模型负责人',
  BIZ_VIEWER: '业务查看员',
  AUDITOR: '审计员',
};

const STATUS_META: Record<SysUser['status'], { label: string; cls: string }> = {
  ACTIVE: { label: '正常', cls: 'bg-success/10 text-success' },
  DISABLED: { label: '已停用', cls: 'bg-border-default/50 text-text-secondary' },
  LOCKED: { label: '已锁定', cls: 'bg-danger/10 text-danger' },
};

const DEPTS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

type UserForm = { name: string; account: string; deptId: string; role: SysRoleKey; mfa: boolean };
const EMPTY_FORM: UserForm = { name: '', account: '', deptId: 'DEPT-TECH', role: 'BIZ_VIEWER', mfa: false };

/** 系统管理 · 用户管理：账号全生命周期（新增/编辑/停用/解锁/重置/删除），变更均留痕 */
export default function UserPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [users, setUsers] = useState<SysUser[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<UserForm | null>(null); // null=关闭；有值=打开（编辑时带原值）
  const [editing, setEditing] = useState<SysUser | null>(null); // 非空=编辑模式
  const [formErr, setFormErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SysUser | null>(null);

  const reload = () => api.getSysUsers().then((u) => { setUsers(u); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (statusFilter === 'ALL' || u.status === statusFilter) &&
        (!q || u.name.toLowerCase().includes(q) || u.account.toLowerCase().includes(q) || u.deptName.includes(q)),
    );
  }, [users, query, statusFilter]);

  const act = (fn: () => Promise<unknown>, ok: string) => {
    fn().then(() => { notify.success(ok); reload(); });
  };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setFormErr(''); };
  const openEdit = (u: SysUser) => { setEditing(u); setForm({ name: u.name, account: u.account, deptId: u.deptId, role: u.role, mfa: u.mfa }); setFormErr(''); };

  const submitForm = () => {
    if (!form) return;
    if (!form.name.trim()) { setFormErr('请输入姓名'); return; }
    if (!form.account.trim()) { setFormErr('请输入登录账号'); return; }
    if (!editing && users.some((u) => u.account === form.account.trim())) { setFormErr('登录账号已存在'); return; }
    const dept = DEPTS.find((d) => d.value === form.deptId) ?? DEPTS[0];
    if (editing) {
      api.updateSysUser({ ...editing, ...form, account: form.account.trim(), deptName: dept.label }).then(() => {
        notify.success(`账号 ${form.name} 已更新`);
        setForm(null);
        reload();
      });
    } else {
      api.addSysUser({ ...form, account: form.account.trim(), deptName: dept.label, status: 'ACTIVE' }).then(() => {
        notify.success(`账号 ${form.name} 已创建`);
        setForm(null);
        reload();
      });
    }
  };

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="用户管理"
        desc="平台账号生命周期管理：对接行内统一身份认证，停用即时失效会话，连续登录失败自动锁定。"
      />
      <Panel
        title="平台账号"
        extra={
          <div className="flex items-center gap-2">
            <span className="num text-xs text-text-secondary">{users.filter((u) => u.status === 'ACTIVE').length}/{users.length} 正常 · 锁定 {users.filter((u) => u.status === 'LOCKED').length}</span>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="姓名 / 账号 / 部门"
                className="w-44 rounded border border-border-default bg-bg-page py-1 pl-6 pr-2 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary">
              <option value="ALL">全部状态</option>
              <option value="ACTIVE">正常</option>
              <option value="DISABLED">已停用</option>
              <option value="LOCKED">已锁定</option>
            </select>
            <button disabled={readOnly} onClick={openCreate} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
              <Plus size={12} /> 新增账号
            </button>
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">用户</th>
              <th className="pb-2 font-medium">登录账号</th>
              <th className="pb-2 font-medium">部门</th>
              <th className="pb-2 font-medium">角色</th>
              <th className="pb-2 font-medium">双因素</th>
              <th className="pb-2 font-medium">最近登录</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isSuper = u.role === 'SUPER_ADMIN';
              return (
                <tr key={u.userId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                  <td className="py-2 text-text-primary">
                    {u.name}
                    <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{u.userId}</span>
                  </td>
                  <td className="py-2 font-mono text-xs text-text-secondary">{u.account}</td>
                  <td className="py-2 text-xs text-text-secondary">{u.deptName}</td>
                  <td className="py-2"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                  <td className="py-2">{u.mfa ? <ShieldCheck size={14} className="text-success" /> : <span className="text-xs text-text-secondary/50">未开启</span>}</td>
                  <td className="num py-2 text-xs text-text-secondary">{new Date(u.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_META[u.status].cls}`}>{STATUS_META[u.status].label}</span></td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1.5">
                      {u.status === 'LOCKED' && (
                        <button disabled={readOnly} onClick={() => act(() => api.unlockSysUser(u.userId), `${u.name} 已解锁`)} className={`flex items-center gap-1 ${BTN_GHOST}`} title={readOnly ? '只读模式下写操作已禁用' : '解除登录失败锁定'}>
                          <Unlock size={12} /> 解锁
                        </button>
                      )}
                      <button disabled={readOnly || isSuper} onClick={() => openEdit(u)} className={`flex items-center gap-1 ${BTN_GHOST}`} title={isSuper ? '超级管理员信息不可编辑' : '编辑部门/角色/双因素'}>
                        <Pencil size={12} /> 编辑
                      </button>
                      <button disabled={readOnly} onClick={() => act(() => api.resetUserPassword(u.userId), `${u.name} 密码已重置`)} className={`flex items-center gap-1 ${BTN_GHOST}`} title={readOnly ? '只读模式下写操作已禁用' : '重置密码，首次登录强制修改'}>
                        <KeyRound size={12} /> 重置密码
                      </button>
                      <button
                        disabled={readOnly || isSuper}
                        onClick={() => act(() => api.toggleSysUser(u.userId), u.status === 'ACTIVE' ? `${u.name} 已停用` : `${u.name} 已启用`)}
                        className={`${BTN_GHOST} ${u.status === 'ACTIVE' ? 'text-warning' : ''}`}
                        title={isSuper ? '超级管理员不可停用' : readOnly ? '只读模式下写操作已禁用' : ''}
                      >
                        {u.status === 'ACTIVE' ? '停用' : '启用'}
                      </button>
                      <button
                        disabled={readOnly || isSuper}
                        onClick={() => setDeleteTarget(u)}
                        className={`${BTN_GHOST} text-danger`}
                        title={isSuper ? '超级管理员不可删除' : '注销账号并回收 Key 与会话'}
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="pt-2 text-[11px] text-text-secondary/70">口径：账号由行内统一身份认证签发，平台侧维护角色与状态；停用/删除即时失效在途会话并回收 Key，全部操作进入操作日志。</p>
      </Panel>

      {/* 新增 / 编辑账号 */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={editing ? `编辑账号 · ${editing.name}` : '新增账号'}
        width={440}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => setForm(null)}>取消</button>
            <button className={BTN_PRIMARY} onClick={submitForm}>{editing ? '保存修改' : '创建账号'}</button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">姓名</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：李雷" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">登录账号</label>
              <input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} disabled={!!editing} placeholder="如：100888（行内 6 位工号）" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60 disabled:opacity-60" />
              {editing && <p className="mt-1 text-[10px] text-text-secondary/70">登录账号由统一身份认证签发，不可修改</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-secondary">所属部门</label>
                <select value={form.deptId} onChange={(e) => setForm({ ...form, deptId: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                  {DEPTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-secondary">角色</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SysRoleKey })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                  {(Object.keys(ROLE_LABEL) as SysRoleKey[]).filter((k) => k !== 'SUPER_ADMIN').map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2.5">
              <div>
                <div className="text-xs text-text-primary">双因素认证（MFA）</div>
                <div className="mt-0.5 text-[10px] text-text-secondary">管理员/审计角色按基线强制开启</div>
              </div>
              <ToggleSwitch checked={form.mfa} onChange={(v) => setForm({ ...form, mfa: v })} />
            </div>
            {formErr && <p className="text-xs text-danger">{formErr}</p>}
            {!editing && <p className="text-[11px] text-text-secondary/70">创建后初始密码由认证平台下发，首次登录强制修改。</p>}
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        level="danger"
        title={`删除账号「${deleteTarget?.name ?? ''}」`}
        message="删除后账号注销，关联 API Key 与在途会话即时回收，历史操作日志保留。请输入「删除」确认。"
        confirmText="删除账号"
        confirmWord="删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) act(() => api.deleteSysUser(deleteTarget.userId), `账号 ${deleteTarget.name} 已删除`);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
