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
  BatchTask,
  CircuitBreaker,
  ComputeResource,
  EvalResult,
  HeteroSchedPolicy,
  HeteroVendor,
  Instance,
  MemberInfo,
  MeteringRecord,
  ModelAsset,
  MonthlyBill,
  MyApplication,
  PlatformAlert,
  Policy,
  QualityAlertRule,
  RouterLog,
  RoutingEngineConfig,
  SecurityEvent,
} from '../types';
import * as cfg from './dataConfig';
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
  OrchestrationConfig,
  PersonalTrendPoint,
  PersonalUsage,
  PlazaApply,
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
} from '../types';

/** 运行环境标识（顶部全局栏展示） */
export const ENV_TAG = 'PROD';

function mock<T>(data: T, delay = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delay));
}

/* ---------------- 查询接口 ---------------- */

export type { PlatformSummary, DeptTco, TokenPoint, TrendPoint } from './data';

export const api = {
  env: () => ENV_TAG,

  getSummary() {
    return mock(getPlatformSummary());
  },

  getDeptNames() {
    return mock(DEPT_NAME_MAP);
  },

  getAppTcoRank() {
    return mock(getAppTcoRank());
  },

  getModelTcoRank() {
    return mock(getModelTcoRank());
  },

  getAssets(): Promise<ModelAsset[]> {
    return mock([...assets]);
  },
  getApps(): Promise<ApplicationRegistry[]> {
    return mock(cfg.appsStore.map((a) => ({ ...a })));
  },

  getResources(): Promise<ComputeResource[]> {
    return mock(cfg.resourcesStore.map((r) => ({ ...r })));
  },

  getInstances(): Promise<Instance[]> {
    return mock([...instances]);
  },

  getPolicies(): Promise<Policy[]> {
    return mock(cfg.policiesStore.map((p) => ({ ...p })));
  },

  getRouterLogs(): Promise<RouterLog[]> {
    return mock(getRouterLogs());
  },

  getRouterLogByTrace(traceId: string): Promise<RouterLog | null> {
    const log = getRouterLogs().find((l) => l.traceId === traceId) ?? null;
    return mock(log, 80);
  },

  getMetering(): Promise<MeteringRecord[]> {
    return mock(getMetering());
  },

  getSecurityEvents(): Promise<SecurityEvent[]> {
    return mock(getSecurityEvents());
  },

  getAlerts(): Promise<PlatformAlert[]> {
    return mock(cfg.alertsStore.map((a) => ({ ...a })));
  },

  getCircuitBreakers(): Promise<CircuitBreaker[]> {
    return mock(getCircuitBreakers());
  },

  getEvals(): Promise<EvalResult[]> {
    return mock([...evals]);
  },

  getTokenSeries() {
    return mock(getTokenSeries(24, 60));
  },

  getTrendSeries() {
    return mock(getTrendSeries(24, 60));
  },

  getDeptTco() {
    return mock(getDeptTco());
  },

  getFunnelData() {
    return mock(getFunnelData());
  },

  getRateLimitHits() {
    return mock(getRateLimitHits());
  },

  getQueueData() {
    return mock(getQueueData());
  },

  getBatchTrend() {
    return mock(getBatchTrend());
  },

  getHeatmapData() {
    return mock(getHeatmapData());
  },

  getOptimizeAdvice() {
    return mock([...cfg.adviceStore]);
  },

  /* ============ 配置域查询（完善方案 v2 第五章） ============ */

  getApiKeys(): Promise<ApiKey[]> {
    return mock([...cfg.apiKeys]);
  },
  getRateLimitRules(): Promise<RateLimitRule[]> {
    return mock([...cfg.rateLimitRules]);
  },
  getRoutingRuleSets(): Promise<RoutingRuleSet[]> {
    return mock([...cfg.routingRuleSets]);
  },
  getAggregationGroups(): Promise<AggregationGroup[]> {
    return mock([...cfg.aggregationGroups]);
  },
  getElasticSwitch(): Promise<ElasticSwitchConfig> {
    return mock({ ...cfg.elasticSwitch });
  },
  getQuotas(): Promise<QuotaProfile[]> {
    return mock([...cfg.quotas]);
  },
  getConnections(): Promise<ModelConnection[]> {
    return mock([...cfg.connections]);
  },
  getModelCards(): Promise<ModelCard[]> {
    return mock([...cfg.modelCards]);
  },
  getPlazaApplies(): Promise<PlazaApply[]> {
    return mock([...cfg.plazaApplies]);
  },
  getGrayReleases(): Promise<GrayRelease[]> {
    return mock(cfg.grayReleases.map((g) => ({ ...g })));
  },
  getArchivedModels(): Promise<ArchivedModel[]> {
    return mock([...cfg.archivedModels]);
  },
  getArchiveRules(): Promise<ArchiveRules> {
    return mock({ ...cfg.archiveRules });
  },
  getGuardrailConfig(): Promise<GuardrailConfig> {
    return mock({ ...cfg.guardrailConfig });
  },
  getGuardrailPolicies(): Promise<GuardrailPolicy[]> {
    return mock([...cfg.guardrailPolicies]);
  },
  getDetectModules(): Promise<DetectModule[]> {
    return mock(cfg.detectModules.map((m) => ({ ...m })));
  },
  getKeywordLibs(): Promise<KeywordLibrary[]> {
    return mock([...cfg.keywordLibs]);
  },
  getDetectModels(): Promise<DetectModelInfo[]> {
    return mock([...cfg.detectModels]);
  },
  getReportFeedbacks(): Promise<ReportFeedback[]> {
    return mock([...cfg.reportFeedbacks]);
  },
  getCallLogs(): Promise<CallLog[]> {
    return mock([...cfg.callLogs]);
  },
  getPersonalUsage(): Promise<PersonalUsage[]> {
    return mock([...cfg.personalUsage]);
  },
  getPersonalTrend(): Promise<PersonalTrendPoint[]> {
    return mock([...cfg.personalTrend]);
  },
  getModelUsageStats(): Promise<ModelUsageStat[]> {
    return mock([...cfg.modelUsageStats]);
  },
  getModelRecommends(): Promise<ModelRecommend[]> {
    return mock([...cfg.modelRecommends]);
  },
  getRoutingSaving() {
    return mock({ ...cfg.routingSaving });
  },
  getEmergencyTickets(): Promise<EmergencyTicket[]> {
    return mock([...cfg.emergencyTickets]);
  },
  getOrchestration(): Promise<OrchestrationConfig> {
    return mock({ ...cfg.orchestration, weights: { ...cfg.orchestration.weights }, mixAffinity: [...cfg.orchestration.mixAffinity] });
  },
  getNodeConfig(resourceId: string): Promise<NodeConfig> {
    return mock({ ...(cfg.nodeConfigs[resourceId] ?? { resourceId, vgpuEnabled: false, vgpuPercent: 25, vgpuVramMb: 8192, quantization: 'FP16', replicas: 1, extendRental: false } as NodeConfig) });
  },
  getTenantRetentions(): Promise<TenantRetention[]> {
    return mock([...cfg.tenantRetentions]);
  },
  getOperationRecords(): Promise<OperationRecord[]> {
    return mock([...cfg.operationRecords]);
  },

  /* ============ 配置域写操作（内存态 mock，返回留痕记录） ============ */

  /** 保存（新建/编辑）API Key */
  saveApiKey(data: Omit<ApiKey, 'keyId' | 'keyFull' | 'keyMasked' | 'usedCount' | 'createdAt'> & { keyId?: string }): Promise<OperationRecord> {
    if (data.keyId) {
      const idx = cfg.apiKeys.findIndex((k) => k.keyId === data.keyId);
      if (idx >= 0) cfg.apiKeys[idx] = { ...cfg.apiKeys[idx], ...data, keyId: data.keyId };
      return mock(cfg.recordOp('编辑 API Key', data.keyId, `更新描述/额度/可用模型（${data.desc}）`), 200);
    }
    const full = cfg.genApiKeyFull();
    const key: ApiKey = {
      ...data,
      keyId: cfg.nextId('KEY'),
      keyFull: full,
      keyMasked: `sk-maas-****${full.slice(-4)}`,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    cfg.apiKeys.unshift(key);
    return mock(cfg.recordOp('新建 API Key', key.keyId, `创建密钥（${key.desc}），归属 ${key.ownerDept}`), 200);
  },
  toggleApiKey(keyId: string): Promise<OperationRecord> {
    const k = cfg.apiKeys.find((x) => x.keyId === keyId);
    if (k) k.status = k.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    return mock(cfg.recordOp(k?.status === 'ENABLED' ? '启用 API Key' : '禁用 API Key', keyId, `密钥状态切换为 ${k?.status}`), 200);
  },
  resetApiKey(keyId: string): Promise<{ rec: OperationRecord; newKey: string }> {
    const k = cfg.apiKeys.find((x) => x.keyId === keyId);
    const full = cfg.genApiKeyFull();
    if (k) {
      k.keyFull = full;
      k.keyMasked = `sk-maas-****${full.slice(-4)}`;
    }
    return mock({ rec: cfg.recordOp('重置 API Key', keyId, '旧 Key 立即失效，已生成新 Key'), newKey: full }, 300);
  },
  deleteApiKey(keyId: string): Promise<OperationRecord> {
    const idx = cfg.apiKeys.findIndex((x) => x.keyId === keyId);
    if (idx >= 0) cfg.apiKeys.splice(idx, 1);
    return mock(cfg.recordOp('删除 API Key', keyId, '密钥已删除，关联调用立即拒绝'), 200);
  },

  saveRateLimitRule(rule: RateLimitRule): Promise<OperationRecord> {
    const idx = cfg.rateLimitRules.findIndex((r) => r.ruleId === rule.ruleId);
    if (idx >= 0) cfg.rateLimitRules[idx] = rule;
    else cfg.rateLimitRules.unshift({ ...rule, ruleId: cfg.nextId('RL-CFG') });
    return mock(cfg.recordOp('保存限流规则', rule.ruleId, `${rule.name}：QPS ${rule.qpsPerMin}/min，输入 ${rule.inputTokenLimit}，并发 ${rule.concurrency}`), 200);
  },
  toggleRateLimitRule(ruleId: string): Promise<OperationRecord> {
    const r = cfg.rateLimitRules.find((x) => x.ruleId === ruleId);
    if (r) r.enabled = !r.enabled;
    return mock(cfg.recordOp(r?.enabled ? '启用限流规则' : '停用限流规则', ruleId, r?.name ?? ''), 200);
  },
  deleteRateLimitRule(ruleId: string): Promise<OperationRecord> {
    const idx = cfg.rateLimitRules.findIndex((x) => x.ruleId === ruleId);
    if (idx >= 0) cfg.rateLimitRules.splice(idx, 1);
    return mock(cfg.recordOp('删除限流规则', ruleId, '规则已删除'), 200);
  },
  saveRoutingRuleSet(rs: RoutingRuleSet): Promise<OperationRecord> {
    const idx = cfg.routingRuleSets.findIndex((x) => x.sceneKey === rs.sceneKey);
    const policyId = rs.policyId ?? cfg.nextId('POL-ROUTING');
    if (idx >= 0) cfg.routingRuleSets[idx] = { ...rs, policyId };
    return mock(cfg.recordOp('保存场景路由规则', rs.sceneKey, `${rs.sceneName}：优先级 ${rs.priority}，时延上限 ${rs.latencyCeilMs}ms，已生成 ${policyId} 待审批`), 200);
  },

  setQuota(deptId: string, quota: number, reason: string): Promise<OperationRecord> {
    const q = cfg.quotas.find((x) => x.deptId === deptId);
    if (q) {
      q.monthTokenQuota = quota;
      q.status = q.usedTokens > quota ? (q.overLimitStop ? 'STOPPED' : 'WARNING') : q.usedTokens / quota >= q.warnThreshold / 100 ? 'WARNING' : 'NORMAL';
    }
    return mock(cfg.recordOp('调整配额', deptId, `月度 Token 配额调整为 ${(quota / 10000).toLocaleString()} 万（原因：${reason}）`), 200);
  },
  toggleQuotaStop(deptId: string): Promise<OperationRecord> {
    const q = cfg.quotas.find((x) => x.deptId === deptId);
    if (q) q.overLimitStop = !q.overLimitStop;
    return mock(cfg.recordOp(q?.overLimitStop ? '开启超限即停' : '关闭超限即停', deptId, q?.deptName ?? ''), 200);
  },
  setQuotaWarn(deptId: string, threshold: 80 | 90 | 95, channels: ('SITE' | 'MAIL' | 'SMS')[]): Promise<OperationRecord> {
    const q = cfg.quotas.find((x) => x.deptId === deptId);
    if (q) {
      q.warnThreshold = threshold;
      q.notifyChannels = channels;
    }
    return mock(cfg.recordOp('配置余额预警', deptId, `预警阈值 ${threshold}%，通知渠道 ${channels.join('/')}`), 200);
  },
  requestQuotaResume(deptId: string, reason: string): Promise<OperationRecord> {
    const q = cfg.quotas.find((x) => x.deptId === deptId);
    if (q) q.resumePending = true;
    // 联动：我的申请
    if (!cfg.myApplications.some((m) => m.kind === 'QUOTA_RESUME' && m.status === 'PENDING' && m.title.includes(q?.deptName ?? deptId))) {
      cfg.myApplications.unshift({ applyId: cfg.nextId('MA'), kind: 'QUOTA_RESUME', title: `配额恢复：${q?.deptName ?? deptId}`, reason, status: 'PENDING', submitAt: new Date().toISOString(), approveAt: null, opinion: '' });
    }
    return mock(cfg.recordOp('申请恢复配额', deptId, `超限停发恢复申请已提交审批（理由：${reason}）`), 200);
  },

  saveConnection(conn: ModelConnection): Promise<OperationRecord> {
    const idx = cfg.connections.findIndex((c) => c.connId === conn.connId);
    if (idx >= 0) cfg.connections[idx] = conn;
    else cfg.connections.unshift({ ...conn, connId: cfg.nextId('CONN') });
    return mock(cfg.recordOp('保存模型接入', conn.connId, `${conn.name}（${conn.source === 'CLOUD' ? conn.provider : conn.source === 'LOCAL' ? '本地算力' : '租赁算力'}）`), 200);
  },
  testConnection(connId: string): Promise<{ ok: boolean; latencyMs: number }> {
    const c = cfg.connections.find((x) => x.connId === connId);
    const ok = c ? c.status !== 'OFFLINE' || Math.random() > 0.3 : false;
    const latencyMs = Math.round(36 + Math.random() * 280);
    if (c) {
      c.status = ok ? 'ONLINE' : 'OFFLINE';
      c.latencyMs = ok ? latencyMs : null;
      c.lastCheckAt = new Date().toISOString();
    }
    return mock({ ok, latencyMs }, 1200);
  },
  deleteConnection(connId: string): Promise<OperationRecord> {
    const idx = cfg.connections.findIndex((x) => x.connId === connId);
    if (idx >= 0) cfg.connections.splice(idx, 1);
    return mock(cfg.recordOp('删除模型接入', connId, '接入已删除'), 200);
  },

  applyModelCard(cardId: string, deptId: string, purpose: string, estMonthCalls: number): Promise<OperationRecord> {
    const card = cfg.modelCards.find((c) => c.cardId === cardId);
    if (card) card.applyStatus = 'PENDING';
    cfg.plazaApplies.unshift({ applyId: cfg.nextId('APL'), cardId, deptId, purpose, estMonthCalls, status: 'PENDING', createdAt: new Date().toISOString() });
    // 联动：写入申请人视角的「我的申请」
    cfg.myApplications.unshift({ applyId: cfg.nextId('MA'), kind: 'MODEL_ACCESS', title: `模型接入：${card?.name ?? cardId}`, reason: purpose, status: 'PENDING', submitAt: new Date().toISOString(), approveAt: null, opinion: '' });
    return mock(cfg.recordOp('模型广场申请', cardId, `${card?.name ?? cardId} 接入申请已提交模型负责人审批`), 200);
  },

  advanceGray(releaseId: string, payload: Partial<GrayRelease>): Promise<OperationRecord> {
    const g = cfg.grayReleases.find((x) => x.releaseId === releaseId);
    if (g) Object.assign(g, payload);
    return mock(cfg.recordOp('灰度发布操作', g?.assetId ?? releaseId, g ? `推进至步骤 ${g.step}，比例 ${g.percent}%，范围 ${g.scope.join('、')}` : ''), 200);
  },
  rollbackGray(releaseId: string): Promise<OperationRecord> {
    const g = cfg.grayReleases.find((x) => x.releaseId === releaseId);
    if (g) {
      g.step = 4;
      g.percent = 0;
    }
    return mock(cfg.recordOp('灰度回滚', g?.assetId ?? releaseId, '已执行一键回滚（SLA ≤3 分钟），流量已切回现网版本'), 300);
  },

  reviveArchived(assetId: string): Promise<OperationRecord> {
    const idx = cfg.archivedModels.findIndex((x) => x.assetId === assetId);
    const name = cfg.archivedModels[idx]?.assetName ?? assetId;
    if (idx >= 0) cfg.archivedModels.splice(idx, 1);
    return mock(cfg.recordOp('复活归档模型', assetId, `${name} 已恢复至下线前状态（PRODUCTION），重新占用算力`), 200);
  },
  deleteArchived(assetId: string): Promise<OperationRecord> {
    const idx = cfg.archivedModels.findIndex((x) => x.assetId === assetId);
    if (idx >= 0) cfg.archivedModels.splice(idx, 1);
    return mock(cfg.recordOp('永久删除归档模型', assetId, '文件已物理删除，不可恢复'), 200);
  },
  saveArchiveRules(rules: ArchiveRules): Promise<OperationRecord> {
    Object.assign(cfg.archiveRules, rules);
    return mock(cfg.recordOp('配置归档规则', 'ARCHIVE-RULES', `90天无调用=${rules.noCall90d}，版本替代=${rules.replaced}，合规=${rules.compliance}`), 200);
  },

  saveGuardrailConfig(c: GuardrailConfig): Promise<OperationRecord> {
    Object.assign(cfg.guardrailConfig, c);
    return mock(cfg.recordOp('保存护栏规则', 'GUARDRAIL', `护栏${c.enabled ? '已开启' : '已关闭'}，API 地址 ${c.apiUrl}`), 200);
  },
  testGuardrail(): Promise<{ ok: boolean; textMs: number; mmMs: number }> {
    return mock({ ok: cfg.guardrailConfig.enabled, textMs: cfg.guardrailConfig.textLatencyMs, mmMs: cfg.guardrailConfig.multimodalLatencyMs }, 1200);
  },
  saveGuardrailPolicy(p: GuardrailPolicy): Promise<OperationRecord> {
    const idx = cfg.guardrailPolicies.findIndex((x) => x.policyId === p.policyId);
    if (idx >= 0) cfg.guardrailPolicies[idx] = p;
    else cfg.guardrailPolicies.unshift({ ...p, policyId: cfg.nextId('GD') });
    return mock(cfg.recordOp('保存安全策略', p.policyId, `${p.name}：动作 ${p.action}，模块 ${p.modules.length} 个`), 200);
  },
  deleteGuardrailPolicy(policyId: string): Promise<OperationRecord> {
    const idx = cfg.guardrailPolicies.findIndex((x) => x.policyId === policyId);
    if (idx >= 0) cfg.guardrailPolicies.splice(idx, 1);
    return mock(cfg.recordOp('删除安全策略', policyId, '策略已删除'), 200);
  },
  toggleDetectModule(moduleKey: string): Promise<OperationRecord> {
    const m = cfg.detectModules.find((x) => x.moduleKey === moduleKey);
    if (m) m.enabled = !m.enabled;
    return mock(cfg.recordOp(m?.enabled ? '启用检测模块' : '停用检测模块', moduleKey, m?.label ?? ''), 200);
  },
  setModuleSensitivity(moduleKey: string, sensitivity: 'LOW' | 'MED' | 'HIGH'): Promise<OperationRecord> {
    const m = cfg.detectModules.find((x) => x.moduleKey === moduleKey);
    if (m) m.sensitivity = sensitivity;
    return mock(cfg.recordOp('调整模块灵敏度', moduleKey, `${m?.label ?? ''} → ${sensitivity}`), 200);
  },
  updateSystemLib(): Promise<OperationRecord> {
    const lib = cfg.keywordLibs.find((l) => l.type === 'SYSTEM');
    if (lib) {
      const v = Number(lib.version.replace('v2026.', ''));
      lib.version = `v2026.${String(v + 1).padStart(2, '0')}`;
      lib.wordCount += 312;
      lib.updatedAt = new Date().toISOString();
    }
    return mock(cfg.recordOp('更新系统词库', 'LIB-SYS', `词库更新至 ${lib?.version}，新增 312 条`), 2000);
  },
  saveCustomLib(name: string, words: number, libId?: string): Promise<OperationRecord> {
    if (libId) {
      const lib = cfg.keywordLibs.find((l) => l.libId === libId);
      if (lib) {
        lib.name = name;
        lib.wordCount = words;
        lib.updatedAt = new Date().toISOString();
      }
      return mock(cfg.recordOp('编辑自定义词库', libId, `${name}：${words} 条词条`), 200);
    }
    const id = cfg.nextId('LIB');
    cfg.keywordLibs.push({ libId: id, name, type: 'CUSTOM', version: 'v1', wordCount: words, updatedAt: new Date().toISOString() });
    return mock(cfg.recordOp('新建自定义词库', id, `${name}：${words} 条词条`), 200);
  },
  deleteCustomLib(libId: string): Promise<OperationRecord> {
    const idx = cfg.keywordLibs.findIndex((l) => l.libId === libId);
    if (idx >= 0) cfg.keywordLibs.splice(idx, 1);
    return mock(cfg.recordOp('删除自定义词库', libId, '词库已删除'), 200);
  },
  handleReport(reportId: string, verdict: 'VALID' | 'FALSE_POSITIVE' | 'IGNORED'): Promise<OperationRecord> {
    const r = cfg.reportFeedbacks.find((x) => x.reportId === reportId);
    if (r) r.status = verdict;
    return mock(cfg.recordOp('处理举报反馈', reportId, `判定：${verdict === 'VALID' ? '有效' : verdict === 'FALSE_POSITIVE' ? '误报' : '忽略'}`), 200);
  },
  setDefaultDetectModel(modelId: string): Promise<OperationRecord> {
    cfg.detectModels.forEach((m) => (m.isDefault = m.modelId === modelId));
    return mock(cfg.recordOp('切换默认检测模型', modelId, cfg.detectModels.find((m) => m.modelId === modelId)?.name ?? ''), 200);
  },

  /** 策略审批/发布/回滚（B2 控制面工作台） */
  approvePolicy(policyId: string, approve: boolean, opinion: string): Promise<OperationRecord> {
    const p = cfg.policiesStore.find((x) => x.policyId === policyId);
    if (p) {
      p.status = approve ? 'ACTIVE' : 'DRAFT';
      p.approvedBy = approve ? '平台管理员' : p.approvedBy;
      if (approve) p.lastPublishedAt = new Date().toISOString();
    }
    return mock(cfg.recordOp(approve ? '审批通过' : '审批驳回', policyId, `意见：${opinion}`), 200);
  },
  publishPolicy(policyId: string): Promise<OperationRecord> {
    const p = cfg.policiesStore.find((x) => x.policyId === policyId);
    if (p) {
      p.status = 'ACTIVE';
      p.lastPublishedAt = new Date().toISOString();
    }
    return mock(cfg.recordOp('发布策略', policyId, `v${p?.version} 已下发全部网关节点（分钟级生效）`), 1200);
  },
  rollbackPolicy(policyId: string): Promise<OperationRecord> {
    const p = cfg.policiesStore.find((x) => x.policyId === policyId);
    if (p) {
      p.status = 'ROLLBACK';
      p.version = Math.max(1, p.rollbackVersion);
    }
    return mock(cfg.recordOp('回滚策略', policyId, `已回滚至 v${p?.rollbackVersion}（SLA ≤3 分钟）`), 300);
  },
  createPolicy(policy: Policy): Promise<OperationRecord> {
    cfg.policiesStore.unshift(policy);
    return mock(cfg.recordOp('新建策略', policy.policyId, `${policy.policyName}（${policy.policyType}）已提交审批`), 200);
  },
  editPolicy(policy: Policy): Promise<OperationRecord> {
    const idx = cfg.policiesStore.findIndex((p) => p.policyId === policy.policyId);
    if (idx >= 0) {
      cfg.policiesStore[idx] = { ...policy, version: policy.version + 1, status: 'PENDING_APPROVAL', rollbackVersion: policy.version };
    }
    return mock(cfg.recordOp('编辑策略', policy.policyId, `${policy.policyName} 修改已保存为 v${policy.version + 1}，重新走审批`), 200);
  },
  togglePolicy(policyId: string): Promise<OperationRecord> {
    const p = cfg.policiesStore.find((x) => x.policyId === policyId);
    if (p) p.status = p.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    return mock(cfg.recordOp(p?.status === 'ACTIVE' ? '启用策略' : '停用策略', policyId, p?.policyName ?? ''), 200);
  },
  /** DRAFT（含被驳回）策略重新提交审批（闭环①） */
  submitPolicy(policyId: string): Promise<OperationRecord> {
    const p = cfg.policiesStore.find((x) => x.policyId === policyId);
    if (p) p.status = 'PENDING_APPROVAL';
    return mock(cfg.recordOp('提交审批', policyId, `${p?.policyName ?? ''} v${p?.version} 已提交审批（顶栏待办联动）`), 200);
  },

  /** 配额恢复审批（闭环②）：通过则解除停发，驳回则保持停发 */
  approveQuotaResume(deptId: string, approve: boolean, opinion: string): Promise<OperationRecord> {
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

  /** 广场接入申请审批（闭环③） */
  reviewPlazaApply(applyId: string, approve: boolean): Promise<OperationRecord> {
    const a = cfg.plazaApplies.find((x) => x.applyId === applyId);
    if (a) {
      a.status = approve ? 'APPROVED' : 'REJECTED';
      const card = cfg.modelCards.find((c) => c.cardId === a.cardId);
      if (card) card.applyStatus = approve ? 'GRANTED' : 'NONE';
      // 联动：我的申请状态回填
      const ma = cfg.myApplications.find((m) => m.kind === 'MODEL_ACCESS' && m.status === 'PENDING' && m.title.includes(card?.name ?? ''));
      if (ma) {
        ma.status = approve ? 'APPROVED' : 'REJECTED';
        ma.approveAt = new Date().toISOString();
        ma.opinion = approve ? '已通过，API Key 已分配并计入部门配额' : '已驳回，可修改用途后重新提交';
      }
    }
    const card = cfg.modelCards.find((c) => c.cardId === a?.cardId);
    return mock(cfg.recordOp(approve ? '接入申请通过' : '接入申请驳回', a?.cardId ?? applyId, `${card?.name ?? ''}；${approve ? '已分配 API Key 并计入部门配额' : '申请已驳回，可重新提交'}`), 200);
  },

  /** 优化建议闭环推进（闭环④）：ACCEPTED→EXECUTED→VERIFIED→CLOSED */
  progressAdvice(adviceId: string): Promise<OperationRecord> {
    let label = '推进建议';
    let detail = '';
    const done = cfg.adviceStore.find((x) => x.adviceId === adviceId);
    if (done) {
      if (done.status === 'ACCEPTED') {
        done.status = 'EXECUTED';
        label = '建议已执行';
        detail = `${done.title}（工单 ${done.workOrderId ?? '—'}）变更已上线`;
      } else if (done.status === 'EXECUTED') {
        done.status = 'VERIFIED';
        label = '建议已验证';
        detail = `${done.title} 收益验证通过（预估月节省 ¥${done.estimatedSaving.toLocaleString()}）`;
      } else if (done.status === 'VERIFIED') {
        done.status = 'CLOSED';
        label = '建议已关闭';
        detail = `${done.title} 闭环完成，归档`;
      }
    }
    return mock(cfg.recordOp(label, adviceId, detail), 200);
  },

  /** 引擎升级完成确认（闭环⑤）：灰度验证通过 → 版本号更新为最新 */
  finishEngineUpgrade(engineId: string): Promise<OperationRecord> {
    const e = cfg.engineVersions.find((x) => x.engineId === engineId);
    if (e) {
      e.version = e.latestVersion;
      e.upgradeStatus = 'UP_TO_DATE';
    }
    return mock(cfg.recordOp('引擎升级完成', engineId, `${e?.engine ?? ''} 已升级至 ${e?.latestVersion ?? ''}，灰度验证通过，全量生效`), 200);
  },

  /** 应急操作（P11） */
  execEmergency(type: EmergencyTicket['type'], target: string, params: string): Promise<EmergencyTicket> {
    const t: EmergencyTicket = {
      ticketId: `EM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(cfg.emergencyTickets.length + 1).padStart(3, '0')}`,
      type,
      operator: '平台管理员',
      target,
      params,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    cfg.emergencyTickets.unshift(t);
    cfg.recordOp('应急操作', t.ticketId, `${target}：${params}`);
    return mock(t, 1500);
  },
  rollbackEmergency(ticketId: string): Promise<OperationRecord> {
    const t = cfg.emergencyTickets.find((x) => x.ticketId === ticketId);
    if (t) t.status = 'ROLLED_BACK';
    return mock(cfg.recordOp('应急回滚', ticketId, `${t?.target ?? ''} 已恢复常态`), 800);
  },

  /** 资源编排（P17-P22） */
  saveOrchestration(c: OrchestrationConfig): Promise<OperationRecord> {
    Object.assign(cfg.orchestration, c, { weights: { ...c.weights }, mixAffinity: [...c.mixAffinity] });
    return mock(cfg.recordOp('保存资源编排', 'ORCHESTRATION', `混部=${c.mixDeploy}，批上限=${c.maxBatch}，KV策略=${c.kvStrategy}，投机解码=${c.speculative}`), 200);
  },
  saveNodeConfig(nc: NodeConfig): Promise<OperationRecord> {
    cfg.nodeConfigs[nc.resourceId] = { ...nc };
    return mock(cfg.recordOp('保存节点配置', nc.resourceId, `vGPU=${nc.vgpuEnabled ? nc.vgpuPercent + '%' : '关'}，量化=${nc.quantization}，副本=${nc.replicas}`), 200);
  },
  adoptPeakShift(node: string): Promise<OperationRecord> {
    return mock(cfg.recordOp('采纳错峰调度', node, `已生成调度任务：${node} 低价值任务迁移至 00-06 低峰窗口`), 200);
  },

  /* ============ 异构算力厂商资源（13.4 异构纳管） ============ */

  getHeteroVendors(): Promise<HeteroVendor[]> {
    return mock(cfg.heteroVendors.map((v) => ({ ...v, pools: [...v.pools] })));
  },
  getHeteroSchedPolicy(): Promise<HeteroSchedPolicy> {
    return mock({ ...cfg.heteroSchedPolicy, vendorPriority: [...cfg.heteroSchedPolicy.vendorPriority] });
  },
  saveHeteroSchedPolicy(p: HeteroSchedPolicy): Promise<OperationRecord> {
    Object.assign(cfg.heteroSchedPolicy, p, { vendorPriority: [...p.vendorPriority] });
    return mock(cfg.recordOp('保存异构调度策略', 'HETERO-SCHED', `国产化优先=${p.domesticFirst}，跨厂商迁移=${p.crossVendorFailover}，租赁削峰=${p.rentalPeak}`), 200);
  },

  /* ============ 多约束路由引擎（智能网关核心配置） ============ */

  getRoutingEngine(): Promise<RoutingEngineConfig> {
    return mock({ ...cfg.routingEngine, weights: { ...cfg.routingEngine.weights } });
  },
  saveRoutingEngine(c: RoutingEngineConfig): Promise<OperationRecord> {
    Object.assign(cfg.routingEngine, c, { weights: { ...c.weights } });
    const total = c.weights.latency + c.weights.cost + c.weights.risk + c.weights.load || 1;
    const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
    return mock(cfg.recordOp('保存路由引擎配置', 'ROUTING-ENGINE', `权重 时延${pct(c.weights.latency)}/成本${pct(c.weights.cost)}/风险${pct(c.weights.risk)}/负载${pct(c.weights.load)}；缓存优先=${c.cacheFirst}，预算约束=${c.budgetGuard}，SLA优先=${c.slaPriority}，自动降级=${c.autoFallback}`), 200);
  },

  /* ============ 复核补充：告警处置闭环（十一章） ============ */

  getAlertActions(): Promise<AlertAction[]> {
    return mock([...cfg.alertActions]);
  },
  /** 告警处置：ACK 待处置→已确认；RESOLVE_START →处置中；CLOSE →已关闭 */
  alertAction(alertId: string, action: AlertAction['action'], note: string): Promise<OperationRecord> {
    const a = cfg.alertsStore.find((x) => x.alertId === alertId);
    if (a) {
      a.alertStatus = action === 'ACK' ? 'ACKNOWLEDGED' : action === 'RESOLVE_START' ? 'RESOLVING' : 'CLOSED';
    }
    cfg.alertActions.unshift({ actionId: cfg.nextId('AA'), alertId, action, note, operator: '平台管理员', createdAt: new Date().toISOString() });
    const label = action === 'ACK' ? '确认告警' : action === 'RESOLVE_START' ? '开始处置' : '关闭告警';
    return mock(cfg.recordOp(label, alertId, `${a?.title ?? ''}；处置意见：${note}`), 200);
  },

  /* ============ 复核补充：审批中心聚合（六章） ============ */

  getApprovals(): Promise<ApprovalItem[]> {
    return mock(cfg.getApprovalItems());
  },

  /* ============ 复核补充：成本预警配置（六章运营策略） ============ */

  getCostAlertConfig(): Promise<CostAlertConfig> {
    return mock({ ...cfg.costAlertConfig, notifyChannels: [...cfg.costAlertConfig.notifyChannels] });
  },
  saveCostAlertConfig(c: CostAlertConfig): Promise<OperationRecord> {
    Object.assign(cfg.costAlertConfig, c, { notifyChannels: [...c.notifyChannels] });
    return mock(cfg.recordOp('保存成本预警', 'COST-ALERT', `预算 ${c.dailyBudget} 元/日，阈值 ${c.warnPct}%，超额动作 ${c.overAction}`), 200);
  },

  /* ============ 复核补充：KV 缓存治理（八章） ============ */

  getKvGovernance(): Promise<KvCacheGovernance> {
    return mock({ ...cfg.kvGovernance });
  },
  saveKvGovernance(g: KvCacheGovernance): Promise<OperationRecord> {
    Object.assign(cfg.kvGovernance, g);
    return mock(cfg.recordOp('保存 KV 缓存治理', 'KV-GOVERNANCE', `租户隔离=${g.tenantIsolation}，敏感禁存=${g.forbidSensitive}，TTL=${g.ttlMin}min，审计=${g.auditEnabled}`), 200);
  },

  /* ============ 复核补充：推理引擎版本管理（13.3） ============ */

  getEngineVersions(): Promise<EngineVersionInfo[]> {
    return mock(cfg.engineVersions.map((e) => ({ ...e })));
  },
  startEngineUpgrade(engineId: string): Promise<OperationRecord> {
    const e = cfg.engineVersions.find((x) => x.engineId === engineId);
    if (e) e.upgradeStatus = 'GRAY_VERIFY';
    return mock(cfg.recordOp('发起引擎升级', engineId, `${e?.engine ?? ''} ${e?.version ?? ''} → ${e?.latestVersion ?? ''}，灰度验证中（先选 1 台低峰节点 24h）`), 200);
  },

  /* ============ 复核补充：请求执行策略清单（六章：证明执行了哪些策略） ============ */

  getExecutedPolicies(traceId: string): Promise<ExecutedPolicyItem[]> {
    const log = getRouterLogs().find((l) => l.traceId === traceId);
    const items: ExecutedPolicyItem[] = [];
    if (!log) return mock(items, 80);
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
    return mock(items, 120);
  },

  /* ============ 二轮完善：节点维护（P1-9） ============ */

  setNodeMaintenance(resourceId: string, maintenance: boolean): Promise<OperationRecord> {
    const r = cfg.resourcesStore.find((x) => x.resourceId === resourceId);
    if (r) r.status = maintenance ? 'MAINTENANCE' : 'RUNNING';
    return mock(cfg.recordOp(maintenance ? '隔离维护' : '恢复上线', resourceId, `${r?.node ?? ''} ${maintenance ? '已隔离，新请求不再调度至该节点，在途请求完成后排空' : '已恢复上线，重新参与调度'}`), 200);
  },
  /** P2-13 容量预测：生成扩容工单 */
  requestExpansion(pool: string, reason: string): Promise<OperationRecord> {
    return mock(cfg.recordOp('提交扩容工单', pool, `${reason}；已推送算力采购流程（预计 2 周到货）`), 200);
  },

  /* ============ 二轮完善：调用质量告警规则（P0-4） ============ */

  getQualityAlertRules(): Promise<QualityAlertRule[]> {
    return mock(cfg.qualityAlertRules.map((r) => ({ ...r, channels: [...r.channels] })));
  },
  saveQualityAlertRule(rule: QualityAlertRule): Promise<OperationRecord> {
    const idx = cfg.qualityAlertRules.findIndex((r) => r.ruleId === rule.ruleId);
    if (idx >= 0) cfg.qualityAlertRules[idx] = { ...rule, channels: [...rule.channels] };
    else cfg.qualityAlertRules.push({ ...rule, ruleId: cfg.nextId('QA'), channels: [...rule.channels] });
    return mock(cfg.recordOp('保存告警规则', rule.ruleId, `${rule.name}：阈值 ${rule.threshold}${rule.unit}，通知 ${rule.channels.join('/')}`), 200);
  },
  toggleQualityAlertRule(ruleId: string): Promise<OperationRecord> {
    const r = cfg.qualityAlertRules.find((x) => x.ruleId === ruleId);
    if (r) r.enabled = !r.enabled;
    return mock(cfg.recordOp(r?.enabled ? '启用告警规则' : '停用告警规则', ruleId, r?.name ?? ''), 200);
  },

  /* ============ 二轮完善：成员与权限（P1-8） ============ */

  getMembers(): Promise<MemberInfo[]> {
    return mock([...cfg.members]);
  },
  saveMember(m: MemberInfo): Promise<OperationRecord> {
    const idx = cfg.members.findIndex((x) => x.memberId === m.memberId);
    if (idx >= 0) cfg.members[idx] = { ...m };
    else cfg.members.push({ ...m, memberId: cfg.nextId('M') });
    return mock(cfg.recordOp('成员权限变更', m.memberId, `${m.name}：角色 ${m.role}，部门 ${m.deptId}`), 200);
  },
  toggleMember(memberId: string): Promise<OperationRecord> {
    const m = cfg.members.find((x) => x.memberId === memberId);
    if (m) m.status = m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    return mock(cfg.recordOp(m?.status === 'ACTIVE' ? '启用成员' : '禁用成员', memberId, `${m?.name ?? ''} 账号已${m?.status === 'ACTIVE' ? '启用' : '禁用（即时收回全部权限）'}`), 200);
  },
  deleteMember(memberId: string): Promise<OperationRecord> {
    const idx = cfg.members.findIndex((x) => x.memberId === memberId);
    const name = cfg.members[idx]?.name ?? memberId;
    if (idx >= 0) cfg.members.splice(idx, 1);
    return mock(cfg.recordOp('移除成员', memberId, `${name} 已移除，关联 Key 与权限已回收`), 200);
  },

  /* ============ 二轮完善：月度账单（P1-11） ============ */

  getMonthlyBills(): Promise<MonthlyBill[]> {
    return mock([...cfg.monthlyBills]);
  },

  /* ============ 二轮完善：公告通知（P2-14） ============ */

  getAnnouncements(): Promise<Announcement[]> {
    return mock([...cfg.announcements]);
  },
  postAnnouncement(type: Announcement['type'], title: string, content: string): Promise<OperationRecord> {
    cfg.announcements.unshift({ annId: cfg.nextId('ANN'), type, title, content, createdAt: new Date().toISOString(), pinned: type === 'MAINTENANCE' });
    return mock(cfg.recordOp('发布公告', title, content.slice(0, 60)), 200);
  },

  /* ============ 二轮完善：批量推理任务（P2-15） ============ */

  getBatchTasks(): Promise<BatchTask[]> {
    return mock([...cfg.batchTasks]);
  },
  submitBatchTask(t: Omit<BatchTask, 'taskId' | 'status' | 'submitAt'>): Promise<OperationRecord> {
    cfg.batchTasks.unshift({ ...t, taskId: cfg.nextId('BT'), status: 'QUEUED', submitAt: new Date().toISOString() });
    return mock(cfg.recordOp('提交批量任务', t.name, `${t.rows.toLocaleString()} 条，错峰窗口 ${t.window}，优先级 ${t.priority}`), 200);
  },
  cancelBatchTask(taskId: string): Promise<OperationRecord> {
    const t = cfg.batchTasks.find((x) => x.taskId === taskId);
    if (t && (t.status === 'QUEUED' || t.status === 'RUNNING')) t.status = 'CANCELLED';
    return mock(cfg.recordOp('取消批量任务', taskId, `${t?.name ?? ''} 已取消，未执行部分不再调度`), 200);
  },

  /* ============ 二轮完善：我的申请（P0-3） ============ */

  getMyApplications(): Promise<MyApplication[]> {
    return mock([...cfg.myApplications]);
  },
  /** 驳回申请重新提交：生成新单（原驳回单保留可追溯），走审批并留痕 */
  resubmitApplication(applyId: string): Promise<OperationRecord> {
    const src = cfg.myApplications.find((x) => x.applyId === applyId);
    if (src) {
      cfg.myApplications.unshift({
        applyId: cfg.nextId('MA'),
        kind: src.kind,
        title: `${src.title}（重新提交）`,
        reason: `${src.reason}（已按审批意见补充优化方案）`,
        status: 'PENDING',
        submitAt: new Date().toISOString(),
        approveAt: null,
        opinion: '',
      });
    }
    return mock(cfg.recordOp('重新提交申请', applyId, `${src?.title ?? ''} 已重新提交，原驳回意见已处理`), 200);
  },

  /* ============ 二轮完善：应用注册管理（P0-5） ============ */

  saveApp(a: ApplicationRegistry): Promise<OperationRecord> {
    const idx = cfg.appsStore.findIndex((x) => x.appId === a.appId);
    if (idx >= 0) cfg.appsStore[idx] = { ...a };
    else cfg.appsStore.push({ ...a, appId: cfg.nextId('APP') });
    return mock(cfg.recordOp('应用注册变更', a.appId, `${a.appName}：${a.businessScenario}，SLA ${a.slaLevel}，数据等级 ${a.dataLevel}`), 200);
  },
  toggleApp(appId: string): Promise<OperationRecord> {
    const a = cfg.appsStore.find((x) => x.appId === appId);
    if (a) a.status = a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    return mock(cfg.recordOp(a?.status === 'ACTIVE' ? '启用应用' : '停用应用', appId, `${a?.appName ?? ''} 已${a?.status === 'ACTIVE' ? '启用' : '停用（路由不再分发）'}`), 200);
  },
  deleteApp(appId: string): Promise<OperationRecord> {
    const idx = cfg.appsStore.findIndex((x) => x.appId === appId);
    const name = cfg.appsStore[idx]?.appName ?? appId;
    if (idx >= 0) cfg.appsStore.splice(idx, 1);
    return mock(cfg.recordOp('删除应用', appId, `${name} 已注销，关联 Key 与配额已回收`), 200);
  },

  /* ============ 核心补强：TCO 成本模型 / 效益评估 / 租户组织 ============ */

  getCostModelConfig(): Promise<CostModelConfig> {
    return mock({ ...cfg.costModelConfig, weights: { ...cfg.costModelConfig.weights } });
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
    Object.assign(cfg.costModelConfig, { ...c, weights: norm, updatedAt: new Date().toISOString() });
    return mock(cfg.recordOp('保存成本模型', 'COST-MODEL', `权重 基建${norm.infra}/推理${norm.compute}/许可${norm.license}/外部${norm.external}，折旧 ${c.depreciationYears} 年，租赁折算 ×${c.rentalFactor.toFixed(2)}，分摊基准 ${c.allocateBy}`), 200);
  },
  getModelBenefits(): Promise<ModelBenefit[]> {
    return mock(cfg.modelBenefits.map((b) => ({ ...b })));
  },
  getTenantOrgs(): Promise<TenantOrg[]> {
    return mock(cfg.tenantOrgs.map((t) => ({ ...t, mappedDepts: [...t.mappedDepts] })));
  },
  toggleTenant(tenantId: string): Promise<OperationRecord> {
    const t = cfg.tenantOrgs.find((x) => x.tenantId === tenantId);
    if (t) t.status = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    return mock(cfg.recordOp(t?.status === 'ACTIVE' ? '启用租户' : '停用租户', tenantId, `${t?.tenantName ?? ''} 已${t?.status === 'ACTIVE' ? '启用：恢复模型/数据/算力权限' : '停用：即时收回模型与数据权限，在途请求排空'}`), 200);
  },

  /* ============ 系统管理（用户/角色/权限/监控/工单/参数） ============ */

  getSysUsers(): Promise<SysUser[]> {
    return mock([...cfg.sysUsers]);
  },
  toggleSysUser(userId: string): Promise<OperationRecord> {
    const u = cfg.sysUsers.find((x) => x.userId === userId);
    if (u) u.status = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    return mock(cfg.recordOp(u?.status === 'ACTIVE' ? '启用账号' : '停用账号', userId, `${u?.name ?? ''}（${u?.account ?? ''}）已${u?.status === 'ACTIVE' ? '启用' : '停用，会话即时失效'}`), 200);
  },
  unlockSysUser(userId: string): Promise<OperationRecord> {
    const u = cfg.sysUsers.find((x) => x.userId === userId);
    if (u && u.status === 'LOCKED') u.status = 'ACTIVE';
    return mock(cfg.recordOp('解锁账号', userId, `${u?.name ?? ''} 连续登录失败锁定已解除，失败计数清零`), 200);
  },
  resetUserPassword(userId: string): Promise<OperationRecord> {
    const u = cfg.sysUsers.find((x) => x.userId === userId);
    return mock(cfg.recordOp('重置密码', userId, `${u?.name ?? ''} 密码已重置，首次登录强制修改并留痕`), 200);
  },
  addSysUser(u: Omit<SysUser, 'userId' | 'lastLoginAt'>): Promise<OperationRecord> {
    cfg.sysUsers.unshift({ ...u, userId: cfg.nextId('M'), lastLoginAt: new Date().toISOString() });
    return mock(cfg.recordOp('新增账号', u.account, `${u.name}（${u.deptName}），首次登录强制改密并绑定双因素`), 200);
  },
  updateSysUser(u: SysUser): Promise<OperationRecord> {
    const idx = cfg.sysUsers.findIndex((x) => x.userId === u.userId);
    if (idx >= 0) cfg.sysUsers[idx] = { ...u };
    return mock(cfg.recordOp('编辑账号', u.userId, `${u.name}：部门 ${u.deptName}，角色 ${u.role}，双因素 ${u.mfa ? '开启' : '关闭'}`), 200);
  },
  deleteSysUser(userId: string): Promise<OperationRecord> {
    const idx = cfg.sysUsers.findIndex((x) => x.userId === userId);
    const name = cfg.sysUsers[idx]?.name ?? userId;
    if (idx >= 0) cfg.sysUsers.splice(idx, 1);
    return mock(cfg.recordOp('删除账号', userId, `${name} 已注销，关联 Key 与会话即时回收`), 200);
  },
  changeMyPassword(account: string): Promise<OperationRecord> {
    return mock(cfg.recordOp('修改密码', account, '本人修改登录密码，新密码符合复杂度策略'), 200);
  },
  getSysRoles(): Promise<SysRole[]> {
    return mock([...cfg.sysRoles]);
  },
  addSysRole(r: { roleName: string; desc: string; scope: string }): Promise<OperationRecord> {
    cfg.sysRoles.push({ roleKey: cfg.nextId('ROLE'), roleName: r.roleName, desc: r.desc, scope: r.scope, builtIn: false, userCount: 0 });
    return mock(cfg.recordOp('新增角色', r.roleName, `${r.desc}，数据范围 ${r.scope}，需在权限配置页完成授权`), 200);
  },
  deleteSysRole(roleKey: string): Promise<OperationRecord> {
    const idx = cfg.sysRoles.findIndex((x) => x.roleKey === roleKey && !x.builtIn);
    const name = idx >= 0 ? cfg.sysRoles[idx].roleName : roleKey;
    if (idx >= 0) cfg.sysRoles.splice(idx, 1);
    return mock(cfg.recordOp('删除角色', roleKey, `${name} 已删除，关联账号回落业务查看员`), 200);
  },
  getPermMatrix(): Promise<PermRow[]> {
    return mock(cfg.permMatrix.map((r) => ({ module: r.module, levels: { ...r.levels } })));
  },
  savePermMatrix(rows: PermRow[]): Promise<OperationRecord> {
    cfg.permMatrix.length = 0;
    rows.forEach((r) => cfg.permMatrix.push({ module: r.module, levels: { ...r.levels } }));
    const n = rows.reduce((acc, r) => acc + Object.values(r.levels).filter((l) => l !== 'DENY').length, 0);
    return mock(cfg.recordOp('保存权限矩阵', 'RBAC', `${rows.length} 模块 × 6 角色，生效授权 ${n} 项，变更即时同步网关鉴权`), 200);
  },
  getPlatformServices(): Promise<PlatformService[]> {
    return mock([...cfg.platformServices]);
  },
  rescanServices(): Promise<OperationRecord> {
    return mock(cfg.recordOp('健康拨测', 'MONITOR', '手动触发全量服务拨测，探测结果即时刷新'), 400);
  },
  getSysTickets(): Promise<SysTicket[]> {
    return mock([...cfg.sysTickets]);
  },
  createTicket(t: { type: TicketType; title: string; content: string; from: string; deptName: string }): Promise<OperationRecord> {
    cfg.sysTickets.unshift({ ...t, ticketId: cfg.nextId('TK'), status: 'OPEN', createdAt: new Date().toISOString(), reply: '' });
    return mock(cfg.recordOp('新建工单', t.title, `${t.from}（${t.deptName}）：${t.content.slice(0, 40)}`), 200);
  },
  replyTicket(ticketId: string, reply: string): Promise<OperationRecord> {
    const t = cfg.sysTickets.find((x) => x.ticketId === ticketId);
    if (t) {
      t.reply = reply;
      if (t.status === 'OPEN') t.status = 'PROCESSING';
    }
    return mock(cfg.recordOp('回复工单', ticketId, reply.slice(0, 60)), 200);
  },
  resolveTicket(ticketId: string): Promise<OperationRecord> {
    const t = cfg.sysTickets.find((x) => x.ticketId === ticketId);
    if (t) t.status = 'RESOLVED';
    return mock(cfg.recordOp('结单', ticketId, `${t?.title ?? ''} 已处理完毕，提交人可评价`), 200);
  },
  getSystemParams(): Promise<SystemParams> {
    return mock({ ...cfg.systemParams });
  },
  saveSystemParams(p: SystemParams): Promise<OperationRecord> {
    Object.assign(cfg.systemParams, p);
    return mock(cfg.recordOp('保存系统参数', 'SYS-PARAM', `密码≥${p.pwdMinLen}位，会话 ${p.sessionTimeoutMin} 分钟，失败锁定 ${p.loginFailLock} 次，审计留存 ${p.auditRetentionDays} 天，IP 白名单${p.ipWhitelistEnabled ? '开' : '关'}，脱敏${p.dataMasking ? '开' : '关'}`), 200);
  },

  /* ============ K8s 容器编排（LLM 推理服务底座） ============ */

  getK8sClusters(): Promise<K8sCluster[]> {
    return mock([...cfg.k8sClusters]);
  },
  getK8sPods(): Promise<K8sPod[]> {
    return mock([...cfg.k8sPods]);
  },
  restartPod(podId: string): Promise<OperationRecord> {
    const p = cfg.k8sPods.find((x) => x.podId === podId);
    return mock(cfg.recordOp('重启 Pod', podId, `${p?.service ?? ''}（${p?.ns ?? ''}）滚动重启，副本逐个替换不中断服务`), 200);
  },
};
