import { useEffect, useState } from 'react';
import { Users, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { MemberInfo, PlatformRole } from '../../types';
import Panel from '../../components/ui/Panel';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { ToggleSwitch } from '../../components/ui/Controls';
import { Field, INPUT_CLS, SELECT_CLS } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const ROLE_LABEL: Record<PlatformRole, string> = {
  ADMIN: '平台管理员',
  OPERATOR: '平台运营',
  MODEL_OWNER: '模型负责人',
  AUDITOR: '审计员',
  BIZ_VIEWER: '部门查看',
};

const DEPTS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

/** P1-8 成员与权限管理（RBAC 可编辑：成员增删 + 角色分配 + 启停） */
export default function MembersPanel() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ data: MemberInfo | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberInfo | null>(null);

  const reload = () => api.getMembers().then((m) => { setMembers(m); setLoading(false); });
  useEffect(() => {
    reload();
  }, []);

  if (loading) return <div className="panel h-52 animate-pulse" />;

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Users size={14} className="text-primary" /> 成员与权限管理
        </span>
      }
      extra={
        <div className="flex items-center gap-2">
          <span className="num text-xs text-text-secondary">{members.filter((m) => m.status === 'ACTIVE').length}/{members.length} 在册</span>
          <button disabled={readOnly} onClick={() => setDialog({ data: null })} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
            <Plus size={12} /> 添加成员
          </button>
        </div>
      }
      height={260}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">成员</th>
            <th className="pb-2 font-medium">部门</th>
            <th className="pb-2 font-medium">角色</th>
            <th className="pb-2 font-medium">最近登录</th>
            <th className="pb-2 font-medium">状态</th>
            <th className="pb-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.memberId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
              <td className="py-2 text-text-primary">
                {m.name}
                <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{m.memberId}</span>
              </td>
              <td className="py-2 text-xs text-text-secondary">{DEPTS.find((d) => d.value === m.deptId)?.label ?? m.deptId}</td>
              <td className="py-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${m.role === 'ADMIN' ? 'bg-danger/10 text-danger' : m.role === 'AUDITOR' ? 'bg-warning/10 text-warning' : m.role === 'MODEL_OWNER' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                  {ROLE_LABEL[m.role]}
                </span>
              </td>
              <td className="num py-2 text-xs text-text-secondary">
                {new Date(m.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="py-2">
                <ToggleSwitch
                  checked={m.status === 'ACTIVE'}
                  title={m.status === 'ACTIVE' ? '禁用（即时收回权限）' : '启用'}
                  onChange={async () => {
                    await api.toggleMember(m.memberId);
                    notify.success(`成员「${m.name}」已${m.status === 'ACTIVE' ? '禁用' : '启用'}`);
                    reload();
                  }}
                />
              </td>
              <td className="py-2">
                <div className="flex items-center justify-end gap-1">
                  <button disabled={readOnly} onClick={() => setDialog({ data: m })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑角色">
                    <Pencil size={13} />
                  </button>
                  <button disabled={readOnly || m.role === 'ADMIN'} onClick={() => setDeleteTarget(m)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40" title={m.role === 'ADMIN' ? '管理员不可移除' : '移除成员'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-secondary/70">口径：角色决定页面可见范围与写操作权限（对接行内统一身份 IAM）；禁用即时收回全部权限并留痕，上方租户权限矩阵为角色能力说明。</p>

      {dialog && <MemberDialog initial={dialog.data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}

      <ConfirmDialog
        open={!!deleteTarget}
        level="danger"
        title="移除成员"
        confirmWord={deleteTarget?.name}
        message={<>移除 <b>{deleteTarget?.name}</b> 后，其账号权限即时回收，关联 API Key 一并禁用；历史记录保留可审计。</>}
        confirmText="确认移除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteMember(deleteTarget.memberId);
          notify.success(`成员「${deleteTarget.name}」已移除`);
          setDeleteTarget(null);
          reload();
        }}
      />
    </Panel>
  );
}

function MemberDialog({ initial, onClose, onSaved }: { initial: MemberInfo | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState(initial?.name ?? '');
  const [deptId, setDeptId] = useState(initial?.deptId ?? 'DEPT-TECH');
  const [role, setRole] = useState<PlatformRole>(initial?.role ?? 'BIZ_VIEWER');

  const nameOk = name.trim().length >= 2 && name.trim().length <= 20;
  const invalid = !nameOk;

  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={initial ? `编辑成员 · ${initial.name}` : '添加成员'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.saveMember({
                memberId: initial?.memberId ?? '',
                name: name.trim(),
                deptId,
                role,
                status: initial?.status ?? 'ACTIVE',
                lastLoginAt: initial?.lastLoginAt ?? new Date().toISOString(),
              });
              notify.success(`成员「${name.trim()}」已保存（角色：${ROLE_LABEL[role]}）`);
              onSaved();
            }}
            className={BTN_PRIMARY}
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="姓名 / 工号" required error={name && !nameOk ? '2~20 字' : ''}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：张伟" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="部门" required>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={SELECT_CLS}>
              {DEPTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="角色" required hint="最小授权原则">
            <select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)} className={SELECT_CLS}>
              {(Object.keys(ROLE_LABEL) as PlatformRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>
        </div>
        {role === 'ADMIN' && <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">平台管理员拥有全部写操作与审批权限，请严格控制授权人数。</p>}
      </div>
    </Modal>
  );
}
