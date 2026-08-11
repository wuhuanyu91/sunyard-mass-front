/**
 * 配置域数据服务（完善方案 v2 第五章）
 *  - 可变内存态：写操作直接修改模块级数组，页面经 api 层读取后乐观更新
 *  - 所有写操作生成 OperationRecord 留痕
 *  - 数据基线与《MAAS平台前端功能完善方案》口径一致
 */
import type {
  AggregationGroup,
  AlertAction,
  Announcement,
  ApiKey,
  ApplicationRegistry,
  ApprovalItem,
  ArchivedModel,
  ArchiveRules,
  BatchTask,
  BehaviorTag,
  CallLog,
  CallLogStatus,
  ComputeResource,
  CostModelConfig,
  CostAlertConfig,
  DetectModelInfo,
  DetectModule,
  ElasticSwitchConfig,
  EmergencyTicket,
  EngineVersionInfo,
  GuardrailConfig,
  GuardrailPolicy,
  HeteroSchedPolicy,
  HeteroVendor,
  KeywordLibrary,
  KvCacheGovernance,
  MemberInfo,
  ModelBenefit,
  ModelCard,
  ModelConnection,
  ModelRecommend,
  ModelUsageStat,
  MonthlyBill,
  MyApplication,
  NodeConfig,
  OperationRecord,
  OrchestrationConfig,
  PersonalTrendPoint,
  PersonalUsage,
  PlazaApply,
  Policy,
  QualityAlertRule,
  QuotaProfile,
  RateLimitRule,
  ReportFeedback,
  RoutingEngineConfig,
  RoutingRuleSet,
  TenantOrg,
  TenantRetention,
  K8sCluster,
  K8sPod,
  PermRow,
  PlatformService,
  SysRole,
  SysTicket,
  SysUser,
  SystemParams,
} from '../types';
import { policies } from './data';
import { getAlerts, getOptimizeAdvice, resources, apps } from './data';

/** 告警可变库（支持处置状态流转） */
export const alertsStore = getAlerts().map((a) => ({ ...a }));

/** 优化建议可变库（闭环推进：ACCEPTED→EXECUTED→VERIFIED→CLOSED） */
export const adviceStore = getOptimizeAdvice();

/* ---------------- 策略可变库（B2 控制面工作台读写基座） ---------------- */

export const policiesStore: Policy[] = [
  ...policies.map((p) => ({ ...p })),
  // 待审批样本（与驾驶舱 approvalPending=2 策略口径一致；顶栏徽标为聚合口径含配额恢复/广场申请）
  {
    policyId: 'POL-ROUTING-006', policyType: 'ROUTING', policyName: '营销触达低成本路由策略',
    scopeType: 'APP', scopeValue: 'APP-CSR', priority: 55, status: 'PENDING_APPROVAL',
    effectiveTime: '2026-08-05T00:00:00+08:00', expireTime: '2027-08-04T23:59:59+08:00',
    version: 1, createdBy: '平台管理员', approvedBy: '', lastPublishedAt: '', rollbackVersion: 0,
    rules: { businessScenario: '营销辅助', primaryModel: 'AST-QWEN-14B-BASE', fallbackMode: 'SWITCH_SECONDARY', latencyCeilMs: 3000 },
  },
  {
    policyId: 'POL-METER-007', policyType: 'METERING', policyName: '金融市场部配额上调策略',
    scopeType: 'DEPT', scopeValue: 'DEPT-INVEST', priority: 50, status: 'PENDING_APPROVAL',
    effectiveTime: '2026-09-01T00:00:00+08:00', expireTime: '2027-08-31T23:59:59+08:00',
    version: 1, createdBy: '平台管理员', approvedBy: '', lastPublishedAt: '', rollbackVersion: 0,
    rules: { tokenQuota: 60_000_000, warnThreshold: 0.8, reason: '投研场景调用量增长 40%' },
  },
  // 被驳回的草稿样例（支撑 提交审批 闭环：驳回原因已写入留痕 OP-0006）
  {
    policyId: 'POL-COMPUTE-008', policyType: 'COMPUTE', policyName: 'POOL-4090 开发池 vGPU 切分策略',
    scopeType: 'GLOBAL', scopeValue: '*', priority: 45, status: 'DRAFT',
    effectiveTime: '2026-08-10T00:00:00+08:00', expireTime: '2027-08-09T23:59:59+08:00',
    version: 1, createdBy: '平台管理员', approvedBy: '', lastPublishedAt: '', rollbackVersion: 0,
    rules: { resourcePool: 'POOL-4090', vgpuPercent: 33, vgpuVramMb: 8192, note: '驳回意见：需补充开发池峰值负载评估后重新提交' },
  },
];

/* ---------------- 留痕 ---------------- */

let opSeq = 100;
export const operationRecords: OperationRecord[] = [
  { opId: 'OP-0001', opType: '发布策略', operator: '赵总', targetId: 'POL-ROUTING-001', detail: '发布 v5 至全部网关节点', createdAt: '2026-07-20T10:30:00+08:00' },
  { opId: 'OP-0002', opType: '调整配额', operator: '张伟', targetId: 'DEPT-TECH', detail: '月度 Token 配额调整为 30,000 万', createdAt: '2026-07-25T11:00:00+08:00' },
  { opId: 'OP-0003', opType: '灰度切流', operator: '李娜', targetId: 'AST-FIN-QWEN-14B-SFT', detail: '灰度比例调整至 20%，范围 APP-RISK', createdAt: '2026-08-01T08:00:00+08:00' },
  { opId: 'OP-0004', opType: '超限停发', operator: '系统', targetId: 'DEPT-RISK', detail: '风险管理部月度配额 3,000 万已超限（已用 3,300 万），自动停发', createdAt: new Date(Date.now() - 5 * 3600_000).toISOString() },
  { opId: 'OP-0005', opType: '申请恢复配额', operator: '风险管理部', targetId: 'DEPT-RISK', detail: '风控模型批量评测任务临时增量，申请恢复停发，待管理员审批', createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { opId: 'OP-0006', opType: '审批驳回', operator: '赵总', targetId: 'POL-COMPUTE-008', detail: '意见：需补充开发池峰值负载评估后重新提交', createdAt: new Date(Date.now() - 6 * 3600_000).toISOString() },
];

export function recordOp(opType: string, targetId: string, detail: string): OperationRecord {
  opSeq += 1;
  const rec: OperationRecord = {
    opId: `OP-${String(opSeq).padStart(4, '0')}`,
    opType,
    operator: '平台管理员',
    targetId,
    detail,
    createdAt: new Date().toISOString(),
  };
  operationRecords.unshift(rec);
  return rec;
}

/* ---------------- API Key（P14） ---------------- */

export const apiKeys: ApiKey[] = [
  { keyId: 'KEY-001', keyFull: 'sk-maas-a1b2c3d4e5f6g7h8', keyMasked: 'sk-maas-****g7h8', desc: '智能客服生产密钥', ownerDept: 'DEPT-RETAIL', appId: 'APP-CSR', status: 'ENABLED', expireAt: '2026-12-31', callQuota: 5000000, usedCount: 2381400, allowedModels: ['AST-QWEN-14B-BASE', 'AST-FIN-QWEN-14B-SFT', 'AST-INTENT-MINI'], rateLimitRuleId: 'RL-CFG-002', lastUsedAt: '2026-08-03T09:42:00+08:00', createdAt: '2026-06-01T10:00:00+08:00', env: 'PROD', lastUsedIp: '10.20.14.36' },
  { keyId: 'KEY-002', keyFull: 'sk-maas-i9j0k1l2m3n4o5p6', keyMasked: 'sk-maas-****o5p6', desc: '信贷审批助手', ownerDept: 'DEPT-CORP', appId: 'APP-CREDIT', status: 'ENABLED', expireAt: '2026-10-31', callQuota: 800000, usedCount: 612300, allowedModels: ['AST-QWEN-72B-BASE', 'AST-FIN-QWEN-14B-SFT'], rateLimitRuleId: null, lastUsedAt: '2026-08-03T09:38:00+08:00', createdAt: '2026-06-05T14:00:00+08:00', env: 'PROD', lastUsedIp: '10.22.8.101' },
  { keyId: 'KEY-003', keyFull: 'sk-maas-q7r8s9t0u1v2w3x4', keyMasked: 'sk-maas-****w3x4', desc: 'AI 代码助手（研发）', ownerDept: 'DEPT-TECH', appId: 'APP-AICODING', status: 'ENABLED', expireAt: null, callQuota: 0, usedCount: 1893600, allowedModels: ['AST-QWEN-72B-BASE', 'AST-QWEN-14B-BASE'], rateLimitRuleId: 'RL-CFG-003', lastUsedAt: '2026-08-03T09:45:00+08:00', createdAt: '2026-06-12T09:00:00+08:00', env: 'PROD', lastUsedIp: '10.30.12.58' },
  { keyId: 'KEY-004', keyFull: 'sk-maas-y5z6a7b8c9d0e1f2', keyMasked: 'sk-maas-****e1f2', desc: '风控报告生成', ownerDept: 'DEPT-RISK', appId: 'APP-RISK', status: 'ENABLED', expireAt: '2026-09-30', callQuota: 300000, usedCount: 299800, allowedModels: ['AST-FIN-QWEN-14B-SFT'], rateLimitRuleId: null, lastUsedAt: '2026-08-03T08:55:00+08:00', createdAt: '2026-06-20T11:00:00+08:00', env: 'PROD', lastUsedIp: '10.25.3.77' },
  { keyId: 'KEY-005', keyFull: 'sk-maas-g3h4i5j6k7l8m9n0', keyMasked: 'sk-maas-****m9n0', desc: '营销触达（第三方）', ownerDept: 'DEPT-RETAIL', appId: 'APP-CSR', status: 'DISABLED', expireAt: '2026-07-31', callQuota: 200000, usedCount: 200000, allowedModels: ['AST-EXT-MARKETING'], rateLimitRuleId: null, lastUsedAt: '2026-07-30T18:20:00+08:00', createdAt: '2026-05-15T16:00:00+08:00', env: 'PROD', lastUsedIp: '10.20.15.9' },
  { keyId: 'KEY-006', keyFull: 'sk-maas-o1p2q3r4s5t6u7v8', keyMasked: 'sk-maas-****u7v8', desc: '合同文档抽取', ownerDept: 'DEPT-OPS', appId: 'APP-DOC', status: 'ENABLED', expireAt: null, callQuota: 1500000, usedCount: 486200, allowedModels: ['AST-OCR-DOC', 'AST-QWEN-14B-BASE'], rateLimitRuleId: 'RL-CFG-005', lastUsedAt: '2026-08-03T09:12:00+08:00', createdAt: '2026-06-28T13:00:00+08:00', env: 'PROD', lastUsedIp: '10.28.6.44' },
  { keyId: 'KEY-007', keyFull: 'sk-maas-t1e2s3t4k5e6y7d8', keyMasked: 'sk-maas-****y7d8', desc: '风控模型联调测试', ownerDept: 'DEPT-RISK', appId: 'APP-RISK', status: 'ENABLED', expireAt: '2026-08-31', callQuota: 50000, usedCount: 12800, allowedModels: ['AST-FIN-QWEN-14B-SFT', 'AST-FIN-QWEN-14B-INT4'], rateLimitRuleId: null, lastUsedAt: '2026-08-02T17:30:00+08:00', createdAt: '2026-07-28T10:00:00+08:00', env: 'TEST', lastUsedIp: '10.99.1.12' },
];

/* ---------------- 限流规则（P14/P29） ---------------- */

export const rateLimitRules: RateLimitRule[] = [
  { ruleId: 'RL-CFG-001', name: '全行 QPS 总闸', targetType: 'GLOBAL', targetId: '*', enabled: true, qpsPerMin: 8000, inputTokenLimit: 131072, outputTokenLimit: 32768, concurrency: 2000, ipWhitelist: [], overAction: 'REJECT', hits24h: 477 },
  { ruleId: 'RL-CFG-002', name: '智能客服限流', targetType: 'APP', targetId: 'APP-CSR', enabled: true, qpsPerMin: 1200, inputTokenLimit: 32768, outputTokenLimit: 8192, concurrency: 400, ipWhitelist: ['10.20.0.0/16'], overAction: 'QUEUE', hits24h: 126 },
  { ruleId: 'RL-CFG-003', name: 'AI 代码助手限流', targetType: 'APP', targetId: 'APP-AICODING', enabled: true, qpsPerMin: 600, inputTokenLimit: 65536, outputTokenLimit: 16384, concurrency: 200, ipWhitelist: ['10.30.12.0/24', '10.30.13.0/24'], overAction: 'DOWNGRADE', hits24h: 58 },
  { ruleId: 'RL-CFG-004', name: '风控密钥专属限流', targetType: 'API_KEY', targetId: 'KEY-004', enabled: true, qpsPerMin: 120, inputTokenLimit: 32768, outputTokenLimit: 8192, concurrency: 40, ipWhitelist: [], overAction: 'REJECT', hits24h: 12 },
  { ruleId: 'RL-CFG-005', name: '文档抽取批量限流', targetType: 'APP', targetId: 'APP-DOC', enabled: false, qpsPerMin: 300, inputTokenLimit: 16384, outputTokenLimit: 4096, concurrency: 80, ipWhitelist: [], overAction: 'QUEUE', hits24h: 0 },
];

/* ---------------- 场景路由规则（P11） ---------------- */

export const routingRuleSets: RoutingRuleSet[] = [
  { sceneKey: 'CREDIT', sceneName: '信贷审批', priority: 'P0', allowedModels: ['AST-QWEN-72B-BASE', 'AST-FIN-QWEN-14B-SFT'], fallbackModel: 'AST-FIN-QWEN-14B-SFT', latencyCeilMs: 1200, policyId: 'POL-ROUTING-001' },
  { sceneKey: 'RISK', sceneName: '风控反欺诈', priority: 'P0', allowedModels: ['AST-FIN-QWEN-14B-SFT', 'AST-QWEN-14B-BASE'], fallbackModel: 'AST-QWEN-14B-BASE', latencyCeilMs: 800, policyId: null },
  { sceneKey: 'MARKETING', sceneName: '营销触达', priority: 'P2', allowedModels: ['AST-EXT-MARKETING', 'AST-QWEN-14B-BASE'], fallbackModel: 'AST-QWEN-14B-BASE', latencyCeilMs: 3000, policyId: null },
  { sceneKey: 'SERVICE', sceneName: '客服问答', priority: 'P1', allowedModels: ['AST-QWEN-14B-BASE', 'AST-INTENT-MINI'], fallbackModel: 'AST-INTENT-MINI', latencyCeilMs: 1500, policyId: null },
];

/* ---------------- 模型聚合组与弹性切换（P15） ---------------- */

export const aggregationGroups: AggregationGroup[] = [
  { groupId: 'AGG-001', name: '客服问答聚合组', members: ['AST-QWEN-14B-BASE', 'AST-FIN-QWEN-14B-SFT', 'AST-INTENT-MINI'], strategy: 'WEIGHTED', autoSkipFault: true, healthCheckSec: 30, faultMembers: [] },
  { groupId: 'AGG-002', name: '复杂推理聚合组', members: ['AST-QWEN-72B-BASE', 'AST-QWEN-14B-BASE'], strategy: 'LATENCY', autoSkipFault: true, healthCheckSec: 15, faultMembers: ['AST-QWEN-72B-BASE'] },
];

export const elasticSwitch: ElasticSwitchConfig = { triggerUtil: 85, sustainMin: 5, target: 'RENTAL', trafficRatio: 30, active: true };

/* ---------------- 配额（P29） ---------------- */

export const quotas: QuotaProfile[] = [
  { deptId: 'DEPT-TECH', deptName: '信息科技部', monthTokenQuota: 3_600_000_000, usedTokens: 2_580_000_000, monthCost: 4_380_000, overLimitStop: true, warnThreshold: 80, notifyChannels: ['SITE', 'MAIL'], status: 'NORMAL', resumePending: false },
  { deptId: 'DEPT-RETAIL', deptName: '零售银行总部', monthTokenQuota: 3_000_000_000, usedTokens: 2_680_000_000, monthCost: 4_560_000, overLimitStop: true, warnThreshold: 80, notifyChannels: ['SITE', 'MAIL'], status: 'WARNING', resumePending: false },
  { deptId: 'DEPT-CORP', deptName: '公司银行总部', monthTokenQuota: 2_000_000_000, usedTokens: 1_240_000_000, monthCost: 2_110_000, overLimitStop: true, warnThreshold: 90, notifyChannels: ['SITE'], status: 'NORMAL', resumePending: false },
  { deptId: 'DEPT-RISK', deptName: '风险管理部', monthTokenQuota: 1_500_000_000, usedTokens: 1_580_000_000, monthCost: 2_690_000, overLimitStop: true, warnThreshold: 80, notifyChannels: ['SITE', 'MAIL', 'SMS'], status: 'STOPPED', resumePending: true },
  { deptId: 'DEPT-OPS', deptName: '运营管理部', monthTokenQuota: 1_200_000_000, usedTokens: 760_000_000, monthCost: 1_290_000, overLimitStop: false, warnThreshold: 90, notifyChannels: ['SITE'], status: 'NORMAL', resumePending: false },
  { deptId: 'DEPT-INVEST', deptName: '金融市场部', monthTokenQuota: 900_000_000, usedTokens: 420_000_000, monthCost: 710_000, overLimitStop: true, warnThreshold: 80, notifyChannels: ['SITE', 'MAIL'], status: 'NORMAL', resumePending: false },
];

/* ---------------- 模型接入（P37） ---------------- */

export const connections: ModelConnection[] = [
  { connId: 'CONN-001', name: '阿里云百炼-Qwen-Max', source: 'CLOUD', provider: '阿里云百炼', modelType: '文本生成', apiKeyMasked: 'sk-bl-****x9e2', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', nodes: 0, cardType: '', status: 'ONLINE', latencyMs: 238, assetId: 'AST-EXT-MARKETING', lastCheckAt: '2026-08-03T09:40:00+08:00', createdAt: '2026-06-02T10:00:00+08:00' },
  { connId: 'CONN-002', name: '火山引擎-Doubao-Pro', source: 'CLOUD', provider: '火山引擎', modelType: '文本生成', apiKeyMasked: 'sk-vl-****m3k7', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', nodes: 0, cardType: '', status: 'ONLINE', latencyMs: 312, assetId: null, lastCheckAt: '2026-08-03T09:35:00+08:00', createdAt: '2026-06-18T14:00:00+08:00' },
  { connId: 'CONN-003', name: 'OpenRouter-聚合网关', source: 'CLOUD', provider: 'OpenRouter', modelType: 'Embedding', apiKeyMasked: 'sk-or-****p1q5', baseUrl: 'https://openrouter.ai/api/v1', nodes: 0, cardType: '', status: 'OFFLINE', latencyMs: null, assetId: null, lastCheckAt: '2026-08-02T22:10:00+08:00', createdAt: '2026-07-01T09:00:00+08:00' },
  { connId: 'CONN-004', name: '本地 H20 生产集群', source: 'LOCAL', provider: '行内数据中心', modelType: '文本生成', apiKeyMasked: '', baseUrl: '', nodes: 64, cardType: 'H20', status: 'ONLINE', latencyMs: 42, assetId: null, lastCheckAt: '2026-08-03T09:44:00+08:00', createdAt: '2026-05-10T08:00:00+08:00' },
  { connId: 'CONN-005', name: '本地 L20/4090 推理集群', source: 'LOCAL', provider: '行内数据中心', modelType: 'OCR', apiKeyMasked: '', baseUrl: '', nodes: 40, cardType: 'L20', status: 'ONLINE', latencyMs: 38, assetId: null, lastCheckAt: '2026-08-03T09:44:00+08:00', createdAt: '2026-05-10T08:00:00+08:00' },
  { connId: 'CONN-006', name: 'CloudA 租赁池', source: 'RENTAL', provider: 'CloudA', modelType: '文本生成', apiKeyMasked: 'sk-ca-****t8w2', baseUrl: 'https://api.clouda.example.com/v1', nodes: 24, cardType: 'H20', status: 'TESTING', latencyMs: null, assetId: null, lastCheckAt: '2026-08-03T09:20:00+08:00', createdAt: '2026-07-20T15:00:00+08:00' },
];

/* ---------------- 模型广场（P38） ---------------- */

export const modelCards: ModelCard[] = [
  { cardId: 'CARD-001', name: 'Qwen-72B-Instruct', category: 'TEXT', provider: '开源基座', desc: '复杂推理与长文本生成主力模型，适合信贷分析与 Agent 规划场景', costPer1k: 0.9, rating: 4.8, monthCalls: 10_800_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-002', name: 'Qwen-14B-Instruct', category: 'TEXT', provider: '开源基座', desc: '通用问答与摘要首选，成本效率最高的大模型选择', costPer1k: 0.25, rating: 4.6, monthCalls: 35_400_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-003', name: 'Fin-Qwen-14B-SFT', category: 'TEXT', provider: '自研微调', desc: '金融场景微调模型，信贷/风控/合规抽取准确率 97.2%', costPer1k: 0.32, rating: 4.9, monthCalls: 17_400_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-004', name: 'MiniLM-Intent', category: 'TEXT', provider: '开源小模型', desc: '意图识别与路由前置分类，时延 85ms 极致轻量', costPer1k: 0.02, rating: 4.5, monthCalls: 28_800_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-005', name: 'OCR-Doc-V3', category: 'OCR', provider: '开源', desc: '票据与合同结构化抽取，支持 40+ 金融票据版式', costPer1k: 0.08, rating: 4.7, monthCalls: 13_800_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-006', name: 'Voice-ASR-Fin', category: 'VOICE', provider: '第三方', desc: '客服语音转写，金融专有词表优化，准确率 98.9%', costPer1k: 0.12, rating: 4.4, monthCalls: 2_600_000, applyStatus: 'NONE' },
  { cardId: 'CARD-007', name: 'BGE-M3-Embedding', category: 'EMBEDDING', provider: '开源', desc: '多语言向量检索，知识库 RAG 场景标配', costPer1k: 0.01, rating: 4.6, monthCalls: 8_200_000, applyStatus: 'NONE' },
  { cardId: 'CARD-008', name: 'SDXL-金融海报', category: 'IMAGE', provider: '自研微调', desc: '营销海报与配图生成，内置品牌合规校验', costPer1k: 1.2, rating: 4.2, monthCalls: 620_000, applyStatus: 'PENDING' },
  { cardId: 'CARD-009', name: '第三方营销模型', category: 'TEXT', provider: '第三方', desc: '客群分析与营销文案生成，外部 API 接入', costPer1k: 0.45, rating: 4.0, monthCalls: 6_600_000, applyStatus: 'GRANTED' },
  { cardId: 'CARD-010', name: 'GLM-5-旗舰', category: 'TEXT', provider: '云端', desc: '旗舰级通用大模型，复杂任务兜底（成本高，路由按需调度）', costPer1k: 1.6, rating: 4.9, monthCalls: 1_260_000, applyStatus: 'NONE' },
  { cardId: 'CARD-011', name: '表格解析-TableParser', category: 'OCR', provider: '自研', desc: '财报与流水表格结构化解析，单元格级精度 99.1%', costPer1k: 0.1, rating: 4.3, monthCalls: 2_100_000, applyStatus: 'NONE' },
  { cardId: 'CARD-012', name: 'Whisper-大语音', category: 'VOICE', provider: '开源', desc: '长语音离线转写，支持方言与中英混读', costPer1k: 0.15, rating: 4.1, monthCalls: 940_000, applyStatus: 'NONE' },
];

export const plazaApplies: PlazaApply[] = [
  { applyId: 'APL-001', cardId: 'CARD-008', deptId: 'DEPT-RETAIL', purpose: '零售营销海报批量生成，替代外包设计流程，预计月调用 5 万次', estMonthCalls: 50000, status: 'PENDING', createdAt: '2026-08-01T10:00:00+08:00' },
];

/* ---------------- 灰度发布（P34） ---------------- */

export const grayReleases: import('../types').GrayRelease[] = [
  {
    releaseId: 'REL-001', assetId: 'AST-FIN-QWEN-14B-SFT', assetName: 'Fin-Qwen-14B-SFT', version: 'v3.2',
    step: 3, percent: 20, scope: ['APP-RISK（风控报告生成）'],
    abMetrics: { accuracy: [96.1, 97.2], latencyMs: [780, 740], compliance: [98.9, 99.4], costPer1k: [0.3, 0.32] },
    startedAt: '2026-08-01T08:00:00+08:00', effectCountdown: null,
  },
  {
    releaseId: 'REL-002', assetId: 'AST-FIN-QWEN-14B-INT4', assetName: 'Fin-Qwen-14B-INT4', version: 'v1.0',
    step: 2, percent: 5, scope: ['APP-CREDIT（信贷审批助手）'],
    abMetrics: { accuracy: [96.1, 95.6], latencyMs: [780, 410], compliance: [98.9, 98.7], costPer1k: [0.3, 0.18] },
    startedAt: '2026-08-02T14:00:00+08:00', effectCountdown: null,
  },
];

/* ---------------- 归档（P35） ---------------- */

export const archivedModels: ArchivedModel[] = [
  { assetId: 'AST-OLD-CHAT-7B', assetName: 'Chat-7B-V1', reason: 'REPLACED', archivedAt: '2026-05-12T10:00:00+08:00', retention: '24M', valueScore: 'D', scoreDetail: { cost: 35, conversion: 22, riskAcc: 61 } },
  { assetId: 'AST-REG-AML-V2', assetName: '反洗钱报送模型 V2', reason: 'COMPLIANCE', archivedAt: '2026-03-30T09:00:00+08:00', retention: 'PERMANENT', valueScore: 'A', scoreDetail: { cost: 82, conversion: 76, riskAcc: 98 } },
  { assetId: 'AST-MKT-COPY-V1', assetName: '营销文案模型 V1', reason: 'NO_CALL_90D', archivedAt: '2026-06-20T16:00:00+08:00', retention: '24M', valueScore: 'C', scoreDetail: { cost: 48, conversion: 51, riskAcc: 72 } },
  { assetId: 'AST-OCR-V2', assetName: 'OCR-Doc-V2', reason: 'MANUAL', archivedAt: '2026-04-18T11:00:00+08:00', retention: '24M', valueScore: 'B', scoreDetail: { cost: 61, conversion: 58, riskAcc: 80 } },
];

export const archiveRules: ArchiveRules = { noCall90d: true, replaced: true, compliance: true };

/* ---------------- 安全护栏（P42-P44） ---------------- */

export const guardrailConfig: GuardrailConfig = { enabled: true, apiUrl: 'https://guardrail.nbmaas.local/api/v1', apiKeyMasked: 'gd-****f3a9', textLatencyMs: 200, multimodalLatencyMs: 1200 };

export const guardrailPolicies: GuardrailPolicy[] = [
  { policyId: 'GD-001', name: '零售客服输出护栏', desc: '客服场景输出脱敏 + 合规检测', modules: ['PRIVACY', 'COMPLIANCE', 'BAD_INFO'], action: 'MASK', bindApps: ['APP-CSR'] },
  { policyId: 'GD-002', name: '研发输入强校验', desc: '防提示注入 + 恶意代码识别', modules: ['INJECTION', 'MALCODE', 'ABUSE'], action: 'BLOCK', bindApps: ['APP-AICODING'] },
  { policyId: 'GD-003', name: '全行输入合规底线', desc: '违法/不良信息全场景拦截', modules: ['ILLEGAL', 'BAD_INFO', 'COMPLIANCE'], action: 'BLOCK', bindApps: [] },
];

export const detectModules: DetectModule[] = [
  { moduleKey: 'ILLEGAL', label: '违法信息过滤', critical: true, enabled: true, sensitivity: 'HIGH' },
  { moduleKey: 'BAD_INFO', label: '不良信息过滤', critical: true, enabled: true, sensitivity: 'MED' },
  { moduleKey: 'MALCODE', label: '恶意代码识别', critical: false, enabled: true, sensitivity: 'MED' },
  { moduleKey: 'PRIVACY', label: '隐私信息拦截', critical: true, enabled: true, sensitivity: 'HIGH' },
  { moduleKey: 'PROXY_ANSWER', label: '模型代答', critical: false, enabled: false, sensitivity: 'LOW' },
  { moduleKey: 'SESSION_BLOCK', label: '会话阻断', critical: false, enabled: true, sensitivity: 'MED' },
  { moduleKey: 'INJECTION', label: '防提示词注入', critical: true, enabled: true, sensitivity: 'HIGH' },
  { moduleKey: 'COMPLIANCE', label: '输入合规检测', critical: false, enabled: true, sensitivity: 'MED' },
  { moduleKey: 'ABUSE', label: '模型滥用检测', critical: false, enabled: true, sensitivity: 'MED' },
  { moduleKey: 'DDOS', label: 'DDOS 检测', critical: false, enabled: true, sensitivity: 'HIGH' },
];

export const keywordLibs: KeywordLibrary[] = [
  { libId: 'LIB-SYS', name: '系统敏感词库', type: 'SYSTEM', version: 'v2026.07', wordCount: 18240, updatedAt: '2026-07-01T00:00:00+08:00' },
  { libId: 'LIB-FIN', name: '金融违禁词库（自定义）', type: 'CUSTOM', version: 'v3', wordCount: 862, updatedAt: '2026-07-22T14:00:00+08:00' },
  { libId: 'LIB-PII', name: '客户隐私模式库（自定义）', type: 'CUSTOM', version: 'v1', wordCount: 126, updatedAt: '2026-06-30T09:00:00+08:00' },
];

export const detectModels: DetectModelInfo[] = [
  { modelId: 'DM-001', name: '内容安全检测模型', version: 'v4.2', status: 'RUNNING', latencyMs: 96, isDefault: true },
  { modelId: 'DM-002', name: '注入攻击识别模型', version: 'v2.1', status: 'RUNNING', latencyMs: 58, isDefault: false },
  { modelId: 'DM-003', name: '多模态审核模型', version: 'v1.3', status: 'STANDBY', latencyMs: 640, isDefault: false },
];

export const reportFeedbacks: ReportFeedback[] = [
  { reportId: 'RP-001', content: '客服回答涉及竞品对比话术，疑似违规', source: 'APP-CSR / U-3021', status: 'OPEN', createdAt: '2026-08-02T15:30:00+08:00' },
  { reportId: 'RP-002', content: '营销文案误拦：正常理财介绍被判不良信息', source: 'APP-CSR / U-3055', status: 'FALSE_POSITIVE', createdAt: '2026-08-01T11:20:00+08:00' },
];

/* ---------------- 调用日志（P41：真实业务场景内容池） ---------------- */

const LOG_MODELS = ['Qwen-14B-Instruct', 'Qwen-72B-Instruct', 'Fin-Qwen-14B-SFT', 'MiniLM-Intent', 'OCR-Doc-V3', '第三方营销模型'];
const LOG_PROVIDERS = ['行内集群', '行内集群', '行内集群', '行内集群', '行内集群', '阿里云百炼'];
const LOG_ROUTES = ['客服问答路由', '信贷审批路由', '风控审查路由', '意图识别路由', '文档抽取路由', '营销触达路由'];
const LOG_APPS = ['智能客服', '信贷审批助手', '反欺诈实时监测', '智能外呼平台', '合同文档抽取', '财富管理营销助手'];
const LOG_TAGS: BehaviorTag[] = ['业务办公', '业务办公', '业务办公', '业务办公', '业务办公', '业务办公'];
const LOG_STATUS: { s: CallLogStatus; code: number }[] = [
  { s: 'SUCCESS', code: 200 }, { s: 'SUCCESS', code: 200 }, { s: 'SUCCESS', code: 200 }, { s: 'SUCCESS', code: 200 },
  { s: 'RATE_LIMITED', code: 429 }, { s: 'FAILED', code: 500 }, { s: 'BLOCKED', code: 403 }, { s: 'SUCCESS', code: 200 },
];
/** 按路由场景的问答内容池（轮换避免重复） */
const LOG_CONTENT: { req: string; res: string }[] = [
  { req: '客户咨询：信用卡账单日与还款日的关系，以及最低还款额后剩余部分的计息规则，请用客服话术回答。', res: '您好，账单日后 20 天为到期还款日；选择最低还款后，剩余未还部分将按日利率万分之五计收利息，并按月计收复利……' },
  { req: '请基于以下客户资料生成贷前尽调摘要：某制造业企业，近三年营收 2.4/2.9/3.1 亿，关注涉诉与对外担保。', res: '【摘要】营收稳定增长，资产负债率 58%；存在 1 起未结诉讼（标的 320 万）及对外担保 1,500 万，建议追加抵押并关注或有负债。' },
  { req: '监测到账户 6217****8821 在 10 分钟内向 5 个新账户分散转账共 48 万元，请给出欺诈风险研判。', res: '【研判】符合“分散转出+新户聚集”特征，风险分 87/100；建议触发二级核实（人脸+回拨），暂缓后续转出 2 小时。' },
  { req: '判断以下来电意图：“我想把到期的定期存款转成大额存单，顺便问下现在的利率”。', res: '意图：存款产品转换（置信度 0.96），子意图：利率查询；建议转接理财经理并推送大额存单当前利率牌价。' },
  { req: '抽取以下借款合同关键要素：借款人、金额、期限、利率、担保方式、违约条款要点。', res: '借款人：宁波某贸易有限公司；金额 500 万元；期限 12 个月；LPR+45BP；抵押+保证；违约要点：逾期罚息上浮 50%，交叉违约条款……' },
  { req: '为 35-45 岁稳健型客群生成一条大额存单营销文案，不得含收益承诺与绝对化用语。', res: '【文案】给财富多一份确定的选择——我行大额存单，期限灵活、到期自动兑付，详询您的专属客户经理。产品有风险，选择需谨慎。' },
  { req: '请审查这份宣传物料是否合规：含“保本保息”“零风险”表述及同业对比图表。', res: '【审查】不合规：命中“保本保息”“零风险”禁用词 2 处；同业对比图缺少数据来源与口径说明，建议删除或补充出处后重新送审。' },
  { req: '帮我写一个 Python 函数：解析对账单 CSV，按摘要字段归类交易并汇总金额，处理编码异常。', res: '```python\ndef parse_statement(path):\n    import csv\n    with open(path, encoding="utf-8", errors="replace") as f:\n        ...``` 已处理 GBK/UTF-8 混合编码与空行，归类键可配置。' },
];

/** 调用日志生成：索引经哈希散列打散（避免等间隔/严格轮转的机械感），时间间隔 18~52 分钟不等 */
export const callLogs: CallLog[] = (() => {
  const logs: CallLog[] = [];
  let cursor = Date.now();
  for (let i = 0; i < 40; i++) {
    const h = (((i + 1) * 2654435761) >>> 0); // 黄金比例哈希，分布均匀且确定可复现
    const m = h % LOG_MODELS.length;
    const st = LOG_STATUS[(h >>> 4) % LOG_STATUS.length];
    cursor -= (18 + (h % 35)) * 60_000; // 间隔 18~52 分钟
    const inTok = 300 + ((h >>> 8) % 3800);
    const content = LOG_CONTENT[(h >>> 12) % LOG_CONTENT.length];
    logs.push({
      logId: `LOG-${String(700000 + i * 13)}`,
      ts: new Date(cursor).toISOString(),
      status: st.s,
      statusCode: st.code,
      apiKeyMasked: `sk-maas-****${['g7h8', 'o5p6', 'w3x4', 'e1f2', 'u7v8', 'm9n0'][(h >>> 16) % 6]}`,
      routeName: LOG_ROUTES[m],
      model: LOG_MODELS[m],
      provider: LOG_PROVIDERS[m],
      appType: LOG_APPS[m],
      behaviorTag: i === 13 ? '疑似违规' : i === 29 ? '私人娱乐' : LOG_TAGS[m],
      inputTokens: inTok,
      // 被限流/阻断的请求未产生有效输出（真实生产口径）
      outputTokens: st.s === 'SUCCESS' ? Math.round(inTok * 0.35) : 0,
      requestContent: content.req,
      responseContent: st.s === 'BLOCKED' ? '（请求被前置护栏阻断，未返回模型输出）' : content.res,
    });
  }
  return logs;
})();

/* ---------------- 个人用量（P27） ---------------- */

export const personalUsage: PersonalUsage[] = [
  { userId: 'U-3014', name: '王芳', deptId: 'DEPT-TECH', tokens: 5_200_000, cost: 8840, tagDist: [{ tag: '开发调试', pct: 78 }, { tag: '业务办公', pct: 18 }, { tag: '私人娱乐', pct: 4 }] },
  { userId: 'U-3068', name: '郑浩', deptId: 'DEPT-TECH', tokens: 4_600_000, cost: 7820, tagDist: [{ tag: '开发调试', pct: 85 }, { tag: '业务办公', pct: 13 }, { tag: '私人娱乐', pct: 2 }] },
  { userId: 'U-3001', name: '陈晓', deptId: 'DEPT-RETAIL', tokens: 620_000, cost: 1050, tagDist: [{ tag: '业务办公', pct: 92 }, { tag: '开发调试', pct: 6 }, { tag: '私人娱乐', pct: 2 }] },
  { userId: 'U-3033', name: '孙倩', deptId: 'DEPT-CORP', tokens: 560_000, cost: 950, tagDist: [{ tag: '业务办公', pct: 95 }, { tag: '私人娱乐', pct: 5 }] },
  { userId: 'U-3007', name: '刘洋', deptId: 'DEPT-RISK', tokens: 480_000, cost: 860, tagDist: [{ tag: '业务办公', pct: 97 }, { tag: '开发调试', pct: 3 }] },
  { userId: 'U-3042', name: '周凯', deptId: 'DEPT-INVEST', tokens: 310_000, cost: 530, tagDist: [{ tag: '业务办公', pct: 89 }, { tag: '开发调试', pct: 11 }] },
  { userId: 'U-3021', name: '赵磊', deptId: 'DEPT-RETAIL', tokens: 230_000, cost: 390, tagDist: [{ tag: '业务办公', pct: 64 }, { tag: '私人娱乐', pct: 31 }, { tag: '开发调试', pct: 5 }] },
  { userId: 'U-3055', name: '吴敏', deptId: 'DEPT-OPS', tokens: 190_000, cost: 320, tagDist: [{ tag: '业务办公', pct: 98 }, { tag: '私人娱乐', pct: 2 }] },
];

/** 个人用量趋势（近 14 天，当前用户 U-3001；末点 = 近 24h 口径 62 万/¥1,050，周末回落符合办公场景） */
export const personalTrend: PersonalTrendPoint[] = [
  { date: '07-29', tokens: 430_000, cost: 727 },
  { date: '07-30', tokens: 465_000, cost: 786 },
  { date: '07-31', tokens: 380_000, cost: 642 },
  { date: '08-01', tokens: 210_000, cost: 355 },
  { date: '08-02', tokens: 180_000, cost: 304 },
  { date: '08-03', tokens: 520_000, cost: 879 },
  { date: '08-04', tokens: 555_000, cost: 938 },
  { date: '08-05', tokens: 590_000, cost: 997 },
  { date: '08-06', tokens: 480_000, cost: 811 },
  { date: '08-07', tokens: 610_000, cost: 1031 },
  { date: '08-08', tokens: 240_000, cost: 406 },
  { date: '08-09', tokens: 190_000, cost: 321 },
  { date: '08-10', tokens: 585_000, cost: 989 },
  { date: '08-11', tokens: 620_000, cost: 1050 },
];

/* ---------------- 模型统计与推荐（P26） ---------------- */

export const modelUsageStats: ModelUsageStat[] = [
  { assetId: 'AST-QWEN-14B-BASE', name: 'Qwen-14B-Instruct', calls: 1_180_000, inputTokens: 150_000_000, outputTokens: 52_000_000, cost: 186_000 },
  { assetId: 'AST-QWEN-72B-BASE', name: 'Qwen-72B-Instruct', calls: 360_000, inputTokens: 105_000_000, outputTokens: 36_000_000, cost: 168_000 },
  { assetId: 'AST-FIN-QWEN-14B-SFT', name: 'Fin-Qwen-14B-SFT', calls: 580_000, inputTokens: 60_000_000, outputTokens: 21_000_000, cost: 98_000 },
  { assetId: 'AST-EXT-MARKETING', name: '第三方营销模型', calls: 220_000, inputTokens: 42_000_000, outputTokens: 16_000_000, cost: 86_000 },
  { assetId: 'AST-INTENT-MINI', name: 'MiniLM-Intent', calls: 960_000, inputTokens: 13_000_000, outputTokens: 4_000_000, cost: 42_000 },
  { assetId: 'AST-OCR-DOC', name: 'OCR-Doc-V3', calls: 460_000, inputTokens: 24_000_000, outputTokens: 9_000_000, cost: 58_000 },
];

export const modelRecommends: ModelRecommend[] = [
  { recId: 'REC-001', scene: '营销文案', currentModel: 'Qwen-72B-Instruct', recommendModel: 'Fin-Qwen-14B-SFT', estSaving: 460_000 },
  { recId: 'REC-002', scene: '客服简单问答', currentModel: 'Qwen-14B-Instruct', recommendModel: 'MiniLM-Intent', estSaving: 280_000 },
  { recId: 'REC-003', scene: '票据要素抽取', currentModel: 'Qwen-14B-Instruct', recommendModel: 'OCR-Doc-V3', estSaving: 150_000 },
];

/** 全量旗舰模型测算口径（P26：若全部用 GLM-5 费用 vs 语义路由节省） */
export const routingSaving = { flagship: 'GLM-5-旗舰', allInCost: 6_420_000, savedCost: 2_740_000, savedPct: 42.7 };

/* ---------------- 应急工单（P11） ---------------- */

export const emergencyTickets: EmergencyTicket[] = [
  { ticketId: 'EM-20260802-001', type: 'GRAY_DEGRADE', operator: '平台管理员', target: '客服问答', params: '降级比例 30% → AST-INTENT-MINI', status: 'ROLLED_BACK', createdAt: '2026-08-02T14:20:00+08:00' },
  { ticketId: 'EM-20260803-001', type: 'SWITCH_BACKUP', operator: '平台管理员', target: '复杂推理聚合组', params: '切备 → POOL-4090 开发池', status: 'ACTIVE', createdAt: '2026-08-03T08:45:00+08:00' },
];

/* ---------------- 资源编排（P17-P22） ---------------- */

export const orchestration: OrchestrationConfig = {
  mixDeploy: true, mixAffinity: ['AST-INTENT-MINI', 'AST-OCR-DOC'], vramReserve: 15,
  weights: { P0: 8, P1: 5, P2: 2 }, lowPrioritySlow: true, p0Preempt: true,
  continuousBatch: true, maxBatch: 64, kvCache: true, kvStrategy: 'SEMANTIC',
  speculative: false, draftModel: 'EAGLE-Qwen-14B-Draft',
};

export const nodeConfigs: Record<string, NodeConfig> = {
  'RES-GPU-H20-01': { resourceId: 'RES-GPU-H20-01', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 24576, quantization: 'FP16', replicas: 3, extendRental: false },
  'RES-GPU-H20-02': { resourceId: 'RES-GPU-H20-02', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 24576, quantization: 'FP16', replicas: 4, extendRental: false },
  'RES-GPU-L20-01': { resourceId: 'RES-GPU-L20-01', vgpuEnabled: true, vgpuPercent: 50, vgpuVramMb: 12288, quantization: 'FP16', replicas: 5, extendRental: false },
  'RES-GPU-L20-02': { resourceId: 'RES-GPU-L20-02', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 12288, quantization: 'INT8', replicas: 3, extendRental: false },
  'RES-GPU-4090-01': { resourceId: 'RES-GPU-4090-01', vgpuEnabled: true, vgpuPercent: 33, vgpuVramMb: 8192, quantization: 'INT4', replicas: 6, extendRental: false },
  'RES-NPU-ASC-01': { resourceId: 'RES-NPU-ASC-01', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 16384, quantization: 'FP16', replicas: 1, extendRental: false },
  'RES-CPU-01': { resourceId: 'RES-CPU-01', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 0, quantization: 'FP16', replicas: 8, extendRental: false },
  'RES-RENTAL-A-01': { resourceId: 'RES-RENTAL-A-01', vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 24576, quantization: 'FP16', replicas: 4, extendRental: true },
};

/* ---------------- 租户留存（P40） ---------------- */

export const tenantRetentions: TenantRetention[] = [
  { tenantId: 'TENANT-RETAIL', tenantName: '零售银行总部', retentionDays: 365, storagePolicy: '独立存储 · 加密', logCount: 486200 },
  { tenantId: 'TENANT-TECH', tenantName: '信息科技部', retentionDays: 180, storagePolicy: '独立存储 · 加密', logCount: 612300 },
  { tenantId: 'TENANT-RISK', tenantName: '风险管理部', retentionDays: 365, storagePolicy: '独立存储 · 监管留存', logCount: 298100 },
];

/* ---------------- 告警处置记录（十一章闭环） ---------------- */

export const alertActions: AlertAction[] = [
  { actionId: 'AA-001', alertId: 'ALT-002', action: 'ACK', note: '已确认，观察队列深度变化', operator: '平台管理员', createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
];

/* ---------------- 成本预警配置（六章运营策略） ---------------- */

export const costAlertConfig: CostAlertConfig = {
  enabled: true,
  dailyBudget: 750_000,
  warnPct: 85,
  overAction: 'DOWNGRADE',
  notifyChannels: ['SITE', 'MAIL'],
  todayCost: 684_000,
};

/* ---------------- KV 缓存治理（八章） ---------------- */

export const kvGovernance: KvCacheGovernance = {
  tenantIsolation: true,
  forbidSensitive: true,
  ttlMin: 120,
  auditEnabled: true,
  hitTokens24h: 212_000_000,
  savedCostPct: 31,
};

/* ---------------- 推理引擎版本（13.3） ---------------- */

export const engineVersions: EngineVersionInfo[] = [
  { engineId: 'ENG-001', engine: 'VLLM', version: 'v0.6.3', latestVersion: 'v0.6.6', instances: 4, upgradeStatus: 'UPGRADE_AVAILABLE', releaseNote: 'v0.6.6：修复 H20 上 KV 缓存碎片化，TTFT 改善 12%；支持 FP8 KV 量化', riskNote: '升级需重启实例；建议先选 1 台低峰节点灰度验证 24h' },
  { engineId: 'ENG-002', engine: 'SGLANG', version: 'v0.3.2', latestVersion: 'v0.3.2', instances: 1, upgradeStatus: 'UP_TO_DATE', releaseNote: '当前为最新版本，RadixAttention 前缀缓存已启用', riskNote: '无待升级项' },
];

/** 审批待办聚合（策略 PENDING_APPROVAL + 配额恢复申请 + 广场接入申请） */
export function getApprovalItems(): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  for (const p of policiesStore) {
    if (p.status === 'PENDING_APPROVAL') {
      items.push({ approvalId: `APR-${p.policyId}`, kind: 'POLICY', title: `策略审批：${p.policyName}`, applicant: p.createdBy, reason: `${p.policyType} 策略 v${p.version} 待审批发布`, targetLink: '/control', createdAt: p.effectiveTime });
    }
  }
  for (const q of quotas) {
    if (q.resumePending) {
      items.push({ approvalId: `APR-RESUME-${q.deptId}`, kind: 'QUOTA_RESUME', title: `配额恢复申请：${q.deptName}`, applicant: q.deptName, reason: '超限停发后提交恢复申请，需管理员审批', targetLink: '/metering?tab=quota', createdAt: new Date().toISOString() });
    }
  }
  for (const a of plazaApplies) {
    if (a.status === 'PENDING') {
      const card = modelCards.find((c) => c.cardId === a.cardId);
      items.push({ approvalId: `APR-${a.applyId}`, kind: 'PLAZA_APPLY', title: `模型接入申请：${card?.name ?? a.cardId}`, applicant: a.deptId, reason: a.purpose, targetLink: '/assets?tab=plaza', createdAt: a.createdAt });
    }
  }
  return items;
}

/* ---------------- 算力资源可变库（节点维护操作） ---------------- */

export const resourcesStore: ComputeResource[] = resources.map((r) => ({ ...r }));

/* ---------------- 应用注册可变库（应用管理 CRUD） ---------------- */

export const appsStore: ApplicationRegistry[] = apps.map((a) => ({ ...a }));

/* ---------------- 调用质量告警规则（对标百炼观测告警） ---------------- */

export const qualityAlertRules: QualityAlertRule[] = [
  { ruleId: 'QA-001', name: 'P95 时延超标', metric: 'P95', threshold: 1200, unit: 'ms', enabled: true, channels: ['SITE', 'MAIL'], hits24h: 2 },
  { ruleId: 'QA-002', name: '错误率超标', metric: 'ERROR_RATE', threshold: 1, unit: '%', enabled: true, channels: ['SITE', 'MAIL', 'SMS'], hits24h: 1 },
  { ruleId: 'QA-003', name: '队列深度拥堵', metric: 'QUEUE', threshold: 200, unit: '任务', enabled: true, channels: ['SITE'], hits24h: 0 },
  { ruleId: 'QA-004', name: '调用量突增（基线 3 倍）', metric: 'CALL_SPIKE', threshold: 3, unit: '倍', enabled: false, channels: ['SITE', 'MAIL'], hits24h: 0 },
];

/* ---------------- 平台成员（RBAC 可编辑） ---------------- */

export const members: MemberInfo[] = [
  { memberId: 'M-001', name: '赵总', deptId: 'DEPT-TECH', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: '2026-08-03T08:30:00+08:00' },
  { memberId: 'M-002', name: '张伟', deptId: 'DEPT-TECH', role: 'OPERATOR', status: 'ACTIVE', lastLoginAt: '2026-08-03T09:05:00+08:00' },
  { memberId: 'M-003', name: '李娜', deptId: 'DEPT-RISK', role: 'MODEL_OWNER', status: 'ACTIVE', lastLoginAt: '2026-08-02T16:40:00+08:00' },
  { memberId: 'M-004', name: '王强', deptId: 'DEPT-OPS', role: 'MODEL_OWNER', status: 'ACTIVE', lastLoginAt: '2026-08-01T14:20:00+08:00' },
  { memberId: 'M-005', name: '审计员-陈', deptId: 'DEPT-TECH', role: 'AUDITOR', status: 'ACTIVE', lastLoginAt: '2026-07-31T10:00:00+08:00' },
  { memberId: 'M-006', name: '陈晓', deptId: 'DEPT-RETAIL', role: 'BIZ_VIEWER', status: 'ACTIVE', lastLoginAt: '2026-08-03T09:20:00+08:00' },
  { memberId: 'M-007', name: '外包-刘', deptId: 'DEPT-TECH', role: 'BIZ_VIEWER', status: 'DISABLED', lastLoginAt: '2026-07-15T11:00:00+08:00' },
];

/* ---------------- 月度账单（P24） ---------------- */

export const monthlyBills: MonthlyBill[] = [
  { month: '2026-07', deptId: 'DEPT-TECH', deptName: '信息科技部', tokens: 3_480_000_000, calls: 32_600_000, cost: 5_620_000, mom: 11.2 },
  { month: '2026-07', deptId: 'DEPT-RETAIL', deptName: '零售银行总部', tokens: 2_900_000_000, calls: 27_400_000, cost: 4_730_000, mom: 8.6 },
  { month: '2026-07', deptId: 'DEPT-CORP', deptName: '公司银行总部', tokens: 1_980_000_000, calls: 15_200_000, cost: 3_150_000, mom: 5.1 },
  { month: '2026-07', deptId: 'DEPT-RISK', deptName: '风险管理部', tokens: 1_420_000_000, calls: 9_800_000, cost: 2_360_000, mom: 14.8 },
  { month: '2026-07', deptId: 'DEPT-OPS', deptName: '运营管理部', tokens: 1_180_000_000, calls: 13_600_000, cost: 1_920_000, mom: 3.4 },
  { month: '2026-07', deptId: 'DEPT-INVEST', deptName: '金融市场部', tokens: 880_000_000, calls: 6_400_000, cost: 1_480_000, mom: 6.9 },
  { month: '2026-08', deptId: 'DEPT-TECH', deptName: '信息科技部', tokens: 250_000_000, calls: 2_100_000, cost: 410_000, mom: 1.1 },
  { month: '2026-08', deptId: 'DEPT-RETAIL', deptName: '零售银行总部', tokens: 200_000_000, calls: 1_700_000, cost: 330_000, mom: 0.8 },
  { month: '2026-08', deptId: 'DEPT-CORP', deptName: '公司银行总部', tokens: 130_000_000, calls: 1_200_000, cost: 215_000, mom: -1.2 },
  { month: '2026-08', deptId: 'DEPT-RISK', deptName: '风险管理部', tokens: 90_000_000, calls: 850_000, cost: 150_000, mom: 2.6 },
  { month: '2026-08', deptId: 'DEPT-OPS', deptName: '运营管理部', tokens: 90_000_000, calls: 800_000, cost: 140_000, mom: 0.4 },
  { month: '2026-08', deptId: 'DEPT-INVEST', deptName: '金融市场部', tokens: 80_000_000, calls: 710_000, cost: 120_000, mom: 1.5 },
];

/* ---------------- 公告通知 ---------------- */

export const announcements: Announcement[] = [
  { annId: 'ANN-001', type: 'MAINTENANCE', title: 'POOL-H20 生产池例行维护通告', content: '8 月 6 日 02:00-04:00 对 node-gpu-02 进行固件升级，期间该节点请求自动调度至其他节点，业务无感。', createdAt: '2026-08-03T09:00:00+08:00', pinned: true },
  { annId: 'ANN-002', type: 'NOTICE', title: '本月配额预警提醒', content: '零售银行总部配额使用已达 87%，风险管理部已超限停发（恢复审批中），请相关部门关注。', createdAt: '2026-08-03T08:30:00+08:00', pinned: false },
  { annId: 'ANN-003', type: 'NOTICE', title: 'vLLM v0.6.6 升级评估已发布', content: '修复 H20 KV 缓存碎片化问题，TTFT 预计改善 12%，可在 资源编排 → 推理引擎版本 发起灰度升级。', createdAt: '2026-08-02T15:00:00+08:00', pinned: false },
];

/* ---------------- 批量推理任务（错峰） ---------------- */

export const batchTasks: BatchTask[] = [
  { taskId: 'BT-001', name: '零售存量客户营销文案批量生成', deptId: 'DEPT-RETAIL', assetId: 'AST-QWEN-14B-BASE', priority: 'P3', window: '00:00-06:00', rows: 120_000, status: 'QUEUED', submitAt: '2026-08-03T10:20:00+08:00' },
  { taskId: 'BT-002', name: '历史合同批量要素抽取', deptId: 'DEPT-OPS', assetId: 'AST-OCR-DOC', priority: 'P2', window: '00:00-06:00', rows: 45_000, status: 'RUNNING', submitAt: '2026-08-02T23:50:00+08:00' },
  { taskId: 'BT-003', name: '风控评测集批量回测', deptId: 'DEPT-RISK', assetId: 'AST-FIN-QWEN-14B-SFT', priority: 'P2', window: '22:00-06:00', rows: 8_000, status: 'DONE', submitAt: '2026-08-01T21:00:00+08:00' },
];

/* ---------------- 我的申请单（申请人视角） ---------------- */

export const myApplications: MyApplication[] = [
  { applyId: 'MA-001', kind: 'MODEL_ACCESS', title: '模型接入：SDXL-金融海报', reason: '零售营销海报批量生成，替代外包设计流程，预计月调用 5 万次', status: 'PENDING', submitAt: '2026-08-01T10:00:00+08:00', approveAt: null, opinion: '' },
  { applyId: 'MA-002', kind: 'QUOTA_RESUME', title: '配额恢复：风险管理部', reason: '风控模型批量评测任务临时增量，申请恢复停发', status: 'PENDING', submitAt: '2026-08-03T07:30:00+08:00', approveAt: null, opinion: '' },
  { applyId: 'MA-003', kind: 'API_KEY', title: 'API Key 申请：风控联调测试', reason: 'Fin-Qwen-14B-INT4 联调测试，需要独立 TEST 环境密钥', status: 'APPROVED', submitAt: '2026-07-27T14:00:00+08:00', approveAt: '2026-07-28T10:00:00+08:00', opinion: '同意，已按 TEST 环境发放 KEY-007，有效期 1 个月' },
  { applyId: 'MA-004', kind: 'QUOTA_ADJUST', title: '配额调整：金融市场部上调至 6,000 万', reason: '投研场景调用量增长 40%，申请下月起上调配额', status: 'REJECTED', submitAt: '2026-07-30T09:00:00+08:00', approveAt: '2026-07-31T16:00:00+08:00', opinion: '驳回：请先提供高消耗 Top3 应用的优化方案后重新申请' },
];

/* ---------------- 多约束路由引擎配置（智能网关核心） ---------------- */

export const routingEngine: RoutingEngineConfig = {
  weights: { latency: 30, cost: 25, risk: 25, load: 20 },
  cacheFirst: true,
  budgetGuard: true,
  slaPriority: true,
  autoFallback: true,
  openaiCompat: true,
};

/* ---------------- 异构算力厂商资源矩阵（13.4） ---------------- */

export const heteroVendors: HeteroVendor[] = [
  { vendorId: 'V-NV-H20', vendor: '英伟达', chip: 'H20', kind: 'GPU', domestic: false, count: 32, vramPerCard: 96, utilization: 78, hostedModels: 6, compatStatus: 'COMPATIBLE', costTag: 'HIGH', pools: ['POOL-H20'] },
  { vendorId: 'V-NV-L20', vendor: '英伟达', chip: 'L20', kind: 'GPU', domestic: false, count: 28, vramPerCard: 48, utilization: 71, hostedModels: 8, compatStatus: 'COMPATIBLE', costTag: 'MID', pools: ['POOL-L20'] },
  { vendorId: 'V-NV-4090', vendor: '英伟达', chip: '4090D', kind: 'GPU', domestic: false, count: 18, vramPerCard: 24, utilization: 55, hostedModels: 5, compatStatus: 'COMPATIBLE', costTag: 'LOW', pools: ['POOL-4090'] },
  { vendorId: 'V-HW-910B', vendor: '华为昇腾', chip: 'Ascend 910B', kind: 'NPU', domestic: true, count: 16, vramPerCard: 64, utilization: 42, hostedModels: 2, compatStatus: 'COMPATIBLE', costTag: 'MID', pools: ['POOL-ASCEND'] },
  { vendorId: 'V-MX-C500', vendor: '沐曦', chip: '曦云 C500', kind: 'GPU', domestic: true, count: 8, vramPerCard: 64, utilization: 18, hostedModels: 1, compatStatus: 'ADAPTING', costTag: 'MID', pools: ['POOL-MUXI'] },
  { vendorId: 'V-INT-XEON', vendor: 'Intel', chip: 'Xeon 8480+', kind: 'CPU', domestic: false, count: 40, vramPerCard: 0, utilization: 41, hostedModels: 3, compatStatus: 'COMPATIBLE', costTag: 'LOW', pools: ['POOL-CPU'] },
];

/** 异构调度策略（国产化优先等，可配置） */
export const heteroSchedPolicy: HeteroSchedPolicy = {
  domesticFirst: true,
  crossVendorFailover: true,
  rentalPeak: true,
  vendorPriority: ['V-NV-H20', 'V-HW-910B', 'V-NV-L20', 'V-MX-C500', 'V-NV-4090', 'V-INT-XEON'],
};

/* ---------------- 核心补强：成本模型 / 效益评估 / 租户组织（需求概览 8-11 章） ---------------- */

/** TCO 成本模型（九章：可配置，默认基线 = 四类成本实际占比） */
export const costModelConfig: CostModelConfig = {
  weights: { infra: 35, compute: 40, license: 15, external: 10 },
  depreciationYears: 5,
  rentalFactor: 1.35,
  allocateBy: 'TOKEN',
  updatedAt: '2026-08-03T09:00:00+08:00',
};

/** 模型效益评估（十章：月度口径，与模型统计 modelUsageStats 同源） */
export const modelBenefits: ModelBenefit[] = [
  { assetId: 'AST-FIN-QWEN-14B-SFT', activeApps: 5, userScale: 980, monthCost: 98_000, unitCost: 169, adoptRate: 82, successRate: 99.6, valueScore: 'A', suggestion: 'KEEP' },
  { assetId: 'AST-INTENT-MINI', activeApps: 7, userScale: 1560, monthCost: 42_000, unitCost: 44, adoptRate: 93, successRate: 99.8, valueScore: 'A', suggestion: 'KEEP' },
  { assetId: 'AST-QWEN-14B-BASE', activeApps: 6, userScale: 1240, monthCost: 186_000, unitCost: 158, adoptRate: 76, successRate: 99.4, valueScore: 'B', suggestion: 'KEEP' },
  { assetId: 'AST-OCR-DOC', activeApps: 4, userScale: 610, monthCost: 58_000, unitCost: 126, adoptRate: 88, successRate: 99.1, valueScore: 'B', suggestion: 'KEEP' },
  { assetId: 'AST-QWEN-72B-BASE', activeApps: 4, userScale: 860, monthCost: 168_000, unitCost: 467, adoptRate: 68, successRate: 99.2, valueScore: 'C', suggestion: 'OPTIMIZE' },
  { assetId: 'AST-EXT-MARKETING', activeApps: 3, userScale: 420, monthCost: 86_000, unitCost: 391, adoptRate: 61, successRate: 98.1, valueScore: 'C', suggestion: 'REPLACE' },
];

/** 租户与组织映射（十一章：租户 → 宁波银行组织条线） */
export const tenantOrgs: TenantOrg[] = [
  { tenantId: 'TENANT-RETAIL', tenantName: '零售银行总部', mappedDepts: ['DEPT-RETAIL', 'DEPT-CORP'], dataBoundary: 'L3', modelScope: 'DEPT', quotaShared: true, memberCount: 46, status: 'ACTIVE' },
  { tenantId: 'TENANT-TECH', tenantName: '信息科技部', mappedDepts: ['DEPT-TECH', 'DEPT-OPS'], dataBoundary: 'L3', modelScope: 'GLOBAL', quotaShared: false, memberCount: 32, status: 'ACTIVE' },
  { tenantId: 'TENANT-RISK', tenantName: '风险管理部', mappedDepts: ['DEPT-RISK'], dataBoundary: 'L3', modelScope: 'DEPT', quotaShared: true, memberCount: 18, status: 'ACTIVE' },
  { tenantId: 'TENANT-INVEST', tenantName: '金融市场部', mappedDepts: ['DEPT-INVEST'], dataBoundary: 'L2', modelScope: 'DEPT', quotaShared: false, memberCount: 12, status: 'SUSPENDED' },
];

/* ---------------- 系统管理（用户/角色/权限/监控/工单/参数） ---------------- */

/** 平台账号（与成员表同源，此处为账号/安全视图；账号为行内 6 位工号） */
export const sysUsers: SysUser[] = [
  { userId: 'M-001', name: '赵总', account: '100001', deptId: 'DEPT-TECH', deptName: '信息科技部', role: 'SUPER_ADMIN', status: 'ACTIVE', mfa: true, lastLoginAt: '2026-08-11T08:25:00+08:00' },
  { userId: 'M-002', name: '张伟', account: '100238', deptId: 'DEPT-TECH', deptName: '信息科技部', role: 'OPERATOR', status: 'ACTIVE', mfa: true, lastLoginAt: '2026-08-11T07:58:00+08:00' },
  { userId: 'M-003', name: '李娜', account: '200516', deptId: 'DEPT-RISK', deptName: '风险管理部', role: 'MODEL_OWNER', status: 'ACTIVE', mfa: false, lastLoginAt: '2026-08-10T17:42:00+08:00' },
  { userId: 'M-004', name: '王强', account: '300172', deptId: 'DEPT-OPS', deptName: '运营管理部', role: 'MODEL_OWNER', status: 'ACTIVE', mfa: false, lastLoginAt: '2026-08-10T15:10:00+08:00' },
  { userId: 'M-005', name: '审计员-陈', account: '100869', deptId: 'DEPT-TECH', deptName: '信息科技部', role: 'AUDITOR', status: 'ACTIVE', mfa: true, lastLoginAt: '2026-08-09T10:05:00+08:00' },
  { userId: 'M-006', name: '陈晓', account: '400325', deptId: 'DEPT-RETAIL', deptName: '零售银行总部', role: 'BIZ_VIEWER', status: 'ACTIVE', mfa: false, lastLoginAt: '2026-08-11T08:52:00+08:00' },
  { userId: 'M-007', name: '外包-刘', account: '900017', deptId: 'DEPT-TECH', deptName: '信息科技部', role: 'BIZ_VIEWER', status: 'DISABLED', mfa: false, lastLoginAt: '2026-07-15T11:20:00+08:00' },
  { userId: 'M-008', name: '周敏', account: '500442', deptId: 'DEPT-CORP', deptName: '公司银行总部', role: 'BIZ_VIEWER', status: 'LOCKED', mfa: false, lastLoginAt: '2026-08-10T09:14:00+08:00' },
];

/** 角色定义（RBAC 内置角色） */
export const sysRoles: SysRole[] = [
  { roleKey: 'SUPER_ADMIN', roleName: '超级管理员', desc: '平台全量功能与系统管理', scope: '全行', builtIn: true, userCount: 1 },
  { roleKey: 'PLATFORM_ADMIN', roleName: '平台管理员', desc: '策略配置/审批/应急处置', scope: '全行', builtIn: true, userCount: 2 },
  { roleKey: 'OPERATOR', roleName: '运维操作员', desc: '算力/实例/引擎日常运维', scope: '调度算力域', builtIn: true, userCount: 3 },
  { roleKey: 'MODEL_OWNER', roleName: '模型负责人', desc: '所辖模型发布/灰度/归档', scope: '所辖模型', builtIn: true, userCount: 2 },
  { roleKey: 'BIZ_VIEWER', roleName: '业务查看员', desc: '本部门用量/日志只读', scope: '本部门', builtIn: true, userCount: 128 },
  { roleKey: 'AUDITOR', roleName: '审计员', desc: '审计日志/合规导出', scope: '全行（只读）', builtIn: true, userCount: 2 },
];

/** 权限矩阵（模块×角色） */
export const permMatrix: PermRow[] = [
  { module: '运营驾驶舱', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'WRITE', OPERATOR: 'READ', MODEL_OWNER: 'READ', BIZ_VIEWER: 'READ', AUDITOR: 'READ' } },
  { module: '策略治理', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'APPROVE', OPERATOR: 'READ', MODEL_OWNER: 'WRITE', BIZ_VIEWER: 'DENY', AUDITOR: 'READ' } },
  { module: '调度算力', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'WRITE', OPERATOR: 'WRITE', MODEL_OWNER: 'READ', BIZ_VIEWER: 'DENY', AUDITOR: 'READ' } },
  { module: '计量运营', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'WRITE', OPERATOR: 'READ', MODEL_OWNER: 'READ', BIZ_VIEWER: 'READ', AUDITOR: 'READ' } },
  { module: '模型资产', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'WRITE', OPERATOR: 'READ', MODEL_OWNER: 'WRITE', BIZ_VIEWER: 'READ', AUDITOR: 'READ' } },
  { module: '安全审计', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'WRITE', OPERATOR: 'READ', MODEL_OWNER: 'READ', BIZ_VIEWER: 'DENY', AUDITOR: 'WRITE' } },
  { module: '系统管理', levels: { SUPER_ADMIN: 'APPROVE', PLATFORM_ADMIN: 'READ', OPERATOR: 'READ', MODEL_OWNER: 'DENY', BIZ_VIEWER: 'DENY', AUDITOR: 'READ' } },
];

/** 平台服务健康（平台监控：分布式平台视角，每服务多副本跨节点部署） */
export const platformServices: PlatformService[] = [
  { svcId: 'SVC-GW', name: '智能调度网关集群', kind: 'GATEWAY', status: 'RUNNING', latencyMs: 8, cpuPct: 42, memPct: 55, uptime: '47 天 6 小时', version: 'v2.4.1', replicas: 3, readyReplicas: 3, nodes: ['gw-01', 'gw-02', 'gw-03'] },
  { svcId: 'SVC-REG', name: '模型注册中心', kind: 'REGISTRY', status: 'RUNNING', latencyMs: 12, cpuPct: 18, memPct: 36, uptime: '47 天 6 小时', version: 'v1.8.0', replicas: 3, readyReplicas: 3, nodes: ['reg-01', 'reg-02', 'reg-03'] },
  { svcId: 'SVC-MET', name: '计量计费引擎', kind: 'METERING', status: 'RUNNING', latencyMs: 21, cpuPct: 38, memPct: 61, uptime: '32 天 11 小时', version: 'v3.1.2', replicas: 2, readyReplicas: 2, nodes: ['met-01', 'met-02'] },
  { svcId: 'SVC-AUD', name: '审计存储（防篡改）', kind: 'AUDIT', status: 'RUNNING', latencyMs: 15, cpuPct: 26, memPct: 48, uptime: '89 天 3 小时', version: 'v1.5.4', replicas: 2, readyReplicas: 2, nodes: ['aud-01', 'aud-02'] },
  { svcId: 'SVC-Q', name: '优先级队列', kind: 'QUEUE', status: 'DEGRADED', latencyMs: 46, cpuPct: 71, memPct: 82, uptime: '12 天 9 小时', version: 'v2.0.3', replicas: 2, readyReplicas: 1, nodes: ['mq-01', 'mq-02'] },
  { svcId: 'SVC-K8S', name: 'K8s 控制面', kind: 'K8S', status: 'RUNNING', latencyMs: 10, cpuPct: 22, memPct: 41, uptime: '120 天 2 小时', version: 'v1.28.6', replicas: 3, readyReplicas: 3, nodes: ['k8s-m1', 'k8s-m2', 'k8s-m3'] },
];

/** 工单反馈 */
export const sysTickets: SysTicket[] = [
  { ticketId: 'TK-2031', type: 'PROBLEM', title: '智能外呼平台间歇性 429', content: '每日 09:00-09:30 外呼高峰出现限流，申请评估提升应用级 QPS 上限。', from: '刘凯', deptName: '零售银行总部', status: 'PROCESSING', createdAt: '2026-08-10T14:20:00+08:00', reply: '已定位为应用级限流规则命中，建议提交配额调整工单同步处理。' },
  { ticketId: 'TK-2030', type: 'REQUEST', title: '申请开通批量任务窗口', content: '月末对账文档抽取需临时批量任务窗口（20:00-24:00），预计 8 万条。', from: '孙倩', deptName: '公司银行总部', status: 'OPEN', createdAt: '2026-08-10T10:05:00+08:00', reply: '' },
  { ticketId: 'TK-2028', type: 'PROBLEM', title: '合同抽取模型输出格式变化', content: 'OCR-Doc-V3 部分输出 JSON 字段缺失，疑似提示词模板变更。', from: '张伟', deptName: '信息科技部', status: 'RESOLVED', createdAt: '2026-08-08T16:40:00+08:00', reply: '确认为 v3.2 模板回滚导致，已恢复 v3.1 模板并补充回归用例。' },
  { ticketId: 'TK-2026', type: 'SUGGEST', title: '建议驾驶舱增加部门环比视图', content: '希望驾驶舱部门 TCO 排行支持环比切换，便于月度经营分析。', from: '赵磊', deptName: '零售银行总部', status: 'RESOLVED', createdAt: '2026-08-06T09:30:00+08:00', reply: '已纳入需求池，随下版本驾驶舱迭代发布。' },
  { ticketId: 'TK-2025', type: 'REQUEST', title: '新增外包人员账号（已到期回收）', content: '外包驻场到期，账号已按流程停用并回收权限，请确认。', from: '审计员-陈', deptName: '信息科技部', status: 'RESOLVED', createdAt: '2026-08-05T11:00:00+08:00', reply: '已确认：账号停用、Key 吊销、权限回收均已留痕。' },
];

/** 系统参数（安全合规基线，默认值对标银行业监管要求） */
export const systemParams: SystemParams = {
  pwdMinLen: 10,
  pwdNeedSpecial: true,
  sessionTimeoutMin: 30,
  mfaRequired: true,
  loginFailLock: 5,
  auditRetentionDays: 365,
  ipWhitelistEnabled: true,
  dataMasking: true,
  auditExportApproval: true,
  pwdHistoryNoRepeat: 5,
  opLogDetailLevel: 'DETAIL',
  notifyChannels: ['SITE', 'MAIL'],
  loginAnnounceEnabled: true,
};

/* ---------------- K8s 容器编排（LLM 推理服务底座） ---------------- */

/** K8s 集群：生产/开发隔离，GPU 节点池统一纳管 */
export const k8sClusters: K8sCluster[] = [
  { clusterId: 'K8S-PROD-GPU', name: '生产 GPU 集群', env: 'PROD', k8sVersion: 'v1.28.6', scheduler: 'Volcano v1.9', gpuOperator: 'NVIDIA GPU Operator v24.3', nodes: 78, gpuTotal: 120, gpuAllocated: 104, status: 'HEALTHY' },
  { clusterId: 'K8S-PROD-NPU', name: '生产国产化集群', env: 'PROD', k8sVersion: 'v1.26.10', scheduler: 'Volcano v1.8', gpuOperator: 'Ascend Device Plugin v24.0', nodes: 42, gpuAllocated: 18, gpuTotal: 22, status: 'HEALTHY' },
  { clusterId: 'K8S-DEV', name: '开发测试集群', env: 'DEV', k8sVersion: 'v1.29.2', scheduler: 'default-scheduler', gpuOperator: 'NVIDIA GPU Operator v24.3', nodes: 22, gpuTotal: 12, gpuAllocated: 7, status: 'DEGRADED' },
];

/** 推理服务 Pod（模型实例 → K8s 运行形态） */
export const k8sPods: K8sPod[] = [
  { podId: 'POD-01', service: 'qwen14-instruct', ns: 'maas-prod', engine: 'vLLM', assetName: 'Qwen-14B-Instruct', replicas: 8, gpuReq: '1×L20', node: 'node-gpu-05', status: 'RUNNING', restarts: 0 },
  { podId: 'POD-02', service: 'qwen72-instruct', ns: 'maas-prod', engine: 'vLLM', assetName: 'Qwen-72B-Instruct', replicas: 4, gpuReq: '2×H20', node: 'node-gpu-02', status: 'RUNNING', restarts: 1 },
  { podId: 'POD-03', service: 'fin-qwen14-sft', ns: 'maas-prod', engine: 'vLLM', assetName: 'Fin-Qwen-14B-SFT', replicas: 6, gpuReq: '1×L20', node: 'node-gpu-08', status: 'RUNNING', restarts: 0 },
  { podId: 'POD-04', service: 'fin-qwen14-int4', ns: 'maas-gray', engine: 'vLLM', assetName: 'Fin-Qwen-14B-INT4', replicas: 2, gpuReq: '1×4090D', node: 'node-4090-02', status: 'RUNNING', restarts: 0 },
  { podId: 'POD-05', service: 'glm5-flagship', ns: 'maas-prod', engine: 'SGLang', assetName: 'GLM-5-旗舰', replicas: 3, gpuReq: '4×H20', node: 'node-gpu-01', status: 'RUNNING', restarts: 2 },
  { podId: 'POD-06', service: 'ocr-doc-v3', ns: 'maas-prod', engine: 'vLLM', assetName: 'OCR-Doc-V3', replicas: 4, gpuReq: '1×L20', node: 'node-gpu-11', status: 'RUNNING', restarts: 0 },
  { podId: 'POD-07', service: 'ascend-qwen14', ns: 'maas-domestic', engine: 'MindIE', assetName: 'Ascend-Qwen-14B', replicas: 2, gpuReq: '2×910B', node: 'node-npu-03', status: 'RUNNING', restarts: 0 },
  { podId: 'POD-08', service: 'sdxl-poster', ns: 'maas-gray', engine: 'ComfyUI', assetName: 'SDXL-金融海报', replicas: 1, gpuReq: '1×L20', node: 'node-gpu-14', status: 'PENDING', restarts: 0 },
];

/* ---------------- ID 生成 ---------------- */

let seqBase = 100;
export function nextId(prefix: string): string {
  seqBase += 1;
  return `${prefix}-${String(seqBase).padStart(3, '0')}`;
}

export function genApiKeyFull(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `sk-maas-${s}`;
}
