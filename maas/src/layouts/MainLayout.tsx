import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Boxes,
  ChevronDown,
  Clock,
  Coins,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Moon,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sun,
  UserCircle,
  KeyRound,
  LogOut,
  Snowflake,
  User,
  Lock,
  Loader2,
} from 'lucide-react';
import { useApp } from '../store/app';
import Banner from '../components/ui/Banner';
import GatewayAgent from '../components/GatewayAgent';
import Drawer from '../components/ui/Drawer';
import { Modal, ConfirmDialog, BTN_PRIMARY, BTN_GHOST } from '../components/ui/Modal';
import { useNotify } from '../components/ui/Toast';
import { api } from '../services/api';
import type { ApprovalItem, Announcement } from '../types';
import type { PlatformSummary } from '../services/api';
import logoUrl from '../assets/logo.png';

/** 导航树（管理风：一级可展开，子菜单直达功能页；命名向管理职责靠拢；子项支持二级分组） */
type NavChild = { label: string; to?: string; children?: NavChild[] };
type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  children?: NavChild[];
};

const NAV_TREE: NavGroup[] = [
  {
    label: '运营驾驶舱', icon: LayoutDashboard, path: '/',
    children: [
      { label: '管理驾驶舱', to: '/' },
      { label: '运维大盘', to: '/?view=ops' },
    ],
  },
  {
    label: '调度算力', icon: Gauge, path: '/routing',
    children: [
      { label: '路由总览', to: '/routing' },
      {
        label: '流量管控',
        children: [
          { label: '密钥管理', to: '/routing?tab=traffic&tview=key' },
          { label: '限流策略', to: '/routing?tab=traffic&tview=limit' },
          { label: '场景路由', to: '/routing?tab=traffic&tview=route' },
        ],
      },
      { label: '应急操作', to: '/routing?tab=emergency' },
      { label: '算力总览', to: '/routing?view=compute' },
      { label: '节点管理', to: '/routing?view=nodes' },
      { label: 'K8s 集群', to: '/routing?view=k8s' },
      { label: '队列调度', to: '/routing?view=queue' },
      { label: '资源编排', to: '/routing?view=compute&ctab=orch' },
    ],
  },
  {
    label: '模型资产', icon: Boxes, path: '/assets',
    children: [
      { label: '资产台账', to: '/assets' },
      { label: '模型接入', to: '/assets?tab=conn' },
      { label: '模型广场', to: '/assets?tab=plaza' },
      { label: '模型体验', to: '/assets?tab=playground' },
      { label: '效益评估', to: '/assets?tab=benefit' },
      { label: '发布归档', to: '/assets?tab=release' },
    ],
  },
  {
    label: '计量运营', icon: Coins, path: '/metering',
    children: [
      { label: '计量台账', to: '/metering' },
      { label: '配额管理', to: '/metering?tab=quota' },
      { label: '模型统计', to: '/metering?tab=stats' },
      { label: '应用管理', to: '/metering?tab=apps' },
      { label: '月度账单', to: '/metering?tab=billing' },
      { label: '成本模型', to: '/metering?tab=cost' },
      { label: '调用日志', to: '/metering?tab=logs' },
    ],
  },
  { label: '策略治理', icon: SlidersHorizontal, path: '/control' },
  {
    label: '安全审计', icon: ShieldCheck, path: '/security',
    children: [
      { label: '安全态势', to: '/security' },
      {
        label: '护栏规则',
        children: [
          { label: '护栏接入', to: '/security?tab=guardrail&gview=conn' },
          { label: '安全策略', to: '/security?tab=guardrail&gview=policy' },
          { label: '检测资源', to: '/security?tab=guardrail&gview=res' },
        ],
      },
      { label: '租户管理', to: '/security?tab=tenant' },
      { label: '告警规则', to: '/security?tab=alertrule' },
      { label: '调用审计', to: '/security?tab=audit' },
      { label: '审计日志', to: '/security?tab=auditlog' },
    ],
  },
  {
    label: '系统管理', icon: Settings, path: '/system',
    children: [
      { label: '用户管理', to: '/system?tab=users' },
      { label: '角色管理', to: '/system?tab=roles' },
      { label: '权限配置', to: '/system?tab=perm' },
      { label: '平台监控', to: '/system?tab=monitor' },
      { label: '工单反馈', to: '/system?tab=tickets' },
      { label: '系统参数', to: '/system?tab=params' },
      { label: '操作日志', to: '/system?tab=logs' },
    ],
  },
  { label: '个人中心', icon: UserCircle, path: '/workbench' },
];

/** 展示型大屏路由：保留玻璃拟态科技风；其余管理页挂 .console 作用域 */
function isBigscreen(pathname: string): boolean {
  return pathname === '/';
}

/** 叶子菜单匹配：to 的 query 必须是当前 URL 的子集；带参多者优先 */
function matchLeaf(child: NavChild, pathname: string, search: URLSearchParams): number {
  const to = child.to;
  if (!to) return -1;
  const [p, qs] = to.split('?');
  if (p !== pathname) return -1;
  if (!qs) return 0;
  const expected = new URLSearchParams(qs);
  let n = 0;
  for (const [k, v] of expected) {
    if (search.get(k) !== v) return -1;
    n += 1;
  }
  return n;
}

/** 解析当前激活叶子：返回标签链（含二级分组名），无匹配回落首项 */
function resolveActive(children: NavChild[], pathname: string, search: URLSearchParams): string[] {
  let best: NavChild | null = null;
  let bestSub: NavChild | null = null;
  let bestN = -1;
  for (const c of children) {
    if (c.children) {
      for (const g of c.children) {
        const n = matchLeaf(g, pathname, search);
        if (n > bestN) { bestN = n; best = g; bestSub = c; }
      }
    } else {
      const n = matchLeaf(c, pathname, search);
      if (n > bestN) { bestN = n; best = c; bestSub = null; }
    }
  }
  if (!best) return [];
  return bestSub ? [bestSub.label, best.label] : [best.label];
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { readOnly, setReadOnly, frozen, setFrozen, circuitOpen, setCircuitOpen, theme, setTheme } = useApp();

  /** 当前位置面包屑：由导航树推导（组 / 子菜单），单页菜单直接显示名称 */
  const crumb = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const group =
      NAV_TREE.find((n) => n.path === location.pathname) ??
      NAV_TREE.find((n) => n.children?.some((c) => c.to?.split('?')[0] === location.pathname));
    if (!group) return '';
    if (!group.children) return group.label;
    const chain = resolveActive(group.children, location.pathname, params);
    if (chain.length === 0) return group.label;
    return chain[0] === group.label ? group.label : `${group.label} / ${chain.join(' / ')}`;
  }, [location]);

  /** 导航组展开状态：默认展开当前路由所在组，路由变化时自动展开对应组 */
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const g = NAV_TREE.find((n) => n.children && location.pathname === n.path);
    return new Set(g ? [g.label] : []);
  });
  useEffect(() => {
    const g = NAV_TREE.find((n) => n.children && location.pathname === n.path);
    if (!g) return;
    const params = new URLSearchParams(location.search);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(g.label);
      /* 二级分组：命中当前 URL 的自动展开 */
      for (const c of g.children!) {
        if (c.children && c.children.some((x) => matchLeaf(x, location.pathname, params) >= 0)) next.add(c.label);
      }
      return next;
    });
  }, [location.pathname, location.search]);
  const toggleGroup = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };
  const [confirmCircuit, setConfirmCircuit] = useState(false);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [broadcast, setBroadcast] = useState(''); // 已发布事件广播内容
  const [composeOpen, setComposeOpen] = useState(false); // 广播输入弹窗
  const [draft, setDraft] = useState('');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annOpen, setAnnOpen] = useState(false);

  /** 顶栏实时时钟（每秒刷新，填充顶栏中部留白） */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* 账号菜单与登录态（内存态：默认未登录，访问任意路径先展示登录页，登录后进入平台） */
  const notify = useNotify();
  const [authed, setAuthed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [pwd, setPwd] = useState({ old: '', next: '', confirm: '' });
  const [pwdErr, setPwdErr] = useState('');

  /** 修改密码校验（与系统参数基线一致：≥10 位 + 含字母与数字） */
  const submitPwd = () => {
    if (!pwd.old) { setPwdErr('请输入当前密码'); return; }
    if (pwd.next.length < 10) { setPwdErr('新密码至少 10 位（系统安全基线）'); return; }
    if (!/[a-zA-Z]/.test(pwd.next) || !/\d/.test(pwd.next)) { setPwdErr('新密码须同时包含字母与数字'); return; }
    if (pwd.next !== pwd.confirm) { setPwdErr('两次输入的新密码不一致'); return; }
    api.changeMyPassword('100001').then(() => {
      notify.success('密码修改成功，下次登录请使用新密码');
      setPwdOpen(false);
      setPwd({ old: '', next: '', confirm: '' });
      setPwdErr('');
    });
  };

  useEffect(() => {
    api.getSummary().then(setSummary);
    api.getApprovals().then(setApprovals);
  }, []);

  /** 风格分治：管理页给 html 挂 console-page（去光斑/纯灰底/实色栏），大屏保留科技风 */
  useEffect(() => {
    document.documentElement.classList.toggle('console-page', !isBigscreen(location.pathname));
  }, [location.pathname]);

  /* 未登录态：展示登录页（会话级，刷新后恢复；必须位于全部 hooks 之后） */
  if (!authed) {
    return <LoginScreen onLogin={() => { setAuthed(true); notify.success('登录成功，欢迎回来'); }} />;
  }

  const openApprovals = () => {
    setApprovalOpen(true);
    api.getApprovals().then(setApprovals); // 打开时刷新聚合待办
  };

  /** P2-14 公告通知中心：打开时拉取最新公告 */
  const openAnnouncements = () => {
    setAnnOpen(true);
    api.getAnnouncements().then(setAnnouncements);
  };

  const handleCircuit = () => {
    if (!confirmCircuit) {
      setConfirmCircuit(true);
      return;
    }
    setCircuitOpen(true);
    setConfirmCircuit(false);
  };

  const publishBroadcast = () => {
    if (draft.trim()) {
      setBroadcast(draft.trim());
      setComposeOpen(false);
      // 联动：广播自动写入公告通知中心（P2-14）
      api.postAnnouncement('BROADCAST', '事件广播', draft.trim()).then(() => {
        if (annOpen) api.getAnnouncements().then(setAnnouncements);
      });
      setDraft('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶部全局栏（左侧面包屑 + 右侧操作区） */}
      <header className="app-glass-bar flex h-14 shrink-0 items-center gap-3 border-b border-border-default px-4">
        {/* 当前位置面包屑（云控制台顶栏左侧标准内容） */}
        <div className="min-w-0 truncate text-sm font-medium text-text-primary">{crumb}</div>
        <span className="h-5 w-px bg-border-default" aria-hidden />

        {/* 运行状态（填充顶栏中部留白）：网关健康 + GPU 利用率 + 实时时钟 */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            网关运行中
          </span>
          <span className="flex items-center gap-1.5">
            <Gauge size={13} className="text-primary/70" />
            GPU 利用率 <span className="num font-semibold text-text-primary">{summary?.gpuUtil ?? '--'}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-primary/70" />
            <span className="num font-medium text-text-primary">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* 主题切换（现代简约：暗色专业 / 浅色清爽，持久化） */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-1 rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
            title={theme === 'dark' ? '切换到浅色清爽主题' : '切换到深色专业主题'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {theme === 'dark' ? '浅色' : '深色'}
          </button>

          {/* 审批待办（六章策略治理：聚合 策略审批 + 配额恢复 + 广场申请） */}
          <button
            onClick={openApprovals}
            className="relative rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
            title="审批中心：策略/配额恢复/模型接入申请"
          >
            审批待办
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-black">
              {approvals.length}
            </span>
          </button>

          {/* 事件广播（规范 4.3 紧急操作入口） */}
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1 rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <Megaphone size={13} /> 事件广播
          </button>

          {/* 数据冻结：暂停驾驶舱等页面的自动轮询（便于核对/截图对比），再点恢复 */}
          <button
            onClick={() => setFrozen(!frozen)}
            title="冻结数据：暂停驾驶舱等页面自动刷新（便于核对或截图对比），再次点击恢复实时刷新"
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              frozen ? 'border-warning/50 bg-warning/10 text-warning' : 'border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            <Snowflake size={13} />
            {frozen ? '已冻结·恢复' : '冻结数据'}
          </button>

          {/* 只读模式（规范 3.2） */}
          <button
            onClick={() => setReadOnly(!readOnly)}
            className={`rounded border px-2 py-1 text-xs transition-colors ${
              readOnly ? 'border-warning/50 bg-warning/10 text-warning' : 'border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            只读模式
          </button>

          {/* 一键熔断（规范 9.2，二次确认） */}
          <button
            onClick={handleCircuit}
            className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              circuitOpen
                ? 'border-danger bg-danger/15 text-danger'
                : 'border-danger/40 bg-danger/5 text-danger hover:bg-danger/15'
            }`}
          >
            <Siren size={14} />
            {circuitOpen ? '熔断中·解除' : confirmCircuit ? '再次确认' : '一键熔断'}
          </button>

          {/* 告警入口（P2-14：告警计数 + 公告通知中心） */}
          <button
            onClick={openAnnouncements}
            className="relative rounded border border-border-default p-1 text-text-secondary transition-colors hover:text-text-primary"
            aria-label="告警与公告"
            title="告警计数 + 公告通知中心（维护通告/事件广播）"
          >
            <Bell size={16} />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {summary?.alertOpen ?? 0}
            </span>
          </button>

          {/* 账号菜单：个人资料 / 修改密码 / 退出登录 */}
          <button
            onClick={() => setUserMenu((v) => !v)}
            className="flex items-center gap-1.5 border-l border-border-default pl-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
            aria-haspopup="menu"
            aria-expanded={userMenu}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-[10px] font-bold text-white">赵</span>
            <span>平台管理员</span>
            <ChevronDown size={12} className={`transition-transform ${userMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* 账号下拉菜单 */}
      {userMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setUserMenu(false)} aria-hidden />
          <div className="modal-in fixed right-3 top-[60px] z-[70] w-60 overflow-hidden rounded-lg border border-border-default bg-bg-panel shadow-2xl" role="menu">
            <div className="flex items-center gap-2.5 border-b border-border-default bg-bg-panel-soft px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-xs font-bold text-white">赵</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">赵总</div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-text-secondary">100001 · 超级管理员</div>
              </div>
            </div>
            <div className="p-1.5">
              <button onClick={() => { setUserMenu(false); setProfileOpen(true); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-text-primary transition-colors hover:bg-bg-panel-soft">
                <UserCircle size={14} className="text-text-secondary" /> 个人资料
              </button>
              <button onClick={() => { setUserMenu(false); setPwdOpen(true); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-text-primary transition-colors hover:bg-bg-panel-soft">
                <KeyRound size={14} className="text-text-secondary" /> 修改密码
              </button>
              <div className="my-1 h-px bg-border-default" aria-hidden />
              <button onClick={() => { setUserMenu(false); setLogoutConfirm(true); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-danger transition-colors hover:bg-danger/10">
                <LogOut size={14} /> 退出登录
              </button>
            </div>
          </div>
        </>
      )}

      {/* 个人资料 */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="个人资料" width={420}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-base font-bold text-white">赵</span>
          <div>
            <div className="text-sm font-semibold text-text-primary">赵总 <span className="ml-1 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">超级管理员</span></div>
            <div className="mt-1 font-mono text-xs text-text-secondary">100001 · M-001</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs">
          {[
            ['所属部门', '信息科技部'],
            ['数据范围', '全行'],
            ['双因素认证', '已开启'],
            ['邮箱', '100001@nbcb.example'],
            ['最近登录', '2026-08-11 08:25（行内统一身份认证）'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded border border-border-default bg-panel-soft px-3 py-2">
              <span className="text-text-secondary">{k}</span>
              <span className="text-text-primary">{v}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* 修改密码 */}
      <Modal
        open={pwdOpen}
        onClose={() => { setPwdOpen(false); setPwdErr(''); }}
        title="修改密码"
        width={420}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => { setPwdOpen(false); setPwdErr(''); }}>取消</button>
            <button className={BTN_PRIMARY} onClick={submitPwd}>确认修改</button>
          </>
        }
      >
        <div className="space-y-3">
          {([
            ['当前密码', 'old'],
            ['新密码', 'next'],
            ['确认新密码', 'confirm'],
          ] as const).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-text-secondary">{label}</label>
              <input
                type="password"
                value={pwd[key]}
                onChange={(e) => setPwd({ ...pwd, [key]: e.target.value })}
                className="w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/60"
              />
            </div>
          ))}
          {pwdErr && <p className="text-xs text-danger">{pwdErr}</p>}
          <p className="text-[11px] leading-relaxed text-text-secondary/70">安全基线：新密码至少 10 位且含字母与数字；修改后当前会话保留，其余会话即时失效，操作写入审计日志。</p>
        </div>
      </Modal>

      {/* 退出登录确认 */}
      <ConfirmDialog
        open={logoutConfirm}
        level="warning"
        title="确认退出登录"
        message="退出后需重新通过身份认证登录，未保存的表单内容将丢失。确认退出？"
        confirmText="退出登录"
        onCancel={() => setLogoutConfirm(false)}
        onConfirm={() => { setLogoutConfirm(false); setAuthed(false); }}
      />

      {/* 事件广播横幅（规范 4.3） */}
      {broadcast && <Banner tone="info"><Megaphone size={13} /> 事件广播：{broadcast}</Banner>}
      {/* 只读横幅（规范 3.2） */}
      {readOnly && <Banner tone="warning">只读模式已开启：所有写操作已禁用</Banner>}
      {/* 熔断横幅（规范 9.2） */}
      {circuitOpen && (
        <Banner
          tone="danger"
          action={
            <button
              onClick={() => setCircuitOpen(false)}
              className="rounded border border-danger/60 px-2 py-0.5 text-xs hover:bg-danger/15"
            >
              解除熔断
            </button>
          }
        >
          <Activity size={14} /> 全局熔断已触发（维度：Token），新请求将被限流。查看熔断记录 → 调度算力
        </Banner>
      )}

      <div className="flex min-h-0 flex-1">
        {/* 左侧导航（规范 4.1，V4：logo 入侧栏 + 浅色选中态） */}
        <aside className="app-glass-bar flex w-56 shrink-0 flex-col border-r border-border-default">
          {/* 品牌区（低饱和科技渐变卡：星舰智能徽标 + 平台名，浅色/暗色自适应） */}
          <div className="brand-card relative mx-3 mt-3 overflow-hidden rounded-lg px-3.5 py-3">
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-12 -left-6 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl" />
            <div className="relative flex items-center gap-2.5">
              <img src={logoUrl} alt="星舰智能" className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-sm shadow-primary/30" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-wide text-text-primary">星舰智能</div>
                <div className="mt-1 truncate text-[11px] leading-none text-primary/75">STARSHIP-MAAS</div>
              </div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-auto px-3 pb-3 pt-2">
            {NAV_TREE.map((group) => {
              const Icon = group.icon;
              const groupActive = location.pathname === group.path;
              /* 单页菜单（无子项）：直接跳转 */
              if (!group.children) {
                return (
                  <NavLink
                    key={group.path}
                    to={group.path}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all ${
                      groupActive
                        ? 'bg-gradient-to-r from-primary/10 to-primary/5 font-medium text-primary'
                        : 'text-text-secondary hover:bg-bg-panel-soft hover:text-text-primary'
                    }`}
                  >
                    <Icon size={17} />
                    {group.label}
                  </NavLink>
                );
              }
              /* 分组菜单：可展开，子项直达功能页（子项支持二级分组） */
              const isOpen = expanded.has(group.label);
              const params = new URLSearchParams(location.search);
              const activeTo = ((): string | undefined => {
                let best: NavChild = group.children[0].children?.[0] ?? group.children[0];
                let bestN = -1;
                for (const c of group.children) {
                  for (const g of c.children ?? [c]) {
                    const n = matchLeaf(g, location.pathname, params);
                    if (n > bestN) { bestN = n; best = g; }
                  }
                }
                return best.to;
              })();
              return (
                <div key={group.path}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all ${
                      groupActive
                        ? 'font-medium text-primary'
                        : 'text-text-secondary hover:bg-bg-panel-soft hover:text-text-primary'
                    }`}
                    aria-expanded={isOpen}
                  >
                    <Icon size={17} />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                  {/* 子菜单展开/收起：grid-rows 高度过渡（丝滑） */}
                  <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
                        {group.children.map((c) => {
                          /* 二级分组子菜单（如 流量管控 / 护栏规则） */
                          if (c.children) {
                            const subOpen = expanded.has(c.label);
                            const subActive = c.children.some((g) => g.to === activeTo);
                            return (
                              <div key={c.label}>
                                <button
                                  onClick={() => toggleGroup(c.label)}
                                  className={`flex w-full items-center gap-2 rounded-md py-2 pl-10 pr-3 text-left text-sm transition-colors ${
                                    subActive ? 'font-medium text-primary' : 'text-text-secondary hover:bg-bg-panel-soft hover:text-text-primary'
                                  }`}
                                  aria-expanded={subOpen}
                                >
                                  <span className={`h-1 w-1 shrink-0 rounded-full ${subActive ? 'bg-primary' : 'bg-text-secondary/40'}`} />
                                  <span className="flex-1">{c.label}</span>
                                  <ChevronDown size={12} className={`transition-transform ${subOpen ? '' : '-rotate-90'}`} />
                                </button>
                                <div className={`grid transition-all duration-300 ease-out ${subOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                  <div className="overflow-hidden">
                                    <div className="flex flex-col gap-0.5 pb-1">
                                      {c.children.map((g) => {
                                        const leafActive = groupActive && g.to === activeTo;
                                        return (
                                          <button
                                            key={g.to}
                                            onClick={() => navigate(g.to!)}
                                            className={`flex items-center gap-2 rounded-md py-1.5 pl-[52px] pr-3 text-left text-sm transition-colors ${
                                              leafActive
                                                ? 'bg-gradient-to-r from-primary/10 to-primary/5 font-medium text-primary'
                                                : 'text-text-secondary hover:bg-bg-panel-soft hover:text-text-primary'
                                            }`}
                                          >
                                            <span className={`h-1 w-1 shrink-0 rounded-full ${leafActive ? 'bg-primary' : 'bg-text-secondary/40'}`} />
                                            {g.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const childActive = groupActive && c.to === activeTo;
                          return (
                            <button
                              key={c.to}
                              onClick={() => navigate(c.to!)}
                              className={`flex items-center gap-2 rounded-md py-2 pl-10 pr-3 text-left text-sm transition-colors ${
                                childActive
                                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 font-medium text-primary'
                                  : 'text-text-secondary hover:bg-bg-panel-soft hover:text-text-primary'
                              }`}
                            >
                              <span className={`h-1 w-1 shrink-0 rounded-full ${childActive ? 'bg-primary' : 'bg-text-secondary/40'}`} />
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* 侧栏底部（填充菜单下方留白）：平台资源概览（与顶栏信息不重叠） */}
          <div className="border-t border-border-default px-3 pb-3 pt-2">
            <div className="rounded-lg bg-bg-panel-soft px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
                <Boxes size={12} className="text-primary/70" /> 平台资源概览
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-md bg-bg-panel/60 px-1 py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{summary?.models ?? '--'}</div>
                  <div className="text-[10px] text-text-secondary">纳管模型</div>
                </div>
                <div className="rounded-md bg-bg-panel/60 px-1 py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{summary?.apps ?? '--'}</div>
                  <div className="text-[10px] text-text-secondary">在用应用</div>
                </div>
                <div className="rounded-md bg-bg-panel/60 px-1 py-1.5">
                  <div className="num text-sm font-semibold text-text-primary">{summary?.nodes ?? '--'}</div>
                  <div className="text-[10px] text-text-secondary">纳管节点</div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-text-secondary/70">
                <span>{summary?.pools ?? '--'} 资源池 · 生产 {summary?.prodModels ?? '--'} 模型</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-text-secondary/70">
              <span>STARSHIP-MAAS</span>
              <span>v3.0 · 2026.08</span>
            </div>
          </div>
        </aside>

        {/* 主舞台（大屏路由保留科技风；管理页挂 .console 作用域） */}
        <main className={`min-w-0 flex-1 overflow-auto p-6 ${isBigscreen(location.pathname) ? '' : 'console'}`}>
          <Outlet />
        </main>
      </div>

      {/* 算力网关 Agent（P28，全局悬浮） */}
      <GatewayAgent />

      {/* 审批中心抽屉（聚合待办，点击跳转对应处置页） */}
      <Drawer open={approvalOpen} onClose={() => setApprovalOpen(false)} title={`审批中心 · ${approvals.length} 项待办`} width={460}>
        {approvals.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-secondary">暂无待办，全部审批已处理</p>
        ) : (
          <div className="space-y-2">
            {approvals.map((a) => (
              <button
                key={a.approvalId}
                onClick={() => {
                  setApprovalOpen(false);
                  navigate(a.targetLink);
                }}
                className="w-full rounded border border-border-default bg-panel-soft p-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.kind === 'POLICY' ? 'bg-primary/10 text-primary' : a.kind === 'QUOTA_RESUME' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                    }`}
                  >
                    {a.kind === 'POLICY' ? '策略审批' : a.kind === 'QUOTA_RESUME' ? '配额恢复' : '模型接入申请'}
                  </span>
                  <span className="num text-[10px] text-text-secondary">
                    {new Date(a.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-medium text-text-primary">{a.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{a.reason}</p>
                <p className="mt-1 text-[10px] text-text-secondary/70">提交人：{a.applicant} · 点击前往处置 →</p>
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-text-secondary">待办来源：策略治理审批、计量配额恢复申请、模型广场接入申请（三类审批统一入口，处置后自动消项）。</p>
      </Drawer>

      {/* 公告通知中心抽屉（P2-14：维护通告/事件广播/公告，置顶优先） */}
      <Drawer open={annOpen} onClose={() => setAnnOpen(false)} title={`公告通知中心 · ${announcements.length} 条`} width={440}>
        <div className="space-y-2">
          {[...announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((a) => (
            <div key={a.annId} className={`rounded border p-3 ${a.pinned ? 'border-warning/40 bg-warning/5' : 'border-border-default bg-panel-soft'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.type === 'MAINTENANCE' ? 'bg-warning/10 text-warning' : a.type === 'BROADCAST' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {a.type === 'MAINTENANCE' ? '维护通告' : a.type === 'BROADCAST' ? '事件广播' : '平台公告'}
                  </span>
                  {a.pinned && <span className="text-[10px] text-warning">置顶</span>}
                </span>
                <span className="num text-[10px] text-text-secondary">
                  {new Date(a.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-medium text-text-primary">{a.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{a.content}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-text-secondary">待处置告警 {summary?.alertOpen ?? 0} 条，前往处置 →</p>
          <button onClick={() => { setAnnOpen(false); navigate('/security'); }} className="rounded border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/20">
            安全审计
          </button>
        </div>
      </Drawer>

      {/* 事件广播输入弹窗（规范 4.3） */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="overlay-in absolute inset-0 bg-black/50" onClick={() => setComposeOpen(false)} aria-hidden />
          <div role="dialog" aria-label="事件广播" className="relative w-[440px] rounded-xl border border-border-default bg-bg-panel p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone size={15} className="text-warning" /> 事件广播（紧急操作，将广播至全行运营控制台）
            </div>
            <textarea
              name="broadcast-content"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="输入广播内容，例如：POOL-L20 节点进入降级维护，预计 30 分钟，涉及批量任务将错峰调度"
              rows={4}
              className="mt-3 w-full rounded border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary/60 focus:border-primary/60"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-text-secondary">广播将留痕：发送人、时间、内容</span>
              <div className="flex gap-2">
                <button onClick={() => setComposeOpen(false)} className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
                  取消
                </button>
                <button
                  onClick={publishBroadcast}
                  disabled={!draft.trim()}
                  className="rounded bg-warning/15 px-3 py-1.5 text-xs text-warning transition-colors hover:bg-warning/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  发送广播
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 登录页（默认入口/退出后展示；左紫蓝插画约 3/5 + 右浅色表单区，固定浅色视觉，不随主题切换） */
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [acc, setAcc] = useState('100001');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [logging, setLogging] = useState(false);
  const submit = () => {
    if (logging) return;
    if (!acc.trim()) { setErr('请输入账号'); return; }
    if (!pw) { setErr('请输入密码'); return; }
    if (pw !== '000000') { setErr('密码错误，初始密码为 000000'); return; }
    setErr('');
    setLogging(true);
    /* 演示态：模拟身份认证耗时，登录后进入平台 */
    window.setTimeout(() => onLogin(), 700);
  };
  return (
    <div className="flex min-h-screen bg-[#f4f6f9]">
      {/* 左：品牌插画区（约 3/5 宽，紫蓝渐变加深，背景大 AI 字 + 漂浮立方体 + 核心能力三卡） */}
      <div className="login-hero relative hidden flex-[1.5] flex-col justify-between overflow-hidden p-10 lg:flex">
        <span aria-hidden className="login-ai-bg">AI</span>
        <span aria-hidden className="login-cube login-cube-1" />
        <span aria-hidden className="login-cube login-cube-2" />
        <span aria-hidden className="login-cube login-cube-3" />
        <div className="relative z-10 flex items-center gap-2.5">
          <img src={logoUrl} alt="星舰智能" className="h-9 w-9 rounded-lg object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-white">星舰智能</div>
            <div className="mt-1 text-[10px] text-white/65">STARSHIP-MAAS · 金融级 AI 生产运营平台</div>
          </div>
        </div>
        <div className="relative z-10">
          <div className="text-[39px] font-bold leading-[1.2] text-white">智算中枢 · 随需调度</div>
          <div aria-hidden className="mt-5 h-px w-14 bg-white/40" />
          <div className="mt-4 text-sm font-light leading-relaxed tracking-wide text-white/80">Unified model governance · Intelligent routing · Compute on demand</div>
          <div className="mt-10 flex flex-wrap gap-3.5">
            {[
              ['智能网关', '多约束语义路由', '模型统一纳管'],
              ['弹性算力', 'GPU/NPU 异构池', '秒级弹性伸缩'],
              ['国产化纳管', '昇腾 / 沐曦适配', '自主可控'],
            ].map(([t, d1, d2]) => (
              <div key={t} className="w-44 rounded-lg border border-white/25 bg-white/15 px-4 py-3 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/45 hover:bg-white/22 hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {t}
                </div>
                <div className="mt-1.5 pl-3 text-[11px] leading-relaxed text-white/75">
                  <div>{d1}</div>
                  <div>{d2}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-4">
          {/* 信雅达：白底框 */}
          <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1e3fd9] text-[9px] font-bold text-white">信</span>
            <span className="text-xs font-semibold leading-none text-[#333]">信雅达® SUNYARD</span>
          </div>
          {/* 星舰智能：深色半透明底框（区别于信雅达白底） */}
          <div className="flex items-center gap-2 rounded-md border border-white/30 bg-slate-900/35 px-3 py-2 backdrop-blur-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-indigo-400 to-blue-500 text-[9px] font-bold text-white">星</span>
            <span className="text-xs font-semibold leading-none text-white">星舰智能 STARSHIP</span>
          </div>
        </div>
      </div>
      {/* 右：表单区（浅色底，无卡片，输入框白底描边醒目） */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-9">
            <div className="text-[27px] font-bold leading-tight text-[#333]">Model as a Service</div>
            <div className="mt-2 text-sm leading-relaxed text-[#8a8f99]">登录星舰智能平台，开启 AI 生产运营</div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="login-acc" className="mb-1.5 block text-xs text-[#555]" style={{ letterSpacing: '0.02em' }}>
                账号
              </label>
              <div className="relative">
                <User size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa3af]" />
                <input
                  id="login-acc"
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                  placeholder="请输入用户名 / 工号"
                  aria-label="账号"
                  className="w-full rounded-md border border-[#d9dee6] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#1f2937] shadow-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#2563e9] focus:ring-2 focus:ring-[#2563e9]/15"
                />
              </div>
            </div>
            <div>
              <label htmlFor="login-pw" className="mb-1.5 block text-xs text-[#555]" style={{ letterSpacing: '0.02em' }}>
                密码
              </label>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa3af]" />
                <input
                  id="login-pw"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="请输入密码（初始 000000）"
                  aria-label="密码"
                  className="w-full rounded-md border border-[#d9dee6] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#1f2937] shadow-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#2563e9] focus:ring-2 focus:ring-[#2563e9]/15"
                />
              </div>
            </div>
            {err && <p className="text-xs leading-relaxed text-[#dc2626]">{err}</p>}
            <button
              onClick={submit}
              disabled={logging}
              className="h-12 w-full rounded-md text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
              style={{ backgroundImage: 'linear-gradient(135deg, #B29DF7 0%, #2563E9 100%)', boxShadow: '0 4px 14px -4px rgba(37, 99, 233, 0.45)' }}
            >
              {logging ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> 登录中…
                </span>
              ) : (
                '登 录'
              )}
            </button>
            <p className="text-[11px] leading-relaxed text-[#8a8f99]">初始密码 000000，登录后请及时修改；登录行为全程审计留痕，连续失败 5 次自动锁定。</p>
            <p className="pt-4 text-center text-[11px] leading-relaxed text-[#8a8f99]/70">
              © 2026 信雅达 · 星舰智能 STARSHIP · STARSHIP-MAAS 平台
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
