import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, Loader2 } from 'lucide-react';
import logoUrl from '../assets/logo.png';

/**
 * M11 星舰 Copilot（P28：AI 原生交互）
 * 一句话查询用量 / 跳转处置告警 / 打开配置页；本地意图解析（无需后端）。
 * 回复口径与各页种子数据一致（月度账单 ¥1,926 万 / 今日成本 ¥68.4 万 / 路由节省 ¥274 万等）。
 */

interface AgentMsg {
  role: 'user' | 'agent';
  text: string;
}

const QUICK = ['查零售部本月用量', '今日有几条告警', '打开护栏规则', '语义路由省了多少钱', '本月账单多少钱', 'K8s Pod 状态如何', '今天拦截了多少次', '平台组件健康吗'];

export default function GatewayAgent() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<AgentMsg[]>([
    { role: 'agent', text: '你好，我是星舰 Copilot。可以问我：部门用量、本月账单、K8s 状态、告警拦截，或让我带你打开配置页面。' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const reply = (text: string) => {
    setMsgs((m) => [...m, { role: 'agent', text }]);
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
  };

  const handle = async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setThinking(true);
    await new Promise((r) => setTimeout(r, 700));
    setThinking(false);

    const lower = q.toLowerCase();
    if (/零售/.test(q)) {
      reply('零售银行总部本月已用 7,840 万 Token（配额 9,000 万，87%，已触发预警）；本月费用 ¥82,400。正在为你打开配额页…');
      setTimeout(() => navigate('/metering?tab=quota'), 900);
    } else if (/风控|风险管理/.test(q)) {
      reply('风险管理部本月已用 3,300 万 Token，超出配额 3,000 万，已触发超限停发；可在配额页提交恢复申请。正在打开…');
      setTimeout(() => navigate('/metering?tab=quota'), 900);
    } else if (/科技部|信息科技/.test(q)) {
      reply('信息科技部本月已用 9,500 万 Token（配额 3 亿，32%），状态正常，费用 ¥102,800。');
    } else if (/告警|报警/.test(q)) {
      reply('当前待处置告警 3 条（1 条 CRITICAL：智能客服触发 Token 限流）。正在打开安全审计页…');
      setTimeout(() => navigate('/security'), 900);
    } else if (/护栏|安全策略/.test(q)) {
      reply('护栏规则入口在 安全审计 → 护栏规则（接入 / 安全策略 / 检测资源）。正在打开…');
      setTimeout(() => navigate('/security?tab=guardrail&gview=policy'), 900);
    } else if (/配额|额度/.test(q)) {
      reply('6 个业务组中：1 个已停发（风险管理部）、1 个预警（零售银行总部）、4 个正常。正在打开配额页…');
      setTimeout(() => navigate('/metering?tab=quota'), 900);
    } else if (/省|节省|成本/.test(q)) {
      reply('本月语义路由节省 ¥274 万（-42.7%）：若全部使用旗舰模型费用约 ¥642 万。详见 计量运营 → 模型统计。');
      setTimeout(() => navigate('/metering?tab=stats'), 1200);
    } else if (/key|密钥/.test(lower)) {
      reply('密钥管理入口在 调度算力 → 流量管控 → 密钥管理（共 6 个密钥，5 个启用）。正在打开…');
      setTimeout(() => navigate('/routing?tab=traffic&tview=key'), 900);
    } else if (/灰度|发布/.test(q)) {
      reply('当前 2 个灰度任务进行中：Fin-Qwen-14B-SFT v3.2（A/B 对照阶段）、Fin-Qwen-14B-INT4 v1.0（5% 切流）。正在打开…');
      setTimeout(() => navigate('/assets?tab=release'), 900);
    } else if (/接入|广场/.test(q)) {
      reply('模型接入与模型广场入口在 模型资产 页。正在打开模型广场…');
      setTimeout(() => navigate('/assets?tab=plaza'), 900);
    } else if (/限流/.test(q)) {
      reply('当前 5 条限流规则（4 条启用），近 24h 总命中 673 次。正在打开限流策略…');
      setTimeout(() => navigate('/routing?tab=traffic&tview=limit'), 900);
    } else if (/账单|花了多少/.test(q)) {
      reply('7 月全行账单合计 ¥1,926 万（环比 +8.6%）；今日累计成本 ¥68.4 万（当日预算 ¥75 万）。正在打开月度账单…');
      setTimeout(() => navigate('/metering?tab=billing'), 900);
    } else if (/k8s|pod|容器|集群/.test(lower)) {
      reply('3 个集群共 142 节点：生产 GPU 120 卡（已分配 104）、国产化 22 卡；8 个推理服务共 30 副本，7 个运行中、1 个待调度（SDXL-金融海报）。正在打开算力总览…');
      setTimeout(() => navigate('/routing?view=compute'), 900);
    } else if (/拦截|阻断/.test(q)) {
      reply('近 24h 全行：限流命中 673 次、护栏阻断 9 次（拦截后不再派发），漏斗口径与路由总览一致。正在打开安全审计…');
      setTimeout(() => navigate('/security'), 900);
    } else if (/健康|组件|监控/.test(q)) {
      reply('平台 6 大组件：智能网关集群（3 副本）、注册中心、计量引擎、审计存储、K8s 控制面均正常；优先级队列降级中（时延 46ms，队列积压偏高）。正在打开平台监控…');
      setTimeout(() => navigate('/system?tab=monitor'), 900);
    } else if (/权重|路由引擎/.test(q)) {
      reply('多约束路由引擎当前权重：时延 30 / 成本 25 / 风险 25 / 负载 20，缓存优先 + 预算守护已开启。正在打开路由总览…');
      setTimeout(() => navigate('/routing'), 900);
    } else {
      reply('抱歉，我暂时没理解。试试问我：「本月账单多少钱」「K8s Pod 状态如何」「今天拦截了多少次」。');
    }
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-float hover-lift fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-primary/40 py-1.5 pl-2 pr-4 text-sm font-medium text-text-primary transition-all hover:border-primary/70"
        title="星舰 Copilot"
      >
        <span className="relative shrink-0">
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg" />
          {/* 在线呼吸点：保持入口醒目但不靠重底色 */}
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-success ring-2 ring-white" aria-hidden />
        </span>
        星舰 Copilot
      </button>
    );
  }

  return (
    <div className="glass-float fixed bottom-5 right-5 z-40 flex h-[460px] w-[380px] flex-col overflow-hidden rounded-xl border border-border-default shadow-2xl">
      <header className="flex items-center justify-between border-b border-border-default px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <img src={logoUrl} alt="" className="h-5 w-5 rounded" /> 星舰 Copilot
          <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">在线</span>
        </span>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-text-secondary hover:text-text-primary" aria-label="关闭">
          <X size={15} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-auto p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                m.role === 'user' ? 'bg-primary/15 text-text-primary' : 'border border-border-default bg-panel-soft text-text-secondary'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Loader2 size={12} className="animate-spin" /> 思考中…
          </div>
        )}
      </div>

      <div className="border-t border-border-default p-2.5">
        <div className="mb-2 flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <button key={q} onClick={() => handle(q)} className="rounded border border-border-default px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-primary/40 hover:text-primary">
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle(input)}
            placeholder="一句话查询用量 / 账单 / 平台状态…"
            className="flex-1 rounded border border-border-default bg-bg-page px-2.5 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/50 focus:border-primary/60"
          />
          <button onClick={() => handle(input)} className="rounded border border-primary/40 bg-primary/10 px-2.5 text-primary transition-colors hover:bg-primary/20" aria-label="发送">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
