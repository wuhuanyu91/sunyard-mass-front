import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Zap, ArrowLeftRight, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import type { ModelAsset } from '../../types';
import Panel from '../../components/ui/Panel';
import PageHeader from '../../components/ui/PageHeader';
import { Segmented, Slider } from '../../components/ui/Controls';
import { BTN_PRIMARY, BTN_GHOST } from '../../components/ui/Modal';
import { useNotify } from '../../components/ui/Toast';
import { useApp } from '../../store/app';

const PRESET_PROMPTS = [
  '请为个人消费贷款写一段 100 字的风险提示话术',
  '把以下客户投诉内容归纳为 3 个要点并给出处理建议',
  '用金融专业语言解释什么是 LPR 定价机制',
  '生成一条面向年轻客群的信用卡营销文案（合规口径）',
];

/** 按模型能力档位生成不同风格回复文本 */
function mockReply(model: ModelAsset, prompt: string): string {
  const tier = model.costPer1kTokens >= 0.8 ? 'large' : model.costPer1kTokens >= 0.2 ? 'mid' : 'small';
  if (tier === 'large') {
    return `【${model.assetName}】针对您的请求：「${prompt.slice(0, 28)}…」\n\n结论要点：\n1. 该请求涉及信贷业务合规表述，需同步引用监管口径；\n2. 建议先校验客户身份与授权链路，再输出业务结论；\n3. 已结合本行风控语料微调，术语与行内规范一致。\n\n（72B 级模型：推理深度高、成本较高，适合复杂推理与长文档场景）`;
  }
  if (tier === 'mid') {
    return `【${model.assetName}】已处理：「${prompt.slice(0, 28)}…」\n\n回复：按行内标准话术模板生成，已规避收益承诺类表述，合规检查通过。\n\n（14B 级模型：成本与效果均衡，适合问答/摘要/分类主力场景）`;
  }
  return `【${model.assetName}】识别意图：${prompt.slice(0, 12)}… → 分类=业务咨询，置信度 0.97。（小模型：毫秒级响应，适合前置分流与确定性计算）`;
}

interface RunState {
  text: string;
  running: boolean;
  done: boolean;
  elapsedMs: number;
  outTokens: number;
}

/** P0-1 模型体验 Playground（先体验后接入，支持双模型同屏对比） */
export default function Playground() {
  const { readOnly } = useApp();
  const notify = useNotify();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ModelAsset[] | null>(null);
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [modelA, setModelA] = useState('AST-QWEN-72B-BASE');
  const [modelB, setModelB] = useState('AST-QWEN-14B-BASE');
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [runA, setRunA] = useState<RunState | null>(null);
  const [runB, setRunB] = useState<RunState | null>(null);
  const timers = useRef<number[]>([]);

  useMemo(() => {
    api.getAssets().then(setAssets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textModels = useMemo(() => (assets ?? []).filter((a) => a.assetType === 'BASE_LLM' || a.assetType === 'SMALL_LLM'), [assets]);
  const byId = (id: string) => textModels.find((m) => m.assetId === id);

  const stopAll = () => {
    timers.current.forEach((t) => clearInterval(t));
    timers.current = [];
  };

  /** 流式输出（逐字渲染，耗时与模型时延画像挂钩） */
  const stream = (model: ModelAsset, setter: (s: RunState) => void) => {
    const full = mockReply(model, prompt);
    const stepChars = model.costPer1kTokens >= 0.8 ? 2 : 4; // 大模型逐字更慢更真实
    const tickMs = Math.max(18, Math.round(model.avgLatencyMs / 40));
    let i = 0;
    const startAt = Date.now();
    setter({ text: '', running: true, done: false, elapsedMs: 0, outTokens: 0 });
    const t = window.setInterval(() => {
      i = Math.min(full.length, i + stepChars);
      const text = full.slice(0, i);
      setter({ text, running: i < full.length, done: i >= full.length, elapsedMs: Date.now() - startAt, outTokens: Math.round(text.length / 1.6) });
      if (i >= full.length) {
        clearInterval(t);
        timers.current = timers.current.filter((x) => x !== t);
      }
    }, tickMs);
    timers.current.push(t);
  };

  const run = () => {
    if (!prompt.trim()) return;
    stopAll();
    const a = byId(modelA);
    if (a) stream(a, setRunA);
    if (mode === 'compare') {
      const b = byId(modelB);
      if (b) stream(b, setRunB);
    } else {
      setRunB(null);
    }
    notify.info('已发起体验调用（体验链路走试算通道，不计入部门结算）');
  };

  const stop = () => {
    stopAll();
    if (runA?.running) setRunA({ ...runA, running: false, done: true });
    if (runB?.running) setRunB({ ...runB, running: false, done: true });
  };

  const running = !!(runA?.running || runB?.running);

  if (!assets) return <div className="panel h-64 animate-pulse" />;

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-border-default bg-bg-page px-2.5 py-2 text-sm text-text-primary">
      {textModels.map((m) => (
        <option key={m.assetId} value={m.assetId}>
          {m.assetName}（¥{m.costPer1kTokens}/K · P95 {m.avgLatencyMs}ms）
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader crumb="模型资产" title="模型体验" desc="在线试用平台模型，支持单模型与双模型对比，直观比较输出质量与时延/成本" />
      {/* 控制区 */}
      <Panel
        title="模型体验（Playground）"
        extra={
          <div className="flex items-center gap-2">
            <Segmented
              options={[
                { value: 'single', label: '单模型' },
                { value: 'compare', label: '双模型对比' },
              ]}
              value={mode}
              onChange={(v) => setMode(v as 'single' | 'compare')}
            />
            {running ? (
              <button onClick={stop} className={`flex items-center gap-1 ${BTN_GHOST}`}>
                <Square size={12} /> 停止
              </button>
            ) : (
              <button onClick={run} disabled={readOnly || !prompt.trim()} title={readOnly ? '只读模式下体验已禁用' : ''} className={`flex items-center gap-1 ${BTN_PRIMARY}`}>
                <Play size={12} /> 生成
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-2">
            <div className={`grid gap-2 ${mode === 'compare' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>{modelSelect(modelA, setModelA)}</div>
              {mode === 'compare' && <div>{modelSelect(modelB, setModelB)}</div>}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
              placeholder="输入提示词…"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((p) => (
                <button key={p} onClick={() => setPrompt(p)} className="rounded border border-border-default px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-primary/40 hover:text-primary">
                  {p.slice(0, 16)}…
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded border border-border-default bg-panel-soft p-3">
            <div>
              <label className="mb-1 flex justify-between text-xs text-text-secondary">
                <span>Temperature（创造性）</span>
                <span className="num">{temperature.toFixed(1)}</span>
              </label>
              <Slider value={Math.round(temperature * 10)} display={temperature.toFixed(1)} onChange={(v) => setTemperature(v / 10)} min={0} max={20} disabled={readOnly} />
            </div>
            <div>
              <label className="mb-1 flex justify-between text-xs text-text-secondary">
                <span>最大输出 Token</span>
                <span className="num">{maxTokens}</span>
              </label>
              <Slider value={maxTokens} onChange={setMaxTokens} min={128} max={4096} step={128} disabled={readOnly} />
            </div>
            <p className="text-[11px] leading-relaxed text-text-secondary">
              <Sparkles size={11} className="mr-1 inline text-primary" />
              体验调用走沙箱通道，不占用生产配额；满意后可在模型广场发起正式接入申请。
            </p>
          </div>
        </div>
      </Panel>

      {/* 输出区 */}
      <div className={`grid gap-3 ${mode === 'compare' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <OutputCard name={byId(modelA)?.assetName ?? ''} run={runA} asset={byId(modelA)} onApply={() => navigate('/assets?tab=plaza')} />
        {mode === 'compare' && <OutputCard name={byId(modelB)?.assetName ?? ''} run={runB} asset={byId(modelB)} onApply={() => navigate('/assets?tab=plaza')} />}
      </div>

      {/* 对比结论 */}
      {mode === 'compare' && runA?.done && runB?.done && byId(modelA) && byId(modelB) && (
        <Panel title="对比结论（自动评估）">
          <CompareSummary a={byId(modelA)!} b={byId(modelB)!} runA={runA} runB={runB} />
        </Panel>
      )}
    </div>
  );
}

function OutputCard({ name, run, asset, onApply }: { name: string; run: RunState | null; asset?: ModelAsset; onApply: () => void }) {
  return (
    <Panel
      title={name || '模型输出'}
      height={320}
      extra={
        run?.done && asset ? (
          <div className="flex items-center gap-2">
            <span className="num text-[10px] text-text-secondary">
              {run.elapsedMs}ms · 约 {run.outTokens} tokens · ≈¥{((run.outTokens / 1000) * asset.costPer1kTokens * 3).toFixed(2)} 量级
            </span>
            <button onClick={onApply} className={`flex items-center gap-1 ${BTN_GHOST}`}>
              <ArrowLeftRight size={12} /> 去申请接入
            </button>
          </div>
        ) : run?.running ? (
          <span className="flex items-center gap-1 text-[10px] text-primary">
            <Zap size={11} /> 流式生成中…
          </span>
        ) : null
      }
    >
      {run ? (
        <pre className="h-full whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-primary">
          {run.text}
          {run.running && <span className="animate-pulse text-primary">▍</span>}
        </pre>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-text-secondary/60">选择模型并点击「生成」开始体验</div>
      )}
    </Panel>
  );
}

function CompareSummary({ a, b, runA, runB }: { a: ModelAsset; b: ModelAsset; runA: RunState; runB: RunState }) {
  const rows: [string, string, string, 0 | 1 | -1][] = [
    ['响应耗时', `${runA.elapsedMs}ms`, `${runB.elapsedMs}ms`, runA.elapsedMs <= runB.elapsedMs ? 0 : 1],
    ['成本 /1K Token', `¥${a.costPer1kTokens}`, `¥${b.costPer1kTokens}`, a.costPer1kTokens <= b.costPer1kTokens ? 0 : 1],
    ['输出长度', `约 ${runA.outTokens} tokens`, `约 ${runB.outTokens} tokens`, runA.outTokens >= runB.outTokens ? 0 : 1],
  ];
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-xs text-text-secondary">
            <th className="pb-2 font-medium">维度</th>
            <th className="pb-2 font-medium">{a.assetName}</th>
            <th className="pb-2 font-medium">{b.assetName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, va, vb, winner]) => (
            <tr key={label} className="border-b border-border-default/40 last:border-0">
              <td className="py-2 text-text-secondary">{label}</td>
              <td className={`num py-2 ${winner === 0 ? 'font-semibold text-success' : 'text-text-primary'}`}>{va}{winner === 0 && ' ✓'}</td>
              <td className={`num py-2 ${winner === 1 ? 'font-semibold text-success' : 'text-text-primary'}`}>{vb}{winner === 1 && ' ✓'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 rounded border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
        选型建议：质量优先选 {a.costPer1kTokens >= b.costPer1kTokens ? a.assetName : b.assetName}；成本/时延优先选 {a.costPer1kTokens < b.costPer1kTokens ? a.assetName : b.assetName}。正式选型以评测准入结果为准（资产中心 → 评测记录）。
      </p>
    </div>
  );
}
