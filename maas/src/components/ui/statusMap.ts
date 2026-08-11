import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Lock,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

/** 状态 → 语义色 token + 图标 + 中文标签（规范 10.2：禁止仅用颜色表达状态） */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: typeof Circle;
}

export const TONE_CLASS: Record<Tone, string> = {
  success: 'text-success border-success/40 bg-success/10',
  warning: 'text-warning border-warning/40 bg-warning/10',
  danger: 'text-danger border-danger/40 bg-danger/10',
  info: 'text-primary border-primary/40 bg-primary/10',
  muted: 'text-text-secondary border-border-default bg-panel-soft',
};

const icon = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: AlertOctagon,
  info: Circle,
  run: RefreshCw,
  wait: Clock,
  pause: PauseCircle,
  lock: Lock,
  shield: ShieldAlert,
  fail: XCircle,
  load: Loader2,
};

function meta(label: string, tone: Tone, i: keyof typeof icon): StatusMeta {
  return { label, tone, icon: icon[i] };
}

/** 按枚举命名空间组织的状态字典（同一字符串在不同上下文语义不同，如 ACTIVE / CLOSED / OPEN） */
export const STATUS_NS = {
  /* Severity */
  Severity: {
    INFO: meta('提示', 'info', 'info'),
    WARN: meta('警告', 'warning', 'warn'),
    ERROR: meta('错误', 'danger', 'fail'),
    CRITICAL: meta('严重', 'danger', 'crit'),
  },
  /* ResourceStatus（7.2 八态） */
  Resource: {
    IDLE: meta('空闲', 'info', 'pause'),
    RUNNING: meta('运行中', 'info', 'run'),
    HOT: meta('高负载', 'warning', 'warn'),
    QUEUED: meta('排队拥堵', 'warning', 'wait'),
    DEGRADED: meta('降级运行', 'warning', 'warn'),
    INSTANCE_FAULT: meta('实例异常', 'danger', 'fail'),
    NODE_FAULT: meta('节点故障', 'danger', 'crit'),
    MAINTENANCE: meta('隔离维护', 'muted', 'lock'),
  },
  /* PolicyStatus（7.1） */
  Policy: {
    DRAFT: meta('草稿', 'muted', 'info'),
    PENDING_APPROVAL: meta('待审批', 'warning', 'wait'),
    GRAY: meta('灰度中', 'warning', 'warn'),
    ACTIVE: meta('生效', 'success', 'ok'),
    ROLLBACK: meta('回滚中', 'danger', 'fail'),
    INACTIVE: meta('停用', 'muted', 'pause'),
    ARCHIVED: meta('归档', 'muted', 'lock'),
  },
  /* LifecycleStatus（7.7） */
  Lifecycle: {
    DRAFT: meta('登记', 'muted', 'info'),
    TESTING: meta('测试', 'info', 'run'),
    GRAY: meta('灰度', 'warning', 'warn'),
    PRODUCTION: meta('生产', 'success', 'ok'),
    ROLLBACK: meta('回滚', 'danger', 'fail'),
    OFFLINE: meta('下线中', 'muted', 'pause'),
    ARCHIVED: meta('归档', 'muted', 'lock'),
  },
  /* RouterLogStatus（7.3） */
  RouterLog: {
    SUCCESS: meta('成功', 'success', 'ok'),
    BLOCKED: meta('阻断', 'danger', 'shield'),
    DEGRADED: meta('降级', 'warning', 'warn'),
    FAILED: meta('失败', 'danger', 'fail'),
  },
  /* CircuitStatus（10.4） */
  Circuit: {
    CLOSED: meta('已恢复', 'success', 'ok'),
    OPEN: meta('已熔断', 'danger', 'crit'),
    HALF_OPEN: meta('半开探测', 'warning', 'warn'),
  },
  /* AlertStatus（10.3） */
  Alert: {
    OPEN: meta('待处置', 'danger', 'crit'),
    ACKNOWLEDGED: meta('已确认', 'warning', 'warn'),
    RESOLVING: meta('处置中', 'warning', 'run'),
    CLOSED: meta('已关闭', 'muted', 'ok'),
  },
  /* ApplicationRegistry（7.10） */
  App: {
    ACTIVE: meta('在用', 'success', 'ok'),
    SUSPENDED: meta('已暂停', 'warning', 'pause'),
    OFFLINE: meta('已下线', 'muted', 'lock'),
  },
  /* 配置域新增状态（完善方案 v2） */
  KeyStatus: {
    ENABLED: meta('启用', 'success', 'ok'),
    DISABLED: meta('禁用', 'muted', 'pause'),
  },
  Conn: {
    ONLINE: meta('在线', 'success', 'ok'),
    OFFLINE: meta('离线', 'danger', 'fail'),
    TESTING: meta('测试中', 'warning', 'run'),
  },
  Quota: {
    NORMAL: meta('正常', 'success', 'ok'),
    WARNING: meta('预警', 'warning', 'warn'),
    STOPPED: meta('已停发', 'danger', 'crit'),
  },
  Apply: {
    NONE: meta('未申请', 'muted', 'info'),
    PENDING: meta('审批中', 'warning', 'wait'),
    GRANTED: meta('已开通', 'success', 'ok'),
    APPROVED: meta('已通过', 'success', 'ok'),
    REJECTED: meta('已驳回', 'danger', 'fail'),
  },
  Emergency: {
    RUNNING: meta('执行中', 'warning', 'run'),
    ACTIVE: meta('已生效', 'success', 'ok'),
    ROLLED_BACK: meta('已回滚', 'muted', 'pause'),
  },
  CallLog: {
    SUCCESS: meta('成功', 'success', 'ok'),
    FAILED: meta('失败', 'danger', 'fail'),
    RATE_LIMITED: meta('限流', 'warning', 'wait'),
    BLOCKED: meta('拦截', 'danger', 'shield'),
  },
  Report: {
    OPEN: meta('待处理', 'warning', 'wait'),
    VALID: meta('判定有效', 'danger', 'shield'),
    FALSE_POSITIVE: meta('误报', 'info', 'info'),
    IGNORED: meta('已忽略', 'muted', 'pause'),
  },
  ValueScore: {
    A: meta('A 战略', 'success', 'ok'),
    B: meta('B 核心', 'info', 'ok'),
    C: meta('C 通用', 'warning', 'warn'),
    D: meta('D 候选下线', 'danger', 'warn'),
  },
} as const;

export type StatusNs = keyof typeof STATUS_NS;

/**
 * 扁平合并字典：供未指定命名空间的兜底查询。
 * 合并顺序使语义最通用的上下文优先（告警 OPEN/CLOSED 对熔断同样成立）。
 */
export const STATUS_DICT: Record<string, StatusMeta> = Object.assign(
  {},
  STATUS_NS.Severity,
  STATUS_NS.Resource,
  STATUS_NS.Policy,
  STATUS_NS.Lifecycle,
  STATUS_NS.RouterLog,
  STATUS_NS.Circuit,
  STATUS_NS.App,
  STATUS_NS.Alert,
  STATUS_NS.KeyStatus,
  STATUS_NS.Conn,
  STATUS_NS.Quota,
  STATUS_NS.Apply,
  STATUS_NS.Emergency,
  STATUS_NS.CallLog,
  STATUS_NS.Report,
);

export function getStatusMeta(status: string, ns?: StatusNs): StatusMeta {
  if (ns) return STATUS_NS[ns][status as never] ?? meta(status || '未知', 'muted', 'info');
  return STATUS_DICT[status] ?? meta(status || '未知', 'muted', 'info');
}
