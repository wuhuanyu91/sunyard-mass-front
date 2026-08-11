/**
 * 宁波银行 MAAS 平台 · 统一对象模型（数据字典）
 * 来源：《MAAS平台前端设计与功能规范》V2.2 第 7 章
 * 约束：全平台唯一字段来源，页面禁止另造字段。
 */

/** 事件级别 */
export type Severity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/** 数据敏感等级 */
export type DataLevel = 'L1' | 'L2' | 'L3' | 'L4';

/** SLA 等级 */
export type SlaLevel = 'P0' | 'P1' | 'P2' | 'P3';

/* ------------------------------------------------------------------ */
/* 7.1 Policy（策略）                                                  */
/* ------------------------------------------------------------------ */

export type PolicyType = 'ROUTING' | 'COMPUTE' | 'MODEL' | 'SECURITY' | 'METERING';

export type PolicyStatus =
  | 'DRAFT' // 草稿
  | 'PENDING_APPROVAL' // 待审批
  | 'GRAY' // 灰度中
  | 'ACTIVE' // 生效
  | 'ROLLBACK' // 回滚中
  | 'INACTIVE' // 停用
  | 'ARCHIVED'; // 归档

export type PolicyScopeType = 'DEPT' | 'APP' | 'MODEL' | 'TENANT' | 'GLOBAL';

export interface Policy {
  policyId: string;
  policyType: PolicyType;
  policyName: string;
  scopeType: PolicyScopeType;
  scopeValue: string;
  priority: number; // 数值大者优先
  status: PolicyStatus;
  effectiveTime: string; // ISO 8601
  expireTime: string;
  version: number;
  createdBy: string;
  approvedBy: string;
  lastPublishedAt: string;
  rollbackVersion: number;
  rules: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* 7.2 ComputeResource（算力资源，8 态）                                */
/* ------------------------------------------------------------------ */

export type ResourceStatus =
  | 'IDLE' // 空闲
  | 'RUNNING' // 运行中
  | 'HOT' // 高负载
  | 'QUEUED' // 排队拥堵
  | 'DEGRADED' // 降级运行
  | 'INSTANCE_FAULT' // 实例异常
  | 'NODE_FAULT' // 节点故障
  | 'MAINTENANCE'; // 隔离维护

export type ResourceType = 'GPU' | 'CPU' | 'NPU' | 'RENTAL';
export type CostTag = 'LOCAL' | 'RENTAL';

export interface ComputeResource {
  resourceId: string;
  resourceType: ResourceType;
  vendor: string;
  architecture: string;
  cluster: string;
  node: string;
  pool: string;
  status: ResourceStatus;
  vramTotal: number; // GB
  vramUsed: number; // GB
  utilization: number; // 0-100，计算时间利用率
  instanceCount: number;
  queueDepth: number;
  costTag: CostTag;
}

/* ------------------------------------------------------------------ */
/* 7.3 RouterLog（请求日志） / 7.4 RoutingDecision（路由决策）          */
/* ------------------------------------------------------------------ */

export type RequestMode = 'SYNC' | 'ASYNC' | 'STREAM';

export interface CandidateModel {
  assetId: string;
  version: string;
  score: number | null; // 综合分（引擎无定义时为 null，前端只展示四维分）
  eliminateReason: string; // 淘汰原因（必填，未淘汰则为空）
}

export interface RoutingDecision {
  candidateModels: CandidateModel[]; // 必须含淘汰原因
  selectedModel: string;
  selectedVersion: string;
  selectedEngine: 'VLLM' | 'SGLANG' | 'OTHER';
  selectedPool: string;
  selectedNode: string;
  routeReason: string;
  scoreLatency: number;
  scoreCost: number;
  scoreRisk: number;
  scoreLoad: number;
  fallbackTriggered: boolean;
  fallbackReason: string;
}

export type RouterLogStatus = 'SUCCESS' | 'BLOCKED' | 'DEGRADED' | 'FAILED';

export interface RouterLog {
  traceId: string;
  requestId: string;
  appId: string;
  tenantId: string;
  userId: string;
  businessScenario: string; // 客户服务/运营处理/信贷分析/营销辅助/研发编码/其他
  taskType: string; // 分类/抽取/问答/摘要/生成/推理/工具规划
  dataLevel: DataLevel;
  requestMode: RequestMode;
  promptTokens: number;
  expectedOutputTokens: number;
  contextLength: number;
  slaLevel: SlaLevel;
  budgetClass: string;
  decision: RoutingDecision;
  status: RouterLogStatus;
  totalDurationMs: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 7.5 Instance（推理实例）                                            */
/* ------------------------------------------------------------------ */

export type EngineType = 'VLLM' | 'SGLANG' | 'OTHER';
export type DeployMode = 'DEDICATED' | 'SHARED' | 'MIXED'; // 独占/共享/混部
export type QuantizationType = 'FP16' | 'INT8' | 'INT4' | 'NONE';

export interface Instance {
  instanceId: string;
  assetId: string;
  engineType: EngineType;
  deployMode: DeployMode;
  quantizationType: QuantizationType;
  batchConfig: { maxBatch: number; maxLatencyMs: number };
  kvCacheEnabled: boolean;
  ttftMs: number; // 采样窗口内 P50
  avgLatencyMs: number; // 采样窗口内 P95
  tokensPerSec: number;
  cacheHitRate: number; // 0-100，Token 级命中率
}

/* ------------------------------------------------------------------ */
/* 7.6 MeteringRecord（计量流水）                                      */
/* ------------------------------------------------------------------ */

export interface MeteringRecord {
  billId: string;
  traceId: string;
  tenantId: string;
  deptId: string;
  appId: string;
  assetId: string;
  modelVersion: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  retryTokens: number;
  failureTokens: number;
  retryCount: number;
  failureCount: number;
  gpuHours: number; // 卡时 = GPU 卡数 × 计算时长
  instanceHours: number;
  queueWaitMs: number;
  costInfra: number;
  costCompute: number;
  costLicense: number;
  costExternal: number;
  tcoTotal: number; // = 四类之和
  success: boolean;
  retryTokensIncluded: boolean; // 失败重试是否计入成本
}

/* ------------------------------------------------------------------ */
/* 7.7 ModelAsset（模型资产） / 7.8 EvalResult（评测结果）             */
/* ------------------------------------------------------------------ */

export type LifecycleStatus =
  | 'DRAFT' // 登记
  | 'TESTING' // 测试
  | 'GRAY' // 灰度
  | 'PRODUCTION' // 生产
  | 'ROLLBACK' // 回滚
  | 'OFFLINE' // 下线中
  | 'ARCHIVED'; // 归档（只读）

export type AssetType = 'BASE_LLM' | 'SMALL_LLM' | 'MULTIMODAL' | 'OCR' | 'VOICE' | 'EXTERNAL';
export type SourceType = 'OPEN_SOURCE' | 'PROPRIETARY' | 'THIRD_PARTY';
export type DerivationType = 'SFT' | 'DISTILLATION' | 'QUANTIZATION' | 'NONE';
export type RiskLevel = 'A' | 'B' | 'C' | 'D';

export interface ModelAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  sourceType: SourceType;
  baseModelId: string | null; // 血缘
  derivationType: DerivationType;
  ownerDept: string;
  maintainer: string;
  riskLevel: RiskLevel;
  securityLevel: DataLevel;
  version: string;
  lifecycleStatus: LifecycleStatus;
  supportedTasks: string[];
  supportedHardware: string[];
  contextWindow: number;
  costPer1kTokens: number; // 元
  avgLatencyMs: number; // P95
  successRate: number; // 0-100
  activeApps: number;
}

export type EvalType = 'ADMISSION' | 'A_B' | 'PERIODIC';
export type ReviewConclusion = 'PASS' | 'FAIL' | 'PENDING';

export interface EvalResult {
  evalId: string;
  assetId: string;
  evalType: EvalType;
  evalDataset: string;
  accuracy: number;
  hallucinationRate: number;
  complianceRate: number;
  toolCallSuccessRate: number;
  longContextScore: number;
  costScore: number;
  reviewConclusion: ReviewConclusion;
  reviewedBy: string;
  reviewedAt: string;
}

/* ------------------------------------------------------------------ */
/* 7.9 SecurityEvent（安全事件）                                       */
/* ------------------------------------------------------------------ */

export type SecurityEventType =
  | 'PROMPT_INJECTION' // 提示注入
  | 'VIOLATION' // 违规内容
  | 'MASKING' // 敏感数据脱敏
  | 'UNAUTHORIZED' // 越权
  | 'ABNORMAL'; // 异常行为

export type GuardrailStage = 'INPUT' | 'OUTPUT' | 'TOOL' | 'KNOWLEDGE';
export type LogStorageType = 'FULL' | 'MASKED' | 'HASH_ONLY';

export interface SecurityEvent {
  securityEventId: string;
  traceId: string;
  tenantId: string;
  userId: string;
  appId: string;
  assetId: string;
  eventType: SecurityEventType;
  eventLevel: Severity;
  guardrailStage: GuardrailStage;
  ruleId: string;
  ruleName: string;
  masked: boolean;
  blocked: boolean;
  reasonCode: string;
  reasonText: string;
  logStorageType: LogStorageType;
  hashSignature: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 7.10 ApplicationRegistry（应用注册）                                */
/* ------------------------------------------------------------------ */

export type AppStatus = 'ACTIVE' | 'SUSPENDED' | 'OFFLINE';

export interface ApplicationRegistry {
  appId: string;
  appName: string;
  deptId: string;
  owner: string;
  businessScenario: string;
  dataLevel: DataLevel;
  slaLevel: SlaLevel;
  quotaToken: number;
  quotaRequest: number;
  costBudget: number;
  status: AppStatus;
}

/* ------------------------------------------------------------------ */
/* 通用工具类型                                                        */
/* ------------------------------------------------------------------ */

/** 告警状态（前端通用，见规范 10.3） */
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVING' | 'CLOSED';

/** 熔断状态（前端通用，见规范 10.4） */
export type CircuitStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface PlatformAlert {
  alertId: string;
  alertStatus: AlertStatus;
  eventLevel: Severity;
  title: string;
  detail: string;
  traceId?: string;
  createdAt: string;
}

export interface CircuitBreaker {
  circuitId: string;
  status: CircuitStatus;
  dimension: 'QPS' | 'TOKEN' | 'COST' | 'CONCURRENCY';
  threshold: number;
  currentValue: number;
  triggeredAt: string;
  recoveredAt: string | null;
  recoverMode: 'AUTO' | 'MANUAL' | null;
}

/* ------------------------------------------------------------------ */
/* 视图层补充对象（供 6.3/6.4 展示，不属于第 7 章数据字典）             */
/* ------------------------------------------------------------------ */

/** 限流命中记录（6.3 限流面板；维度来自触发时的策略规则） */
export type RateLimitDimension = 'QPS' | 'TOKEN' | 'COST' | 'CONCURRENCY';

export interface RateLimitHit {
  rateLimitId: string;
  dimension: RateLimitDimension;
  threshold: number;
  currentValue: number;
  action: 'LIMIT' | 'BLOCK'; // LIMIT=降速放行；BLOCK=直接拒绝
  policyId: string;
  policyName: string;
  appId: string;
  tenantId: string;
  traceId: string | null;
  createdAt: string;
}

/** 路由漏斗阶段（6.3；数量口径：同时间窗内请求条数） */
export interface FunnelStage {
  name: string;
  value: number;
  detail: string;
}

/** 优先级队列视图（6.4；高优先级被挤压时队列等待超阈值触发横幅） */
export interface PriorityQueueItem {
  priorityClass: 'P0' | 'P1' | 'P2';
  queued: number;
  running: number;
  avgWaitMs: number;
  maxWaitMs: number;
}

/** 批处理与 TTFT 联动序列（6.4；同一时间窗，验证吞吐提升是否牺牲首字时延） */
export interface BatchPoint {
  t: string;
  throughput: number; // tokens/s 聚合
  batchSize: number; // 平均批大小
  ttftMs: number; // P50
}

/** 节点热区（6.4；节点 × 时段利用率，用于错峰建议） */
export interface HeatCell {
  node: string;
  pool: string;
  hour: number; // 0-23
  utilization: number; // 0-100
}

/** 成本优化建议（6.5 / 9.5 闭环：识别→建议→采纳→执行→验证→关闭） */
export type AdviceStatus = 'IDENTIFIED' | 'ACCEPTED' | 'EXECUTED' | 'VERIFIED' | 'CLOSED';

export interface OptimizeAdvice {
  adviceId: string;
  title: string;
  description: string;
  estimatedSaving: number; // 元/月
  basis: { data: string; metric: string; calc: string }[]; // 建议依据（禁止无依据建议）
  status: AdviceStatus;
  workOrderId: string | null; // 采纳后生成工单
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 配置域对象（完善方案 v2 第四章，对应 PPT P11-P44 配置能力）          */
/* ------------------------------------------------------------------ */

/** API Key（P14：精细化流量控制） */
export type KeyEnv = 'PROD' | 'TEST';
export interface ApiKey {
  keyId: string;
  keyFull: string; // 完整 Key（仅重置时展示一次，列表展示 keyMasked）
  keyMasked: string;
  desc: string;
  ownerDept: string; // deptId
  appId: string;
  status: 'ENABLED' | 'DISABLED';
  expireAt: string | null; // null=永久
  callQuota: number; // 0=不限
  usedCount: number;
  allowedModels: string[]; // assetId 列表
  rateLimitRuleId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  env: KeyEnv; // 环境区分（对标百炼 Key 分场景管理）
  lastUsedIp: string; // 最近调用来源 IP（调用源监控）
}

/** 限流规则（P14/P29：QPS+Token 双维） */
export type RateLimitTarget = 'GLOBAL' | 'DEPT' | 'APP' | 'API_KEY';
export interface RateLimitRule {
  ruleId: string;
  name: string;
  targetType: RateLimitTarget;
  targetId: string; // GLOBAL 时为 '*'
  enabled: boolean;
  qpsPerMin: number; // 请求频率 次/分钟
  inputTokenLimit: number; // 单请求输入 Token 上限
  outputTokenLimit: number; // 单请求输出 Token 上限
  concurrency: number; // 并发连接数
  ipWhitelist: string[]; // IP/CIDR，空=不限制
  overAction: 'REJECT' | 'QUEUE' | 'DOWNGRADE'; // 超限行为
  hits24h: number; // 近 24h 命中次数（联动 RateLimitHit）
}

/** 场景路由规则（P11：信贷/风控/营销/客服专属规则） */
export type SceneKey = 'CREDIT' | 'RISK' | 'MARKETING' | 'SERVICE';
export interface RoutingRuleSet {
  sceneKey: SceneKey;
  sceneName: string;
  priority: SlaLevel;
  allowedModels: string[];
  fallbackModel: string;
  latencyCeilMs: number;
  policyId: string | null; // 保存后生成的控制面策略
}

/** 模型聚合组（P15：防单点故障） */
export interface AggregationGroup {
  groupId: string;
  name: string;
  members: string[]; // assetId
  strategy: 'ROUND_ROBIN' | 'WEIGHTED' | 'LATENCY';
  autoSkipFault: boolean;
  healthCheckSec: number;
  faultMembers: string[]; // 当前故障被跳过的成员
}

/** 云上云下弹性切换配置（P15） */
export interface ElasticSwitchConfig {
  triggerUtil: number; // 本地池利用率阈值 %
  sustainMin: number; // 持续分钟
  target: 'RENTAL' | 'CLOUD';
  trafficRatio: number; // 分流比例 %
  active: boolean; // 当前是否处于分流态
}

/** 业务组 Token 配额（P29：Token 精细化管控） */
export type QuotaStatus = 'NORMAL' | 'WARNING' | 'STOPPED';
export interface QuotaProfile {
  deptId: string;
  deptName: string;
  monthTokenQuota: number;
  usedTokens: number;
  monthCost: number;
  overLimitStop: boolean; // 超限即停
  warnThreshold: 80 | 90 | 95;
  notifyChannels: ('SITE' | 'MAIL' | 'SMS')[];
  status: QuotaStatus;
  resumePending: boolean; // 恢复申请审批中
}

/** 模型接入（P37：统一模型接入配置） */
export type ConnSource = 'CLOUD' | 'LOCAL' | 'RENTAL';
export type ConnStatus = 'ONLINE' | 'OFFLINE' | 'TESTING';
export interface ModelConnection {
  connId: string;
  name: string;
  source: ConnSource;
  provider: string;
  modelType: string; // 文本生成/Embedding/图像生成/OCR/语音
  apiKeyMasked: string;
  baseUrl: string;
  nodes: number;
  cardType: string;
  status: ConnStatus;
  latencyMs: number | null; // 最近连通性时延
  assetId: string | null; // 连通后自动登记的资产
  lastCheckAt: string;
  createdAt: string;
}

/** 模型广场卡片（P38） */
export type PlazaCategory = 'TEXT' | 'EMBEDDING' | 'IMAGE' | 'OCR' | 'VOICE';
export type ApplyStatus = 'NONE' | 'PENDING' | 'GRANTED';
export interface ModelCard {
  cardId: string;
  name: string;
  category: PlazaCategory;
  provider: string;
  desc: string;
  costPer1k: number;
  rating: number; // 1-5
  monthCalls: number;
  applyStatus: ApplyStatus;
}

/** 模型广场申请单 */
export interface PlazaApply {
  applyId: string;
  cardId: string;
  deptId: string;
  purpose: string;
  estMonthCalls: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

/** 灰度发布任务（P34：五步流程） */
export type GrayStep = 1 | 2 | 3 | 4 | 5;
export interface GrayRelease {
  releaseId: string;
  assetId: string;
  assetName: string;
  version: string;
  step: GrayStep;
  percent: number; // 灰度比例
  scope: string[]; // 灰度范围（应用/部门）
  abMetrics: {
    accuracy: [number, number]; // [现网, 灰度]
    latencyMs: [number, number];
    compliance: [number, number];
    costPer1k: [number, number];
  };
  startedAt: string;
  effectCountdown: number | null; // 生效倒计时（前端态）
}

/** 归档模型（P35：下线归档） */
export type ArchiveReason = 'NO_CALL_90D' | 'REPLACED' | 'COMPLIANCE' | 'MANUAL';
export type ValueScore = 'A' | 'B' | 'C' | 'D';
export interface ArchivedModel {
  assetId: string;
  assetName: string;
  reason: ArchiveReason;
  archivedAt: string;
  retention: '24M' | 'PERMANENT'; // 监管模型永久留存
  valueScore: ValueScore;
  scoreDetail: { cost: number; conversion: number; riskAcc: number }; // 三维评分 0-100
}

/** 归档自动触发规则 */
export interface ArchiveRules {
  noCall90d: boolean;
  replaced: boolean;
  compliance: boolean;
}

/** 安全护栏规则（P44） */
export interface GuardrailConfig {
  enabled: boolean;
  apiUrl: string;
  apiKeyMasked: string;
  textLatencyMs: number; // P43 口径 200ms
  multimodalLatencyMs: number; // P43 口径 1200ms
}

/** 安全策略（P44：策略列表 CRUD） */
export type GuardrailAction = 'BLOCK' | 'MASK' | 'ALERT';
export interface GuardrailPolicy {
  policyId: string;
  name: string;
  desc: string;
  modules: string[]; // 检测模块 key
  action: GuardrailAction;
  bindApps: string[];
}

/** 检测模块（P42：10 大模块） */
export type ModuleSensitivity = 'LOW' | 'MED' | 'HIGH';
export interface DetectModule {
  moduleKey: string;
  label: string;
  critical: boolean; // 核心模块关闭需强确认
  enabled: boolean;
  sensitivity: ModuleSensitivity;
}

/** 词库（P43） */
export interface KeywordLibrary {
  libId: string;
  name: string;
  type: 'SYSTEM' | 'CUSTOM';
  version: string;
  wordCount: number;
  updatedAt: string;
}

/** 检测模型（P43） */
export interface DetectModelInfo {
  modelId: string;
  name: string;
  version: string;
  status: 'RUNNING' | 'STANDBY';
  latencyMs: number;
  isDefault: boolean;
}

/** 举报反馈（P43） */
export interface ReportFeedback {
  reportId: string;
  content: string;
  source: string;
  status: 'OPEN' | 'VALID' | 'FALSE_POSITIVE' | 'IGNORED';
  createdAt: string;
}

/** 调用日志（P41：行为分析标签） */
export type BehaviorTag = '业务办公' | '开发调试' | '私人娱乐' | '疑似违规';
export type CallLogStatus = 'SUCCESS' | 'FAILED' | 'RATE_LIMITED' | 'BLOCKED';
export interface CallLog {
  logId: string;
  ts: string;
  status: CallLogStatus;
  statusCode: number;
  apiKeyMasked: string;
  routeName: string;
  model: string;
  provider: string;
  appType: string;
  behaviorTag: BehaviorTag;
  inputTokens: number;
  outputTokens: number;
  requestContent: string;
  responseContent: string;
}

/** 个人用量（P27 三视图） */
export interface PersonalUsage {
  userId: string;
  name: string;
  deptId: string;
  tokens: number;
  cost: number;
  tagDist: { tag: BehaviorTag; pct: number }[];
}

/** 个人用量趋势点（个人中心：近 14 天） */
export interface PersonalTrendPoint {
  date: string;
  tokens: number;
  cost: number;
}

/** 应急工单（P11：应急操作台） */
export type EmergencyType = 'GRAY_DEGRADE' | 'SWITCH_BACKUP' | 'STOP_NONCORE';
export interface EmergencyTicket {
  ticketId: string;
  type: EmergencyType;
  operator: string;
  target: string;
  params: string;
  status: 'RUNNING' | 'ACTIVE' | 'ROLLED_BACK';
  createdAt: string;
}

/** 资源编排配置（P17-P22） */
export interface OrchestrationConfig {
  mixDeploy: boolean; // 大小模型混部
  mixAffinity: string[]; // 可混部小模型 assetId
  vramReserve: number; // 显存预留 %
  weights: { P0: number; P1: number; P2: number }; // 优先级权重
  lowPrioritySlow: boolean; // 低优自动降速
  p0Preempt: boolean; // P0 抢占
  continuousBatch: boolean;
  maxBatch: number;
  kvCache: boolean;
  kvStrategy: 'ROUND_ROBIN' | 'SEMANTIC'; // P19 语义感知
  speculative: boolean; // P20 投机解码
  draftModel: string;
}

/** 节点级编排（vGPU/量化/副本） */
export interface NodeConfig {
  resourceId: string;
  vgpuEnabled: boolean;
  vgpuPercent: number; // 1-100
  vgpuVramMb: number; // 256MB 步长
  quantization: 'FP16' | 'INT8' | 'INT4';
  replicas: number;
  extendRental: boolean; // 扩到租赁池
}

/** 租户日志留存（P40） */
export interface TenantRetention {
  tenantId: string;
  tenantName: string;
  retentionDays: number;
  storagePolicy: string;
  logCount: number;
}

/** 模型统计行（P26） */
export interface ModelUsageStat {
  assetId: string;
  name: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** 推荐模型（P26） */
export interface ModelRecommend {
  recId: string;
  scene: string;
  currentModel: string;
  recommendModel: string;
  estSaving: number; // 月节省
}

/** 全局操作留痕 */
export interface OperationRecord {
  opId: string;
  opType: string;
  operator: string;
  targetId: string;
  detail: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 复核补充对象（告警处置/审批聚合/成本预警/KV治理/引擎版本）       */
/* ------------------------------------------------------------------ */

/** 告警处置记录（十一章：异常处置闭环 + 十四章：责任定位） */
export interface AlertAction {
  actionId: string;
  alertId: string;
  action: 'ACK' | 'RESOLVE_START' | 'CLOSE';
  note: string;
  operator: string;
  createdAt: string;
}

/** 审批待办聚合项（六章：策略治理审批机制） */
export type ApprovalKind = 'POLICY' | 'QUOTA_RESUME' | 'PLAZA_APPLY';
export interface ApprovalItem {
  approvalId: string;
  kind: ApprovalKind;
  title: string;
  applicant: string;
  reason: string;
  targetLink: string; // 前端路由跳转
  createdAt: string;
}

/** 成本预警配置（六章运营策略：成本预警/超额限流） */
export interface CostAlertConfig {
  enabled: boolean;
  dailyBudget: number; // 全行日成本预算（元）
  warnPct: number; // 预警阈值 %
  overAction: 'ALERT_ONLY' | 'DOWNGRADE' | 'RATE_LIMIT'; // 超额动作
  notifyChannels: ('SITE' | 'MAIL' | 'SMS')[];
  todayCost: number;
}

/** KV 缓存治理配置（八章：租户隔离/敏感禁存/有效期/审计） */
export interface KvCacheGovernance {
  tenantIsolation: boolean; // 租户间缓存隔离
  forbidSensitive: boolean; // L3 以上敏感数据禁止入缓
  ttlMin: number; // 缓存有效期（分钟）
  auditEnabled: boolean; // 命中计量与使用审计
  hitTokens24h: number;
  savedCostPct: number;
}

/** 推理引擎实例版本（13.3：开源推理引擎管理） */
export interface EngineVersionInfo {
  engineId: string;
  engine: 'VLLM' | 'SGLANG';
  version: string;
  latestVersion: string;
  instances: number;
  upgradeStatus: 'UP_TO_DATE' | 'UPGRADE_AVAILABLE' | 'GRAY_VERIFY';
  releaseNote: string;
  riskNote: string;
}

/** 请求执行策略清单（六章：证明一次请求实际执行了哪些策略） */
export interface ExecutedPolicyItem {
  policyType: PolicyType;
  policyId: string;
  policyName: string;
  effect: string; // 该策略对本次请求的实际作用
  matched: boolean;
}

/** 多约束路由引擎配置（智能调度网关核心：权重/开关可配置） */
export interface RoutingEngineConfig {
  weights: { latency: number; cost: number; risk: number; load: number }; // 四维评分权重（自动归一）
  cacheFirst: boolean; // 缓存优先：命中 KV Cache 的实例优先派发
  budgetGuard: boolean; // 成本预算约束：超预算候选降权/剔除
  slaPriority: boolean; // SLA 优先：P0/P1 请求资源预留
  autoFallback: boolean; // 自动降级：主模型异常自动切备用
  openaiCompat: boolean; // OpenAI 兼容入口（上层应用零改造）
}

/** 异构算力厂商资源（13.4：英伟达/华为/沐曦/Intel 统一纳管） */
export type ChipKind = 'GPU' | 'NPU' | 'CPU';
export type CompatStatus = 'COMPATIBLE' | 'ADAPTING' | 'PLANNED'; // 适配状态
export interface HeteroVendor {
  vendorId: string;
  vendor: string; // 厂商
  chip: string; // 芯片型号
  kind: ChipKind;
  domestic: boolean; // 是否国产化
  count: number; // 卡数/核数
  vramPerCard: number; // GB（CPU 为 0）
  utilization: number; // 当前利用率 %
  hostedModels: number; // 承载模型数
  compatStatus: CompatStatus;
  costTag: 'LOW' | 'MID' | 'HIGH'; // 成本特征
  pools: string[]; // 所属资源池
}

/** 异构调度策略（厂商优先级/国产化优先等） */
export interface HeteroSchedPolicy {
  domesticFirst: boolean; // 国产化优先：同等条件优先调度昇腾/沐曦
  crossVendorFailover: boolean; // 跨厂商故障迁移
  rentalPeak: boolean; // 峰值启用租赁池削峰
  vendorPriority: string[]; // 厂商调度优先级顺序（vendorId）
}

/* ------------------------------------------------------------------ */
/* 二轮完善对象（对标硅基流动/百炼/方舟 + 五角色视角）              */
/* ------------------------------------------------------------------ */

/** 调用质量告警规则（对标百炼观测与告警） */
export type AlertMetric = 'P95' | 'ERROR_RATE' | 'QUEUE' | 'CALL_SPIKE';
export interface QualityAlertRule {
  ruleId: string;
  name: string;
  metric: AlertMetric;
  threshold: number;
  unit: string;
  enabled: boolean;
  channels: ('SITE' | 'MAIL' | 'SMS')[];
  hits24h: number;
}

/** 平台成员（RBAC 可编辑） */
export type PlatformRole = 'ADMIN' | 'OPERATOR' | 'MODEL_OWNER' | 'AUDITOR' | 'BIZ_VIEWER';
export interface MemberInfo {
  memberId: string;
  name: string;
  deptId: string;
  role: PlatformRole;
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: string;
}

/** 月度账单（P24 月度账单导出） */
export interface MonthlyBill {
  month: string; // YYYY-MM
  deptId: string;
  deptName: string;
  tokens: number;
  calls: number;
  cost: number;
  mom: number; // 环比 %
}

/** 公告通知（平台维护/事件广播/公告） */
export type AnnouncementType = 'MAINTENANCE' | 'BROADCAST' | 'NOTICE';
export interface Announcement {
  annId: string;
  type: AnnouncementType;
  title: string;
  content: string;
  createdAt: string;
  pinned: boolean;
}

/** 批量推理任务（错峰排队，对标硅基流动批量推理） */
export type BatchTaskStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'CANCELLED';
export interface BatchTask {
  taskId: string;
  name: string;
  deptId: string;
  assetId: string;
  priority: 'P1' | 'P2' | 'P3';
  window: string; // 错峰窗口
  rows: number; // 批量条数
  status: BatchTaskStatus;
  submitAt: string;
}

/** 我的申请单（申请人视角统一进度跟踪） */
export type MyApplyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface MyApplication {
  applyId: string;
  kind: 'MODEL_ACCESS' | 'QUOTA_ADJUST' | 'QUOTA_RESUME' | 'API_KEY';
  title: string;
  reason: string;
  status: MyApplyStatus;
  submitAt: string;
  approveAt: string | null;
  opinion: string; // 审批意见（通过/驳回）
}

/* ------------------------------------------------------------------ */
/* 核心补强：成本模型 / 效益评估 / 租户组织（需求概览 8-11 章）       */
/* ------------------------------------------------------------------ */

/** TCO 成本模型配置（九章：成本模型可配置，不能固化单一分摊方式） */
export type CostAllocateBy = 'TOKEN' | 'CARD_HOUR' | 'CALLS'; // 部门分摊基准
/** 四类成本：基础设施(硬件折旧/机房/电力/制冷/网络/存储) / 推理计算 / 软件许可 / 外部调用 */
export type CostKind = 'infra' | 'compute' | 'license' | 'external';
export interface CostModelConfig {
  weights: Record<CostKind, number>; // 四类成本权重（自动归一，%）
  depreciationYears: number; // 硬件折旧年限（3/5 年）
  rentalFactor: number; // 外部租赁折算系数（自建=1.0，租赁按系数折算同量级卡时成本）
  allocateBy: CostAllocateBy; // 部门分摊基准
  updatedAt: string;
}

/** 模型效益评估（十章：综合调用量/活跃应用/用户规模/效果/成本，为保留/升级/替换/下线提供依据） */
export type BenefitSuggestion = 'KEEP' | 'OPTIMIZE' | 'REPLACE' | 'ARCHIVE';
export interface ModelBenefit {
  assetId: string;
  activeApps: number; // 活跃应用数
  userScale: number; // 用户规模（人）
  monthCost: number; // 月成本（与模型统计同口径）
  unitCost: number; // 单位任务成本（元/千次调用）
  adoptRate: number; // 任务效果采纳率 %（应用侧回传）
  successRate: number; // 调用成功率 %
  valueScore: 'A' | 'B' | 'C' | 'D'; // 业务价值综合评分
  suggestion: BenefitSuggestion; // 治理建议
}

/** 租户与组织映射（十一章：租户如何映射宁波银行组织条线） */
export interface TenantOrg {
  tenantId: string;
  tenantName: string;
  mappedDepts: string[]; // 映射组织（部门条线）
  dataBoundary: 'L2' | 'L3'; // 数据等级边界
  modelScope: 'DEPT' | 'GLOBAL'; // 模型权限范围（本租户模型/全量）
  quotaShared: boolean; // 是否共享部门配额（不独立建额）
  memberCount: number; // 成员数
  status: 'ACTIVE' | 'SUSPENDED';
}

/* ------------------------------------------------------------------ */
/* 系统管理（用户/角色/权限/监控/工单/参数）                     */
/* ------------------------------------------------------------------ */

export type SysRoleKey = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'OPERATOR' | 'MODEL_OWNER' | 'BIZ_VIEWER' | 'AUDITOR';

/** 平台账号（对接行内统一身份认证，此处为平台侧账号视图） */
export interface SysUser {
  userId: string;
  name: string;
  account: string; // 登录账号
  deptId: string;
  deptName: string;
  role: SysRoleKey;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED'; // 正常/停用/锁定（连续登录失败）
  mfa: boolean; // 双因素认证
  lastLoginAt: string;
}

/** 角色定义（RBAC）：内置角色 roleKey 为固定枚举，自建角色为生成的 ROLE-xxx */
export interface SysRole {
  roleKey: string;
  roleName: string;
  desc: string;
  scope: string; // 数据范围
  builtIn: boolean; // 内置角色不可删除
  userCount: number;
}

/** 权限级别：无/只读/读写/审批 */
export type PermLevel = 'DENY' | 'READ' | 'WRITE' | 'APPROVE';

/** 模块×角色 权限矩阵行 */
export interface PermRow {
  module: string; // 功能模块
  levels: Record<SysRoleKey, PermLevel>;
}

/** 平台服务健康（平台监控） */
export interface PlatformService {
  svcId: string;
  name: string;
  kind: 'GATEWAY' | 'REGISTRY' | 'METERING' | 'AUDIT' | 'QUEUE' | 'K8S';
  status: 'RUNNING' | 'DEGRADED' | 'DOWN';
  latencyMs: number; // 探测时延
  cpuPct: number;
  memPct: number;
  uptime: string; // 连续运行时长
  version: string;
  replicas: number; // 分布式副本数
  readyReplicas: number; // 已就绪副本数
  nodes: string[]; // 分布节点（多副本跨节点部署）
}

/** 工单反馈 */
export type TicketType = 'PROBLEM' | 'REQUEST' | 'SUGGEST';
export type TicketStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED';
export interface SysTicket {
  ticketId: string;
  type: TicketType;
  title: string;
  content: string;
  from: string; // 提交人
  deptName: string;
  status: TicketStatus;
  createdAt: string;
  reply: string; // 处理回复
}

/** 系统参数（安全与合规基线） */
export interface SystemParams {
  pwdMinLen: number; // 密码最小长度
  pwdNeedSpecial: boolean; // 必须含特殊字符
  sessionTimeoutMin: number; // 会话超时（分钟）
  mfaRequired: boolean; // 管理员强制双因素
  loginFailLock: number; // 连续失败锁定阈值
  auditRetentionDays: number; // 审计留存天数（监管要求≥180）
  ipWhitelistEnabled: boolean; // 登录 IP 白名单开关
  dataMasking: boolean; // 数据脱敏开关（响应/日志敏感字段）
  auditExportApproval: boolean; // 审计导出审批开关
  pwdHistoryNoRepeat: number; // 密码历史不可重复次数（0=不校验）
  opLogDetailLevel: 'SUMMARY' | 'DETAIL'; // 操作日志明细级别
  notifyChannels: ('SITE' | 'MAIL' | 'SMS')[]; // 通知渠道（站内/邮件/短信）
  loginAnnounceEnabled: boolean; // 登录页公告开关
}

/* ------------------------------------------------------------------ */
/* K8s 容器编排（GPU 算力上部署 LLM 推理服务的底座）                */
/* ------------------------------------------------------------------ */

/** K8s 集群（生产/开发隔离，GPU 节点池由 GPU Operator 统一纳管） */
export interface K8sCluster {
  clusterId: string;
  name: string;
  env: 'PROD' | 'DEV';
  k8sVersion: string;
  scheduler: string; // 批调度器（Volcano）
  gpuOperator: string; // GPU 设备插件
  nodes: number; // 工作节点数
  gpuTotal: number; // GPU 总量
  gpuAllocated: number; // 已分配 GPU
  status: 'HEALTHY' | 'DEGRADED';
}

/** 推理服务 Pod（模型实例在 K8s 上的运行形态） */
export interface K8sPod {
  podId: string;
  service: string; // 服务名（Deployment）
  ns: string; // 命名空间
  engine: string; // vLLM / SGLang
  assetName: string; // 对应模型资产
  replicas: number; // 副本数
  gpuReq: string; // GPU 申请（如 2×H20）
  node: string; // 调度节点
  status: 'RUNNING' | 'PENDING' | 'RESTART';
  restarts: number;
}
