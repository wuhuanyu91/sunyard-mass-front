import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import type { BenefitSuggestion, ModelAsset, ModelBenefit } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { Segmented } from '../../components/ui/Controls';

const SUGGEST_LABEL: Record<BenefitSuggestion, { label: string; cls: string }> = {
  KEEP: { label: '保留', cls: 'bg-success/10 text-success' },
  OPTIMIZE: { label: '建议优化', cls: 'bg-warning/10 text-warning' },
  REPLACE: { label: '建议替换', cls: 'bg-danger/10 text-danger' },
  ARCHIVE: { label: '建议归档', cls: 'bg-border-default/40 text-text-secondary' },
};
const SCORE_COLOR: Record<string, string> = { A: 'text-success', B: 'text-primary', C: 'text-warning', D: 'text-danger' };

/** 十章：模型效益评估（综合调用量/活跃应用/用户规模/任务效果/成本，为保留/升级/替换/下线提供依据） */
export default function BenefitPanel() {
  const [benefits, setBenefits] = useState<ModelBenefit[]>([]);
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    Promise.all([api.getModelBenefits(), api.getAssets()]).then(([b, a]) => {
      setBenefits(b);
      setAssets(a);
    });
  }, []);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.assetId, a.assetName])), [assets]);
  const rows = useMemo(() => {
    const list = [...benefits].sort((a, b) => (a.valueScore < b.valueScore ? -1 : a.valueScore > b.valueScore ? 1 : b.unitCost - a.unitCost));
    return filter === 'NEED_ACTION' ? list.filter((b) => b.suggestion === 'OPTIMIZE' || b.suggestion === 'REPLACE') : list;
  }, [benefits, filter]);

  const agg = useMemo(() => {
    const totalCost = benefits.reduce((s, b) => s + b.monthCost, 0);
    const avgAdopt = benefits.length ? Math.round(benefits.reduce((s, b) => s + b.adoptRate, 0) / benefits.length) : 0;
    const needAction = benefits.filter((b) => b.suggestion === 'OPTIMIZE' || b.suggestion === 'REPLACE').length;
    return { totalCost, avgAdopt, needAction };
  }, [benefits]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="效益评估" desc="基于调用量/成本/效果综合评估模型价值，为保留/升级/替换/下线提供决策依据" />
      {/* 口径说明（十章：效益 = 成本 + 效果 + 价值综合判断） */}
      <div className="panel flex items-center gap-2 px-4 py-2.5 text-xs">
        <BarChart3 size={13} className="shrink-0 text-primary" />
        <span className="text-text-secondary">评估说明：月度调用/成本与「模型统计」同源；活跃应用与用户规模来自计量回流；任务效果采纳率由应用侧回传；建议供模型治理委员会决策，不自动执行。</span>
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">纳入评估模型</div>
          <div className="num mt-1.5 text-2xl font-semibold text-text-primary">{benefits.length}<span className="text-sm text-text-secondary"> 个</span></div>
        </div>
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">月度成本合计</div>
          <div className="num mt-1.5 text-2xl font-semibold text-primary">¥{agg.totalCost.toLocaleString('zh-CN')}</div>
        </div>
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">平均任务采纳率</div>
          <div className="num mt-1.5 text-2xl font-semibold text-success">{agg.avgAdopt}<span className="text-sm text-text-secondary">%</span></div>
        </div>
        <div className="panel p-3">
          <div className="text-xs text-text-secondary">需治理（优化/替换）</div>
          <div className="num mt-1.5 text-2xl font-semibold text-warning">{agg.needAction}<span className="text-sm text-text-secondary"> 个</span></div>
        </div>
      </div>

      <Panel
        title="模型效益矩阵（月度）"
        extra={
          <Segmented
            options={[{ value: 'ALL', label: '全部' }, { value: 'NEED_ACTION', label: '需治理' }]}
            value={filter}
            onChange={setFilter}
          />
        }
      >
        <div className="overflow-auto pr-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="pb-2 font-medium">模型</th>
                <th className="pb-2 font-medium">活跃应用</th>
                <th className="pb-2 font-medium">用户规模</th>
                <th className="pb-2 font-medium">月成本</th>
                <th className="pb-2 font-medium">单位任务成本</th>
                <th className="pb-2 font-medium">采纳率</th>
                <th className="pb-2 font-medium">成功率</th>
                <th className="pb-2 font-medium">价值分</th>
                <th className="pb-2 font-medium">治理建议</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.assetId} className="border-t border-border-default/60 text-text-primary">
                  <td className="py-2 pr-3">{byId[b.assetId] ?? b.assetId}</td>
                  <td className="py-2 pr-3 num">{b.activeApps} 个</td>
                  <td className="py-2 pr-3 num">{b.userScale} 人</td>
                  <td className="py-2 pr-3 num">¥{b.monthCost.toLocaleString('zh-CN')}</td>
                  <td className="py-2 pr-3 num">{b.unitCost} 元/千次</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-border-default/40">
                        <span className={`block h-full rounded-full ${b.adoptRate >= 80 ? 'bg-success' : b.adoptRate >= 65 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${b.adoptRate}%` }} />
                      </span>
                      <span className="num">{b.adoptRate}%</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 num">{b.successRate}%</td>
                  <td className={`py-2 pr-3 num font-semibold ${SCORE_COLOR[b.valueScore]}`}>{b.valueScore}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${SUGGEST_LABEL[b.suggestion].cls}`}>{SUGGEST_LABEL[b.suggestion].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-text-secondary/70">
          <Sparkles size={11} className="text-primary" />
          解读示例：Qwen-72B 单位任务成本 467 元/千次、采纳率 68% → 建议优化（长上下文复杂推理场景才用旗舰）；第三方营销模型采纳率 61% → 建议替换为 Fin-Qwen-14B-SFT 或自研文案模型。
        </p>
      </Panel>
  );
}
