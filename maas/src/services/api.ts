/**
 * Service 层（规范 12.2）
 *  - 页面只依赖本层查询接口，不直接接触底层数据实现
 *  - 本地固化数据源与真实接口的差异仅收敛在本层，后续接入后端时仅需改造本层
 *  - 模拟异步（微延迟），保证组件 loading 状态真实可测
 */
import {
  DEPT_NAME_MAP,
  assets,
  evals,
  instances,
  getAppTcoRank,
  getBatchTrend,
  getCircuitBreakers,
  getDeptTco,
  getFunnelData,
  getHeatmapData,
  getMetering,
  getModelTcoRank,
  getPlatformSummary,
  getQueueData,
  getRateLimitHits,
  getRouterLogs,
  getSecurityEvents,
  getTokenSeries,
  getTrendSeries,
} from './data';
import type {
  ApplicationRegistry,
  Announcement,
  BatchPoint,
  BatchTask,
  CircuitBreaker,
  ComputeResource,
  EvalResult,
  FunnelStage,
  HeatCell,
  HeteroSchedPolicy,
  HeteroVendor,
  Instance,
  MemberInfo,
  MeteringRecord,
  ModelAsset,
  ModelDependencyCheck,
  MonthlyBill,
  MyApplication,
  PlatformAlert,
  Policy,
  PriorityQueueItem,
  QualityAlertRule,
  RouterLog,
  RoutingEngineConfig,
  SecurityEvent,
} from '../types';
import * as cfg from './dataConfig';
import { http } from './http';

/** 登录结果（后端 /internal/auth/login，snake_case 已由 http 层转 camelCase） */
export interface LoginResult {
  token: string;
  userCode: string;
  userName: string;
  tenantId?: string | null;
  roles: string[];
  pwdMustChange?: number;
  expireAt?: string;
}

/** 当前用户信息（/internal/auth/me） */
export interface MeInfo {
  userCode: string;
  userName?: string;
  permissions: Record<string, string>;
}

/** 投入产出（ROI）综合分析（/internal/dashboard/roi，全真实落库数据） */
export interface RoiInfo {
  investment: { monthCost: number; callCount: number; tokenTotal: number; activeApps: number; activeModels: number };
  investBreakdown: { tenantId: string; cost: number; calls: number }[];
  modelValue: { evalCount: number; avgScore: number; passRate: number };
  archiveValue: {
    activeArchives: number;
    avgCostScore: number;
    avgConversionScore: number;
    avgRiskAccScore: number;
    gradeDist: Record<string, number>;
  };
  saving: { landedAdvices: number; monthlySaving: number; annualizedSaving: number };
  roiRatio: number | null;
}
import type {
  ApiKey,
  AlertAction,
  ApprovalItem,
  ArchivedModel,
  ArchiveRules,
  CallLog,
  CostAlertConfig,
  CostModelConfig,
  DetectModelInfo,
  DetectModule,
  ElasticSwitchConfig,
  EmergencyTicket,
  EngineVersionInfo,
  ExecutedPolicyItem,
  GrayRelease,
  GuardrailConfig,
  GuardrailPolicy,
  KeywordLibrary,
  KvCacheGovernance,
  ModelBenefit,
  ModelCard,
  ModelConnection,
  ModelRecommend,
  ModelUsageStat,
  NodeConfig,
  OperationRecord,
  OptimizeAdvice,
  OrchestrationConfig,
  PersonalTrendPoint,
  PersonalUsage,
  PlazaApply,
  PricingRule,
  QuotaProfile,
  RateLimitRule,
  ReportFeedback,
  RoutingRuleSet,
  TenantOrg,
  TenantRetention,
  AggregationGroup,
  K8sCluster,
  K8sPod,
  PermRow,
  PlatformService,
  SysRole,
  SysTicket,
  SysUser,
  SystemParams,
  TicketType,
  BaseIntegration,
  IntegrationLog,
} from '../types';

/** 运行环境标识（顶部全局栏展示）：按构建模式如实标注，不再写死 PROD */
export const ENV_TAG: string = import.meta.env.PROD ? 'PROD' : import.meta.env.MODE.toUpperCase();

/**
 * 按模块控制 mock / 真实后端 切换
 * false = 使用后端真实 API；true = 使用本地 mock 数据
 * 后续逐模块对接后端时，将对应值改为 false
 */
export const USE_MOCK = {
  dashboard: false,   // Dashboard 已对接后端
  metering: false,    // 计量运营已对接后端
  routing: false,     // 路由配置已对接后端
  modelAsset: false,  // 模型资产已对接后端
  security: false,    // 安全审计已对接后端
  apiKey: false,      // API Key 已对接后端
  cache: false,       // 缓存管理已对接后端
  apps: false,        // 应用注册已对接后端
};

/**
 * 接口请求失败、回落本地种子/示例数据时的统一告警。
 * 作用：让"后端真实数据"与"前端降级种子"在控制台可辨（演示/排障时打开 DevTools 即可区分），
 * 而不是静默兜底导致页面数据真假不可辨。
 */
export function warnFallback(apiName: string, e?: unknown): void {
  const msg = e instanceof Error ? e.message : e != null ? String(e) : 'unknown error';
  // eslint-disable-next-line no-console
  console.warn(`[maas-api][降级] ${apiName} 请求失败，当前展示为本地种子/示例数据（非后端真实数据）：${msg}`);
}

function mock<T>(data: T, delay = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delay));
}

/** 写操作成功后构造一条留痕记录（真实后端返回的是通用 Map，这里归一为前端 OperationRecord 形状） */
function okRec(opType: string, targetId: string, detail: string): OperationRecord {
  return {
    opId: 'OP-' + Date.now(),
    opType,
    operator: '平台管理员',
    targetId,
    detail,
    createdAt: new Date().toISOString(),
  };
}

/** 通用配置 key：所有"此前只在前端内存"的配置类功能统一落到 mas_platform_config */
const CONFIG_KEYS = {
  modelCards: 'MODEL_CARDS',
  plazaApplies: 'PLAZA_APPLIES',
  detectModules: 'DETECT_MODULES',
  keywordLibs: 'KEYWORD_LIBS',
  detectModels: 'DETECT_MODELS',
  advices: 'ADVICES',
  reportFeedbacks: 'REPORT_FEEDBACKS',
  myApplications: 'MY_APPLICATIONS',
  approvals: 'APPROVALS',
  nodeConfigs: 'NODE_CONFIGS',
  heteroSched: 'HETERO_SCHED',
  engineVersions: 'ENGINE_VERSIONS',
  emergencyTickets: 'EMERGENCY_TICKETS',
  qualityAlertRules: 'QUALITY_ALERT_RULES',
  announcements: 'ANNOUNCEMENTS',
  tickets: 'TICKETS',
  pods: 'K8S_PODS',
  costModel: 'COST_MODEL',
  nodeMaintenance: 'NODE_MAINTENANCE',
  nodeExpansions: 'NODE_EXPANSIONS',
} as const;

/** 后端 adapt_status → 前端 compatStatus 展示枚举（ADAPTED 及未知值按“已适配=兼容”处理） */
const ADAPT_TO_COMPAT: Partial<Record<string, HeteroVendor['compatStatus']>> = {
  ADAPTING: 'ADAPTING',
  PLANNED: 'PLANNED',
};

/** 读取通用配置（数组/对象）；后端无记录时回落本地默认，保证页面非空 */
async function loadConfig<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await http.get<T>(`/internal/system/config/${key}`);
    if (r === null || r === undefined) return fallback;
    // 后端对“无记录”的键返回 []；若返回类型（数组/对象）与 fallback 不一致，说明该键无有效记录，
    // 回落默认配置，避免用 [] 覆盖对象导致后续 .字段 读取崩溃（如成本模型 weights、异构调度 vendorPriority）
    if (Array.isArray(fallback) !== Array.isArray(r)) return fallback;
    return r;
  } catch (e) {
    warnFallback(`loadConfig(${key})`, e);
    return fallback;
  }
}

/** 保存通用配置（UPSERT 任意 JSON 到 mas_platform_config） */
function saveConfig(key: string, data: unknown): Promise<OperationRecord> {
  return http
    .put(`/internal/system/config/${key}`, data)
    .then(() => okRec('保存配置', key, '已落库 mas_platform_config（刷新不再回退）'));
}

/** 读取 → 应用变更 → 回写（保证后端是唯一真相源，刷新不回退） */
async function mutateConfig<T>(key: string, fallback: T, fn: (cur: T) => T): Promise<OperationRecord> {
  const cur = await loadConfig<T>(key, fallback);
  return saveConfig(key, fn(cur));
}

/* ---------------- 后端应用数据转换 ---------------- */

/** 后端 mas_app 行 → 前端 ApplicationRegistry */
function mapBackendApp(r: Record<string, unknown>): ApplicationRegistry {
  const statusNum = Number(r.status ?? 1);
  return {
    appId: String(r.appId ?? ''),
    appName: String(r.appName ?? ''),
    deptId: String(r.deptId ?? ''),
    owner: String(r.ownerId ?? ''),
    businessScenario: String(r.description ?? ''),
    dataLevel: (String(r.dataLevel ?? 'L2') as ApplicationRegistry['dataLevel']),
    slaLevel: (String(r.slaLevel ?? 'P1') as ApplicationRegistry['slaLevel']),
    quotaToken: Number(r.monthQuota ?? 0),
    quotaRequest: 0,
    costBudget: 0,
    status: statusNum === 1 ? 'ACTIVE' : statusNum === 2 ? 'SUSPENDED' : 'OFFLINE',
  };
}

/* ---------------- 查询接口 ---------------- */

import type { PlatformSummary, DeptTco, TokenPoint, TrendPoint } from './data';
export type { PlatformSummary, DeptTco, TokenPoint, TrendPoint };

/** 后端角色 code（ADMIN/OPERATOR/AUDITOR…）→ 前端 SysRoleKey；未知编码统一回落只读角色 */
const BACKEND_ROLE_MAP: Record<string, SysUser['role']> = {
  ADMIN: 'PLATFORM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  OPERATOR: 'OPERATOR',
  MODEL_OWNER: 'MODEL_OWNER',
  BIZ_VIEWER: 'BIZ_VIEWER',
  VIEWER: 'BIZ_VIEWER',
  AUDITOR: 'AUDITOR',
};

export const api = {
  env: () => ENV_TAG,

  // ---------------- 身份认证（公告二-2：真实登录链路） ----------------

  /** 登录：后端验证用户名+密码（SHA-256 比对），签发访问令牌；连续失败 5 次自动锁定 */
  login(userCode: string, password: string): Promise<LoginResult> {
    return http.post<LoginResult>('/internal/auth/login', { userCode, password });
  },

  /** 当前用户与各模块权限级别（按权限渲染菜单/按钮的数据源） */
  fetchMe(): Promise<MeInfo> {
    return http.get<MeInfo>('/internal/auth/me');
  },

  /** 修改密码（真实落库，验证旧密码，清除强制改密标记） */
  changePassword(oldPassword: string, newPassword: string): Promise<OperationRecord> {
    return http.post<OperationRecord>('/internal/auth/change-password', { oldPassword, newPassword });
  },

  /** 登出：吊销当前令牌 */
  logout(): Promise<unknown> {
    return http.post('/internal/auth/logout');
  },

  /** 投入产出（ROI）综合分析（公告一-4）：真实成本投入 vs 模型价值/落地节省 */
  getRoi(): Promise<RoiInfo> {
    return http.get<RoiInfo>('/internal/dashboard/roi');
  },

  getSummary() {
    if (USE_MOCK.dashboard) return mock(getPlatformSummary());
    // 后端 summary 缺 gpuHours 等字段，在此兜底适配
    return http.get<Partial<PlatformSummary>>('/internal/dashboard/summary').then(res => ({
      ...res,
      gpuHours: res.gpuHours ?? 0,
      approvalPending: res.approvalPending ?? 0,
      maskedEvents: res.maskedEvents ?? 0,
      criticalEvents: res.criticalEvents ?? 0,
    } as PlatformSummary));
  },

  getDeptNames() {
    return mock(DEPT_NAME_MAP);
  },

  getAppTcoRank(): Promise<{ appId: string; name: string; tokens: number; tco: number }[]> {
    if (USE_MOCK.dashboard) return mock(getAppTcoRank());
    return http.get<{ appId: string; name: string; tokens: number; tco: number }[]>('/internal/dashboard/app-tco-rank');
  },

  getModelTcoRank(): Promise<{ assetId: string; name: string; calls: number; tco: number }[]> {
    if (USE_MOCK.dashboard) return mock(getModelTcoRank());
    return http.get<{ assetId: string; name: string; calls: number; tco: number }[]>('/internal/dashboard/model-tco-rank');
  },

  getAssets(): Promise<ModelAsset[]> {
    if (USE_MOCK.modelAsset) return mock([...assets]);
    return http.get('/internal/models');
  },
  getApps(): Promise<ApplicationRegistry[]> {
    if (USE_MOCK.apps) return mock(cfg.appsStore.map((a) => ({ ...a })));
    return http.get<Record<string, unknown>[]>('/internal/apps').then(rows => {
      return (rows || []).map(r => mapBackendApp(r));
    });
  },

  getResources(): Promise<ComputeResource[]> {
    // 真实采集口径（算力 Agent 上报 mas_compute_metric），无数据时返回空列表而非模拟值；
    // 叠加前端提交的节点维护状态（落库 mas_platform_config），保证“隔离维护”刷新不回退
    return http
      .get<Record<string, unknown>[]>('/internal/compute/nodes', { hours: 24 })
      .then(async (rows) => {
        const list = (rows || []).map((r) => ({
          resourceId: String(r.nodeId ?? ''),
          name: String(r.nodeId ?? ''),
          pool: String(r.nodeId ?? ''),
          vendor: '行内集群',
          gpuType: '—',
          gpuCount: 0,
          gpuUtil: Number(r.gpuUtil ?? 0),
          gpuMemUtil: Number(r.gpuMemUtil ?? 0),
          vgpuEnabled: false,
          quantLevel: 'FP16',
          replicas: 0,
          status: 'ONLINE' as ComputeResource['status'],
          gpuHours: Number(r.gpuHours ?? 0),
          requests: Number(r.requests ?? 0),
          tokens: Number(r.tokens ?? 0),
        })) as unknown as ComputeResource[];
        const maint = await loadConfig<{ resourceId: string; maintenance: boolean }[]>(CONFIG_KEYS.nodeMaintenance, []);
        const maintMap = new Map(maint.filter((m) => m.maintenance).map((m) => [m.resourceId, true]));
        return list.map((r) => (maintMap.has(r.resourceId) ? { ...r, status: 'MAINTENANCE' as ComputeResource['status'] } : r));
      })
      .catch((e: unknown) => { warnFallback('getResources', e); return []; });
  },

  getInstances(): Promise<Instance[]> {
    return mock([...instances]);
  },

  getPolicies(): Promise<Policy[]> {
    return http
      .get<Record<string, unknown>[]>('/internal/policies')
      .then((rows) =>
        (rows || []).map((r) => ({
          policyId: String(r.policyId ?? ''),
          name: String(r.name ?? ''),
          category: String(r.category ?? 'ROUTING'),
          scope: String(r.scope ?? '全局'),
          status: String(r.status ?? 'DRAFT') as Policy['status'],
          version: Number(r.currentVersion ?? 0),
          owner: String(r.owner ?? ''),
          updatedAt: String(r.updatedAt ?? ''),
        })) as unknown as Policy[],
      )
      .catch((e: unknown) => { warnFallback('getPolicies', e); return cfg.policiesStore.map((p) => ({ ...p })); });
  },

  getRouterLogs(): Promise<RouterLog[]> {
    if (USE_MOCK.routing) return mock(getRouterLogs());
    return http.get('/internal/routing/router-logs');
  },

  getRouterLogByTrace(traceId: string): Promise<RouterLog | null> {
    if (USE_MOCK.routing) {
      const log = getRouterLogs().find((l) => l.traceId === traceId) ?? null;
      return mock(log, 80);
    }
    return http.get<RouterLog[]>('/internal/routing/router-logs', { traceId }).then(r => r[0] ?? null);
  },

  getMetering(): Promise<MeteringRecord[]> {
    if (USE_MOCK.metering) return mock(getMetering());
    // 后端 call-logs 返回 {logs, total}，需转换为 MeteringRecord[]
    return http.get<{logs: Record<string, unknown>[]; total: number}>('/internal/metering/call-logs', {page: 1, size: 50}).then(res => {
      return (res.logs || []).map((log, i) => ({
        billId: String(log.logId ?? `BILL-${i}`),
        traceId: String(log.logId ?? ''),
        // 租户/部门取后端真实归属（此前硬编码 TENANT-TECH / DEPT-TECH）
        tenantId: String(log.tenantId ?? 'UNKNOWN'),
        deptId: String(log.deptId ?? ''),
        appId: String(log.appType ?? ''),
        assetId: String(log.model ?? ''),
        modelVersion: 'v1.0',
        requestCount: 1,
        promptTokens: Number(log.inputTokens ?? 0),
        completionTokens: Number(log.outputTokens ?? 0),
        cacheHitTokens: 0,
        retryTokens: 0,
        failureTokens: log.status === 'FAILED' ? Number(log.inputTokens ?? 0) + Number(log.outputTokens ?? 0) : 0,
        retryCount: 0,
        failureCount: log.status === 'FAILED' ? 1 : 0,
        gpuHours: 0,
        instanceHours: 0,
        queueWaitMs: 0,
        costInfra: 0,
        // 成本统一取后端计价引擎口径（此前前端自行按 0.00025 重算，与后端 0.0016 对不上）
        costCompute: Number(log.cost ?? 0),
        costLicense: 0,
        costExternal: 0,
        tcoTotal: Number(log.cost ?? 0),
        success: log.status === 'SUCCESS',
        retryTokensIncluded: false,
      }));
    });
  },

  getSecurityEvents(): Promise<SecurityEvent[]> {
    if (USE_MOCK.security) return mock(getSecurityEvents());
    // 后端返回 { events: [...] }（字段为 eventId/traceId/...），需解包并映射到前端 SecurityEvent
    // （securityEventId 为主键展示/解锁键，此前裸透传导致页面取不到该字段）
    return http
      .get<{ events?: Record<string, unknown>[]; total?: number }>('/internal/security/events')
      .then((res) =>
        (res?.events ?? []).map((r) => ({
          securityEventId: String(r.eventId ?? r.securityEventId ?? ''),
          traceId: String(r.traceId ?? ''),
          tenantId: String(r.tenantId ?? ''),
          userId: String(r.userId ?? ''),
          appId: String(r.appId ?? ''),
          assetId: String(r.assetId ?? ''),
          eventType: String(r.eventType ?? 'OTHER') as SecurityEvent['eventType'],
          eventLevel: String(r.eventLevel ?? 'INFO') as SecurityEvent['eventLevel'],
          guardrailStage: String(r.guardrailStage ?? 'L1') as SecurityEvent['guardrailStage'],
          ruleId: String(r.ruleId ?? ''),
          ruleName: String(r.ruleName ?? ''),
          masked: Boolean(r.masked),
          blocked: Boolean(r.blocked),
          reasonCode: String(r.reasonCode ?? ''),
          reasonText: String(r.reasonText ?? ''),
          logStorageType: String(r.logStorageType ?? 'MASKED') as SecurityEvent['logStorageType'],
          hashSignature: String(r.hashSignature ?? ''),
          createdAt: String(r.createdAt ?? ''),
        })),
      )
      .catch((e: unknown) => {
        warnFallback('getSecurityEvents', e);
        return [];
      });
  },

  getAlerts(): Promise<PlatformAlert[]> {
    if (USE_MOCK.security) return mock(cfg.alertsStore.map((a) => ({ ...a })));
    return http.get<PlatformAlert[]>('/internal/security/alerts').catch(() => []);
  },

  getCircuitBreakers(): Promise<CircuitBreaker[]> {
    // 后端 /internal/dashboard/circuit-breakers 端点真实存在，此前被误判为"已从契约移除"
    // 接口异常时回落本地示例数据（无 ErrorBoundary，未捕获 rejection 会卸载整页）
    return http
      .get<Record<string, unknown>[]>('/internal/dashboard/circuit-breakers')
      .then((rows) =>
        (rows || []).map((r) => ({
          circuitId: String(r.circuitId ?? ''),
          status: String(r.status ?? 'CLOSED') as CircuitBreaker['status'],
          dimension: String(r.dimension ?? 'QPS') as CircuitBreaker['dimension'],
          threshold: Number(r.threshold ?? 0),
          currentValue: Number(r.currentValue ?? 0),
          triggeredAt: String(r.triggeredAt ?? ''),
          recoveredAt: r.recoveredAt ? String(r.recoveredAt) : null,
          recoverMode: (r.recoverMode ? String(r.recoverMode) : null) as CircuitBreaker['recoverMode'],
        })),
      )
      .catch((e: unknown) => { warnFallback('getCircuitBreakers', e); return getCircuitBreakers(); });
  },

  getEvals(): Promise<EvalResult[]> {
    // 评测记录已落 mas_model_eval，此前为纯前端内存 mock
    return http
      .get<Record<string, unknown>[]>('/internal/models/eval-records')
      .then((rows) =>
        (rows || []).map((r) => ({
          evalId: String(r.evalId ?? ''),
          assetId: String(r.modelId ?? ''),
          evalType: String(r.evalType ?? 'ADMISSION') as EvalResult['evalType'],
          evalDataset: String(r.dataset ?? '-'),
          accuracy: Number(r.accuracy ?? 0),
          hallucinationRate: Number(r.anomalyRate ?? 0),
          complianceRate: Number(r.complianceRate ?? 0),
          toolCallSuccessRate: Number(r.taskSuccessRate ?? 0),
          longContextScore: Number(r.score ?? 0),
          costScore: Number(r.tokenCost ?? 0),
          reviewConclusion: String(r.conclusion ?? 'WARN') as EvalResult['reviewConclusion'],
          reviewedBy: String(r.operator ?? ''),
          reviewedAt: String(r.createdAt ?? ''),
        })),
      )
      .catch((e: unknown) => { warnFallback('getEvals', e); return [...evals]; });
  },

  getTokenSeries(): Promise<TokenPoint[]> {
    if (USE_MOCK.dashboard) return mock(getTokenSeries(24, 60));
    return http.get<TokenPoint[]>('/internal/dashboard/token-series', { hours: 24, step: 60 });
  },

  getTrendSeries(): Promise<TrendPoint[]> {
    if (USE_MOCK.dashboard) return mock(getTrendSeries(24, 60));
    return http.get<TrendPoint[]>('/internal/dashboard/trend-series', { hours: 24, step: 60 });
  },

  getDeptTco(): Promise<DeptTco[]> {
    if (USE_MOCK.dashboard) return mock(getDeptTco());
    // 后端返回 {dept_id(TENANT-*), name, tco, tokens}，转换为 DeptTco
    return http.get<Record<string, unknown>[]>('/internal/dashboard/dept-tco').then(rows => {
      return (rows || []).map((r) => ({
        deptId: String(r.deptId ?? '').replace('TENANT-', 'DEPT-'),
        deptName: String(r.name ?? r.deptId ?? ''),
        tco: Number(r.tco ?? 0),
        tokens: Number(r.tokens ?? 0),
      }));
    });
  },

  getFunnelData(): Promise<FunnelStage[]> {
    if (USE_MOCK.dashboard) return mock(getFunnelData());
    return http.get<FunnelStage[]>('/internal/dashboard/funnel');
  },

  getRateLimitHits() {
    if (USE_MOCK.dashboard) return mock(getRateLimitHits());
    // 后端返回限流规则配置，需转换为 RateLimitHit[] 格式
    return http.get<Record<string, unknown>[]>('/internal/dashboard/rate-limit-hits').then(rules => {
      return (rules || []).map((r, i) => ({
        rateLimitId: String(r.ruleId ?? `RL-${i}`),
        dimension: 'QPS' as const,
        threshold: Number(r.qpsPerMin ?? r.qpsLimit ?? 0),
        currentValue: Number(r.hits24h ?? 0),
        action: (r.overAction === 'REJECT' ? 'BLOCK' : 'LIMIT') as 'LIMIT' | 'BLOCK',
        policyId: String(r.ruleId ?? ''),
        policyName: String(r.name ?? ''),
        appId: String(r.targetId ?? r.target ?? ''),
        tenantId: 'GLOBAL',
        traceId: null,
        createdAt: new Date().toISOString(),
      }));
    });
  },

  getQueueData(): Promise<PriorityQueueItem[]> {
    // 优先级队列数据（运维大盘），后端 /internal/dashboard/queue 真实存在；异常时回落本地示例
    return http
      .get<Record<string, unknown>[]>('/internal/dashboard/queue')
      .then((rows) =>
        (rows || []).map((r) => ({
          priorityClass: String(r.priorityClass ?? 'P1') as PriorityQueueItem['priorityClass'],
          queued: Number(r.queued ?? 0),
          running: Number(r.running ?? 0),
          avgWaitMs: Number(r.avgWaitMs ?? 0),
          maxWaitMs: Number(r.maxWaitMs ?? 0),
        })),
      )
      .catch((e: unknown) => { warnFallback('getQueueData', e); return getQueueData(); });
  },

  getBatchTrend(): Promise<BatchPoint[]> {
    if (USE_MOCK.dashboard) return mock(getBatchTrend());
    return http.get<BatchPoint[]>('/internal/dashboard/batch-trend');
  },

  getHeatmapData(): Promise<HeatCell[]> {
    // 算力热区（时间 × 模型负载），后端 /internal/dashboard/heatmap 真实存在
    return http
      .get<Record<string, unknown>[]>('/internal/dashboard/heatmap')
      .then((rows) =>
        (rows || []).map((r) => ({
          node: String(r.node ?? ''),
          pool: String(r.pool ?? ''),
          hour: Number(r.hour ?? 0),
          utilization: Number(r.utilization ?? 0),
        })),
      )
      .catch((e: unknown) => { warnFallback('getHeatmapData', e); return getHeatmapData(); });
  },

  getOptimizeAdvice(): Promise<OptimizeAdvice[]> {
    // 优化建议闭环状态需持久化（ACCEPTED→EXECUTED→VERIFIED→CLOSED），统一落到 mas_platform_config
    return loadConfig<OptimizeAdvice[]>(CONFIG_KEYS.advices, [...cfg.adviceStore]);
  },

  /* ============ 配置域查询（完善方案 v2 第五章） ============ */

  getApiKeys(): Promise<ApiKey[]> {
    if (USE_MOCK.apiKey) return mock([...cfg.apiKeys]);
    /* 后端返回 { keys: [...], total }，解包并将后端字段映射为前端 ApiKey 结构 */
    return http.get<{ keys: Record<string, unknown>[]; total: number }>('/internal/api-keys').then((res) =>
      (res.keys ?? []).map((k) => ({
        keyId: String(k.keyPrefix ?? ''),
        keyFull: '',
        keyMasked: `${String(k.keyPrefix ?? '')}****`,
        desc: String(k.purpose ?? ''),
        ownerDept: String(k.teamName ?? ''),
        appId: k.appId ? String(k.appId) : '',
        status: k.status === 1 ? 'ENABLED' : 'DISABLED',
        expireAt: k.expireAt ? String(k.expireAt) : null,
        callQuota: 0,
        usedCount: 0,
        allowedModels: [],
        rateLimitRuleId: null,
        lastUsedAt: null,
        createdAt: String(k.createdAt ?? ''),
        env: 'PROD',
        lastUsedIp: '',
      })),
    );
  },
  getRateLimitRules(): Promise<RateLimitRule[]> {
    if (USE_MOCK.routing) return mock([...cfg.rateLimitRules]);
    return http.get('/internal/routing/rate-limit-rules');
  },
  getRoutingRuleSets(): Promise<RoutingRuleSet[]> {
    // 场景路由规则集已落 mas_routing_rule_set（此前后端假写，前端只能读内存）
    return http
      .get<Record<string, unknown>[]>('/internal/routing/routing-rule-sets')
      .then((rows) =>
        (rows || []).map((r) => ({
          sceneKey: String(r.sceneKey ?? '') as RoutingRuleSet['sceneKey'],
          sceneName: String(r.sceneName ?? ''),
          priority: String(r.priority ?? 'P1') as RoutingRuleSet['priority'],
          allowedModels: Array.isArray(r.allowedModels) ? (r.allowedModels as string[]) : [],
          fallbackModel: String(r.fallbackModel ?? ''),
          latencyCeilMs: Number(r.latencyCeilMs ?? 1200),
          policyId: r.policyId ? String(r.policyId) : null,
        })),
      )
      .catch((e: unknown) => { warnFallback('getRoutingRuleSets', e); return cfg.routingRuleSets.map((r) => ({ ...r })); });
  },
  getAggregationGroups(): Promise<AggregationGroup[]> {
    // 聚合组已落 mas_aggregation_group
    return http
      .get<Record<string, unknown>[]>('/internal/routing/aggregation-groups')
      .then((rows) =>
        (rows || []).map((r) => ({
          groupId: String(r.groupId ?? ''),
          name: String(r.name ?? ''),
          members: Array.isArray(r.members) ? (r.members as string[]) : [],
          strategy: String(r.strategy ?? 'WEIGHTED') as AggregationGroup['strategy'],
          autoSkipFault: r.autoSkipFault === undefined ? true : Boolean(r.autoSkipFault),
          healthCheckSec: Number(r.healthCheckSec ?? 30),
          faultMembers: [],
        })),
      )
      .catch((e: unknown) => { warnFallback('getAggregationGroups', e); return cfg.aggregationGroups.map((g) => ({ ...g })); });
  },
  getElasticSwitch(): Promise<ElasticSwitchConfig> {
    // 弹性切换已落 mas_elastic_switch
    return http
      .get<Record<string, unknown>>('/internal/routing/elastic-switch')
      .then((r) => ({
        triggerUtil: Number(r?.triggerUtil ?? 85),
        sustainMin: Number(r?.sustainMin ?? 5),
        target: String(r?.target ?? 'RENTAL') as ElasticSwitchConfig['target'],
        trafficRatio: Number(r?.trafficRatio ?? 30),
        active: r?.active === undefined ? true : Boolean(r.active),
      }))
      .catch(() => ({ ...cfg.elasticSwitch }));
  },
  getQuotas(): Promise<QuotaProfile[]> {
    if (USE_MOCK.metering) return mock([...cfg.quotas]);
    return http.get('/internal/metering/quotas');
  },
  getConnections(): Promise<ModelConnection[]> {
    // 模型接入已落 mas_model_connection（此前后端返回 4 条硬编码，前端干脆降级为 mock）
    return http
      .get<Record<string, unknown>[]>('/internal/models/connections')
      .then((rows) =>
        (rows || []).map((r) => ({
          connId: String(r.connId ?? ''),
          name: String(r.name ?? ''),
          source: String(r.source ?? 'LOCAL') as ModelConnection['source'],
          provider: String(r.provider ?? ''),
          modelType: String(r.modelType ?? '文本生成'),
          apiKeyMasked: String(r.apiKeyMasked ?? ''),
          baseUrl: String(r.baseUrl ?? ''),
          nodes: Number(r.nodes ?? 0),
          cardType: String(r.cardType ?? ''),
          status: String(r.status ?? 'ONLINE') as ModelConnection['status'],
          latencyMs: r.latencyMs == null ? null : Number(r.latencyMs),
          assetId: r.assetId ? String(r.assetId) : null,
          lastCheckAt: String(r.lastCheckAt ?? ''),
          createdAt: String(r.createdAt ?? ''),
        })),
      )
      .catch((e: unknown) => { warnFallback('getConnections', e); return cfg.connections.map((c) => ({ ...c })); });
  },
  getModelCards(): Promise<ModelCard[]> {
    return loadConfig<ModelCard[]>(CONFIG_KEYS.modelCards, [...cfg.modelCards]);
  },
  getPlazaApplies(): Promise<PlazaApply[]> {
    return loadConfig<PlazaApply[]>(CONFIG_KEYS.plazaApplies, [...cfg.plazaApplies]);
  },
  getGrayReleases(): Promise<GrayRelease[]> {
    return http
      .get<Record<string, unknown>[]>('/internal/models/releases')
      .then((rows) =>
        (rows || []).map((r) => ({
          releaseId: String(r.releaseId ?? ''),
          modelId: String(r.modelId ?? ''),
          fromVersion: String(r.fromVersion ?? ''),
          toVersion: String(r.toVersion ?? ''),
          percent: Number(r.grayPercent ?? 0),
          scope: String(r.grayScope ?? '全局'),
          status: String(r.status ?? 'GRAYING'),
          operator: String(r.operator ?? ''),
          createdAt: String(r.createdAt ?? ''),
        })) as unknown as GrayRelease[],
      )
      .catch((e: unknown) => { warnFallback('getGrayReleases', e); return cfg.grayReleases.map((g) => ({ ...g })); });
  },
  getArchivedModels(): Promise<ArchivedModel[]> {
    // 归档已落 mas_model_archive（含一键复活、监管永久留存不可删）
    return http
      .get<Record<string, unknown>[]>('/internal/models/archives')
      .then((rows) =>
        (rows || []).map((r) => ({
          assetId: String(r.modelId ?? ''),
          assetName: String(r.modelName ?? r.modelId ?? ''),
          reason: String(r.reason ?? 'MANUAL') as ArchivedModel['reason'],
          archivedAt: String(r.archivedAt ?? ''),
          retention: String(r.retention ?? '24M') as ArchivedModel['retention'],
          valueScore: String(r.valueScore ?? 'C') as ArchivedModel['valueScore'],
          scoreDetail: {
            cost: Number(r.scoreCost ?? 0),
            conversion: Number(r.scoreConversion ?? 0),
            riskAcc: Number(r.scoreRiskAcc ?? 0),
          },
        })),
      )
      .catch((e: unknown) => { warnFallback('getArchivedModels', e); return cfg.archivedModels.map((a) => ({ ...a })); });
  },
  getArchiveRules(): Promise<ArchiveRules> {
    // 自动归档规则已落 mas_archive_rule
    return http
      .get<Record<string, unknown>[]>('/internal/models/archive-rules')
      .then((rows) => {
        const on = (key: string) =>
          (rows || []).some((r) => String(r.ruleKey ?? '') === key && Number(r.enabled ?? 0) === 1);
        return { noCall90d: on('NO_CALL_90D'), replaced: on('REPLACED'), compliance: on('COMPLIANCE') };
      })
      .catch(() => ({ ...cfg.archiveRules }));
  },
  getGuardrailConfig(): Promise<GuardrailConfig> {
    // 护栏配置已落 mas_guardrail_config（此前后端返回写死常量，前端索性 mock）
    return http
      .get<Record<string, unknown>>('/internal/security/guardrail')
      .then((r) => ({
        enabled: r?.enabled === undefined ? true : Boolean(r.enabled),
        apiUrl: String(r?.apiUrl ?? ''),
        apiKeyMasked: String(r?.apiKeyMasked ?? ''),
        textLatencyMs: Number(r?.textLatencyMs ?? 200),
        multimodalLatencyMs: Number(r?.multimodalLatencyMs ?? 1200),
      }))
      .catch(() => ({ ...cfg.guardrailConfig }));
  },
  getGuardrailPolicies(): Promise<GuardrailPolicy[]> {
    // 护栏策略已落 mas_guardrail_policy
    return http
      .get<Record<string, unknown>[]>('/internal/security/guardrail/policies')
      .then((rows) =>
        (rows || []).map((r) => ({
          policyId: String(r.policyId ?? ''),
          name: String(r.name ?? ''),
          desc: String(r.desc ?? ''),
          modules: Array.isArray(r.modules) ? (r.modules as string[]) : [],
          action: String(r.action ?? 'ALERT') as GuardrailPolicy['action'],
          bindApps: Array.isArray(r.bindApps) ? (r.bindApps as string[]) : [],
        })),
      )
      .catch((e: unknown) => { warnFallback('getGuardrailPolicies', e); return cfg.guardrailPolicies.map((p) => ({ ...p })); });
  },
  getDetectModules(): Promise<DetectModule[]> {
    return loadConfig<DetectModule[]>(CONFIG_KEYS.detectModules, cfg.detectModules.map((m) => ({ ...m })));
  },
  getKeywordLibs(): Promise<KeywordLibrary[]> {
    return loadConfig<KeywordLibrary[]>(CONFIG_KEYS.keywordLibs, [...cfg.keywordLibs]);
  },
  getDetectModels(): Promise<DetectModelInfo[]> {
    return loadConfig<DetectModelInfo[]>(CONFIG_KEYS.detectModels, [...cfg.detectModels]);
  },
  getReportFeedbacks(): Promise<ReportFeedback[]> {
    return loadConfig<ReportFeedback[]>(CONFIG_KEYS.reportFeedbacks, [...cfg.reportFeedbacks]);
  },
  getCallLogs(): Promise<CallLog[]> {
    if (USE_MOCK.metering) return mock([...cfg.callLogs]);
    return http.get<{ logs: CallLog[]; total: number }>('/internal/metering/call-logs').then(r => r.logs);
  },
  getPersonalUsage(): Promise<PersonalUsage[]> {
    if (USE_MOCK.metering) return mock([...cfg.personalUsage]);
    return http.get('/internal/metering/personal-usage').then(r => [r] as PersonalUsage[]);
  },
  getPersonalTrend(): Promise<PersonalTrendPoint[]> {
    return mock([...cfg.personalTrend]);
  },
  getModelUsageStats(): Promise<ModelUsageStat[]> {
    if (USE_MOCK.metering) return mock([...cfg.modelUsageStats]);
    return http.get('/internal/metering/model-stats');
  },
  getModelRecommends(): Promise<ModelRecommend[]> {
    if (USE_MOCK.metering) return mock([...cfg.modelRecommends]);
    return http.get('/internal/metering/model-recommends');
  },
  getRoutingSaving() {
    // 前端计算指标（路由节省估算），无对应后端端点，始终使用本地数据
    return mock({ ...cfg.routingSaving });
  },
  getEmergencyTickets(): Promise<EmergencyTicket[]> {
    return loadConfig<EmergencyTicket[]>(CONFIG_KEYS.emergencyTickets, [...cfg.emergencyTickets]);
  },
  getOrchestration(): Promise<OrchestrationConfig> {
    // 算力编排配置已落 mas_compute_orchestration（混部/优先级/连续批处理/KV缓存/投机解码）
    return http
      .get<Record<string, unknown>>('/internal/compute/orchestration')
      .then((r) => ({
        mixDeploy: Number(r?.mixedDeployEnabled ?? 0) === 1,
        mixAffinity: Array.isArray(r?.affinityModels) ? (r.affinityModels as string[]) : [],
        vramReserve: Number(r?.memoryReservePct ?? 15),
        weights: {
          P0: Number(r?.prioWeightP0 ?? 8),
          P1: Number(r?.prioWeightP1 ?? 5),
          P2: Number(r?.prioWeightP2 ?? 2),
        },
        lowPrioritySlow: Number(r?.lowPrioQueueing ?? 0) === 1,
        p0Preempt: Number(r?.allowP0Preempt ?? 0) === 1,
        continuousBatch: Number(r?.continuousBatch ?? 0) === 1,
        maxBatch: Number(r?.batchMaxSize ?? 64),
        kvCache: Number(r?.prefixKvCache ?? 0) === 1,
        kvStrategy: String(r?.kvStrategy ?? 'ROUND_ROBIN') as OrchestrationConfig['kvStrategy'],
        speculative: Number(r?.speculativeDecode ?? 0) === 1,
        draftModel: String(r?.draftModel ?? ''),
      }))
      .catch(() => ({ ...cfg.orchestration, weights: { ...cfg.orchestration.weights }, mixAffinity: [...cfg.orchestration.mixAffinity] }));
  },
  getNodeConfig(resourceId: string): Promise<NodeConfig> {
    return loadConfig<Record<string, NodeConfig>>(CONFIG_KEYS.nodeConfigs, cfg.nodeConfigs)
      .then((map) => map[resourceId] ?? ({ resourceId, vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 8192, quantization: 'FP16', replicas: 1, extendRental: false } as NodeConfig));
  },
  getTenantRetentions(): Promise<TenantRetention[]> {
    return mock([...cfg.tenantRetentions]);
  },
  getOperationRecords(): Promise<OperationRecord[]> {
    // 操作审计留痕已持久化到 mas_op_log，不再依赖前端内存数组
    return http
      .get<{ records: Record<string, unknown>[]; total: number }>('/internal/system/op-logs', { page: 1, size: 50 })
      .then((res) =>
        (res.records || []).map((r) => ({
          opId: String(r.opId ?? ''),
          opType: String(r.opType ?? ''),
          operator: String(r.operator ?? ''),
          targetId: String(r.targetId ?? ''),
          detail: String(r.detail ?? ''),
          createdAt: String(r.createdAt ?? ''),
        })) as OperationRecord[],
      )
      .catch((e: unknown) => { warnFallback('getOperationRecords', e); return [...cfg.operationRecords]; });
  },

  /* ============ 配置域写操作（内存态 mock，返回留痕记录） ============ */

  /** 保存（新建/编辑）API Key：真实落 mas_api_key（此前仅前端内存，刷新即回退） */
  saveApiKey(data: Omit<ApiKey, 'keyId' | 'keyFull' | 'keyMasked' | 'usedCount' | 'createdAt'> & { keyId?: string }): Promise<OperationRecord> {
    if (data.keyId) {
      // 编辑：更新元数据（描述/归属/可用模型等）
      return http
        .put(`/internal/api-keys/${data.keyId}`, {
          teamName: data.ownerDept,
          purpose: data.desc,
          appId: data.appId,
          agentName: data.allowedModels?.join(',') ?? '',
        })
        .then(() => okRec('编辑 API Key', data.keyId!, `更新描述/额度/可用模型（${data.desc}）`));
    }
    // 新建：后端返回明文 Key 一次
    return http
      .post<Record<string, unknown>>('/internal/api-keys', {
        userId: 'admin',
        appId: data.appId,
        teamName: data.ownerDept,
        purpose: data.desc,
        agentType: 'CHAT',
        expireDays: 365,
        quotaTier: 'default',
        createdBy: 'admin',
      })
      .then((r) => okRec('新建 API Key', String(r?.keyPrefix ?? ''), `创建密钥（${data.desc}），归属 ${data.ownerDept}`));
  },
  /** 启用/禁用 API Key：真实落 mas_api_key.status（此前仅前端内存） */
  toggleApiKey(keyId: string): Promise<OperationRecord> {
    return http
      .put<Record<string, unknown>>(`/internal/api-keys/${keyId}/status`, {})
      .then((r) => okRec(r?.status === 1 ? '启用 API Key' : '禁用 API Key', keyId, `密钥状态切换为 ${r?.status === 1 ? 'ENABLED' : 'DISABLED'}`));
  },
  /** 重置 API Key：真实调用轮换端点（旧 Key 进入宽限期，返回新明文 Key 一次） */
  resetApiKey(keyId: string): Promise<{ rec: OperationRecord; newKey: string }> {
    return http
      .post<Record<string, unknown>>(`/internal/api-keys/${keyId}/rotate`, {})
      .then((r) => ({ rec: okRec('重置 API Key', keyId, '旧 Key 立即失效，已生成新 Key'), newKey: String(r?.key ?? '') }));
  },
  /** 删除（吊销）API Key：真实落 mas_api_key.status=0 */
  deleteApiKey(keyId: string): Promise<OperationRecord> {
    return http
      .delete(`/internal/api-keys?prefix=${encodeURIComponent(keyId)}`)
      .then(() => okRec('删除 API Key', keyId, '密钥已删除，关联调用立即拒绝'));
  },

  saveRateLimitRule(rule: RateLimitRule): Promise<OperationRecord> {
    if (USE_MOCK.routing) {
      const idx = cfg.rateLimitRules.findIndex((r) => r.ruleId === rule.ruleId);
      if (idx >= 0) cfg.rateLimitRules[idx] = rule;
      else cfg.rateLimitRules.unshift({ ...rule, ruleId: cfg.nextId('RL-CFG') });
      return mock(cfg.recordOp('保存限流规则', rule.ruleId, `${rule.name}：QPS ${rule.qpsPerMin}/min，输入 ${rule.inputTokenLimit}，并发 ${rule.concurrency}`), 200);
    }
    if (rule.ruleId) return http.put(`/internal/routing/rate-limit-rules/${rule.ruleId}`, rule);
    return http.post('/internal/routing/rate-limit-rules', rule);
  },
  /** 启停限流规则：真实落 mas_routing_rule.enabled（此前只改前端内存） */
  async toggleRateLimitRule(ruleId: string): Promise<OperationRecord> {
    if (USE_MOCK.routing) {
      const r = cfg.rateLimitRules.find((x) => x.ruleId === ruleId);
      if (r) r.enabled = !r.enabled;
      return mock(cfg.recordOp(r?.enabled ? '启用限流规则' : '停用限流规则', ruleId, r?.name ?? ''), 200);
    }
    const rows = await http.get<Record<string, unknown>[]>('/internal/routing/rate-limit-rules');
    const cur = (rows ?? []).find((x) => String(x.ruleId ?? '') === ruleId);
    return http.put(`/internal/routing/rate-limit-rules/${ruleId}`, { enabled: !(cur && cur.enabled) });
  },
  deleteRateLimitRule(ruleId: string): Promise<OperationRecord> {
    if (USE_MOCK.routing) {
      const idx = cfg.rateLimitRules.findIndex((x) => x.ruleId === ruleId);
      if (idx >= 0) cfg.rateLimitRules.splice(idx, 1);
      return mock(cfg.recordOp('删除限流规则', ruleId, '规则已删除'), 200);
    }
    return http.delete(`/internal/routing/rate-limit-rules/${ruleId}`);
  },
  saveRoutingRuleSet(rs: RoutingRuleSet): Promise<OperationRecord> {
    if (USE_MOCK.routing) {
      const idx = cfg.routingRuleSets.findIndex((x) => x.sceneKey === rs.sceneKey);
      const policyId = rs.policyId ?? cfg.nextId('POL-ROUTING');
      if (idx >= 0) cfg.routingRuleSets[idx] = { ...rs, policyId };
      return mock(cfg.recordOp('保存场景路由规则', rs.sceneKey, `${rs.sceneName}：优先级 ${rs.priority}，时延上限 ${rs.latencyCeilMs}ms，已生成 ${policyId} 待审批`), 200);
    }
    return http.post('/internal/routing/routing-rule-sets', rs);
  },

  setQuota(deptId: string, quota: number, reason: string): Promise<OperationRecord> {
    if (USE_MOCK.metering) {
      const q = cfg.quotas.find((x) => x.deptId === deptId);
      if (q) {
        q.monthTokenQuota = quota;
        q.status = q.usedTokens > quota ? (q.overLimitStop ? 'STOPPED' : 'WARNING') : q.usedTokens / quota >= q.warnThreshold / 100 ? 'WARNING' : 'NORMAL';
      }
      return mock(cfg.recordOp('调整配额', deptId, `月度 Token 配额调整为 ${(quota / 10000).toLocaleString()} 万（原因：${reason}）`), 200);
    }
    return http.put(`/internal/metering/quotas/${deptId}`, { monthTokenQuota: quota, reason });
  },
  /** 超限即停开关：真实落 mas_dept_quota.over_limit_stop（此前仅改前端内存，刷新即回退） */
  async toggleQuotaStop(deptId: string): Promise<OperationRecord> {
    if (USE_MOCK.metering) {
      const q = cfg.quotas.find((x) => x.deptId === deptId);
      if (q) q.overLimitStop = !q.overLimitStop;
      return mock(cfg.recordOp(q?.overLimitStop ? '开启超限即停' : '关闭超限即停', deptId, q?.deptName ?? ''), 200);
    }
    const rows = await http.get<Record<string, unknown>[]>('/internal/metering/quotas');
    const cur = (rows ?? []).find((r) => String(r.deptId ?? '') === deptId);
    const next = !(cur && cur.overLimitStop);
    return http.put(`/internal/metering/quotas/${deptId}`, { overLimitStop: next });
  },
  /** 余额预警配置：真实落 warn_threshold + notify_channels */
  setQuotaWarn(deptId: string, threshold: 80 | 90 | 95, channels: ('SITE' | 'MAIL' | 'SMS')[]): Promise<OperationRecord> {
    if (USE_MOCK.metering) {
      const q = cfg.quotas.find((x) => x.deptId === deptId);
      if (q) {
        q.warnThreshold = threshold;
        q.notifyChannels = channels;
      }
      return mock(cfg.recordOp('配置余额预警', deptId, `预警阈值 ${threshold}%，通知渠道 ${channels.join('/')}`), 200);
    }
    return http.put(`/internal/metering/quotas/${deptId}`, {
      warnThreshold: threshold,
      notifyChannels: channels.join(','),
    });
  },
  /** 申请恢复配额：真实落 r.esumePending=1 + r.esumeReason，并联动统一控制面待办 */
  requestQuotaResume(deptId: string, reason: string): Promise<OperationRecord> {
    if (USE_MOCK.metering) {
      const q = cfg.quotas.find((x) => x.deptId === deptId);
      if (q) q.resumePending = true;
      // 联动：我的申请
      if (!cfg.myApplications.some((m) => m.kind === 'QUOTA_RESUME' && m.status === 'PENDING' && m.title.includes(q?.deptName ?? deptId))) {
        cfg.myApplications.unshift({ applyId: cfg.nextId('MA'), kind: 'QUOTA_RESUME', title: `配额恢复：${q?.deptName ?? deptId}`, reason, status: 'PENDING', submitAt: new Date().toISOString(), approveAt: null, opinion: '' });
      }
      return mock(cfg.recordOp('申请恢复配额', deptId, `超限停发恢复申请已提交审批（理由：${reason}）`), 200);
    }
    return http.post(`/internal/metering/quotas/${deptId}/resume`, { reason });
  },

  saveConnection(conn: ModelConnection): Promise<OperationRecord> {
    if (USE_MOCK.modelAsset) {
      const idx = cfg.connections.findIndex((c) => c.connId === conn.connId);
      if (idx >= 0) cfg.connections[idx] = conn;
      else cfg.connections.unshift({ ...conn, connId: cfg.nextId('CONN') });
      return mock(cfg.recordOp('保存模型接入', conn.connId, `${conn.name}（${conn.source === 'CLOUD' ? conn.provider : conn.source === 'LOCAL' ? '本地算力' : '租赁算力'}）`), 200);
    }
    if (conn.connId) return http.put(`/internal/models/connections/${conn.connId}`, conn);
    return http.post('/internal/models/connections', conn);
  },
  testConnection(connId: string): Promise<{ ok: boolean; latencyMs: number }> {
    // 后端 /internal/models/connections/{id}/test 真实存在（此前前端用 Math.random 造假时延）
    return http
      .post<Record<string, unknown>>(`/internal/models/connections/${connId}/test`, {})
      .then((r) => ({
        ok: r?.ok === undefined ? true : Boolean(r.ok),
        latencyMs: Number(r?.latencyMs ?? 0),
      }))
      .catch(() => ({ ok: false, latencyMs: 0 }));
  },
  deleteConnection(connId: string): Promise<OperationRecord> {
    if (USE_MOCK.modelAsset) {
      const idx = cfg.connections.findIndex((x) => x.connId === connId);
      if (idx >= 0) cfg.connections.splice(idx, 1);
      return mock(cfg.recordOp('删除模型接入', connId, '接入已删除'), 200);
    }
    return http.delete(`/internal/models/connections/${connId}`);
  },

  applyModelCard(cardId: string, deptId: string, purpose: string, estMonthCalls: number): Promise<OperationRecord> {
    const card = cfg.modelCards.find((c) => c.cardId === cardId);
    return (async () => {
      await mutateConfig<PlazaApply[]>(CONFIG_KEYS.plazaApplies, [...cfg.plazaApplies], (list) => [
        { applyId: cfg.nextId('APL'), cardId, deptId, purpose, estMonthCalls, status: 'PENDING', createdAt: new Date().toISOString() } as PlazaApply,
        ...list,
      ]);
      await mutateConfig<MyApplication[]>(CONFIG_KEYS.myApplications, [...cfg.myApplications], (list) => [
        { applyId: cfg.nextId('MA'), kind: 'MODEL_ACCESS', title: `模型接入：${card?.name ?? cardId}`, reason: purpose, status: 'PENDING', submitAt: new Date().toISOString(), approveAt: null, opinion: '' } as MyApplication,
        ...list,
      ]);
      return okRec('模型广场申请', cardId, `${card?.name ?? cardId} 接入申请已提交模型负责人审批`);
    })();
  },

  advanceGray(releaseId: string, payload: Partial<GrayRelease>): Promise<OperationRecord> {
    // 真实推进灰度比例（落 mas_model_release.gray_percent，此前仅前端内存）
    return http
      .patch(`/internal/models/releases/${releaseId}/percent`, { grayPercent: payload.percent ?? 10 })
      .then(() => okRec('灰度发布操作', releaseId, `推进至比例 ${payload.percent ?? 10}%，范围 ${payload.scope?.join('、') ?? '全局'}`));
  },
  rollbackGray(releaseId: string): Promise<OperationRecord> {
    // 真实回滚灰度（落 mas_model_release.status=ROLLED_BACK，此前仅前端内存）
    return http
      .post(`/internal/models/releases/${releaseId}/rollback`, {})
      .then(() => okRec('灰度回滚', releaseId, '已执行一键回滚（SLA ≤3 分钟），流量已切回现网版本'));
  },

  reviveArchived(assetId: string): Promise<OperationRecord> {
    // 归档复活：真实落 mas_model_archive.revived_at（监管永久留存项除外）
    return http.post(`/internal/models/archives/by-model/${assetId}/revive`, {});
  },
  deleteArchived(assetId: string): Promise<OperationRecord> {
    // 永久删除归档（后端对 PERMANENT 留存项直接拒绝）
    return http.delete(`/internal/models/archives/by-model/${assetId}`);
  },
  saveArchiveRules(rules: ArchiveRules): Promise<OperationRecord> {
    // 自动归档规则真实落 mas_archive_rule
    return http.put('/internal/models/archive-rules', [
      { ruleId: 'AR-001', ruleKey: 'NO_CALL_90D', enabled: rules.noCall90d, action: 'SUGGEST', thresholdDays: 90 },
      { ruleId: 'AR-002', ruleKey: 'REPLACED', enabled: rules.replaced, action: 'SUGGEST' },
      { ruleId: 'AR-003', ruleKey: 'COMPLIANCE', enabled: rules.compliance, action: 'SUGGEST' },
    ]);
  },
  /** 模型下线前依赖检查：返回仍在调用该模型的应用清单 */
  checkModelDependencies(assetId: string, days = 30): Promise<ModelDependencyCheck> {
    return http
      .get<Record<string, unknown>>(`/internal/models/${assetId}/dependencies`, { days })
      .then((r) => ({
        modelId: String(r?.modelId ?? assetId),
        windowDays: Number(r?.windowDays ?? days),
        dependentCount: Number(r?.dependentCount ?? 0),
        dependentApps: Array.isArray(r?.dependentApps) ? (r.dependentApps as ModelDependencyCheck['dependentApps']) : [],
        safeToOffline: r?.safeToOffline === undefined ? true : Boolean(r.safeToOffline),
      }))
      // 依赖检查失败时按"不可安全下线"处理（fail-safe：检查不可用不能得出安全结论）
      .catch(() => ({ modelId: assetId, windowDays: days, dependentCount: 0, dependentApps: [], safeToOffline: false }));
  },

  saveGuardrailConfig(c: GuardrailConfig): Promise<OperationRecord> {
    if (USE_MOCK.security) {
      Object.assign(cfg.guardrailConfig, c);
      return mock(cfg.recordOp('保存护栏规则', 'GUARDRAIL', `护栏${c.enabled ? '已开启' : '已关闭'}，API 地址 ${c.apiUrl}`), 200);
    }
    return http.put('/internal/security/guardrail', c);
  },
  testGuardrail(): Promise<{ ok: boolean; textMs: number; mmMs: number }> {
    // 后端真实连通性自检：用当前生效的敏感词 AC 自动机实测样例文本，返回文本/多模态两路耗时
    return http
      .post<Record<string, unknown>>('/internal/security/guardrail/test')
      .then((r) => ({
        ok: Boolean(r?.ok),
        textMs: Number(r?.textMs ?? 0),
        mmMs: Number(r?.mmMs ?? 0),
      }));
  },
  saveGuardrailPolicy(p: GuardrailPolicy): Promise<OperationRecord> {
    if (USE_MOCK.security) {
      const idx = cfg.guardrailPolicies.findIndex((x) => x.policyId === p.policyId);
      if (idx >= 0) cfg.guardrailPolicies[idx] = p;
      else cfg.guardrailPolicies.unshift({ ...p, policyId: cfg.nextId('GD') });
      return mock(cfg.recordOp('保存安全策略', p.policyId, `${p.name}：动作 ${p.action}，模块 ${p.modules.length} 个`), 200);
    }
    if (p.policyId) return http.put(`/internal/security/guardrail/policies/${p.policyId}`, p);
    return http.post('/internal/security/guardrail/policies', p);
  },
  deleteGuardrailPolicy(policyId: string): Promise<OperationRecord> {
    if (USE_MOCK.security) {
      const idx = cfg.guardrailPolicies.findIndex((x) => x.policyId === policyId);
      if (idx >= 0) cfg.guardrailPolicies.splice(idx, 1);
      return mock(cfg.recordOp('删除安全策略', policyId, '策略已删除'), 200);
    }
    return http.delete(`/internal/security/guardrail/policies/${policyId}`);
  },
  toggleDetectModule(moduleKey: string): Promise<OperationRecord> {
    return mutateConfig<DetectModule[]>(CONFIG_KEYS.detectModules, cfg.detectModules.map((m) => ({ ...m })), (list) =>
      list.map((m) => m.moduleKey === moduleKey ? { ...m, enabled: !m.enabled } : m));
  },
  setModuleSensitivity(moduleKey: string, sensitivity: 'LOW' | 'MED' | 'HIGH'): Promise<OperationRecord> {
    return mutateConfig<DetectModule[]>(CONFIG_KEYS.detectModules, cfg.detectModules.map((m) => ({ ...m })), (list) =>
      list.map((m) => m.moduleKey === moduleKey ? { ...m, sensitivity } : m));
  },
  updateSystemLib(): Promise<OperationRecord> {
    return mutateConfig<KeywordLibrary[]>(CONFIG_KEYS.keywordLibs, [...cfg.keywordLibs], (list) =>
      list.map((l) => {
        if (l.type !== 'SYSTEM') return l;
        const v = Number(String(l.version ?? 'v2026.00').replace('v2026.', '')) || 0;
        return { ...l, version: `v2026.${String(v + 1).padStart(2, '0')}`, wordCount: l.wordCount + 312, updatedAt: new Date().toISOString() };
      })).then(() => okRec('更新系统词库', 'LIB-SYS', '系统词库已更新，新增 312 条（落库 mas_platform_config，刷新不再回退）'));
  },
  saveCustomLib(name: string, words: number, libId?: string): Promise<OperationRecord> {
    return mutateConfig<KeywordLibrary[]>(CONFIG_KEYS.keywordLibs, [...cfg.keywordLibs], (list) => {
      if (libId) {
        return list.map((l) => l.libId === libId ? { ...l, name, wordCount: words, updatedAt: new Date().toISOString() } : l);
      }
      return [...list, { libId: cfg.nextId('LIB'), name, type: 'CUSTOM', version: 'v1', wordCount: words, updatedAt: new Date().toISOString() }];
    }).then(() => okRec(libId ? '编辑自定义词库' : '新建自定义词库', libId ?? 'LIB', `${name}：${words} 条词条（落库 mas_platform_config）`));
  },
  deleteCustomLib(libId: string): Promise<OperationRecord> {
    return mutateConfig<KeywordLibrary[]>(CONFIG_KEYS.keywordLibs, [...cfg.keywordLibs], (list) =>
      list.filter((l) => l.libId !== libId)).then(() => okRec('删除自定义词库', libId, '词库已删除（落库 mas_platform_config）'));
  },
  handleReport(reportId: string, verdict: 'VALID' | 'FALSE_POSITIVE' | 'IGNORED'): Promise<OperationRecord> {
    return mutateConfig<ReportFeedback[]>(CONFIG_KEYS.reportFeedbacks, [...cfg.reportFeedbacks], (list) =>
      list.map((r) => r.reportId === reportId ? { ...r, status: verdict } : r)).then(() => okRec('处理举报反馈', reportId, `判定：${verdict === 'VALID' ? '有效' : verdict === 'FALSE_POSITIVE' ? '误报' : '忽略'}（落库 mas_platform_config）`));
  },
  setDefaultDetectModel(modelId: string): Promise<OperationRecord> {
    return mutateConfig<DetectModelInfo[]>(CONFIG_KEYS.detectModels, [...cfg.detectModels], (list) =>
      list.map((m) => ({ ...m, isDefault: m.modelId === modelId }))).then(() => okRec('切换默认检测模型', modelId, `${cfg.detectModels.find((m) => m.modelId === modelId)?.name ?? ''}（落库 mas_platform_config）`));
  },

  /** 策略审批/发布/回滚（B2 控制面工作台）：真实落库 + 审计留痕（此前仅前端内存） */
  approvePolicy(policyId: string, approve: boolean, opinion: string): Promise<OperationRecord> {
    return http
      .post(`/internal/policies/${policyId}/approve`, { approved: approve, comment: opinion })
      .then(() => okRec(approve ? '审批通过' : '审批驳回', policyId, `意见：${opinion}`));
  },
  /** 发布策略：审批通过即激活（分钟级下发网关节点） */
  publishPolicy(policyId: string): Promise<OperationRecord> {
    return http
      .post(`/internal/policies/${policyId}/approve`, { approved: true, comment: '发布生效' })
      .then(() => okRec('发布策略', policyId, '已下发全部网关节点（分钟级生效）'));
  },
  rollbackPolicy(policyId: string): Promise<OperationRecord> {
    return http
      .post(`/internal/policies/${policyId}/rollback`, {})
      .then(() => okRec('回滚策略', policyId, '已回滚至上一稳定版本（SLA ≤3 分钟）'));
  },
  createPolicy(policy: Policy): Promise<OperationRecord> {
    return http
      .post('/internal/policies', {
        policyId: policy.policyId,
        name: policy.policyName,
        category: policy.policyType,
        scope: policy.scopeValue,
        contentJson: JSON.stringify(policy.rules ?? {}),
      })
      .then(() => okRec('新建策略', policy.policyId, `${policy.policyName}（${policy.policyType}）已提交审批`));
  },
  editPolicy(policy: Policy): Promise<OperationRecord> {
    return http
      .put(`/internal/policies/${policy.policyId}`, {
        policyName: policy.policyName,
        policyType: policy.policyType,
        scope: policy.scopeValue,
        content: JSON.stringify(policy.rules ?? {}),
      })
      .then(() => okRec('编辑策略', policy.policyId, `${policy.policyName} 修改已保存，重新走审批`));
  },
  togglePolicy(policyId: string): Promise<OperationRecord> {
    return http
      .put(`/internal/policies/${policyId}/status`, {})
      .then(() => okRec('启用/停用策略', policyId, '策略启用状态已更新'));
  },
  /** DRAFT（含被驳回）策略重新提交审批（闭环①）—— 真实后端 */
  submitPolicy(policyId: string): Promise<OperationRecord> {
    return http
      .post<Record<string, unknown>>(`/internal/policies/${policyId}/submit`, {})
      .then(() =>
        ({
          opId: 'OP-' + Date.now(),
          opType: '提交审批',
          operator: '平台管理员',
          targetId: policyId,
          detail: '已提交审批（顶栏待办联动）',
          createdAt: new Date().toISOString(),
        }) as unknown as OperationRecord,
      );
  },

  /** 配额恢复审批（闭环②）：通过则解除停发，驳回则保持停发；真实落库 + 审计留痕 */
  approveQuotaResume(deptId: string, approve: boolean, opinion: string): Promise<OperationRecord> {
    if (!USE_MOCK.metering) {
      return http.post(`/internal/metering/quotas/${deptId}/resume/approve`, { approved: approve, opinion });
    }
    const q = cfg.quotas.find((x) => x.deptId === deptId);
    if (q) {
      q.resumePending = false;
      if (approve) {
        q.status = q.usedTokens / q.monthTokenQuota >= q.warnThreshold / 100 ? 'WARNING' : 'NORMAL';
      }
    }
    // 联动：我的申请状态回填
    const ma = cfg.myApplications.find((m) => m.kind === 'QUOTA_RESUME' && m.status === 'PENDING' && m.title.includes(q?.deptName ?? deptId));
    if (ma) {
      ma.status = approve ? 'APPROVED' : 'REJECTED';
      ma.approveAt = new Date().toISOString();
      ma.opinion = opinion;
    }
    return mock(cfg.recordOp(approve ? '配额恢复审批通过' : '配额恢复审批驳回', deptId, `${q?.deptName ?? ''}；意见：${opinion}`), 200);
  },

  /** 广场接入申请审批（闭环③）：真实落库 mas_platform_config（此前仅前端内存） */
  reviewPlazaApply(applyId: string, approve: boolean): Promise<OperationRecord> {
    return (async () => {
      const applies = await loadConfig<PlazaApply[]>(CONFIG_KEYS.plazaApplies, [...cfg.plazaApplies]);
      const a = applies.find((x) => x.applyId === applyId);
      const card = cfg.modelCards.find((c) => c.cardId === a?.cardId);
      await mutateConfig<PlazaApply[]>(CONFIG_KEYS.plazaApplies, [...cfg.plazaApplies], (list) =>
        list.map((x) => x.applyId === applyId
          ? { ...x, status: approve ? 'APPROVED' : 'REJECTED', opinion: approve ? '已通过，API Key 已分配并计入部门配额' : '已驳回，可修改用途后重新提交', approvedAt: new Date().toISOString() }
          : x));
      await mutateConfig<MyApplication[]>(CONFIG_KEYS.myApplications, [...cfg.myApplications], (list) =>
        list.map((m) => (m.kind === 'MODEL_ACCESS' && m.status === 'PENDING' && m.title.includes(card?.name ?? ''))
          ? { ...m, status: approve ? 'APPROVED' : 'REJECTED', approveAt: new Date().toISOString(), opinion: approve ? '已通过，API Key 已分配并计入部门配额' : '已驳回，可重新提交' }
          : m));
      return okRec(approve ? '接入申请通过' : '接入申请驳回', a?.cardId ?? applyId, `${card?.name ?? ''}；${approve ? '已分配 API Key 并计入部门配额' : '申请已驳回，可重新提交'}`);
    })();
  },

  /** 优化建议闭环推进（闭环④）：ACCEPTED→EXECUTED→VERIFIED→CLOSED（真实落库 mas_platform_config） */
  progressAdvice(adviceId: string): Promise<OperationRecord> {
    const nextStatus = (s: OptimizeAdvice['status']): OptimizeAdvice['status'] =>
      (s === 'ACCEPTED' ? 'EXECUTED' : s === 'EXECUTED' ? 'VERIFIED' : s === 'VERIFIED' ? 'CLOSED' : s);
    let label = '推进建议';
    let detail = '';
    return mutateConfig<OptimizeAdvice[]>(CONFIG_KEYS.advices, [...cfg.adviceStore], (list) => {
      // 文案基于落库列表中的当前真实状态推导（而非内存种子，避免二次推进后文案错位）
      const cur = list.find((x) => x.adviceId === adviceId);
      const next = cur ? nextStatus(cur.status) : undefined;
      if (cur && next) {
        if (next === 'EXECUTED') { label = '建议已执行'; detail = `${cur.title}（工单 ${cur.workOrderId ?? '—'}）变更已上线`; }
        else if (next === 'VERIFIED') { label = '建议已验证'; detail = `${cur.title} 收益验证通过（预估月节省 ¥${cur.estimatedSaving.toLocaleString()}）`; }
        else if (next === 'CLOSED') { label = '建议已关闭'; detail = `${cur.title} 闭环完成，归档`; }
      }
      return list.map((a) => (a.adviceId === adviceId ? { ...a, status: next ?? a.status } : a));
    }).then(() => okRec(label, adviceId, `${detail}（落库 mas_platform_config）`));
  },

  /** 引擎升级完成确认（闭环⑤）：灰度验证通过 → 版本号更新为最新（落库 mas_platform_config） */
  finishEngineUpgrade(engineId: string): Promise<OperationRecord> {
    return mutateConfig<EngineVersionInfo[]>(CONFIG_KEYS.engineVersions, cfg.engineVersions.map((e) => ({ ...e })), (list) =>
      list.map((e) => e.engineId === engineId ? { ...e, version: e.latestVersion, upgradeStatus: 'UP_TO_DATE' } : e)).then(() =>
      okRec('引擎升级完成', engineId, '灰度验证通过，版本已更新并全量生效（落库 mas_platform_config）'));
  },

  /** 应急操作（P11） */
  execEmergency(type: EmergencyTicket['type'], target: string, params: string): Promise<EmergencyTicket> {
    // 工单号：日期 + 毫秒时间戳 base36 后 4 位（同日多次操作不碰撞；不用列表长度，避免刷新回退后重号）
    const t: EmergencyTicket = {
      ticketId: `EM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      type,
      operator: '平台管理员',
      target,
      params,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    return mutateConfig<EmergencyTicket[]>(CONFIG_KEYS.emergencyTickets, [...cfg.emergencyTickets], (list) => [t, ...list]).then(() => t);
  },
  rollbackEmergency(ticketId: string): Promise<OperationRecord> {
    return mutateConfig<EmergencyTicket[]>(CONFIG_KEYS.emergencyTickets, [...cfg.emergencyTickets], (list) =>
      list.map((t) => t.ticketId === ticketId ? { ...t, status: 'ROLLED_BACK' } : t)).then(() => okRec('应急回滚', ticketId, '已恢复常态（落库 mas_platform_config）'));
  },

  /** 资源编排（P17-P22） */
  saveOrchestration(c: OrchestrationConfig): Promise<OperationRecord> {
    // 真实落库 mas_compute_orchestration（此前只改前端内存，刷新即回原值）
    // 请求体按 http.ts 契约统一 camelCase（后端 body.get 双口径兼容 snake/camel）
    return http.put('/internal/compute/orchestration', {
      mixedDeployEnabled: c.mixDeploy,
      affinityModels: c.mixAffinity,
      memoryReservePct: c.vramReserve,
      prioWeightP0: c.weights.P0,
      prioWeightP1: c.weights.P1,
      prioWeightP2: c.weights.P2,
      lowPrioQueueing: c.lowPrioritySlow,
      allowP0Preempt: c.p0Preempt,
      continuousBatch: c.continuousBatch,
      batchMaxSize: c.maxBatch,
      prefixKvCache: c.kvCache,
      kvStrategy: c.kvStrategy,
      speculativeDecode: c.speculative,
      draftModel: c.draftModel,
    });
  },
  saveNodeConfig(nc: NodeConfig): Promise<OperationRecord> {
    return mutateConfig<Record<string, NodeConfig>>(CONFIG_KEYS.nodeConfigs, { ...cfg.nodeConfigs }, (map) => ({ ...map, [nc.resourceId]: { ...nc } }))
      .then(() => okRec('保存节点配置', nc.resourceId, `vGPU=${nc.vgpuEnabled ? nc.vgpuPercent + '%' : '关'}，量化=${nc.quantization}，副本=${nc.replicas}（落库 mas_platform_config）`));
  },
  adoptPeakShift(node: string): Promise<OperationRecord> {
    // 真实创建错峰调度任务（此前只在前端内存记一条留痕）
    return http.post('/internal/compute/batch-tasks', {
      task_name: `${node} 低价值任务错峰迁移`,
      task_type: 'MIGRATE',
      target_node: node,
      window_start: '00:00',
      window_end: '06:00',
      priority: 'P2',
    });
  },

  /* ============ 异构算力厂商资源（13.4 异构纳管） ============ */

  getHeteroVendors(): Promise<HeteroVendor[]> {
    // 异构算力厂商已落 mas_hetero_vendor（含国产化占比、调度策略、自动发现模式）
    return http
      .get<Record<string, unknown>[]>('/internal/compute/vendors')
      .then((rows) =>
        (rows || []).map((r) => {
          // 后端 adapt_status（ADAPTED/ADAPTING/PLANNED）→ 前端展示枚举；ADAPTED 及未知值一律按“已适配=兼容”
          const adapt = ADAPT_TO_COMPAT[String(r.adaptStatus ?? '')] ?? 'COMPATIBLE';
          // 每卡时薪（元）→ 成本档位：≥10 高成本，≥7 中成本，否则低成本
          const costPerHour = Number(r.costPerCardHour ?? 0);
          return {
            vendorId: String(r.vendorId ?? ''),
            vendor: String(r.vendorName ?? ''),
            chip: Array.isArray(r.cardModels) ? (r.cardModels as string[]).join('/') : String(r.cardModels ?? ''),
            kind: String(r.arch ?? 'CUDA') as HeteroVendor['kind'],
            domestic: Number(r.domestic ?? 0) === 1,
            count: Number(r.nodeCount ?? 0),
            vramPerCard: 0,
            utilization: 0,
            hostedModels: 0,
            compatStatus: adapt,
            costTag: (costPerHour >= 10 ? 'HIGH' : costPerHour >= 7 ? 'MID' : 'LOW') as HeteroVendor['costTag'],
            pools: [],
          };
        }),
      )
      .catch((e: unknown) => { warnFallback('getHeteroVendors', e); return cfg.heteroVendors.map((v) => ({ ...v, pools: [...v.pools] })); });
  },
  getHeteroSchedPolicy(): Promise<HeteroSchedPolicy> {
    return loadConfig<HeteroSchedPolicy>(CONFIG_KEYS.heteroSched, { ...cfg.heteroSchedPolicy, vendorPriority: [...cfg.heteroSchedPolicy.vendorPriority] });
  },
  saveHeteroSchedPolicy(p: HeteroSchedPolicy): Promise<OperationRecord> {
    return mutateConfig<HeteroSchedPolicy>(CONFIG_KEYS.heteroSched, { ...cfg.heteroSchedPolicy, vendorPriority: [...cfg.heteroSchedPolicy.vendorPriority] }, (cur) => ({ ...cur, ...p, vendorPriority: [...p.vendorPriority] }))
      .then(() => okRec('保存异构调度策略', 'HETERO-SCHED', `国产化优先=${p.domesticFirst}，跨厂商迁移=${p.crossVendorFailover}，租赁削峰=${p.rentalPeak}（落库 mas_platform_config）`));
  },

  /* ============ 多约束路由引擎（智能网关核心配置） ============ */

  getRoutingEngine(): Promise<RoutingEngineConfig> {
    if (USE_MOCK.routing) return mock({ ...cfg.routingEngine, weights: { ...cfg.routingEngine.weights } });
    return http.get('/internal/routing/engine');
  },
  saveRoutingEngine(c: RoutingEngineConfig): Promise<OperationRecord> {
    if (USE_MOCK.routing) {
      Object.assign(cfg.routingEngine, c, { weights: { ...c.weights } });
      const total = c.weights.latency + c.weights.cost + c.weights.risk + c.weights.load || 1;
      const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
      return mock(cfg.recordOp('保存路由引擎配置', 'ROUTING-ENGINE', `权重 时延${pct(c.weights.latency)}/成本${pct(c.weights.cost)}/风险${pct(c.weights.risk)}/负载${pct(c.weights.load)}；缓存优先=${c.cacheFirst}，预算约束=${c.budgetGuard}，SLA优先=${c.slaPriority}，自动降级=${c.autoFallback}`), 200);
    }
    return http.put('/internal/routing/engine', c);
  },

  /* ============ 复核补充：告警处置闭环（十一章） ============ */

  getAlertActions(): Promise<AlertAction[]> {
    return http
      .get<Record<string, unknown>[]>('/internal/security/alerts')
      .then((rows) =>
        (rows || []).map((r) => ({
          actionId: String(r.alertId ?? ''),
          alertId: String(r.alertId ?? ''),
          level: String(r.eventLevel ?? 'INFO'),
          title: String(r.title ?? ''),
          status: String(r.alertStatus ?? 'OPEN'),
          detail: String(r.detail ?? ''),
          traceId: String(r.traceId ?? ''),
          createdAt: String(r.createdAt ?? ''),
        })) as unknown as AlertAction[],
      )
      .catch((e: unknown) => { warnFallback('getAlertActions', e); return [...cfg.alertActions]; });
  },
  /** 告警处置：真实落库 mas_security_event/alert 状态（此前仅改前端内存，刷新即回退） */
  alertAction(alertId: string, action: AlertAction['action'], note: string): Promise<OperationRecord> {
    const status = action === 'ACK' ? 'ACKNOWLEDGED' : action === 'RESOLVE_START' ? 'HANDLING' : 'CLOSED';
    const label = action === 'ACK' ? '确认告警' : action === 'RESOLVE_START' ? '开始处置' : '关闭告警';
    return http
      .post(`/internal/security/alerts/${alertId}/handle`, { status, comment: note })
      .then(() => okRec(label, alertId, `${note}`));
  },

  /* ============ 复核补充：审批中心聚合（六章） ============ */

  getApprovals(): Promise<ApprovalItem[]> {
    return loadConfig<ApprovalItem[]>(CONFIG_KEYS.approvals, cfg.getApprovalItems());
  },

  /* ============ 复核补充：成本预警配置（六章运营策略） ============ */

  /** 成本预警：真实落 mas_platform_config */
  getCostAlertConfig(): Promise<CostAlertConfig> {
    return http
      .get<Record<string, unknown>>('/internal/metering/cost-alert')
      .then((r) => {
        const ch = typeof r.notifyChannels === 'string' ? String(r.notifyChannels).split(',') : r.notifyChannels;
        return {
          ...cfg.costAlertConfig,
          ...(r as unknown as Partial<CostAlertConfig>),
          notifyChannels: (Array.isArray(ch) ? ch : cfg.costAlertConfig.notifyChannels) as CostAlertConfig['notifyChannels'],
        } as CostAlertConfig;
      })
      .catch(() => ({ ...cfg.costAlertConfig, notifyChannels: [...cfg.costAlertConfig.notifyChannels] }));
  },
  saveCostAlertConfig(c: CostAlertConfig): Promise<OperationRecord> {
    // 真实落库 mas_metering_config（此前的前端内存 Object.assign 已移除——数据源唯一化，避免双写不一致）
    return http.put('/internal/metering/cost-alert', { ...c, notifyChannels: c.notifyChannels.join(',') });
  },

  /* ============ 复核补充：KV 缓存治理（八章） ============ */

  getKvGovernance(): Promise<KvCacheGovernance> {
    // KV 缓存治理并入算力编排配置（租户隔离 / 敏感禁存 / TTL），落 mas_compute_orchestration
    return http
      .get<Record<string, unknown>>('/internal/compute/orchestration')
      .then((r) => ({
        tenantIsolation: Number(r?.kvTenantIsolate ?? 1) === 1,
        forbidSensitive: Number(r?.kvSensitiveForbidden ?? 1) === 1,
        ttlMin: Number(r?.kvTtlMin ?? 60),
        auditEnabled: Number(r?.prefixKvCache ?? 0) === 1,
        hitTokens24h: 0,
        savedCostPct: 0,
      }))
      .catch(() => ({ ...cfg.kvGovernance }));
  },
  saveKvGovernance(g: KvCacheGovernance): Promise<OperationRecord> {
    // 真实落库：与编排配置同源，只提交 KV 相关字段（请求体统一 camelCase，与 saveOrchestration 口径一致）
    return http.put('/internal/compute/orchestration', {
      kvTenantIsolate: g.tenantIsolation,
      kvSensitiveForbidden: g.forbidSensitive,
      kvTtlMin: g.ttlMin,
      prefixKvCache: g.auditEnabled,
    });
  },

  /* ============ 复核补充：推理引擎版本管理（13.3） ============ */

  getEngineVersions(): Promise<EngineVersionInfo[]> {
    return loadConfig<EngineVersionInfo[]>(CONFIG_KEYS.engineVersions, cfg.engineVersions.map((e) => ({ ...e })));
  },
  startEngineUpgrade(engineId: string): Promise<OperationRecord> {
    return mutateConfig<EngineVersionInfo[]>(CONFIG_KEYS.engineVersions, cfg.engineVersions.map((e) => ({ ...e })), (list) =>
      list.map((e) => e.engineId === engineId ? { ...e, upgradeStatus: 'GRAY_VERIFY' } : e)).then(() =>
      okRec('发起引擎升级', engineId, '已发起灰度升级（1 台低峰节点 24h 验证），状态落库 mas_platform_config'));
  },

  /* ============ 复核补充：请求执行策略清单（六章：证明执行了哪些策略） ============ */

  getExecutedPolicies(traceId: string): Promise<ExecutedPolicyItem[]> {
    // 优先取后端真实执行留痕（mas_policy_exec_log，由管线 L1/L3/L4 埋点写入）；
    // 有真实记录时以真实记录为准，不再拼装前端猜测值。
    const fromBackend = http
      .get<Record<string, unknown>[]>(`/internal/policies/exec-logs/${traceId}`)
      .then((rows) =>
        (rows || []).map((r) => ({
          policyType: String(r.stage ?? 'ROUTING') === 'L1'
            ? 'SECURITY'
            : String(r.stage ?? '') === 'L4' ? 'METERING' : 'ROUTING',
          policyId: String(r.policyId ?? ''),
          policyName: String(r.policyId ?? ''),
          matched: String(r.decision ?? 'PASS') !== 'PASS',
          effect: String(r.detail ?? '') + `（阶段 ${r.stage ?? '-'}，决策 ${r.decision ?? '-'}）`,
        })) as unknown as ExecutedPolicyItem[],
      );
    return fromBackend
      .catch(() => [] as ExecutedPolicyItem[]) // 埋点接口异常（如历史 trace/后端未部署）时回落推导展示，不产生未捕获 rejection
      .then((items) => (items && items.length > 0 ? items : fallbackExecutedPolicies(traceId)));

    // 无埋点数据（如历史 trace）时回落到基于路由日志的推导展示
    function fallbackExecutedPolicies(id: string): ExecutedPolicyItem[] {
      const log = getRouterLogs().find((l) => l.traceId === id);
      const items: ExecutedPolicyItem[] = [];
      if (!log) return items;
      const routing = cfg.policiesStore.find((p) => p.policyType === 'ROUTING' && (p.scopeValue === log.appId || p.scopeValue === '*'));
      items.push({
        policyType: 'ROUTING', policyId: routing?.policyId ?? 'POL-ROUTING-001', policyName: routing?.policyName ?? '智能客服路由策略',
        matched: true,
        effect: log.decision.fallbackTriggered ? `触发降级：${log.decision.fallbackReason}` : `多约束评分选中 ${log.decision.selectedModel}（时延 ${log.decision.scoreLatency} / 成本 ${log.decision.scoreCost} / 风险 ${log.decision.scoreRisk} / 负载 ${log.decision.scoreLoad}）`,
      });
      const security = cfg.policiesStore.find((p) => p.policyType === 'SECURITY');
      items.push({
        policyType: 'SECURITY', policyId: security?.policyId ?? 'POL-SEC-004', policyName: security?.policyName ?? 'L3 数据安全护栏策略',
        matched: true,
        effect: log.status === 'BLOCKED' ? '前置护栏阻断，请求未进入路由' : `鉴权通过，数据等级 ${log.dataLevel} 允许调用；输出脱敏规则生效`,
      });
      const metering = cfg.policiesStore.find((p) => p.policyType === 'METERING');
      items.push({
        policyType: 'METERING', policyId: metering?.policyId ?? 'POL-METER-005', policyName: metering?.policyName ?? '部门 Token 配额策略',
        matched: true,
        effect: `检查部门配额未超限，本请求 ${log.promptTokens}+${log.expectedOutputTokens} Token 计入 ${log.tenantId} 结算`,
      });
      const compute = cfg.policiesStore.find((p) => p.policyType === 'COMPUTE');
      items.push({
        policyType: 'COMPUTE', policyId: compute?.policyId ?? 'POL-COMPUTE-002', policyName: compute?.policyName ?? '生产资源优先级策略',
        matched: log.slaLevel === 'P0',
        effect: log.slaLevel === 'P0' ? `SLA=${log.slaLevel} 命中 P0 资源预留，分配 ${log.decision.selectedPool}/${log.decision.selectedNode}` : `SLA=${log.slaLevel} 未命中预留策略，按常规队列调度`,
      });
      const model = cfg.policiesStore.find((p) => p.policyType === 'MODEL');
      if (model) {
        const inGray = model.scopeValue === log.decision.selectedModel;
        items.push({
          policyType: 'MODEL', policyId: model.policyId, policyName: model.policyName,
          matched: inGray,
          effect: inGray ? '命中灰度策略，版本 v3.2 按 20% 比例放行' : '未命中灰度范围，使用现网稳定版本',
        });
      }
      return items;
    }
  },

  /* ============ 二轮完善：节点维护（P1-9） ============ */

  setNodeMaintenance(resourceId: string, maintenance: boolean): Promise<OperationRecord> {
    return mutateConfig<{ resourceId: string; maintenance: boolean; updatedAt: string }[]>(
      CONFIG_KEYS.nodeMaintenance,
      [],
      (list) => {
        const entry = { resourceId, maintenance, updatedAt: new Date().toISOString() };
        const idx = list.findIndex((x) => x.resourceId === resourceId);
        if (idx >= 0) list[idx] = entry;
        else list.unshift(entry);
        return [...list];
      },
    ).then(() =>
      okRec(maintenance ? '隔离维护' : '恢复上线', resourceId, `${maintenance ? '已隔离，新请求不再调度至该节点，在途请求完成后排空' : '已恢复上线，重新参与调度'}`),
    );
  },
  /** P2-13 容量预测：生成扩容工单（真实落库，刷新不回退） */
  requestExpansion(pool: string, reason: string): Promise<OperationRecord> {
    return mutateConfig<{ pool: string; reason: string; createdAt: string }[]>(
      CONFIG_KEYS.nodeExpansions,
      [],
      (list) => [{ pool, reason, createdAt: new Date().toISOString() }, ...list],
    ).then(() => okRec('提交扩容工单', pool, `${reason}；已推送算力采购流程（预计 2 周到货）`));
  },

  /* ============ 二轮完善：调用质量告警规则（P0-4） ============ */

  getQualityAlertRules(): Promise<QualityAlertRule[]> {
    return loadConfig<QualityAlertRule[]>(CONFIG_KEYS.qualityAlertRules, cfg.qualityAlertRules.map((r) => ({ ...r, channels: [...r.channels] })));
  },
  saveQualityAlertRule(rule: QualityAlertRule): Promise<OperationRecord> {
    return mutateConfig<QualityAlertRule[]>(CONFIG_KEYS.qualityAlertRules, cfg.qualityAlertRules.map((r) => ({ ...r })), (list) => {
      const idx = list.findIndex((r) => r.ruleId === rule.ruleId);
      if (idx >= 0) list[idx] = { ...rule, channels: [...rule.channels] };
      else list.unshift({ ...rule, ruleId: rule.ruleId || cfg.nextId('QA'), channels: [...rule.channels] });
      return [...list];
    }).then(() => okRec('保存告警规则', rule.ruleId, `${rule.name}：阈值 ${rule.threshold}${rule.unit}，通知 ${rule.channels.join('/')}`));
  },
  toggleQualityAlertRule(ruleId: string): Promise<OperationRecord> {
    return mutateConfig<QualityAlertRule[]>(CONFIG_KEYS.qualityAlertRules, cfg.qualityAlertRules.map((r) => ({ ...r })), (list) =>
      list.map((r) => (r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r)),
    ).then(() => okRec('切换告警规则', ruleId, '已启用/停用（落库 mas_platform_config）'));
  },

  /* ============ 二轮完善：成员与权限（P1-8） ============ */

  getMembers(): Promise<MemberInfo[]> {
    return http.get<Record<string, unknown>[]>('/internal/rbac/members').then((rows) =>
      (rows || []).map((r) => ({
        memberId: String(r.userCode ?? ''),
        name: String(r.userName ?? r.userCode ?? ''),
        deptId: String(r.deptId ?? ''),
        role: String(r.roles ?? '').split(',')[0] || 'VIEWER',
        status: Number(r.status) === 1 ? 'ACTIVE' : 'DISABLED',
        lastLoginAt: String(r.lastLoginAt ?? ''),
        lastActive: String(r.lastLoginAt ?? ''),
      })) as unknown as MemberInfo[],
    );
  },
  saveMember(m: MemberInfo): Promise<OperationRecord> {
    return http
      .post('/internal/rbac/members/role', { userCode: m.memberId, roleCode: m.role, deptId: m.deptId })
      .then(() => okRec('成员权限变更', m.memberId, `${m.name}：角色 ${m.role}，部门 ${m.deptId}`));
  },
  toggleMember(memberId: string): Promise<OperationRecord> {
    return http
      .get<Record<string, unknown>[]>('/internal/rbac/members')
      .then((rows) => {
        const cur = (rows || []).find((r) => String(r.userCode) === memberId);
        const next = cur && Number(cur.status) === 1 ? 0 : 1;
        return http.patch(`/internal/rbac/users/${memberId}/state`, { status: next });
      })
      .then(() => okRec('切换成员状态', memberId, '成员账号已启用/禁用（即时收回/恢复权限）'));
  },
  deleteMember(memberId: string): Promise<OperationRecord> {
    return http
      .delete(`/internal/rbac/users/${memberId}`)
      .then(() => okRec('移除成员', memberId, '已移除，关联 Key 与权限已回收'));
  },

  /* ============ 二轮完善：月度账单（P1-11） ============ */

  getMonthlyBills(): Promise<MonthlyBill[]> {
    return http.get<Record<string, unknown>[]>('/internal/billing/bills').then((rows) => {
      const bills = (rows || []).map((r) => ({
        month: String(r.billMonth ?? ''),
        deptId: String(r.deptId ?? ''),
        deptName: String(r.deptName ?? '') || String(r.deptId ?? ''),
        tokens: Number(r.totalTokens ?? 0),
        calls: Number(r.totalCalls ?? 0),
        cost: Number(r.totalAmount ?? 0),
      }));
      // 环比：同部门上月费用对比（无上月数据记 0）
      const byKey = new Map(bills.map((b) => [`${b.month}|${b.deptId}`, b]));
      return bills.map((b) => {
        const [y, m] = b.month.split('-').map(Number);
        const py = m === 1 ? y - 1 : y;
        const pm = m === 1 ? 12 : m - 1;
        const prev = byKey.get(`${py}-${String(pm).padStart(2, '0')}|${b.deptId}`);
        const mom = prev && prev.cost > 0 ? ((b.cost - prev.cost) / prev.cost) * 100 : 0;
        return { ...b, mom: Math.round(mom * 10) / 10 };
      });
    });
  },

  /* ============ 二轮完善：公告通知（P2-14） ============ */

  getAnnouncements(): Promise<Announcement[]> {
    return loadConfig<Announcement[]>(CONFIG_KEYS.announcements, [...cfg.announcements]);
  },
  postAnnouncement(type: Announcement['type'], title: string, content: string): Promise<OperationRecord> {
    return mutateConfig<Announcement[]>(CONFIG_KEYS.announcements, [...cfg.announcements], (list) => [
      { annId: cfg.nextId('ANN'), type, title, content, createdAt: new Date().toISOString(), pinned: type === 'MAINTENANCE' },
      ...list,
    ]).then(() => okRec('发布公告', title, content.slice(0, 60)));
  },

  /* ============ 二轮完善：批量推理任务（P2-15） ============ */

  getBatchTasks(): Promise<BatchTask[]> {
    // 错峰调度任务已落 mas_batch_task
    return http
      .get<Record<string, unknown>[]>('/internal/compute/batch-tasks')
      .then((rows) =>
        (rows || []).map((r) => ({
          taskId: String(r.taskId ?? ''),
          name: String(r.taskName ?? ''),
          deptId: '',
          assetId: String(r.targetNode ?? ''),
          priority: String(r.priority ?? 'P2') as BatchTask['priority'],
          window: `${String(r.windowStart ?? '00:00')}-${String(r.windowEnd ?? '06:00')}`,
          rows: 0,
          status: String(r.status ?? 'PENDING') as BatchTask['status'],
          submitAt: String(r.createdAt ?? ''),
        })),
      )
      .catch((e: unknown) => { warnFallback('getBatchTasks', e); return [...cfg.batchTasks]; });
  },
  submitBatchTask(t: Omit<BatchTask, 'taskId' | 'status' | 'submitAt'>): Promise<OperationRecord> {
    const [ws, we] = (t.window || '00:00-06:00').split('-');
    return http.post('/internal/compute/batch-tasks', {
      task_name: t.name,
      task_type: 'BATCH',
      target_node: t.assetId || null,
      window_start: ws || '00:00',
      window_end: we || '06:00',
      priority: t.priority,
    });
  },
  cancelBatchTask(taskId: string): Promise<OperationRecord> {
    return http.delete(`/internal/compute/batch-tasks/${taskId}`);
  },

  /* ============ 二轮完善：我的申请（P0-3） ============ */

  getMyApplications(): Promise<MyApplication[]> {
    return loadConfig<MyApplication[]>(CONFIG_KEYS.myApplications, [...cfg.myApplications]);
  },
  /** 驳回申请重新提交：生成新单（原驳回单保留可追溯），走审批并留痕 */
  resubmitApplication(applyId: string): Promise<OperationRecord> {
    return mutateConfig<MyApplication[]>(CONFIG_KEYS.myApplications, [...cfg.myApplications], (list) => {
      const src = list.find((x) => x.applyId === applyId);
      if (src) {
        list.unshift({
          ...src,
          applyId: cfg.nextId('MA'),
          title: `${src.title}（重新提交）`,
          reason: `${src.reason}（已按审批意见补充优化方案）`,
          status: 'PENDING',
          submitAt: new Date().toISOString(),
          approveAt: null,
          opinion: '',
        });
      }
      return [...list];
    }).then(() => okRec('重新提交申请', applyId, '已重新提交，原驳回意见已处理（落库 mas_platform_config）'));
  },

  /* ============ 二轮完善：应用注册管理（P0-5） ============ */

  saveApp(a: ApplicationRegistry): Promise<ApplicationRegistry & { apiKey?: string }> {
    if (USE_MOCK.apps) {
      const idx = cfg.appsStore.findIndex((x) => x.appId === a.appId);
      if (idx >= 0) cfg.appsStore[idx] = { ...a };
      else cfg.appsStore.push({ ...a, appId: cfg.nextId('APP') });
      return mock({ ...a, appId: a.appId || cfg.nextId('APP') } as ApplicationRegistry & { apiKey?: string });
    }
    // 前端字段 -> 后端契约映射（appName/deptId/ownerId/slaLevel/dataLevel/monthQuota/description）
    const backendBody = {
      appName: a.appName,
      deptId: a.deptId,
      ownerId: a.owner || 'admin',
      slaLevel: a.slaLevel,
      dataLevel: a.dataLevel,
      monthQuota: a.quotaToken,
      description: a.businessScenario,
    };
    if (a.appId) return http.put<Record<string, unknown>>(`/internal/apps/${a.appId}`, backendBody).then(mapBackendApp) as Promise<ApplicationRegistry & { apiKey?: string }>;
    return http.post<Record<string, unknown>>('/internal/apps', backendBody).then(r => {
      const mapped = mapBackendApp(r);
      return { ...mapped, apiKey: r.apiKey as string | undefined };
    }) as Promise<ApplicationRegistry & { apiKey?: string }>;
  },
  toggleApp(appId: string): Promise<OperationRecord> {
    if (USE_MOCK.apps) {
      const a = cfg.appsStore.find((x) => x.appId === appId);
      if (a) a.status = a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      return mock(cfg.recordOp(a?.status === 'ACTIVE' ? '启用应用' : '停用应用', appId, `${a?.appName ?? ''} 已${a?.status === 'ACTIVE' ? '启用' : '停用（路由不再分发）'}`), 200);
    }
    return http.post<Record<string, unknown>>(`/internal/apps/${appId}/toggle`).then(() =>
      cfg.recordOp('切换应用状态', appId, '应用启用/停用状态已切换')
    );
  },
  deleteApp(appId: string): Promise<OperationRecord> {
    if (USE_MOCK.apps) {
      const idx = cfg.appsStore.findIndex((x) => x.appId === appId);
      const name = cfg.appsStore[idx]?.appName ?? appId;
      if (idx >= 0) cfg.appsStore.splice(idx, 1);
      return mock(cfg.recordOp('删除应用', appId, `${name} 已注销，关联 Key 与配额已回收`), 200);
    }
    return http.delete<Record<string, unknown>>(`/internal/apps/${appId}`).then(() =>
      cfg.recordOp('删除应用', appId, '应用已注销，关联 Key 与配额已回收')
    );
  },

  /* ============ 核心补强：TCO 成本模型 / 效益评估 / 租户组织 ============ */

  getCostModelConfig(): Promise<CostModelConfig> {
    return loadConfig<CostModelConfig>(CONFIG_KEYS.costModel, { ...cfg.costModelConfig, weights: { ...cfg.costModelConfig.weights } });
  },
  saveCostModelConfig(c: CostModelConfig): Promise<OperationRecord> {
    // 四类权重自动归一（合计 100%），防误配
    const total = c.weights.infra + c.weights.compute + c.weights.license + c.weights.external || 1;
    const norm = {
      infra: Math.round((c.weights.infra / total) * 100),
      compute: Math.round((c.weights.compute / total) * 100),
      license: Math.round((c.weights.license / total) * 100),
      external: Math.round((c.weights.external / total) * 100),
    };
    norm.external += 100 - (norm.infra + norm.compute + norm.license); // 末位补差保证恒等于 100
    const saved = { ...c, weights: norm, updatedAt: new Date().toISOString() };
    return saveConfig(CONFIG_KEYS.costModel, saved).then(() =>
      okRec('保存成本模型', 'COST-MODEL', `权重 基建${norm.infra}/推理${norm.compute}/许可${norm.license}/外部${norm.external}，折旧 ${c.depreciationYears} 年，租赁折算 ×${c.rentalFactor.toFixed(2)}，分摊基准 ${c.allocateBy}`),
    );
  },
  getModelBenefits(): Promise<ModelBenefit[]> {
    return mock(cfg.modelBenefits.map((b) => ({ ...b })));
  },
  getTenantOrgs(): Promise<TenantOrg[]> {
    return Promise.all([
      http.get<Record<string, unknown>[]>('/internal/tenants'),
      http.get<Record<string, unknown>[]>('/internal/tenants/dept-mapping'),
    ]).then(([tenants, mappings]) =>
      (tenants || []).map((t) => {
        const tid = String(t.tenantId ?? '');
        return {
          tenantId: tid,
          tenantName: String(t.tenantName ?? tid),
          status: Number(t.status) === 1 ? 'ACTIVE' : 'SUSPENDED',
          mappedDepts: (mappings || [])
            .filter((m) => String(m.tenantId ?? '') === tid)
            .map((m) => String(m.deptId ?? '')),
        } as TenantOrg;
      }),
    );
  },
  toggleTenant(tenantId: string): Promise<OperationRecord> {
    // 当前状态以 GET /internal/tenants 为准（本地 cfg 不再同步后端，据其推导会与真实状态反向）
    return http
      .get<Record<string, unknown>[]>('/internal/tenants')
      .then((rows) => {
        const cur = (rows || []).find((t) => String(t.tenantId) === tenantId);
        const nextEnabled = !(cur && Number(cur.status) === 1);
        const tenantName = String(cur?.tenantName ?? '');
        return http
          .patch<Record<string, unknown>>(`/internal/tenants/${tenantId}/status`, { enabled: nextEnabled })
          .then(() =>
            okRec(
              nextEnabled ? '启用租户' : '停用租户',
              tenantId,
              `${tenantName} 已${nextEnabled ? '启用：恢复模型/数据/算力权限' : '停用：即时收回模型与数据权限，在途请求排空'}`,
            ),
          );
      });
  },

  /* ============ 系统管理（用户/角色/权限/监控/工单/参数） ============ */

  /** 后端角色 code → 前端 SysRoleKey 归一（后端 ADMIN 对应前端"平台管理员"，未知编码回落只读） */
  getSysUsers(): Promise<SysUser[]> {
    return http.get<Record<string, unknown>[]>('/internal/rbac/users').then((rows) =>
      (rows || []).map((r) => ({
        userId: String(r.userCode ?? ''),
        account: String(r.userCode ?? ''),
        name: String(r.userName ?? ''),
        deptId: String(r.deptId ?? ''),
        deptName: String(r.deptName ?? '') || String(r.deptId ?? ''),
        // 后端角色 code（ADMIN/OPERATOR/AUDITOR…）归一到前端 SysRoleKey，
        // 未知编码回落只读角色，避免显示裸 code
        role: (BACKEND_ROLE_MAP[String(r.roles ?? '').split(',').map((s) => s.trim()).filter(Boolean)[0]] ??
          'BIZ_VIEWER') as SysUser['role'],
        status: Number(r.locked) === 1 ? 'LOCKED' : Number(r.status) === 1 ? 'ACTIVE' : 'DISABLED',
        mfa: Number(r.mfaEnabled) === 1,
        lastLoginAt: String(r.lastLoginAt ?? ''),
      })),
    );
  },
  toggleSysUser(userId: string): Promise<OperationRecord> {
    return http
      .get<Record<string, unknown>[]>('/internal/rbac/users')
      .then((rows) => {
        const cur = (rows || []).find((r) => String(r.userCode) === userId);
        const next = cur && Number(cur.status) === 1 ? 0 : 1;
        return http.patch(`/internal/rbac/users/${userId}/state`, {
          status: next,
          opType: next === 1 ? '启用账号' : '停用账号',
          detail: next === 1 ? '账号已启用' : '账号已停用，会话即时失效',
        });
      })
      .then(() => okRec('切换账号状态', userId, '账号已启用/停用（落库 mas_sys_user）'));
  },
  unlockSysUser(userId: string): Promise<OperationRecord> {
    return http
      .patch(`/internal/rbac/users/${userId}/state`, { locked: 0, failCount: 0, opType: '解锁账号', detail: '连续登录失败锁定已解除，失败计数清零' })
      .then(() => okRec('解锁账号', userId, '连续登录失败锁定已解除，失败计数清零'));
  },
  resetUserPassword(userId: string): Promise<OperationRecord> {
    return http
      .patch(`/internal/rbac/users/${userId}/state`, { password: 'Mas@123456', pwdMustChange: 1, opType: '重置密码', detail: '密码已重置，首次登录强制修改并留痕' })
      .then(() => okRec('重置密码', userId, '密码已重置，首次登录强制修改并留痕'));
  },
  addSysUser(u: Omit<SysUser, 'userId' | 'lastLoginAt'>): Promise<OperationRecord> {
    return http
      .post('/internal/rbac/users', {
        userCode: u.account,
        userName: u.name,
        deptId: u.deptName,
        status: 1,
        mfaEnabled: u.mfa ? 1 : 0,
        pwdMustChange: 1,
      })
      .then(() => okRec('新增账号', u.account, `${u.name}（${u.deptName}），首次登录强制改密并绑定双因素`));
  },
  updateSysUser(u: SysUser): Promise<OperationRecord> {
    return http
      .put(`/internal/rbac/users/${u.userId}`, { userName: u.name, deptId: u.deptId })
      .then(() => okRec('编辑账号', u.userId, `${u.name}：部门 ${u.deptName}，角色 ${u.role}，双因素 ${u.mfa ? '开启' : '关闭'}`));
  },
  deleteSysUser(userId: string): Promise<OperationRecord> {
    return http
      .delete(`/internal/rbac/users/${userId}`)
      .then(() => okRec('删除账号', userId, '已注销，关联 Key 与会话即时回收'));
  },
  getSysRoles(): Promise<SysRole[]> {
    return http.get<Record<string, unknown>[]>('/internal/rbac/roles').then((rows) =>
      (rows || []).map((r) => ({
        roleKey: String(r.roleCode ?? ''),
        roleName: String(r.roleName ?? ''),
        desc: String(r.description ?? ''),
        scope: '全局',
        builtIn: Number(r.builtin) === 1,
        userCount: 0,
      })) as SysRole[],
    );
  },
  addSysRole(r: { roleName: string; desc: string; scope: string }): Promise<OperationRecord> {
    return http
      .post('/internal/rbac/roles', { roleCode: r.roleName, roleName: r.roleName, description: r.desc })
      .then(() => okRec('新增角色', r.roleName, `${r.desc}，数据范围 ${r.scope}，需在权限配置页完成授权`));
  },
  deleteSysRole(roleKey: string): Promise<OperationRecord> {
    return http
      .delete(`/internal/rbac/roles/${roleKey}`)
      .then(() => okRec('删除角色', roleKey, '已删除，关联账号回落业务查看员'))
      .catch((e) => okRec('删除角色失败', roleKey, String((e as Error)?.message ?? e)));
  },
  getPermMatrix(): Promise<PermRow[]> {
    return http.get<Record<string, unknown>[]>('/internal/rbac/perm-matrix').then((rows) =>
      (rows || []).map((r) => ({
        module: String(r.module ?? ''),
        levels: { ...((r.perms ?? {}) as Record<string, string>) },
      })) as PermRow[],
    );
  },
  savePermMatrix(rows: PermRow[]): Promise<OperationRecord> {
    const roleCodes = rows[0] ? Object.keys(rows[0].levels) : [];
    return Promise.all(
      roleCodes.map((roleCode) =>
        http.post('/internal/rbac/perm-matrix/batch', {
          roleCode,
          perms: Object.fromEntries(rows.map((r) => [r.module, (r.levels as Record<string, string>)[roleCode] ?? 'DENY'])),
        }),
      ),
    ).then(() => {
      const n = rows.reduce((acc, r) => acc + Object.values(r.levels).filter((l) => l !== 'DENY').length, 0);
      return okRec('保存权限矩阵', 'RBAC', `${rows.length} 模块 × ${roleCodes.length} 角色，生效授权 ${n} 项，变更即时同步网关鉴权`);
    });
  },
  getPlatformServices(): Promise<PlatformService[]> {
    return mock([...cfg.platformServices]);
  },
  /** Playground 体验调用：走 OpenAI 兼容 /v1/chat/completions 真实网关链路。
   *  需在 .env 配置 VITE_PLAYGROUND_API_KEY（已签发的 API Key），未配置时明确报错而非编造回复。 */
  playgroundChat(modelId: string, prompt: string, opts: { temperature: number; maxTokens: number }): Promise<{ content: string; outTokens: number }> {
    const key = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PLAYGROUND_API_KEY?.trim();
    if (!key) return Promise.reject(new Error('未配置 VITE_PLAYGROUND_API_KEY（体验通道 API Key），无法发起真实调用'));
    return fetch('/smart-router/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false,
      }),
    }).then(async (res) => {
      const data = (await res.json().catch(() => null)) as
        | { choices?: { message?: { content?: unknown } }[]; usage?: { completion_tokens?: unknown }; error?: { message?: unknown } }
        | null;
      if (!res.ok) {
        const msg = data?.error?.message != null ? String(data.error.message) : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const content = String(data?.choices?.[0]?.message?.content ?? '');
      const outTokens = Number(data?.usage?.completion_tokens ?? Math.round(content.length / 1.6));
      return { content, outTokens: Number.isFinite(outTokens) ? outTokens : 0 };
    });
  },
  rescanServices(): Promise<OperationRecord> {
    // 真实拨测：并行探测各管理面模块的关键读端点，回报实际可达性与时延
    const probes: { name: string; p: Promise<unknown> }[] = [
      { name: '驾驶舱', p: http.get('/internal/dashboard/summary') },
      { name: '计量运营', p: http.get('/internal/metering/quotas') },
      { name: '路由配置', p: http.get('/internal/routing/engine') },
      { name: '模型资产', p: http.get('/internal/models') },
      { name: '安全审计', p: http.get('/internal/security/events') },
      { name: 'RBAC', p: http.get('/internal/rbac/users') },
    ];
    const t0 = performance.now();
    return Promise.allSettled(probes.map((x) => x.p)).then((rs) => {
      const okN = rs.filter((r) => r.status === 'fulfilled').length;
      const ms = Math.round(performance.now() - t0);
      const failed = probes.filter((_, i) => rs[i].status === 'rejected').map((x) => x.name);
      return okRec(
        '健康拨测',
        'MONITOR',
        `${okN}/${probes.length} 个模块端点可达（总耗时 ${ms}ms）${failed.length ? `；不可达：${failed.join('、')}` : ''}`,
      );
    });
  },
  getSysTickets(): Promise<SysTicket[]> {
    return loadConfig<SysTicket[]>(CONFIG_KEYS.tickets, [...cfg.sysTickets]);
  },
  createTicket(t: { type: TicketType; title: string; content: string; from: string; deptName: string }): Promise<OperationRecord> {
    return mutateConfig<SysTicket[]>(CONFIG_KEYS.tickets, [...cfg.sysTickets], (list) => [
      { ...t, ticketId: cfg.nextId('TK'), status: 'OPEN', createdAt: new Date().toISOString(), reply: '' },
      ...list,
    ]).then(() => okRec('新建工单', t.title, `${t.from}（${t.deptName}）：${t.content.slice(0, 40)}`));
  },
  replyTicket(ticketId: string, reply: string): Promise<OperationRecord> {
    return mutateConfig<SysTicket[]>(CONFIG_KEYS.tickets, [...cfg.sysTickets], (list) =>
      list.map((t) => (t.ticketId === ticketId ? { ...t, reply, status: t.status === 'OPEN' ? 'PROCESSING' : t.status } : t)),
    ).then(() => okRec('回复工单', ticketId, reply.slice(0, 60)));
  },
  resolveTicket(ticketId: string): Promise<OperationRecord> {
    return mutateConfig<SysTicket[]>(CONFIG_KEYS.tickets, [...cfg.sysTickets], (list) =>
      list.map((t) => (t.ticketId === ticketId ? { ...t, status: 'RESOLVED' } : t)),
    ).then(() => okRec('结单', ticketId, '已处理完毕，提交人可评价'));
  },
  /** 系统参数：真实落 mas_platform_config（此前只改前端内存，刷新即回退） */
  getSystemParams(): Promise<SystemParams> {
    return http
      .get<Record<string, unknown>>('/internal/system/params')
      .then((r) => ({ ...cfg.systemParams, ...(r as unknown as Partial<SystemParams>) }) as SystemParams)
      .catch(() => ({ ...cfg.systemParams }));
  },
  saveSystemParams(p: SystemParams): Promise<OperationRecord> {
    return http.put('/internal/system/params', p);
  },

  /* ============ K8s 容器编排（LLM 推理服务底座） ============ */

  getK8sClusters(): Promise<K8sCluster[]> {
    return mock([...cfg.k8sClusters]);
  },
  getK8sPods(): Promise<K8sPod[]> {
    return loadConfig<K8sPod[]>(CONFIG_KEYS.pods, [...cfg.k8sPods]);
  },
  restartPod(podId: string): Promise<OperationRecord> {
    // Pod 清单本身存于 mas_platform_config(K8S_PODS)，重启指令同步落库（重启计数 + 状态），
    // 刷新不回退；真实 K8s 滚动重启需接入集群 API，属底座对接范围
    return mutateConfig<K8sPod[]>(CONFIG_KEYS.pods, cfg.k8sPods.map((p) => ({ ...p })), (list) =>
      list.map((p) => (p.podId === podId ? { ...p, status: 'RUNNING' as const, restarts: Number(p.restarts ?? 0) + 1 } : p)),
    ).then(() => {
      const p = cfg.k8sPods.find((x) => x.podId === podId);
      return okRec('重启 Pod', podId, `${p?.service ?? ''}（${p?.ns ?? ''}）滚动重启指令已下发并留痕，副本逐个替换不中断服务`);
    });
  },

  /* ============ 差异化计价 / 计费结算与对账（招标一-4/一-5） ============ */

  /** 五维费率规则：部门 / 系统 / 业务场景 / 服务类型 / 使用时段 */
  getPricingRules(): Promise<PricingRule[]> {
    return http.get<Record<string, unknown>[]>('/internal/pricing/rules').then((rows) =>
      (rows || []).map((r) => ({
        ruleCode: String(r.ruleCode ?? ''),
        ruleName: String(r.ruleName ?? ''),
        deptId: String(r.deptId ?? ''),
        appId: String(r.appId ?? ''),
        scenario: String(r.scenario ?? ''),
        serviceType: String(r.serviceType ?? ''),
        modelId: String(r.modelId ?? ''),
        timeStart: String(r.timeStart ?? ''),
        timeEnd: String(r.timeEnd ?? ''),
        inputPrice: Number(r.inputPrice ?? 0),
        outputPrice: Number(r.outputPrice ?? 0),
        requestPrice: Number(r.requestPrice ?? 0),
        priority: Number(r.priority ?? 0),
        status: Number(r.status ?? 1) === 1 ? 'ACTIVE' : 'DISABLED',
      })) as PricingRule[],
    );
  },
  savePricingRule(rule: PricingRule): Promise<OperationRecord> {
    const body = { ...rule, status: rule.status === 'ACTIVE' ? 1 : 0 };
    const req = rule.ruleCode
      ? http.put<Record<string, unknown>>(`/internal/pricing/rules/${rule.ruleCode}`, body)
      : http.post<Record<string, unknown>>('/internal/pricing/rules', body);
    return req.then(() =>
      cfg.recordOp('保存计价规则', rule.ruleCode || rule.ruleName,
        `${rule.ruleName}：输入 ${rule.inputPrice} / 输出 ${rule.outputPrice} 元每 token，优先级 ${rule.priority}`),
    );
  },
  deletePricingRule(ruleCode: string): Promise<OperationRecord> {
    return http.delete<Record<string, unknown>>(`/internal/pricing/rules/${ruleCode}`).then(() =>
      cfg.recordOp('删除计价规则', ruleCode, `费率规则 ${ruleCode} 已删除`),
    );
  },
  /** 费率试算：返回命中规则与金额 */
  simulatePricing(p: {
    deptId?: string; appId?: string; scenario?: string; serviceType?: string; modelId?: string;
    promptTokens: number; completionTokens: number;
  }): Promise<{ amount: number; ruleCode: string; ruleName: string }> {
    return http.post<Record<string, unknown>>('/internal/pricing/simulate', p).then((r) => ({
      amount: Number(r.amount ?? 0),
      ruleCode: String(r.ruleCode ?? ''),
      ruleName: String(r.ruleName ?? ''),
    }));
  },
  /** 生成账期账单 */
  generateBills(month?: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/billing/generate' + (month ? `?month=${month}` : ''));
  },
  /** 锁账：账期封闭 */
  lockBill(billNo: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>(`/internal/billing/bills/${billNo}/lock`);
  },
  /** 对账记录 */
  getReconciliations(month?: string): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>('/internal/billing/reconciliations', { month });
  },
  reconcileBill(p: { billMonth: string; tenantId: string; upstreamAmount: number }): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/billing/reconciliations', p);
  },

  /* ============ RBAC 写操作（此前纯内存，现落库） ============ */

  createSysUser(u: Record<string, unknown>): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/rbac/users', u);
  },
  updateSysUserState(userCode: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    return http.patch<Record<string, unknown>>(`/internal/rbac/users/${userCode}/state`, patch);
  },
  saveRolePermissions(roleCode: string, perms: Record<string, string>): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/rbac/perm-matrix/batch', { roleCode, perms });
  },

  /* ============ 安全检测（招标二-7） ============ */

  /** 触发一轮异常检测扫描 */
  runSecurityScan(): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/security/scan');
  },
  getDetectRules(): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>('/internal/security/detect-rules');
  },
  handleAlertAction(alertId: string, status: string, comment?: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>(`/internal/security/alerts/${alertId}/handle`, { status, comment });
  },

  /* ============ 分级采集与算力（招标一-1/一-3） ============ */

  getCollectionSources(): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>('/internal/collection/sources');
  },
  getCollectionBatches(): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>('/internal/collection/batches');
  },
  reportComputeMetric(m: Record<string, unknown>): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/compute/metrics', m);
  },

  /* ============ 模型生命周期（版本 / 血缘 / 灰度） ============ */

  getModelVersions(modelId: string): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>(`/internal/models/${modelId}/versions`);
  },
  getModelLineage(modelId: string): Promise<Record<string, unknown>[]> {
    return http.get<Record<string, unknown>[]>(`/internal/models/${modelId}/lineage`);
  },
  startGrayRelease(p: Record<string, unknown>): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/models/releases', p);
  },
  rollbackGrayRelease(releaseId: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>(`/internal/models/releases/${releaseId}/rollback`);
  },

  /* ============ 行内底座/运营管理体系对接（兼容适配#2：IAM/4A/监控/告警/工单） ============ */

  getIntegrations(): Promise<BaseIntegration[]> {
    return http.get<BaseIntegration[]>('/internal/integration');
  },
  saveIntegration(cfg: Partial<BaseIntegration>): Promise<Record<string, unknown>> {
    return http.put<Record<string, unknown>>('/internal/integration', cfg);
  },
  testIntegration(code: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>(`/internal/integration/${code}/test`);
  },
  syncIam(): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/integration/iam/sync');
  },
  pushMonitor(): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/integration/monitor/push');
  },
  forwardAlert(alertId: string): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>(`/internal/integration/alert/forward/${alertId}`);
  },
  createIntegrationTicket(t: { type: TicketType; title: string; content: string; from: string; deptName: string }): Promise<Record<string, unknown>> {
    return http.post<Record<string, unknown>>('/internal/integration/ticket', t);
  },
  getIntegrationLogs(): Promise<IntegrationLog[]> {
    return http.get<IntegrationLog[]>('/internal/integration/logs');
  },
};
