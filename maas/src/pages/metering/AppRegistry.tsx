import { useEffect, useState } from 'react';
import { AppWindow, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationRegistry } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { ToggleSwitch } from '../../components/ui/Controls';
import { Field, INPUT_CLS, SELECT_CLS } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const DEPTS = [
  { value: 'DEPT-TECH', label: '信息科技部' },
  { value: 'DEPT-RETAIL', label: '零售银行总部' },
  { value: 'DEPT-CORP', label: '公司银行总部' },
  { value: 'DEPT-RISK', label: '风险管理部' },
  { value: 'DEPT-OPS', label: '运营管理部' },
  { value: 'DEPT-INVEST', label: '金融市场部' },
];

const SCENARIOS = ['客户服务', '信贷分析', '风控审核', '营销辅助', '运营处理', '研发编码', '投研分析'];

/** P0-5 应用注册管理（贯穿路由/限流/计量的基础对象，管理员维护） */
export default function AppRegistry() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ data: ApplicationRegistry | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationRegistry | null>(null);

  const reload = () => api.getApps().then((a) => { setApps(a); setLoading(false); });
  useEffect(() => {
    reload();
  }, []);

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="应用管理"
        desc="应用注册、部门归属、数据等级与 SLA 管理；应用是路由策略、限流与配额的挂载对象。"
      />
      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <AppWindow size={14} className="text-primary" /> 应用注册管理
          </span>
        }
      extra={
        <div className="flex items-center gap-2">
          <span className="num text-xs text-text-secondary">{apps.length} 个应用 · {apps.filter((a) => a.status === 'ACTIVE').length} 在用</span>
          <button disabled={readOnly} onClick={() => setDialog({ data: null })} className={`flex items-center gap-1 ${BTN_PRIMARY}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
            <Plus size={12} /> 注册应用
          </button>
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">应用</th>
            <th className="pb-2 font-medium">部门</th>
            <th className="pb-2 font-medium">业务场景</th>
            <th className="pb-2 font-medium">数据等级</th>
            <th className="pb-2 font-medium">SLA</th>
            <th className="pb-2 font-medium">Token 额度</th>
            <th className="pb-2 font-medium">成本预算</th>
            <th className="pb-2 font-medium">状态</th>
            <th className="pb-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.appId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
              <td className="py-2">
                <span className="text-text-primary">{a.appName}</span>
                <span className="ml-1.5 font-mono text-[10px] text-text-secondary">{a.appId}</span>
              </td>
              <td className="py-2 text-xs text-text-secondary">{DEPTS.find((d) => d.value === a.deptId)?.label ?? a.deptId}</td>
              <td className="py-2 text-xs text-text-secondary">{a.businessScenario}</td>
              <td className="py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${a.dataLevel === 'L3' ? 'bg-danger/10 text-danger' : a.dataLevel === 'L2' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>{a.dataLevel}</span></td>
              <td className="num py-2">{a.slaLevel}</td>
              <td className="num py-2 text-xs">{(a.quotaToken / 10000).toLocaleString()} 万</td>
              <td className="num py-2 text-xs">¥{a.costBudget.toLocaleString()}/月</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={a.status === 'ACTIVE'}
                    title={a.status === 'ACTIVE' ? '停用（路由不再分发）' : '启用'}
                    onChange={async () => {
                      await api.toggleApp(a.appId);
                      notify.success(`应用「${a.appName}」已${a.status === 'ACTIVE' ? '停用' : '启用'}`);
                      reload();
                    }}
                  />
                  <StatusTag status={a.status} ns="App" size="sm" />
                </div>
              </td>
              <td className="py-2">
                <div className="flex items-center justify-end gap-1">
                  <button disabled={readOnly} onClick={() => setDialog({ data: a })} className="rounded p-1 text-text-secondary hover:text-primary disabled:opacity-40" title="编辑">
                    <Pencil size={13} />
                  </button>
                  <button disabled={readOnly} onClick={() => setDeleteTarget(a)} className="rounded p-1 text-text-secondary hover:text-danger disabled:opacity-40" title="注销应用">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-secondary/70">口径：应用是路由策略、限流规则、配额与计量的挂载对象；停用后网关不再分发流量，历史账单保留。与 IAM 统一身份对接。</p>

      {dialog && <AppDialog initial={dialog.data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}

      <ConfirmDialog
        open={!!deleteTarget}
        level="danger"
        title="注销应用"
        confirmWord={deleteTarget?.appName}
        message={<>注销 <b>{deleteTarget?.appName}</b> 后：关联 API Key 全部禁用、配额回收、路由规则失效；历史计量与账单保留可审计。</>}
        confirmText="确认注销"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteApp(deleteTarget.appId);
          notify.success(`应用「${deleteTarget.appName}」已注销`);
          setDeleteTarget(null);
          reload();
        }}
      />
      </Panel>
    </div>
  );
}

function AppDialog({ initial, onClose, onSaved }: { initial: ApplicationRegistry | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [name, setName] = useState(initial?.appName ?? '');
  const [deptId, setDeptId] = useState(initial?.deptId ?? 'DEPT-TECH');
  const [owner, setOwner] = useState(initial?.owner ?? '');
  const [scenario, setScenario] = useState(initial?.businessScenario ?? '客户服务');
  const [dataLevel, setDataLevel] = useState<ApplicationRegistry['dataLevel']>(initial?.dataLevel ?? 'L2');
  const [slaLevel, setSlaLevel] = useState<ApplicationRegistry['slaLevel']>(initial?.slaLevel ?? 'P1');
  const [quotaToken, setQuotaToken] = useState(String(initial ? initial.quotaToken / 10000 : 1000));
  const [budget, setBudget] = useState(String(initial?.costBudget ?? 10000));

  const nameOk = name.trim().length >= 2 && name.trim().length <= 30;
  const numOk = (s: string) => /^\d+$/.test(s) && Number(s) > 0;
  const invalid = !nameOk || !owner.trim() || !numOk(quotaToken) || !numOk(budget);

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={initial ? `编辑应用 · ${initial.appName}` : '注册应用'}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>取消</button>
          <button
            disabled={invalid}
            onClick={async () => {
              await api.saveApp({
                appId: initial?.appId ?? '',
                appName: name.trim(),
                deptId,
                owner: owner.trim(),
                businessScenario: scenario,
                dataLevel,
                slaLevel,
                quotaToken: Number(quotaToken) * 10000,
                quotaRequest: initial?.quotaRequest ?? 1000000,
                costBudget: Number(budget),
                status: initial?.status ?? 'ACTIVE',
              });
              notify.success(`应用「${name.trim()}」已${initial ? '保存' : '注册'}`);
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="应用名称" required error={name && !nameOk ? '2~30 字' : ''}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="如：智能客服" />
          </Field>
          <Field label="责任部门" required>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={SELECT_CLS}>
              {DEPTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="负责人" required>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={INPUT_CLS} placeholder="如：零售银行总部" />
          </Field>
          <Field label="业务场景" required>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className={SELECT_CLS}>
              {SCENARIOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="数据安全等级" required hint="决定护栏策略强度">
            <select value={dataLevel} onChange={(e) => setDataLevel(e.target.value as ApplicationRegistry['dataLevel'])} className={SELECT_CLS}>
              {['L1', 'L2', 'L3', 'L4'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="SLA 等级" required>
            <select value={slaLevel} onChange={(e) => setSlaLevel(e.target.value as ApplicationRegistry['slaLevel'])} className={SELECT_CLS}>
              {['P0', 'P1', 'P2', 'P3'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Token 额度（万/月）" required error={quotaToken && !numOk(quotaToken) ? '需为正整数' : ''}>
            <input value={quotaToken} onChange={(e) => setQuotaToken(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
          <Field label="成本预算（元/月）" required error={budget && !numOk(budget) ? '需为正整数' : ''}>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
