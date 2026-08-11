/**
 * 平台数据服务（本地固化数据源，规范 12.2）
 * 约束：
 *  - 使用确定性生成（seeded PRNG），同一会话可复现、可解释
 *  - 全链路闭环：同 traceId 可跨 路由 → 计量 → 资产画像 → 审计事件 查询
 *  - 独立于业务组件，仅由 service 层引用
 */
import type {
  ApplicationRegistry,
  BatchPoint,
  CircuitBreaker,
  ComputeResource,
  EvalResult,
  FunnelStage,
  HeatCell,
  Instance,
  MeteringRecord,
  ModelAsset,
  OptimizeAdvice,
  PlatformAlert,
  Policy,
  PriorityQueueItem,
  RateLimitHit,
  RouterLog,
  RoutingDecision,
  SecurityEvent,
} from '../types';

/* ------------------------------------------------------------------ */
/* 确定性随机数（mulberry32）                                          */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260803);
const between = (min: number, max: number) => min + rand() * (max - min);
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* 全行组织与规模口径（宁波银行全行 AI 生产，2026）                     */
/* ------------------------------------------------------------------ */

/** 部门名称映射（宁波银行组织条线） */
export const DEPT_NAME_MAP: Record<string, string> = {
  'DEPT-TECH': '信息科技部',
  'DEPT-RETAIL': '零售银行总部',
  'DEPT-CORP': '公司银行总部',
  'DEPT-RISK': '风险管理部',
  'DEPT-OPS': '运营管理部',
  'DEPT-INVEST': '金融市场部',
};

/** 全行近 24h 聚合口径（KPI/图表统一来源，与明细窗口共存） */
export interface PlatformSummary {
  requests: number; // 总请求数（次）
  inputTokens: number; // 输入 Token
  outputTokens: number; // 输出 Token
  cacheHitTokens: number; // 缓存命中 Token
  gpuHours: number; // GPU 卡时
  tco: number; // 日 TCO（元）
  qps: number; // 实时 QPS
  ttftP50: number; // 首字时延 P50（ms）
  p95: number; // 平均响应 P95（ms）
  gpuUtil: number; // GPU 时间利用率 %
  cacheHitRate: number; // 缓存命中率 %
  successRate: number; // 请求成功率 %
  abnormal: number; // 今日异常（非 SUCCESS）
  degraded: number; // 降级
  blocked: number; // 阻断
  circuitOpen: number; // 熔断中
  nodes: number; // 纳管节点
  pools: number; // 资源池
  models: number; // 模型资产
  prodModels: number; // 生产模型
  apps: number; // 在用应用
  alertOpen: number; // 待处置告警
  approvalPending: number; // 待审批策略
  securityEvents: number; // 安全事件总数（近 24h）
  maskedEvents: number; // 脱敏事件数
  criticalEvents: number; // 严重/错误事件数
}

export function getPlatformSummary(): PlatformSummary {
  return {
    requests: 3_660_000,
    inputTokens: 394_000_000,
    outputTokens: 138_000_000,
    cacheHitTokens: 212_000_000,
    gpuHours: 7860,
    tco: 684_000,
    qps: 86,
    ttftP50: 210,
    p95: 690,
    gpuUtil: 72,
    cacheHitRate: 54,
    successRate: 99.4,
    abnormal: 46,
    degraded: 31,
    blocked: 12,
    circuitOpen: 1,
    nodes: 142,
    pools: 8,
    models: 128,
    prodModels: 46,
    apps: 10,
    alertOpen: 3,
    approvalPending: 2,
    securityEvents: 46,
    maskedEvents: 27,
    criticalEvents: 4,
  };
}

/** 应用 TCO 排行（全行量级，近 24h） */
export function getAppTcoRank(): { appId: string; name: string; tokens: number; tco: number }[] {
  return [
    { appId: 'APP-AICODING', name: 'AI 代码助手', tokens: 96_000_000, tco: 138_000 },
    { appId: 'APP-CSR', name: '智能客服', tokens: 78_000_000, tco: 152_000 },
    { appId: 'APP-CREDIT', name: '信贷审批助手', tokens: 42_000_000, tco: 96_000 },
    { appId: 'APP-RISK', name: '风控报告生成', tokens: 35_000_000, tco: 74_000 },
    { appId: 'APP-INVEST', name: '金融投研助手', tokens: 28_000_000, tco: 52_000 },
  ];
}

/** 模型 TCO 排行（全行量级，近 24h） */
export function getModelTcoRank(): { assetId: string; name: string; calls: number; tco: number }[] {
  return [
    { assetId: 'AST-QWEN-14B-BASE', name: 'Qwen-14B-Instruct', calls: 1_180_000, tco: 186_000 },
    { assetId: 'AST-QWEN-72B-BASE', name: 'Qwen-72B-Instruct', calls: 360_000, tco: 168_000 },
    { assetId: 'AST-FIN-QWEN-14B-SFT', name: 'Fin-Qwen-14B-SFT', calls: 580_000, tco: 98_000 },
    { assetId: 'AST-EXT-MARKETING', name: '第三方营销模型', calls: 220_000, tco: 86_000 },
    { assetId: 'AST-INTENT-MINI', name: 'MiniLM-Intent', calls: 960_000, tco: 42_000 },
  ];
}

/** 生成 HH:mm 时间序列 */
function timeSeries(hours: number, stepMin: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let m = 0; m < hours * 60; m += stepMin) {
    const d = new Date(now.getTime() - (hours * 60 - m) * 60_000);
    out.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 固定实体                                                            */
/* ------------------------------------------------------------------ */

export const assets: ModelAsset[] = [
  {
    assetId: 'AST-QWEN-72B-BASE', assetCode: 'BASE-0001', assetName: 'Qwen-72B-Instruct',
    assetType: 'BASE_LLM', sourceType: 'OPEN_SOURCE', baseModelId: null, derivationType: 'NONE',
    ownerDept: '信息科技部', maintainer: '张伟', riskLevel: 'A', securityLevel: 'L2',
    version: 'v2.1', lifecycleStatus: 'PRODUCTION', supportedTasks: ['复杂推理', '长文本生成', 'Agent 规划'],
    supportedHardware: ['H20', 'L20'], contextWindow: 131072, costPer1kTokens: 0.9, avgLatencyMs: 1850, successRate: 99.1, activeApps: 4,
  },
  {
    assetId: 'AST-QWEN-14B-BASE', assetCode: 'BASE-0002', assetName: 'Qwen-14B-Instruct',
    assetType: 'BASE_LLM', sourceType: 'OPEN_SOURCE', baseModelId: null, derivationType: 'NONE',
    ownerDept: '信息科技部', maintainer: '张伟', riskLevel: 'B', securityLevel: 'L2',
    version: 'v1.8', lifecycleStatus: 'PRODUCTION', supportedTasks: ['问答', '摘要', '分类'],
    supportedHardware: ['L20', '4090D'], contextWindow: 32768, costPer1kTokens: 0.25, avgLatencyMs: 620, successRate: 99.4, activeApps: 8,
  },
  {
    assetId: 'AST-FIN-QWEN-14B-SFT', assetCode: 'FIN-0101', assetName: 'Fin-Qwen-14B-SFT',
    assetType: 'SMALL_LLM', sourceType: 'PROPRIETARY', baseModelId: 'AST-QWEN-14B-BASE', derivationType: 'SFT',
    ownerDept: '风险管理部', maintainer: '李娜', riskLevel: 'A', securityLevel: 'L3',
    version: 'v3.2', lifecycleStatus: 'GRAY', supportedTasks: ['信贷分析', '风控审核', '合规抽取'],
    supportedHardware: ['L20'], contextWindow: 32768, costPer1kTokens: 0.32, avgLatencyMs: 740, successRate: 98.7, activeApps: 3,
  },
  {
    assetId: 'AST-FIN-QWEN-14B-INT4', assetCode: 'FIN-0102', assetName: 'Fin-Qwen-14B-INT4',
    assetType: 'SMALL_LLM', sourceType: 'PROPRIETARY', baseModelId: 'AST-FIN-QWEN-14B-SFT', derivationType: 'QUANTIZATION',
    ownerDept: '风险管理部', maintainer: '李娜', riskLevel: 'B', securityLevel: 'L3',
    version: 'v1.0', lifecycleStatus: 'TESTING', supportedTasks: ['信贷分析', '意图识别'],
    supportedHardware: ['4090D', 'L20'], contextWindow: 16384, costPer1kTokens: 0.18, avgLatencyMs: 410, successRate: 98.2, activeApps: 1,
  },
  {
    assetId: 'AST-OCR-DOC', assetCode: 'MODEL-0201', assetName: 'OCR-Doc-V3',
    assetType: 'OCR', sourceType: 'OPEN_SOURCE', baseModelId: null, derivationType: 'NONE',
    ownerDept: '运营管理部', maintainer: '王强', riskLevel: 'C', securityLevel: 'L2',
    version: 'v3.1', lifecycleStatus: 'PRODUCTION', supportedTasks: ['票据识别', '合同抽取'],
    supportedHardware: ['CPU', 'L20'], contextWindow: 8192, costPer1kTokens: 0.08, avgLatencyMs: 230, successRate: 99.6, activeApps: 6,
  },
  {
    assetId: 'AST-INTENT-MINI', assetCode: 'MODEL-0202', assetName: 'MiniLM-Intent',
    assetType: 'SMALL_LLM', sourceType: 'OPEN_SOURCE', baseModelId: null, derivationType: 'NONE',
    ownerDept: '信息科技部', maintainer: '赵敏', riskLevel: 'C', securityLevel: 'L1',
    version: 'v2.0', lifecycleStatus: 'PRODUCTION', supportedTasks: ['意图识别', '分类'],
    supportedHardware: ['CPU', '4090D'], contextWindow: 2048, costPer1kTokens: 0.02, avgLatencyMs: 85, successRate: 99.8, activeApps: 12,
  },
  {
    assetId: 'AST-VOICE-ASR', assetCode: 'MODEL-0203', assetName: 'Voice-ASR-Fin',
    assetType: 'VOICE', sourceType: 'THIRD_PARTY', baseModelId: null, derivationType: 'NONE',
    ownerDept: '零售银行总部', maintainer: '外部供应商', riskLevel: 'B', securityLevel: 'L3',
    version: 'v1.5', lifecycleStatus: 'PRODUCTION', supportedTasks: ['客服语音转写'],
    supportedHardware: ['L20'], contextWindow: 4096, costPer1kTokens: 0.12, avgLatencyMs: 380, successRate: 98.9, activeApps: 2,
  },
  {
    assetId: 'AST-EXT-MARKETING', assetCode: 'EXT-0301', assetName: '第三方营销模型',
    assetType: 'EXTERNAL', sourceType: 'THIRD_PARTY', baseModelId: null, derivationType: 'NONE',
    ownerDept: '零售银行总部', maintainer: '外部供应商', riskLevel: 'C', securityLevel: 'L2',
    version: 'v4.0', lifecycleStatus: 'PRODUCTION', supportedTasks: ['营销文案', '客群分析'],
    supportedHardware: ['RENTAL'], contextWindow: 8192, costPer1kTokens: 0.45, avgLatencyMs: 900, successRate: 97.8, activeApps: 3,
  },
];

export const apps: ApplicationRegistry[] = [
  { appId: 'APP-CSR', appName: '智能客服', deptId: 'DEPT-RETAIL', owner: '零售银行总部', businessScenario: '客户服务', dataLevel: 'L3', slaLevel: 'P0', quotaToken: 200_000_000, quotaRequest: 5_000_000, costBudget: 60_000, status: 'ACTIVE' },
  { appId: 'APP-CREDIT', appName: '信贷审批助手', deptId: 'DEPT-CORP', owner: '公司银行总部', businessScenario: '信贷分析', dataLevel: 'L3', slaLevel: 'P0', quotaToken: 80_000_000, quotaRequest: 800_000, costBudget: 40_000, status: 'ACTIVE' },
  { appId: 'APP-AICODING', appName: 'AI 代码助手', deptId: 'DEPT-TECH', owner: '信息科技部', businessScenario: '研发编码', dataLevel: 'L1', slaLevel: 'P1', quotaToken: 300_000_000, quotaRequest: 2_000_000, costBudget: 90_000, status: 'ACTIVE' },
  { appId: 'APP-RISK', appName: '风控报告生成', deptId: 'DEPT-RISK', owner: '风险管理部', businessScenario: '风控审核', dataLevel: 'L3', slaLevel: 'P0', quotaToken: 60_000_000, quotaRequest: 300_000, costBudget: 35_000, status: 'ACTIVE' },
  { appId: 'APP-DOC', appName: '合同文档抽取', deptId: 'DEPT-OPS', owner: '运营管理部', businessScenario: '运营处理', dataLevel: 'L2', slaLevel: 'P2', quotaToken: 40_000_000, quotaRequest: 1_500_000, costBudget: 20_000, status: 'ACTIVE' },
  { appId: 'APP-INVEST', appName: '金融投研助手', deptId: 'DEPT-INVEST', owner: '金融市场部', businessScenario: '投研分析', dataLevel: 'L3', slaLevel: 'P1', quotaToken: 50_000_000, quotaRequest: 200_000, costBudget: 25_000, status: 'ACTIVE' },
  { appId: 'APP-CALL', appName: '智能外呼平台', deptId: 'DEPT-RETAIL', owner: '零售银行总部', businessScenario: '客户服务', dataLevel: 'L2', slaLevel: 'P1', quotaToken: 60_000_000, quotaRequest: 900_000, costBudget: 32_000, status: 'ACTIVE' },
  { appId: 'APP-ANTIFRAUD', appName: '反欺诈实时监测', deptId: 'DEPT-RISK', owner: '风险管理部', businessScenario: '风控审核', dataLevel: 'L3', slaLevel: 'P0', quotaToken: 45_000_000, quotaRequest: 1_200_000, costBudget: 30_000, status: 'ACTIVE' },
  { appId: 'APP-COMPLIANCE', appName: '合规审查助手', deptId: 'DEPT-OPS', owner: '运营管理部', businessScenario: '运营处理', dataLevel: 'L3', slaLevel: 'P1', quotaToken: 30_000_000, quotaRequest: 400_000, costBudget: 18_000, status: 'ACTIVE' },
  { appId: 'APP-WEALTH', appName: '财富管理营销助手', deptId: 'DEPT-RETAIL', owner: '零售银行总部', businessScenario: '营销辅助', dataLevel: 'L2', slaLevel: 'P2', quotaToken: 35_000_000, quotaRequest: 600_000, costBudget: 20_000, status: 'ACTIVE' },
];

export const resources: ComputeResource[] = [
  { resourceId: 'RES-GPU-H20-01', resourceType: 'GPU', vendor: 'NVIDIA', architecture: 'Hopper', cluster: 'CLS-PROD', node: 'node-gpu-01', pool: 'POOL-H20', status: 'RUNNING', vramTotal: 94, vramUsed: 61, utilization: 72, instanceCount: 3, queueDepth: 0, costTag: 'LOCAL' },
  { resourceId: 'RES-GPU-H20-02', resourceType: 'GPU', vendor: 'NVIDIA', architecture: 'Hopper', cluster: 'CLS-PROD', node: 'node-gpu-02', pool: 'POOL-H20', status: 'HOT', vramTotal: 94, vramUsed: 88, utilization: 91, instanceCount: 4, queueDepth: 6, costTag: 'LOCAL' },
  { resourceId: 'RES-GPU-L20-01', resourceType: 'GPU', vendor: 'NVIDIA', architecture: 'Ada', cluster: 'CLS-PROD', node: 'node-gpu-03', pool: 'POOL-L20', status: 'RUNNING', vramTotal: 48, vramUsed: 33, utilization: 65, instanceCount: 5, queueDepth: 1, costTag: 'LOCAL' },
  { resourceId: 'RES-GPU-L20-02', resourceType: 'GPU', vendor: 'NVIDIA', architecture: 'Ada', cluster: 'CLS-PROD', node: 'node-gpu-04', pool: 'POOL-L20', status: 'DEGRADED', vramTotal: 48, vramUsed: 42, utilization: 78, instanceCount: 3, queueDepth: 12, costTag: 'LOCAL' },
  { resourceId: 'RES-GPU-4090-01', resourceType: 'GPU', vendor: 'NVIDIA', architecture: 'Ada', cluster: 'CLS-DEV', node: 'node-gpu-05', pool: 'POOL-4090', status: 'RUNNING', vramTotal: 24, vramUsed: 15, utilization: 55, instanceCount: 6, queueDepth: 0, costTag: 'LOCAL' },
  { resourceId: 'RES-NPU-ASC-01', resourceType: 'NPU', vendor: 'Huawei', architecture: 'Ascend910', cluster: 'CLS-PROD', node: 'node-npu-01', pool: 'POOL-ASCEND', status: 'IDLE', vramTotal: 64, vramUsed: 8, utilization: 12, instanceCount: 1, queueDepth: 0, costTag: 'LOCAL' },
  { resourceId: 'RES-CPU-01', resourceType: 'CPU', vendor: 'Intel', architecture: 'x86', cluster: 'CLS-PROD', node: 'node-cpu-01', pool: 'POOL-CPU', status: 'RUNNING', vramTotal: 0, vramUsed: 0, utilization: 41, instanceCount: 8, queueDepth: 0, costTag: 'LOCAL' },
  { resourceId: 'RES-RENTAL-A-01', resourceType: 'RENTAL', vendor: 'CloudA', architecture: 'H20', cluster: 'CLS-RENTAL', node: 'cloud-a-01', pool: 'POOL-RENTAL', status: 'RUNNING', vramTotal: 94, vramUsed: 90, utilization: 89, instanceCount: 4, queueDepth: 8, costTag: 'RENTAL' },
  { resourceId: 'RES-MX-C500-01', resourceType: 'GPU', vendor: 'MetaX', architecture: '曦云C500', cluster: 'CLS-DOMESTIC', node: 'node-mx-01', pool: 'POOL-MUXI', status: 'RUNNING', vramTotal: 64, vramUsed: 14, utilization: 18, instanceCount: 1, queueDepth: 0, costTag: 'LOCAL' },
];

export const instances: Instance[] = [
  { instanceId: 'INS-QWEN72-01', assetId: 'AST-QWEN-72B-BASE', engineType: 'VLLM', deployMode: 'DEDICATED', quantizationType: 'FP16', batchConfig: { maxBatch: 64, maxLatencyMs: 2000 }, kvCacheEnabled: true, ttftMs: 480, avgLatencyMs: 1850, tokensPerSec: 240, cacheHitRate: 61 },
  { instanceId: 'INS-QWEN14-01', assetId: 'AST-QWEN-14B-BASE', engineType: 'VLLM', deployMode: 'SHARED', quantizationType: 'FP16', batchConfig: { maxBatch: 128, maxLatencyMs: 1000 }, kvCacheEnabled: true, ttftMs: 210, avgLatencyMs: 620, tokensPerSec: 620, cacheHitRate: 74 },
  { instanceId: 'INS-FIN14-01', assetId: 'AST-FIN-QWEN-14B-SFT', engineType: 'SGLANG', deployMode: 'SHARED', quantizationType: 'FP16', batchConfig: { maxBatch: 96, maxLatencyMs: 1200 }, kvCacheEnabled: true, ttftMs: 260, avgLatencyMs: 740, tokensPerSec: 480, cacheHitRate: 69 },
  { instanceId: 'INS-FIN14Q-01', assetId: 'AST-FIN-QWEN-14B-INT4', engineType: 'VLLM', deployMode: 'SHARED', quantizationType: 'INT4', batchConfig: { maxBatch: 160, maxLatencyMs: 800 }, kvCacheEnabled: true, ttftMs: 150, avgLatencyMs: 410, tokensPerSec: 880, cacheHitRate: 81 },
  { instanceId: 'INS-OCR-01', assetId: 'AST-OCR-DOC', engineType: 'OTHER', deployMode: 'SHARED', quantizationType: 'NONE', batchConfig: { maxBatch: 32, maxLatencyMs: 500 }, kvCacheEnabled: false, ttftMs: 90, avgLatencyMs: 230, tokensPerSec: 150, cacheHitRate: 0 },
  { instanceId: 'INS-INTENT-01', assetId: 'AST-INTENT-MINI', engineType: 'VLLM', deployMode: 'MIXED', quantizationType: 'INT8', batchConfig: { maxBatch: 256, maxLatencyMs: 300 }, kvCacheEnabled: true, ttftMs: 40, avgLatencyMs: 85, tokensPerSec: 2100, cacheHitRate: 92 },
  { instanceId: 'INS-VOICE-01', assetId: 'AST-VOICE-ASR', engineType: 'OTHER', deployMode: 'DEDICATED', quantizationType: 'NONE', batchConfig: { maxBatch: 16, maxLatencyMs: 800 }, kvCacheEnabled: false, ttftMs: 140, avgLatencyMs: 380, tokensPerSec: 90, cacheHitRate: 0 },
  { instanceId: 'INS-EXT-01', assetId: 'AST-EXT-MARKETING', engineType: 'OTHER', deployMode: 'DEDICATED', quantizationType: 'NONE', batchConfig: { maxBatch: 64, maxLatencyMs: 1500 }, kvCacheEnabled: false, ttftMs: 320, avgLatencyMs: 900, tokensPerSec: 180, cacheHitRate: 0 },
];

export const policies: Policy[] = [
  {
    policyId: 'POL-ROUTING-001', policyType: 'ROUTING', policyName: '智能客服路由策略',
    scopeType: 'APP', scopeValue: 'APP-CSR', priority: 90, status: 'ACTIVE',
    effectiveTime: '2026-07-01T00:00:00+08:00', expireTime: '2027-06-30T23:59:59+08:00',
    version: 5, createdBy: '李娜', approvedBy: '赵总', lastPublishedAt: '2026-07-20T10:30:00+08:00', rollbackVersion: 4,
    rules: { businessScenario: '客户服务', taskType: '问答', dataSensitivity: 'L3', slaLevel: 'P0', budgetLimit: 60000, primaryModel: 'AST-QWEN-14B-BASE', secondaryModel: 'AST-FIN-QWEN-14B-SFT', fallbackMode: 'SWITCH_SECONDARY' },
  },
  {
    policyId: 'POL-COMPUTE-002', policyType: 'COMPUTE', policyName: '生产资源优先级策略',
    scopeType: 'GLOBAL', scopeValue: '*', priority: 80, status: 'ACTIVE',
    effectiveTime: '2026-07-01T00:00:00+08:00', expireTime: '2027-06-30T23:59:59+08:00',
    version: 3, createdBy: '张伟', approvedBy: '赵总', lastPublishedAt: '2026-07-15T09:00:00+08:00', rollbackVersion: 2,
    rules: { resourcePool: 'POOL-H20', allowedArch: ['Hopper', 'Ada'], quotaType: 'RESERVED', quotaValue: 4, priorityClass: 'P0', reservedCapacity: 2 },
  },
  {
    policyId: 'POL-MODEL-003', policyType: 'MODEL', policyName: '信贷风控模型灰度策略',
    scopeType: 'MODEL', scopeValue: 'AST-FIN-QWEN-14B-SFT', priority: 70, status: 'GRAY',
    effectiveTime: '2026-08-01T00:00:00+08:00', expireTime: '2026-08-31T23:59:59+08:00',
    version: 1, createdBy: '李娜', approvedBy: '赵总', lastPublishedAt: '2026-08-01T08:00:00+08:00', rollbackVersion: 0,
    rules: { allowedAssetIds: ['AST-FIN-QWEN-14B-SFT'], allowedVersions: ['v3.2'], grayRule: { ratio: 0.2, scope: 'APP:APP-RISK' }, abTestRule: { enabled: true, metrics: ['accuracy', 'latency', 'compliance'] }, rollbackThreshold: { successRate: 0.97, latencyMs: 1200 } },
  },
  {
    policyId: 'POL-SEC-004', policyType: 'SECURITY', policyName: 'L3 数据安全护栏策略',
    scopeType: 'TENANT', scopeValue: 'TENANT-RETAIL', priority: 95, status: 'ACTIVE',
    effectiveTime: '2026-07-01T00:00:00+08:00', expireTime: '2027-06-30T23:59:59+08:00',
    version: 2, createdBy: '安全中心', approvedBy: '赵总', lastPublishedAt: '2026-07-18T14:00:00+08:00', rollbackVersion: 1,
    rules: { roleSet: ['CSR', 'CSR_MGR'], tenantBoundary: 'STRICT', promptCheckRule: 'PROMPT_INJECTION_STRICT', outputMaskRule: 'MASK-ID-CARD', logRetentionRule: '365D' },
  },
  {
    policyId: 'POL-METER-005', policyType: 'METERING', policyName: '部门 Token 配额策略',
    scopeType: 'DEPT', scopeValue: 'DEPT-TECH', priority: 60, status: 'ACTIVE',
    effectiveTime: '2026-07-01T00:00:00+08:00', expireTime: '2027-06-30T23:59:59+08:00',
    version: 4, createdBy: '张伟', approvedBy: '赵总', lastPublishedAt: '2026-07-25T11:00:00+08:00', rollbackVersion: 3,
    rules: { tokenQuota: 300_000_000, requestQuota: 2_000_000, costBudget: 90000, warnThreshold: 0.8, limitThreshold: 1.0 },
  },
];

/* ------------------------------------------------------------------ */
/* 核心 Trace 样本（全链路闭环锚点）                                    */
/* ------------------------------------------------------------------ */

const BASE_TIME = Date.now() - 24 * 3600_000;

/** 构造一条完整请求记录 */
function buildTrace(index: number, over: Partial<RouterLog> & { decision?: RouterLog['decision'] }): RouterLog {
  const app = apps[index % apps.length];
  const asset = assets[(index * 3) % assets.length];
  const scenario = ['客户服务', '信贷分析', '研发编码', '运营处理', '风控审核', '投研分析'][index % 6];
  const task = ['问答', '抽取', '生成', '分类', '推理', '工具规划'][index % 6];
  const traceId = `TR-${String(20260803 + index)}-${String(100000 + index * 7919).padStart(6, '0')}`;
  const mode = (['SYNC', 'SYNC', 'STREAM', 'ASYNC'] as const)[index % 4];
  const engine = index % 3 === 0 ? 'SGLANG' : 'VLLM';

  const decision: RoutingDecision = {
    candidateModels: [
      { assetId: asset.assetId, version: asset.version, score: 86, eliminateReason: '' },
      { assetId: 'AST-QWEN-72B-BASE', version: 'v2.1', score: 64, eliminateReason: '成本超出 budgetClass 预算，scoreCost=38' },
      { assetId: 'AST-INTENT-MINI', version: 'v2.0', score: 41, eliminateReason: 'contextLength 超出 2048 上限' },
    ],
    selectedModel: asset.assetId,
    selectedVersion: asset.version,
    selectedEngine: engine,
    selectedPool: 'POOL-H20',
    selectedNode: 'node-gpu-01',
    routeReason: `业务=${scenario}, 任务=${task}, 数据等级=${app.dataLevel}, SLA=${app.slaLevel}; 主模型候选得分最高且预算内, 命中 KV Cache`,
    scoreLatency: round1(between(70, 95)),
    scoreCost: round1(between(55, 92)),
    scoreRisk: round1(between(60, 98)),
    scoreLoad: round1(between(50, 90)),
    fallbackTriggered: false,
    fallbackReason: '',
    ...over.decision,
  };

  return {
    traceId,
    requestId: `REQ-${String(90000 + index)}`,
    appId: app.appId,
    tenantId: `TENANT-${app.deptId.replace('DEPT-', '')}`,
    userId: `U-${String(3000 + index * 7)}`,
    businessScenario: scenario,
    taskType: task,
    dataLevel: app.dataLevel,
    requestMode: mode,
    promptTokens: Math.round(between(600, 4200)),
    expectedOutputTokens: Math.round(between(200, 1500)),
    contextLength: Math.round(between(1500, 12000)),
    slaLevel: app.slaLevel,
    budgetClass: index % 2 === 0 ? 'STANDARD' : 'LOW',
    decision,
    status: 'SUCCESS',
    totalDurationMs: Math.round(between(300, 3200)),
    createdAt: new Date(BASE_TIME + index * 3600_000 * 1.4).toISOString(),
    ...over,
  };
}

/** 手工锚定的 3 条特殊 Trace（覆盖 DEGRADED / BLOCKED / MASKING 闭环） */
const degradedTrace: RouterLog = buildTrace(1, {
  traceId: 'TR-20260803-999001',
  status: 'DEGRADED',
  decision: {
    candidateModels: [
      { assetId: 'AST-QWEN-72B-BASE', version: 'v2.1', score: null, eliminateReason: '主模型实例 INS-QWEN72-01 检测到 OOM，节点故障剔除候选' },
      { assetId: 'AST-QWEN-14B-BASE', version: 'v1.8', score: 71, eliminateReason: '' },
    ],
    selectedModel: 'AST-QWEN-14B-BASE',
    selectedVersion: 'v1.8',
    selectedEngine: 'VLLM',
    selectedPool: 'POOL-L20',
    selectedNode: 'node-gpu-04',
    routeReason: '主模型实例 INS-QWEN72-01 检测到 OOM，触发降级：切换备用模型 AST-QWEN-14B-BASE',
    scoreLatency: 78, scoreCost: 82, scoreRisk: 90, scoreLoad: 55,
    fallbackTriggered: true,
    fallbackReason: 'FALLBACK_SWITCH_SECONDARY: 主模型节点故障',
  },
});

const blockedTrace: RouterLog = buildTrace(2, {
  traceId: 'TR-20260803-888002',
  status: 'BLOCKED',
  decision: {
    candidateModels: [
      { assetId: 'AST-QWEN-14B-BASE', version: 'v1.8', score: null, eliminateReason: '请求被前置护栏阻断，未进入路由评分' },
    ],
    selectedModel: '',
    selectedVersion: '',
    selectedEngine: 'VLLM',
    selectedPool: '',
    selectedNode: '',
    routeReason: '安全护栏阻断：输入命中 PROMPT_INJECTION 规则（rule: PII-L3-017），请求未进入路由',
    scoreLatency: 0, scoreCost: 0, scoreRisk: 0, scoreLoad: 0,
    fallbackTriggered: false,
    fallbackReason: '',
  },
});

/** 生成 24h 路由日志（含 3 条锚定特殊 Trace）；模块级缓存保证跨接口确定性一致 */
let routerLogsCache: RouterLog[] | null = null;
export function getRouterLogs(): RouterLog[] {
  if (routerLogsCache) return routerLogsCache;
  const logs: RouterLog[] = [degradedTrace, blockedTrace];
  for (let i = 0; i < 58; i++) {
    logs.push(buildTrace(i + 10, {}));
  }
  // 制造 2 条额外降级，贴近真实占比
  logs[5] = buildTrace(5, { status: 'DEGRADED', decision: { ...buildTrace(5, {}).decision, fallbackTriggered: true, fallbackReason: 'FALLBACK_LIMIT_CONCURRENCY: 高并发队列超限' } });
  logs[12] = buildTrace(12, { status: 'DEGRADED', decision: { ...buildTrace(12, {}).decision, fallbackTriggered: true, fallbackReason: 'FALLBACK_TRUNCATE_CONTEXT: 上下文超出实例窗口' } });
  routerLogsCache = logs;
  return logs;
}

/** 计量流水：与 RouterLog 同 traceId 一一对应，保证可反查；模块级缓存保证确定性一致 */
let meteringCache: MeteringRecord[] | null = null;
export function getMetering(): MeteringRecord[] {
  if (meteringCache) return meteringCache;
  const logs = getRouterLogs();
  meteringCache = logs.map((log, i) => {
    const asset = assets.find((a) => a.assetId === log.decision.selectedModel) ?? assets[1];
    const app = apps.find((a) => a.appId === log.appId) ?? apps[0];
    const success = log.status === 'SUCCESS';
    const prompt = log.promptTokens;
    const completion = log.expectedOutputTokens;
    const cacheHit = Math.round(prompt * (asset.assetId === 'AST-INTENT-MINI' ? 0.9 : 0.55));
    const gpuHours = round1(prompt / 1000 * (0.3 + rand() * 0.4));
    const unit = asset.costPer1kTokens / 1000;
    const costInfra = round1(gpuHours * 18);
    const costCompute = round1((prompt + completion) * unit);
    const costLicense = round1(gpuHours * 4);
    const costExternal = asset.assetType === 'EXTERNAL' ? round1((prompt + completion) * unit * 1.5) : 0;
    return {
      billId: `BILL-${String(500000 + i * 17)}`,
      traceId: log.traceId,
      tenantId: log.tenantId,
      deptId: app.deptId,
      appId: log.appId,
      assetId: asset.assetId,
      modelVersion: asset.version,
      requestCount: 1,
      promptTokens: prompt,
      completionTokens: completion,
      cacheHitTokens: cacheHit,
      retryTokens: success ? 0 : Math.round(completion * 0.4),
      failureTokens: success ? 0 : completion,
      retryCount: success ? 0 : 1,
      failureCount: success ? 0 : 1,
      gpuHours,
      instanceHours: round1(gpuHours * 1.6),
      queueWaitMs: Math.round(between(20, 400)),
      costInfra,
      costCompute,
      costLicense,
      costExternal,
      tcoTotal: round1(costInfra + costCompute + costLicense + costExternal),
      success,
      retryTokensIncluded: false,
    };
  });
  return meteringCache;
}

/** 安全事件：BLOCKED / MASKING 两条锚定 trace 必须出现在审计链路 */
export function getSecurityEvents(): SecurityEvent[] {
  const events: SecurityEvent[] = [
    {
      securityEventId: 'SEC-EVT-000001', traceId: 'TR-20260803-888002', tenantId: 'TENANT-TECH',
      userId: 'U-3014', appId: 'APP-AICODING', assetId: 'AST-QWEN-14B-BASE',
      eventType: 'PROMPT_INJECTION', eventLevel: 'CRITICAL', guardrailStage: 'INPUT',
      ruleId: 'PII-L3-017', ruleName: '提示注入强校验', masked: false, blocked: true,
      reasonCode: 'INJECTION_KEYWORD', reasonText: '输入包含越权指令关键词，已阻断',
      logStorageType: 'FULL', hashSignature: 'sha256:9f2c…e41a', createdAt: new Date(BASE_TIME + 2.8 * 3600_000).toISOString(),
    },
    {
      securityEventId: 'SEC-EVT-000002', traceId: 'TR-20260803-999001', tenantId: 'TENANT-RISK',
      userId: 'U-3007', appId: 'APP-RISK', assetId: 'AST-QWEN-14B-BASE',
      eventType: 'MASKING', eventLevel: 'INFO', guardrailStage: 'OUTPUT',
      ruleId: 'MASK-ID-CARD', ruleName: '身份证号脱敏', masked: true, blocked: false,
      reasonCode: 'PII_DETECTED', reasonText: '输出命中身份证号模式，已替换为 ***',
      logStorageType: 'MASKED', hashSignature: 'sha256:7b1e…c903', createdAt: new Date(BASE_TIME + 1.4 * 3600_000).toISOString(),
    },
    {
      securityEventId: 'SEC-EVT-000003', traceId: 'TR-20260803-999001', tenantId: 'TENANT-RISK',
      userId: 'U-3007', appId: 'APP-RISK', assetId: 'AST-QWEN-14B-BASE',
      eventType: 'ABNORMAL', eventLevel: 'WARN', guardrailStage: 'INPUT',
      ruleId: 'ABNORM-FREQ', ruleName: '调用频次异常', masked: false, blocked: false,
      reasonCode: 'RATE_SPIKE', reasonText: '同一用户 5 分钟调用量超过基线 3 倍',
      logStorageType: 'FULL', hashSignature: 'sha256:4d0a…77f2', createdAt: new Date(BASE_TIME + 1.4 * 3600_000).toISOString(),
    },
  ];
  return events;
}

/** 告警（OPEN → CLOSED 闭环） */
export function getAlerts(): PlatformAlert[] {
  return [
    { alertId: 'ALT-001', alertStatus: 'OPEN', eventLevel: 'CRITICAL', title: '智能客服应用触发 Token 限流', detail: 'APP-CSR 输入 Token 达到运营策略阈值 limitThreshold，已按维度限流', traceId: 'TR-20260803-999001', createdAt: new Date(BASE_TIME + 2.8 * 3600_000).toISOString() },
    { alertId: 'ALT-002', alertStatus: 'ACKNOWLEDGED', eventLevel: 'WARN', title: 'POOL-L20 节点高负载', detail: 'node-gpu-04 队列深度 12，接近排队拥堵阈值', traceId: undefined, createdAt: new Date(BASE_TIME + 5.2 * 3600_000).toISOString() },
    { alertId: 'ALT-003', alertStatus: 'CLOSED', eventLevel: 'INFO', title: '缓存命中率波动', detail: 'INS-QWEN72-01 命中率回落至 61%，已自动恢复', traceId: undefined, createdAt: new Date(BASE_TIME + 9 * 3600_000).toISOString() },
  ];
}

/** 熔断记录（OPEN/HALF_OPEN/CLOSED 三态） */
export function getCircuitBreakers(): CircuitBreaker[] {
  return [
    { circuitId: 'CKT-001', status: 'OPEN', dimension: 'TOKEN', threshold: 50_000_000, currentValue: 56_200_000, triggeredAt: new Date(BASE_TIME + 2.8 * 3600_000).toISOString(), recoveredAt: null, recoverMode: null },
    { circuitId: 'CKT-002', status: 'HALF_OPEN', dimension: 'QPS', threshold: 1200, currentValue: 1100, triggeredAt: new Date(BASE_TIME + 6 * 3600_000).toISOString(), recoveredAt: null, recoverMode: null },
    { circuitId: 'CKT-003', status: 'CLOSED', dimension: 'CONCURRENCY', threshold: 800, currentValue: 320, triggeredAt: new Date(BASE_TIME + 11 * 3600_000).toISOString(), recoveredAt: new Date(BASE_TIME + 11.4 * 3600_000).toISOString(), recoverMode: 'AUTO' },
  ];
}

/* ------------------------------------------------------------------ */
/* 评测结果                                                            */
/* ------------------------------------------------------------------ */

export const evals: EvalResult[] = [
  { evalId: 'EVAL-001', assetId: 'AST-FIN-QWEN-14B-SFT', evalType: 'ADMISSION', evalDataset: '信贷场景评测集 v3', accuracy: 97.2, hallucinationRate: 1.1, complianceRate: 99.4, toolCallSuccessRate: 95.8, longContextScore: 88, costScore: 82, reviewConclusion: 'PASS', reviewedBy: '李娜', reviewedAt: '2026-07-28T16:00:00+08:00' },
  { evalId: 'EVAL-002', assetId: 'AST-FIN-QWEN-14B-INT4', evalType: 'ADMISSION', evalDataset: '信贷场景评测集 v3', accuracy: 95.6, hallucinationRate: 1.8, complianceRate: 98.7, toolCallSuccessRate: 92.1, longContextScore: 74, costScore: 95, reviewConclusion: 'PENDING', reviewedBy: '', reviewedAt: '' },
  { evalId: 'EVAL-003', assetId: 'AST-QWEN-14B-BASE', evalType: 'PERIODIC', evalDataset: '通用问答评测集', accuracy: 94.8, hallucinationRate: 2.0, complianceRate: 99.1, toolCallSuccessRate: 96.3, longContextScore: 85, costScore: 88, reviewConclusion: 'PASS', reviewedBy: '张伟', reviewedAt: '2026-07-26T10:00:00+08:00' },
];

/* ------------------------------------------------------------------ */
/* 时间序列（24h / 1h 粒度）                                            */
/* ------------------------------------------------------------------ */

export interface TokenPoint {
  t: string;
  input: number;
  output: number;
  cacheHit: number;
}

export function getTokenSeries(hours = 24, stepMin = 60): TokenPoint[] {
  const times = timeSeries(hours, stepMin);
  // 全行业务潮汐：9-11 点早高峰、14-16 点午后高峰；全日输入 Token 约 3.9 亿
  return times.map((t) => {
    const h = Number(t.split(':')[0]);
    const peak = Math.exp(-Math.pow(h - 9, 2) / 18) * 0.7 + Math.exp(-Math.pow(h - 14, 2) / 20) * 0.9;
    const input = Math.round((160 + stableNoise(h) * 40 + peak * 120) * 100_000);
    const output = Math.round(input * (0.33 + stableNoise(h + 2) * 0.05));
    const cacheHit = Math.round(input * (0.5 + stableNoise(h + 4) * 0.08));
    return { t, input, output, cacheHit };
  });
}

export interface TrendPoint {
  t: string;
  gpuUtil: number;
  ttftP50: number;
  avgP95: number;
}

export function getTrendSeries(hours = 24, stepMin = 60): TrendPoint[] {
  const times = timeSeries(hours, stepMin);
  return times.map((t) => {
    const h = Number(t.split(':')[0]);
    const peak = Math.exp(-Math.pow(h - 9, 2) / 18) * 0.7 + Math.exp(-Math.pow(h - 14, 2) / 20) * 0.9;
    return {
      t,
      gpuUtil: Math.round((45 + rand() * 25) * (0.7 + peak * 0.6)),
      ttftP50: Math.round(180 + rand() * 120 + peak * 160),
      avgP95: Math.round(520 + rand() * 380 + peak * 500),
    };
  });
}

/** 部门 TCO 排行（供旭日图/排行表） */
export interface DeptTco {
  deptId: string;
  deptName: string;
  tco: number;
  tokens: number;
}

/** 部门 TCO 排行（近 24h 全行量级，与 PlatformSummary.tco 同口径） */
export function getDeptTco(): DeptTco[] {
  return [
    { deptId: 'DEPT-TECH', deptName: DEPT_NAME_MAP['DEPT-TECH'], tco: 186_000, tokens: 108_000_000 },
    { deptId: 'DEPT-RETAIL', deptName: DEPT_NAME_MAP['DEPT-RETAIL'], tco: 158_000, tokens: 92_000_000 },
    { deptId: 'DEPT-CORP', deptName: DEPT_NAME_MAP['DEPT-CORP'], tco: 108_000, tokens: 63_000_000 },
    { deptId: 'DEPT-RISK', deptName: DEPT_NAME_MAP['DEPT-RISK'], tco: 86_000, tokens: 50_000_000 },
    { deptId: 'DEPT-OPS', deptName: DEPT_NAME_MAP['DEPT-OPS'], tco: 72_000, tokens: 42_000_000 },
    { deptId: 'DEPT-INVEST', deptName: DEPT_NAME_MAP['DEPT-INVEST'], tco: 74_000, tokens: 39_000_000 },
  ];
}

/* ------------------------------------------------------------------ */
/* 6.3 智能路由白盒 / 6.4 弹性算力中心 补充数据                          */
/* ------------------------------------------------------------------ */

/** 路由漏斗（6.3.2）：近 24h 全行量级，与 PlatformSummary / 限流规则命中总数同口径 */
export function getFunnelData(): FunnelStage[] {
  const s = getPlatformSummary();
  const intercepted = 682; // 限流命中 673（5 条规则合计）+ 护栏阻断 9（拦截后不再派发）
  return [
    { name: '入站请求', value: s.requests, detail: '网关接收请求总数（含重试）' },
    { name: '识别分流', value: s.requests, detail: '场景/任务/数据等级识别完成' },
    { name: '限流/熔断拦截', value: intercepted, detail: '限流命中 673 + 护栏阻断 9' },
    { name: '派发成功', value: s.requests - intercepted, detail: '成功派发至推理实例（降级请求切换备用模型后仍派发）' },
  ];
}

/** 限流命中记录（6.3 限流面板；锚定 trace 与告警 ALT-001 呼应） */
export function getRateLimitHits(): RateLimitHit[] {
  return [
    { rateLimitId: 'RL-20260803-0001', dimension: 'TOKEN', threshold: 50_000_000, currentValue: 56_200_000, action: 'LIMIT', policyId: 'POL-METER-005', policyName: '部门 Token 配额策略', appId: 'APP-CSR', tenantId: 'TENANT-RETAIL', traceId: 'TR-20260803-999001', createdAt: new Date(BASE_TIME + 2.8 * 3600_000).toISOString() },
    { rateLimitId: 'RL-20260803-0002', dimension: 'QPS', threshold: 1200, currentValue: 1387, action: 'LIMIT', policyId: 'POL-ROUTING-001', policyName: '智能客服路由策略', appId: 'APP-CSR', tenantId: 'TENANT-RETAIL', traceId: null, createdAt: new Date(BASE_TIME + 3.1 * 3600_000).toISOString() },
    { rateLimitId: 'RL-20260803-0003', dimension: 'CONCURRENCY', threshold: 800, currentValue: 812, action: 'BLOCK', policyId: 'POL-COMPUTE-002', policyName: '生产资源优先级策略', appId: 'APP-RISK', tenantId: 'TENANT-RISK', traceId: null, createdAt: new Date(BASE_TIME + 5.8 * 3600_000).toISOString() },
    { rateLimitId: 'RL-20260803-0004', dimension: 'COST', threshold: 60_000, currentValue: 63_400, action: 'LIMIT', policyId: 'POL-ROUTING-001', policyName: '智能客服路由策略', appId: 'APP-CSR', tenantId: 'TENANT-RETAIL', traceId: null, createdAt: new Date(BASE_TIME + 8.4 * 3600_000).toISOString() },
    { rateLimitId: 'RL-20260803-0005', dimension: 'TOKEN', threshold: 60_000_000, currentValue: 61_900_000, action: 'LIMIT', policyId: 'POL-METER-005', policyName: '部门 Token 配额策略', appId: 'APP-AICODING', tenantId: 'TENANT-TECH', traceId: null, createdAt: new Date(BASE_TIME + 12.6 * 3600_000).toISOString() },
  ];
}

/** 优先级队列视图（6.4.5：P0 等待超阈值触发横幅） */
export function getQueueData(): PriorityQueueItem[] {
  return [
    { priorityClass: 'P0', queued: 14, running: 6, avgWaitMs: 620, maxWaitMs: 980 },
    { priorityClass: 'P1', queued: 38, running: 22, avgWaitMs: 240, maxWaitMs: 410 },
    { priorityClass: 'P2', queued: 96, running: 48, avgWaitMs: 90, maxWaitMs: 260 },
  ];
}

/** 确定性噪声（不推进模块级 rand，保证跨刷新稳定） */
function stableNoise(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 批处理与 TTFT 联动（6.4.5：同一时间窗，验证吞吐提升是否牺牲首字时延；全行推理集群量级） */
export function getBatchTrend(): BatchPoint[] {
  const times = timeSeries(24, 60);
  return times.map((t) => {
    const h = Number(t.split(':')[0]);
    const peak = Math.exp(-Math.pow(h - 10, 2) / 18) * 0.8 + Math.exp(-Math.pow(h - 15, 2) / 22) * 0.9;
    return {
      t,
      throughput: Math.round((26_000 + stableNoise(h) * 6_000) * (0.8 + peak * 0.5)),
      batchSize: Math.round((48 + stableNoise(h + 3) * 24) * (0.8 + peak * 0.4)),
      ttftMs: Math.round(210 + stableNoise(h + 7) * 80 + peak * 120),
    };
  });
}

/** 节点热区（6.4：近 24h 按小时采样，用于错峰建议） */
export function getHeatmapData(): HeatCell[] {
  const nodes = [
    { node: 'node-gpu-01', pool: 'POOL-H20' },
    { node: 'node-gpu-02', pool: 'POOL-H20' },
    { node: 'node-gpu-03', pool: 'POOL-L20' },
    { node: 'node-gpu-04', pool: 'POOL-L20' },
    { node: 'node-npu-01', pool: 'POOL-ASCEND' },
    { node: 'cloud-a-01', pool: 'POOL-RENTAL' },
  ];
  const cells: HeatCell[] = [];
  for (const n of nodes) {
    // 按节点名哈希加盐，避免同名长节点生成完全相同的曲线
    const salt = [...n.node].reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let h = 0; h < 24; h += 2) {
      const peak = Math.exp(-Math.pow(h - 10, 2) / 24) * 0.7 + Math.exp(-Math.pow(h - 15, 2) / 26) * 0.9;
      const base = n.pool === 'POOL-H20' ? 0.62 : n.pool === 'POOL-L20' ? 0.55 : 0.4;
      cells.push({ node: n.node, pool: n.pool, hour: h, utilization: Math.min(100, Math.round((base + peak * 0.35 + stableNoise(salt + h) * 0.1) * 100)) });
    }
  }
  return cells;
}

/** 成本优化建议（6.5 / 9.5 闭环；每条必须含依据，禁止无依据建议） */
export function getOptimizeAdvice(): OptimizeAdvice[] {
  return [
    {
      adviceId: 'ADV-001',
      title: 'APP-AICODING 启用 KV Cache 命中率优化',
      description: 'AI 代码助手输入模板化占比 68%，建议开启前缀缓存，预估命中率从 61% 提升至 82%',
      estimatedSaving: 12600,
      basis: [
        { data: '近 7d 输入 Token 121M', metric: 'cacheHitRate=61%', calc: '模板前缀占比 68% × 输入 Token × 单价 ¥0.0009/K' },
        { data: 'INS-QWEN72-01', metric: 'KV Cache=ON', calc: '开启后命中率参照 INTENT 实例 92%' },
      ],
      status: 'IDENTIFIED',
      workOrderId: null,
      createdAt: new Date(BASE_TIME + 3 * 3600_000).toISOString(),
    },
    {
      adviceId: 'ADV-002',
      title: 'POOL-L20 降级节点错峰调度',
      description: 'node-gpu-04 连续 12h 利用率 >80%，建议将 OCR 批量任务错峰至 00-06 低峰窗口',
      estimatedSaving: 8300,
      basis: [
        { data: 'node-gpu-04 近 24h', metric: 'utilization avg 78%', calc: '错峰后平均利用率降至 55%，节约 GPU 空闲成本' },
        { data: 'getHeatmapData', metric: '热区 00/02/04 时段 56%', calc: '低峰窗口容量充足' },
      ],
      status: 'ACCEPTED',
      workOrderId: 'WO-20260803-001',
      createdAt: new Date(BASE_TIME + 8 * 3600_000).toISOString(),
    },
    {
      adviceId: 'ADV-003',
      title: '低价值场景切换小模型',
      description: '营销文案场景 70% 请求使用 72B，任务复杂度低，建议路由切换 Fin-Qwen-14B-SFT',
      estimatedSaving: 15200,
      basis: [
        { data: 'APP-CSR 营销场景', metric: 'avgLatency P95=690ms', calc: '14B 推理成本为 72B 的 28%，P95 仍满足 SLA P1' },
        { data: 'POL-ROUTING-001', metric: 'fallbackMode=SWITCH_SECONDARY', calc: '已有备用模型路由策略' },
      ],
      status: 'EXECUTED',
      workOrderId: 'WO-20260801-009',
      createdAt: new Date(BASE_TIME + 20 * 3600_000).toISOString(),
    },
  ];
}
