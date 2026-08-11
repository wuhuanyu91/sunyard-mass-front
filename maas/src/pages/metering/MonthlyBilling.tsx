import { useEffect, useMemo, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { api } from '../../services/api';
import type { MonthlyBill } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { BTN_PRIMARY } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const fmtYuan = (n: number) => `¥${fmt(Math.round(n))}`;
const fmtWanTok = (n: number) => (n >= 100_000_000 ? `${(n / 100_000_000).toFixed(2)} 亿` : `${(n / 10_000).toFixed(0)} 万`);

/** P1-11 月度账单中心（P24：月度账单汇总 + 环比 + 导出） */
export default function MonthlyBilling() {
  const notify = useNotify();
  const [bills, setBills] = useState<MonthlyBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('2026-08');

  useEffect(() => {
    api.getMonthlyBills().then((b) => {
      setBills(b);
      setLoading(false);
    });
  }, []);

  const months = useMemo(() => [...new Set(bills.map((b) => b.month))].sort().reverse(), [bills]);
  const rows = useMemo(() => bills.filter((b) => b.month === month).sort((a, b) => b.cost - a.cost), [bills, month]);
  const total = useMemo(() => rows.reduce((s, b) => ({ tokens: s.tokens + b.tokens, calls: s.calls + b.calls, cost: s.cost + b.cost }), { tokens: 0, calls: 0, cost: 0 }), [rows]);

  const exportCsv = () => {
    const head = '月份,部门,Token用量,调用次数,费用(元),环比%';
    const lines = rows.map((b) => [b.month, b.deptName, b.tokens, b.calls, b.cost, b.mom].join(','));
    const blob = new Blob(['\uFEFF' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maas-bill-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(`${month} 月度账单已导出（已脱敏，不含个人级明细）`);
  };

  if (loading) return <div className="panel h-72 animate-pulse" />;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        crumb="计量运营"
        title="月度账单"
        desc="按部门汇总月度账单、环比与 CSV 导出；成本口径按 TCO 四类分摊。"
      />
      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <Receipt size={14} className="text-primary" /> 月度账单中心
          </span>
        }
      extra={
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-border-default bg-bg-page px-2 py-1.5 text-xs text-text-primary">
            {months.map((m) => (
              <option key={m} value={m}>{m}{m === '2026-08' ? '（本月至今）' : ''}</option>
            ))}
          </select>
          <button onClick={exportCsv} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
            <Download size={12} /> 导出月度账单
          </button>
        </div>
      }
    >
      {/* 汇总卡 */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <div className="rounded border border-border-default bg-panel-soft p-3">
          <div className="text-xs text-text-secondary">当月 Token 总量</div>
          <div className="num mt-1 text-xl font-semibold text-text-primary">{fmtWanTok(total.tokens)}</div>
        </div>
        <div className="rounded border border-border-default bg-panel-soft p-3">
          <div className="text-xs text-text-secondary">当月调用次数</div>
          <div className="num mt-1 text-xl font-semibold text-text-primary">{fmt(total.calls)}</div>
        </div>
        <div className="rounded border border-border-default bg-panel-soft p-3">
          <div className="text-xs text-text-secondary">当月 TCO 合计</div>
          <div className="num mt-1 text-xl font-semibold text-warning">{fmtYuan(total.cost)}</div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">部门</th>
            <th className="pb-2 font-medium">Token 用量</th>
            <th className="pb-2 font-medium">调用次数</th>
            <th className="pb-2 font-medium">费用（TCO 分摊）</th>
            <th className="pb-2 font-medium">费用占比</th>
            <th className="pb-2 font-medium">环比</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={`${b.month}-${b.deptId}`} className="border-b border-border-default/40 last:border-0 hover:bg-panel-soft">
              <td className="py-2 text-text-primary">{b.deptName}</td>
              <td className="num py-2">{fmtWanTok(b.tokens)}</td>
              <td className="num py-2 text-text-secondary">{fmt(b.calls)}</td>
              <td className="num py-2 font-medium">{fmtYuan(b.cost)}</td>
              <td className="num py-2 text-xs text-text-secondary">{total.cost ? ((b.cost / total.cost) * 100).toFixed(1) : 0}%</td>
              <td className="num py-2">
                <span className={b.mom >= 0 ? 'text-warning' : 'text-success'}>{b.mom >= 0 ? '▲' : '▼'} {Math.abs(b.mom)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-text-secondary/70">TCO 四类成本分摊（基础设施/推理计算/软件许可/外部调用），财务口径由管理部门确认；环比按上月同期同部门比较。支持按月导出 CSV 供财务结算。</p>
      </Panel>
    </div>
  );
}
