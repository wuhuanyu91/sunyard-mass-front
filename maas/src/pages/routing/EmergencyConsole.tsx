import { useEffect, useState } from 'react';
import { Gauge, ArrowLeftRight, PowerOff, RotateCcw, Siren, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ApplicationRegistry, EmergencyTicket, ModelAsset } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import StatusTag from '../../components/ui/StatusTag';
import { ConfirmDialog, BTN_PRIMARY, BTN_GHOST, BTN_DANGER } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Controls';
import { ProgressBar } from '../../components/ui/Bits';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

/** M3 应急操作台（P11：灰度降级 / 流量切备 / 关停非核心） */
export default function EmergencyConsole() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const [tickets, setTickets] = useState<EmergencyTicket[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [apps, setApps] = useState<ApplicationRegistry[]>([]);
  const [loading, setLoading] = useState(true);

  /* 灰度降级参数 */
  const [degScene, setDegScene] = useState('客服问答');
  const [degRatio, setDegRatio] = useState('30');
  const [degModel, setDegModel] = useState('');
  /* 流量切备参数 */
  const [swScene, setSwScene] = useState('复杂推理聚合组');
  const [swPool, setSwPool] = useState('POOL-4090');
  /* 关停非核心参数 */
  const [stopApps, setStopApps] = useState<string[]>([]);

  /* 执行态 */
  const [executing, setExecuting] = useState<EmergencyTicket['type'] | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<{ type: EmergencyTicket['type']; summary: string } | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<EmergencyTicket | null>(null);

  useEffect(() => {
    Promise.all([api.getEmergencyTickets(), api.getAssets(), api.getApps()]).then(([t, a, ap]) => {
      setTickets(t);
      setAssets(a);
      setApps(ap);
      setDegModel(a[5]?.assetId ?? '');
      setLoading(false);
    });
  }, []);

  const nonCoreApps = apps.filter((a) => a.slaLevel === 'P2');

  const exec = async (type: EmergencyTicket['type'], target: string, params: string) => {
    setExecuting(type);
    // 进度条模拟
    setProgress((p) => ({ ...p, [type]: 8 }));
    const timer = setInterval(() => setProgress((p) => ({ ...p, [type]: Math.min(92, (p[type] ?? 0) + 14) })), 180);
    const t = await api.execEmergency(type, target, params);
    clearInterval(timer);
    setProgress((p) => ({ ...p, [type]: 100 }));
    setTimeout(() => {
      setExecuting(null);
      setProgress((p) => ({ ...p, [type]: 0 }));
    }, 600);
    notify.success(`应急工单 ${t.ticketId} 已生效（${target}），已广播至运营控制台`);
    api.getEmergencyTickets().then(setTickets);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel h-52 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mock-data flex flex-col gap-3">
      <PageHeader crumb="调度算力" title="应急操作" desc="灰度降级/流量切备/关停非核心三类应急操作，执行均生成工单并支持一键回滚" />
      <div className="grid grid-cols-3 gap-3">
        {/* -------- 灰度降级 -------- */}
        <div className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded border border-warning/40 bg-warning/10 text-warning"><Gauge size={16} /></span>
            灰度降级
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">将指定场景的部分流量切换到备选低成本模型，缓解高峰压力。</p>
          <div className="space-y-2 text-xs">
            <label className="block text-text-secondary">业务场景</label>
            <select value={degScene} onChange={(e) => setDegScene(e.target.value)} className="w-full rounded border border-border-default bg-bg-page px-2 py-1.5 text-text-primary">
              {['客服问答', '信贷审批', '营销触达', '风控反欺诈'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="block text-text-secondary">降级比例</label>
            <Segmented
              options={[
                { value: '10', label: '10%' },
                { value: '30', label: '30%' },
                { value: '50', label: '50%' },
              ]}
              value={degRatio}
              onChange={setDegRatio}
            />
            <label className="block text-text-secondary">目标备选模型</label>
            <select value={degModel} onChange={(e) => setDegModel(e.target.value)} className="w-full rounded border border-border-default bg-bg-page px-2 py-1.5 text-text-primary">
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>{a.assetName}（¥{a.costPer1kTokens}/K）</option>
              ))}
            </select>
          </div>
          {(progress.GRAY_DEGRADE ?? 0) > 0 && <ProgressBar pct={progress.GRAY_DEGRADE} />}
          <button
            disabled={readOnly || executing !== null || !degModel}
            onClick={() => setConfirm({ type: 'GRAY_DEGRADE', summary: `场景「${degScene}」${degRatio}% 流量降级至 ${assets.find((a) => a.assetId === degModel)?.assetName}` })}
            className={`mt-auto flex items-center justify-center gap-1.5 ${BTN_PRIMARY}`}
            title={readOnly ? '只读模式下写操作已禁用' : ''}
          >
            {executing === 'GRAY_DEGRADE' ? <Loader2 size={13} className="animate-spin" /> : <Gauge size={13} />} 执行降级
          </button>
        </div>

        {/* -------- 流量切备 -------- */}
        <div className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded border border-primary/40 bg-primary/10 text-primary"><ArrowLeftRight size={16} /></span>
            流量切备
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">将聚合组流量整体切换到备用资源池，规避故障池风险。</p>
          <div className="space-y-2 text-xs">
            <label className="block text-text-secondary">切换对象</label>
            <select value={swScene} onChange={(e) => setSwScene(e.target.value)} className="w-full rounded border border-border-default bg-bg-page px-2 py-1.5 text-text-primary">
              {['客服问答聚合组', '复杂推理聚合组'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="block text-text-secondary">目标备用池</label>
            <select value={swPool} onChange={(e) => setSwPool(e.target.value)} className="w-full rounded border border-border-default bg-bg-page px-2 py-1.5 text-text-primary">
              <option value="POOL-4090">4090 开发池</option>
              <option value="POOL-RENTAL">外部租赁池</option>
              <option value="CLOUD">云端备用</option>
            </select>
            <p className="rounded border border-border-default bg-panel-soft px-2 py-1.5 text-text-secondary">切流过程不中断在途请求，预计 30 秒内完成 100% 切换。</p>
          </div>
          {(progress.SWITCH_BACKUP ?? 0) > 0 && <ProgressBar pct={progress.SWITCH_BACKUP} />}
          <button
            disabled={readOnly || executing !== null}
            onClick={() => setConfirm({ type: 'SWITCH_BACKUP', summary: `「${swScene}」切备至 ${swPool === 'POOL-4090' ? '4090 开发池' : swPool === 'POOL-RENTAL' ? '外部租赁池' : '云端备用'}` })}
            className={`mt-auto flex items-center justify-center gap-1.5 ${BTN_PRIMARY}`}
            title={readOnly ? '只读模式下写操作已禁用' : ''}
          >
            {executing === 'SWITCH_BACKUP' ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />} 一键切备
          </button>
        </div>

        {/* -------- 关停非核心 -------- */}
        <div className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded border border-danger/40 bg-danger/10 text-danger"><PowerOff size={16} /></span>
            关停非核心应用
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">极端容量压力下，一键停发非核心应用（配额置 0 + Key 禁用联动）。</p>
          <div className="max-h-32 space-y-1.5 overflow-auto rounded border border-border-default bg-bg-page p-2 text-xs">
            {nonCoreApps.map((a) => (
              <label key={a.appId} className="flex cursor-pointer items-center gap-1.5 text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={stopApps.includes(a.appId)}
                  onChange={(e) => setStopApps(e.target.checked ? [...stopApps, a.appId] : stopApps.filter((x) => x !== a.appId))}
                  className="accent-[#ef4444]"
                />
                {a.appName}
                <span className="ml-auto font-mono text-[10px] text-text-secondary/60">{a.appId} · {a.slaLevel}</span>
              </label>
            ))}
          </div>
          {stopApps.length > 0 && (
            <p className="rounded border border-danger/30 bg-danger/5 px-2 py-1.5 text-[11px] text-danger">
              联动影响：将置 0 配额 {stopApps.length} 个、禁用关联 API Key {stopApps.length + 1} 个
            </p>
          )}
          {(progress.STOP_NONCORE ?? 0) > 0 && <ProgressBar pct={progress.STOP_NONCORE} tone="danger" />}
          <button
            disabled={readOnly || executing !== null || stopApps.length === 0}
            onClick={() => setConfirm({ type: 'STOP_NONCORE', summary: `停发 ${stopApps.length} 个非核心应用（${stopApps.map((id) => apps.find((a) => a.appId === id)?.appName).join('、')}）` })}
            className={`mt-auto flex items-center justify-center gap-1.5 ${BTN_DANGER}`}
            title={readOnly ? '只读模式下写操作已禁用' : ''}
          >
            {executing === 'STOP_NONCORE' ? <Loader2 size={13} className="animate-spin" /> : <PowerOff size={13} />} 执行关停
          </button>
        </div>
      </div>

      {/* -------- 应急工单记录 -------- */}
      <Panel title="应急工单记录" extra={<span className="num text-xs text-text-secondary">{tickets.length} 条</span>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-secondary">
              <th className="pb-2 font-medium">工单号</th>
              <th className="pb-2 font-medium">类型</th>
              <th className="pb-2 font-medium">对象</th>
              <th className="pb-2 font-medium">参数</th>
              <th className="pb-2 font-medium">执行人</th>
              <th className="pb-2 font-medium">时间</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.ticketId} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
                <td className="py-2 font-mono text-xs text-primary">{t.ticketId}</td>
                <td className="py-2 text-xs text-text-secondary">
                  {t.type === 'GRAY_DEGRADE' ? (
                    <span className="flex items-center gap-1"><Gauge size={12} className="text-warning" /> 灰度降级</span>
                  ) : t.type === 'SWITCH_BACKUP' ? (
                    <span className="flex items-center gap-1"><ArrowLeftRight size={12} className="text-primary" /> 流量切备</span>
                  ) : (
                    <span className="flex items-center gap-1"><PowerOff size={12} className="text-danger" /> 关停非核心</span>
                  )}
                </td>
                <td className="py-2 text-text-primary">{t.target}</td>
                <td className="py-2 text-xs text-text-secondary">{t.params}</td>
                <td className="py-2 text-xs text-text-secondary">{t.operator}</td>
                <td className="num py-2 text-xs text-text-secondary">
                  {new Date(t.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-2">
                  <StatusTag status={t.status} ns="Emergency" size="sm" />
                </td>
                <td className="py-2 text-right">
                  {t.status === 'ACTIVE' && (
                    <button disabled={readOnly} onClick={() => setRollbackTarget(t)} className={`inline-flex items-center gap-1 ${BTN_GHOST}`} title={readOnly ? '只读模式下写操作已禁用' : ''}>
                      <RotateCcw size={12} /> 回滚
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* -------- 确认弹窗 -------- */}
      <ConfirmDialog
        open={!!confirm}
        level={confirm?.type === 'STOP_NONCORE' ? 'danger' : 'warning'}
        title={confirm?.type === 'STOP_NONCORE' ? '关停非核心应用' : '执行应急操作'}
        message={
          <>
            <Siren size={14} className="mb-1 inline text-warning" /> {confirm?.summary}。执行后立即生效并广播至运营控制台，全程留痕。
          </>
        }
        confirmText="立即执行"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          const { type, summary } = confirm;
          setConfirm(null);
          const target = type === 'GRAY_DEGRADE' ? degScene : type === 'SWITCH_BACKUP' ? swScene : `${stopApps.length} 个应用`;
          await exec(type, target, summary);
        }}
      />

      <ConfirmDialog
        open={!!rollbackTarget}
        level="warning"
        title="回滚应急操作"
        message={<>将回滚工单 <b className="font-mono">{rollbackTarget?.ticketId}</b>（{rollbackTarget?.target}），流量与配额恢复常态。</>}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={async () => {
          if (!rollbackTarget) return;
          await api.rollbackEmergency(rollbackTarget.ticketId);
          notify.success(`工单 ${rollbackTarget.ticketId} 已回滚`);
          setRollbackTarget(null);
          api.getEmergencyTickets().then(setTickets);
        }}
      />
    </div>
  );
}
