import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { PermLevel, PermRow, SysRole, SysRoleKey } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { Modal, ConfirmDialog, BTN_GHOST, BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

/** 系统管理 · 角色管理：内置 RBAC 角色 + 自建角色（新增/删除） */
export function RolePanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [roles, setRoles] = useState<SysRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ roleName: string; desc: string; scope: string } | null>(null);
  const [formErr, setFormErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SysRole | null>(null);

  const reload = () => api.getSysRoles().then((r) => { setRoles(r); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const submit = () => {
    if (!form) return;
    if (!form.roleName.trim()) { setFormErr('请输入角色名称'); return; }
    if (!form.desc.trim()) { setFormErr('请输入职责说明'); return; }
    api.addSysRole({ roleName: form.roleName.trim(), desc: form.desc.trim(), scope: form.scope.trim() || '本部门' }).then(() => {
      notify.success(`角色「${form.roleName}」已创建，请在权限配置页完成授权`);
      setForm(null);
      reload();
    });
  };

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="角色管理"
        desc="内置 RBAC 角色（不可删除）+ 自建角色；按最小权限原则划分职责与数据范围，授权在权限配置页完成。"
      />
      <Panel
        title="角色列表"
        extra={
          <div className="flex items-center gap-2">
            <span className="num text-xs text-text-secondary">{roles.length} 个角色 · 内置 {roles.filter((r) => r.builtIn).length}</span>
            <button disabled={readOnly} onClick={() => { setForm({ roleName: '', desc: '', scope: '本部门' }); setFormErr(''); }} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
              <Plus size={12} /> 新增角色
            </button>
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">角色</th>
              <th className="pb-2 font-medium">职责说明</th>
              <th className="pb-2 font-medium">数据范围</th>
              <th className="pb-2 font-medium">账号数</th>
              <th className="pb-2 font-medium">属性</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.roleKey} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                <td className="py-2 text-text-primary">
                  {r.roleName}
                  <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{r.roleKey}</span>
                </td>
                <td className="py-2 text-xs text-text-secondary">{r.desc}</td>
                <td className="py-2 text-xs text-text-secondary">{r.scope}</td>
                <td className="num py-2 text-xs">{r.userCount.toLocaleString()}</td>
                <td className="py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.builtIn ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>{r.builtIn ? '内置' : '自建'}</span>
                </td>
                <td className="py-2">
                  <div className="flex justify-end">
                    {r.builtIn ? (
                      <span className="text-[11px] text-text-secondary/50" title="内置角色保障审计与监管职责，不可删除">不可删除</span>
                    ) : (
                      <button
                        disabled={readOnly || r.userCount > 0}
                        onClick={() => setDeleteTarget(r)}
                        className={`flex items-center gap-1 ${BTN_GHOST} text-danger`}
                        title={r.userCount > 0 ? '存在关联账号，不可删除' : readOnly ? '只读模式下写操作已禁用' : '删除自建角色'}
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-2 text-[11px] text-text-secondary/70">口径：角色与行内岗位目录映射；自建角色创建后需在权限配置页完成模块授权方可使用，删除时关联账号回落业务查看员。</p>
      </Panel>

      {/* 新增角色 */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title="新增角色"
        width={420}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => setForm(null)}>取消</button>
            <button className={BTN_PRIMARY} onClick={submit}>创建角色</button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">角色名称</label>
              <input value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="如：外包协作员" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">职责说明</label>
              <textarea value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} rows={2} placeholder="如：外包驻场人员，仅限指定项目的模型调试与日志自查" className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">数据范围</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-full rounded border border-border-default bg-bg-page px-2 py-2 text-sm text-text-primary">
                <option value="本部门">本部门</option>
                <option value="所辖模型">所辖模型</option>
                <option value="指定项目">指定项目</option>
                <option value="全行（只读）">全行（只读）</option>
              </select>
            </div>
            {formErr && <p className="text-xs text-danger">{formErr}</p>}
            <p className="text-[11px] text-text-secondary/70">创建后默认为无权限，需在「权限配置」页完成模块授权。</p>
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        level="danger"
        title={`删除角色「${deleteTarget?.roleName ?? ''}」`}
        message="删除后该角色即时失效，关联账号（如有前置迁移）回落业务查看员。请输入「删除」确认。"
        confirmText="删除角色"
        confirmWord="删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            api.deleteSysRole(deleteTarget.roleKey).then(() => {
              notify.success(`角色「${deleteTarget.roleName}」已删除`);
              reload();
            });
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

const PERM_LEVELS: { v: PermLevel; label: string; cls: string }[] = [
  { v: 'DENY', label: '无权限', cls: 'text-text-secondary/60' },
  { v: 'READ', label: '只读', cls: 'text-primary' },
  { v: 'WRITE', label: '读写', cls: 'text-warning' },
  { v: 'APPROVE', label: '审批', cls: 'text-danger' },
];

const ROLE_ORDER: SysRoleKey[] = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'OPERATOR', 'MODEL_OWNER', 'BIZ_VIEWER', 'AUDITOR'];
const ROLE_SHORT: Record<SysRoleKey, string> = {
  SUPER_ADMIN: '超管',
  PLATFORM_ADMIN: '平台管理员',
  OPERATOR: '运维操作员',
  MODEL_OWNER: '模型负责人',
  BIZ_VIEWER: '业务查看员',
  AUDITOR: '审计员',
};

/** 系统管理 · 权限配置：模块×角色矩阵，保存即时同步网关鉴权并留痕 */
export function PermPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [rows, setRows] = useState<PermRow[]>([]);
  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPermMatrix().then((m) => { setRows(m); setOrigin(JSON.stringify(m)); });
  }, []);

  const dirty = useMemo(() => JSON.stringify(rows) !== origin && origin !== '', [rows, origin]);

  const setLevel = (module: string, role: SysRoleKey, level: PermLevel) => {
    setRows((prev) => prev.map((r) => (r.module === module ? { ...r, levels: { ...r.levels, [role]: level } } : r)));
  };

  const save = () => {
    setSaving(true);
    api.savePermMatrix(rows).then(() => {
      setSaving(false);
      setOrigin(JSON.stringify(rows));
      notify.success('权限矩阵已保存，即时同步网关鉴权');
    });
  };

  return (
    <>
      <PageHeader
        crumb="系统管理"
        title="权限配置"
        desc="模块 × 角色授权矩阵（RBAC）：无权限/只读/读写/审批四级，保存后网关鉴权即时生效并写操作日志。"
      />
      <Panel
        title="授权矩阵"
        extra={
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warning">有未保存的授权变更</span>}
            <button disabled={readOnly || !dirty || saving} onClick={save} className={BTN_PRIMARY} title={readOnly ? '只读模式下写操作已禁用' : ''}>
              <Save size={12} className="mr-1 inline" /> 保存并生效
            </button>
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">功能模块</th>
              {ROLE_ORDER.map((rk) => (
                <th key={rk} className="pb-2 font-medium">{ROLE_SHORT[rk]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.module} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                <td className="py-2 text-text-primary">{r.module}</td>
                {ROLE_ORDER.map((rk) => (
                  <td key={rk} className="py-2">
                    <select
                      value={r.levels[rk]}
                      disabled={readOnly || rk === 'SUPER_ADMIN'}
                      title={rk === 'SUPER_ADMIN' ? '超级管理员权限恒定，不可修改' : ''}
                      onChange={(e) => setLevel(r.module, rk, e.target.value as PermLevel)}
                      className={`rounded border border-border-default bg-bg-page px-1.5 py-0.5 text-xs outline-none focus:border-primary/60 disabled:opacity-60 ${PERM_LEVELS.find((p) => p.v === r.levels[rk])?.cls ?? ''}`}
                    >
                      {PERM_LEVELS.map((p) => (
                        <option key={p.v} value={p.v}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-2 text-[11px] text-text-secondary/70">口径：审批级 = 可发起并审批该域变更；读写级 = 可配置不可审批；变更即时下发网关鉴权，旧会话按新权限校验。</p>
      </Panel>
    </>
  );
}
