# 宁波银行 MAAS 平台前端架构与 UI/UX 设计规范 (V3 - 实施对齐版)

> 本文档可直接作为前端开发的页面规格说明书。页面实现、组件拆分、字段绑定、交互与异常处理均以本文档为准。
> 若与后端接口文档冲突，以本文档字段为准先行对齐。
> **V3 更新**：与实际项目对齐——导航增至 7 项（新增我的工作台）、新增明暗双主题、补充异构算力/路由引擎/运维大盘/成本模型/效益评估/租户管理等增量对象与页面、全行量级数据基线真实化（见 8.4）。

## 1. 文档定位

本文档基于以下材料联合整理：

- [需求概览.md](file:///d:/my-project/sunyard-ai-xingjian-2025/MAAS-xingjian/doc/%E9%9C%80%E6%B1%82%E6%A6%82%E8%A7%88.md)
- [信雅达Maas解决方案_0730.pdf](file:///d:/my-project/sunyard-ai-xingjian-2025/MAAS-xingjian/doc/%E4%BF%A1%E9%9B%85%E8%BE%BEMaas%E8%A7%A3%E5%86%B3%E6%96%B9%E6%A1%88_0730.pdf)

本文档不是纯视觉稿说明，而是用于方案评审、前端落图、组件拆分和演示验收的页面设计规范。重点补齐四类内容：

1. 页面布局与视觉风格
2. 字段参数与对象模型
3. 页面操作项与状态机
4. 关键交互链路与联动逻辑

**开发约定：**
- 第 7 章为统一对象模型（数据字典），第 6 章页面字段全部引用该模型，禁止页面内另造字段。
- 所有状态字段必须使用第 7 章定义的枚举值，前端禁止自由文本状态。
- 所有页面必须覆盖：正常态、空态、错误态、权限不足态。

---

## 2. 设计目标与产品边界

### 2.1 平台目标

MASS 平台不是"大模型调用后台"，而是银行级 AI 生产运营基础设施。前端设计必须服务以下目标：

- 让管理层看清全行模型、算力、Token 和成本全貌
- 让平台运营团队对白盒化路由、算力利用、降级和审计链路进行管控
- 让模型资产团队完成模型准入、灰度、回滚、下线和画像管理
- 让安全与审计团队对越权、异常、敏感调用形成可追溯证据链

### 2.2 产品边界

前端页面覆盖以下范围：

- 统一控制面
- 智能调度网关
- 弹性算力中心
- 计量运营中心
- 模型资产中心
- 安全运行中心

不直接承担以下能力（可通过关联链接、引用状态或外部系统入口接入）：

- 模型训练、实验、Checkpoint 管理
- 知识生产加工
- 智能体编排细节编辑
- 财务系统最终记账

---

## 3. 设计原则

### 3.1 三个第一性原则

1. **先秩序，后炫技**：所有页面首先解决"可视、可管、可追溯"，其次才是视觉张力。
2. **先白盒，后智能**：路由、限流、降级、回滚、计费都必须能解释，不能只展示结果。
3. **先状态，后内容**：该平台本质上是运行控制台。页面应优先暴露状态、风险、异常和执行依据。

### 3.2 四类用户视角与字段权限

同一底层数据口径，按角色切换展示深度，不做两套相互割裂的数据视图。

| 角色 | 默认首页 | 可见范围 | 可执行高危操作 |
|---|---|---|---|
| `ADMIN`（平台管理员） | 总控驾驶舱 | 全量字段 | 策略发布/回滚、熔断、归档、账号管理 |
| `OPERATOR`（平台运营） | 调度与算力 | 路由、算力、限流、降级全字段 | 手动演练主备切换、调整限流阈值（需审批） |
| `MODEL_OWNER`（模型治理） | 模型资产 | 模型资产、评测、血缘、灰度 | 灰度、A/B、回滚、下线（需审批） |
| `AUDITOR`（审计安全） | 安全与审计 | 审计、脱敏、租户矩阵、导出 | 导出审计包（留痕） |
| `BIZ_VIEWER`（业务只读） | 总控驾驶舱 | 部门口径聚合数据，无明细 | 无 |

- 只读模式下，所有写操作按钮隐藏且禁用，页面顶部展示黄色横幅"只读模式已开启"。
- 越权访问页面时，展示"无权限"空态页（见第 10 章 `no_permission`），不静默降级。

---

## 4. 信息架构与导航设计

### 4.1 一级导航（左侧固定 7 项）

1. `总控驾驶舱`
2. `统一控制面`
3. `调度与算力`
4. `计量与运营`
5. `模型资产`
6. `安全与审计`
7. `我的工作台`（业务员自助门户 + 申请人进度中心，五角色视角）

### 4.2 二级导航

### 4.2 二级导航

#### 4.2.1 总控驾驶舱
- 管理驾驶舱（全行资源总览 / 部门与业务分布 / 今日告警与异常 / 热点模型与热点应用）
- 运维大盘（`?view=ops`：GPU 与集群状态 / 模型实例矩阵 / 并发与队列 / 响应时间 / 缓存命中 / 资源热点 / 熔断降级 / 容量余量，与管理驾驶舱同一套数据口径）

#### 4.2.2 统一控制面
- 调度策略 / 资源策略 / 模型策略 / 安全策略 / 运营策略
- 策略审批与发布记录

#### 4.2.3 调度与算力
- 智能路由白盒 / 路由引擎配置中心（六段流水线 + 四维权重 + 策略开关）
- 限流与熔断 / 流量管控（API Key + QPS/Token 双维限流 + 场景路由）
- 应急操作台（灰度降级 / 流量切备 / 关停非核心）
- 异构算力厂商矩阵（英伟达/华为昇腾/沐曦/Intel，国产化占比 + 厂商级调度策略）
- 资源编排（vGPU/量化/混部/优先级/批处理与 KV Cache/错峰调度/推理引擎版本）
- 优先级队列 / 资源热区分析 / 容量预测

#### 4.2.4 计量与运营
- Token 计量 / 调用量与时延 / 卡时与实例时长
- 配额与限流（业务组 Token 配额治理 + 成本预警）
- 模型统计（部门结算 / 个人用量 / 应用统计 + 语义路由节省测算）
- 调用日志（真实业务内容池 + 行为标签）
- 应用管理（应用注册 + IAM 对接口径）
- TCO 分摊（旭日图）/ 月度账单
- 成本模型配置（四类成本权重可配置 + 折旧/租赁折算/分摊基准）
- 部门排行 / 账单导出

#### 4.2.5 模型资产
- 模型台账 / 模型画像 / 模型血缘
- 模型接入（云端/本地/租赁 + 连通性测试）
- 模型广场（卡片浏览 + 自助申请）
- 模型体验 Playground（先体验后接入，双模型对比）
- 效益评估（单位任务成本/活跃应用/采纳率/治理建议）
- 评测与准入 / 灰度与 A/B / 回滚与下线 / 发布与归档

#### 4.2.6 安全与审计
- RBAC 与租户隔离 / 租户管理（组织映射/数据边界/启停）
- 安全护栏（接入/策略/10 检测模块/词库/检测模型/举报反馈）
- 成员与权限（平台成员 RBAC 管理）
- Trace 检索 / 审计留痕 / 多维调用审计 / 风险告警 / 合规导出
- 告警规则配置（P95/错误率/队列/调用尖峰）

#### 4.2.7 我的工作台（V3 新增）
- 业务员自助门户（本部门配额/我的申请/模型广场快捷入口）
- 申请人进度中心（模型接入/配额调整/密钥申请统一跟踪）
- 个人用量与行为标签

### 4.3 顶部全局栏（固定）

- 平台名称与环境标识：`生产 / 灰度 / 测试`
- 当前组织/租户切换器（`tenantId`，切换后全局数据随之过滤）
- 全局时间选择器：`实时 / 1h / 24h / 7d / 30d`（各档位数据时延见 8.3）
- 全局搜索：支持 `TraceID / 资产ID / 应用ID / 用户ID / 模型名`
- 紧急操作入口：`一键熔断`、`只读模式`、`事件广播`
- 当前登录人、角色、审批待办（badge 显示待办数）

---

## 5. 视觉系统与布局规范

### 5.1 风格定位

`金融级指挥中心 + 工程化运维控制台`。

- 主基调：深色、高对比、低饱和（默认）；另提供现代简约浅色主题（见 5.2.1）
- 层级感：依赖边框、发光、阴影和局部高亮，而非大面积渐变
- 目标气质：稳、准、硬朗、可审计
- 科技感细节：细网格底纹 + 双色径向光晕、面板顶部光锋、入场动效、焦点环（均在两种主题下适配）

### 5.2 色板（语义色，代码中必须以 token 引用）

| Token | 色值 | 用途 |
|---|---|---|
| `bg-page` | `#0A0F1A` | 页面底色 |
| `bg-panel` | `#121A2A` | 面板底色 |
| `border-default` | `#22324A` | 分割边框 |
| `color-primary` | `#18C3FF` | 主强调、正常流转 |
| `color-success` | `#14E7A0` | 命中/优化 |
| `color-warning` | `#FFB340` | 预警/降级 |
| `color-danger` | `#FF4D6D` | 严重告警/熔断/拦截 |
| `color-text-primary` | `#E8F0FA` | 主文字 |
| `color-text-secondary` | `#8EA3B8` | 次级文字 |

状态色规则：**禁止仅用颜色表达状态**，必须同时有图标或文字（见 10.2）。

#### 5.2.1 明暗双主题（V3 新增）

- 右上角提供 Sun/Moon 切换按钮，主题持久化于 `localStorage`（key `maas-theme`），通过 `html[data-theme]` 驱动 CSS 变量覆盖。
- 深色（默认）：上表色板，专业指挥风。
- 浅色（现代简约）：`bg-page #EEF2F8`、`bg-panel #FFFFFF`、`border-default #DDE5F0`、`color-primary #1668DC`、`color-success #0CA678`、`color-warning #DD8D0A`、`color-danger #E5484D`、`text-primary #182430`、`text-secondary #5C6C80`；面板附浅阴影，品牌字切深蓝→绿渐变。
- 图表 tooltip 采用主题自适应 CSS 变量（`--chart-tooltip-bg/border`），两种主题下均高对比可读；饼图/旭日图扇区 hover 增亮，避免深色主题下 hover 变暗。

### 5.3 布局规则

- `Header + Sidebar + Main Canvas + Right Drawer` 结构
- 12 列栅格，间距 16px
- 面板圆角 12px，统一边框 1px
- 卡片高度三档：240 / 320 / 400 px，便于大屏拼装
- 复杂链路分析采用中间主舞台 + 右侧抽屉承载详情

### 5.4 字体与数据展示

- 正文 16px；二级说明 14px；指标大数字 28px / 36px
- 代码、ID、哈希、Trace 使用等宽字体（`Roboto Mono`）
- 所有金额、Token、卡时默认千分位格式
- 数字使用 tabular-nums，禁止跳动换行

### 5.5 通用组件规格（开发必读）

| 组件 | 规格 |
|---|---|
| `KpiCard` | 标题 + 大数字 + 环比/同比 + hover 口径说明 tooltip |
| `StatusTag` | 状态枚举 + 语义色 + 图标，必须图文同现 |
| `Drawer` | 右侧抽屉，宽度 480px，支持多级下钻与返回 |
| `DataTable` | 分页 + 排序 + 列筛选，超过 500 行启用虚拟滚动 |
| `ConfirmDialog` | 高风险操作二次确认，必须输入操作对象名才能确认 |
| `ProgressTask` | 长时任务进度条（非单一 loading） |
| `EmptyState` / `ErrorState` / `NoPermissionState` | 三类兜底态，见第 10 章 |
| `Banner` | 顶部横幅：只读、口径待校准、高优先级被挤压、配额预警 |
| `Timeline` | 请求链路时间线，每个节点含阶段名/耗时/状态/责任对象 |
| `RadarChart` / `SunburstChart` / `FunnelChart` / `LineChart` | 图表组件，均需 legend + tooltip + 键盘可达 |

---

## 6. 页面级详细设计

> 每个页面按：页面目标 → 页面结构 → 核心字段 → 核心操作（含权限）→ 交互逻辑 → 异常状态 → 组件拆分 组织。
> 字段引用第 7 章对象模型；页面字段为视图层裁剪，不新增字段定义。

### 6.1 总控驾驶舱

#### 6.1.1 页面目标
面向管理层与平台负责人，提供全行 AI 生产资源全局态势。

#### 6.1.2 页面结构（12 列栅格）
- 顶部 KPI 条（横贯 12 列，一行 6 个 KpiCard）
- 中央全行资源态势拓扑图（占 6 列，含部门/应用/模型/算力节点流转）
- 左侧资源与负载（占 3 列：算力利用率、缓存命中率、批处理吞吐）
- 右侧风险与成本（占 3 列：今日异常/熔断/降级、今日预估 TCO）
- 底部重点应用/重点模型排行（横贯 12 列，两栏表格）

#### 6.1.3 核心字段（口径见 8.1）

| 字段 | 来源对象 | 必填 | 展示形态 |
|---|---|---|---|
| 总模型数 / 生产模型数 | ModelAsset 聚合 | ✓ | KpiCard |
| 总应用数 | ApplicationRegistry 聚合 | ✓ | KpiCard |
| 总请求数 / 输入Token / 输出Token | MeteringRecord 聚合 | ✓ | KpiCard |
| 总卡时 / 平均TTFT / 平均响应时延 | MeteringRecord / Instance 聚合 | ✓ | KpiCard（时延含 P95，见 8.1） |
| GPU利用率 | ComputeResource 聚合 | ✓ | KpiCard |
| 缓存命中率 | Instance 聚合 | ✓ | KpiCard |
| 本地/外部算力占比 | ComputeResource 按 costTag 分组 | ✓ | 环形图 |
| 今日异常数 / 熔断数 / 降级数 | SecurityEvent / RouterLog 聚合 | ✓ | KpiCard（红色数字） |
| 今日预估 TCO | MeteringRecord.tcoTotal 求和 | ✓ | KpiCard（金额） |

#### 6.1.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 切换时间范围 | 全部 | 联动刷新全页所有卡片/图表 |
| 按部门/业务线筛选 | 全部 | 顶部筛选器，联动所有区块 |
| 点击部门下钻 | 全部 | 跳转 6.5 计量与运营页并预置部门筛选 |
| 点击模型下钻 | 全部 | 跳转 6.6 模型资产页并预置模型 |
| 点击异常/熔断/降级数字 | 全部 | 跳转 6.7 安全与审计页并预置事件筛选 |

#### 6.1.5 交互逻辑
- KPI 卡 hover 显示：环比、同比、口径说明（口径说明文字见 8.1）
- 点击任意 KPI，右侧 Drawer 展示构成明细（可下钻到账单流水）
- 拓扑节点颜色：蓝=正常、绿=高命中/优化、黄=负载偏高、红=故障/熔断（配合图标）
- 刷新策略：`实时`档位 10s 轮询；其余档位 60s 轮询；支持手动冻结（暂停轮询并显示"已冻结"徽标）

#### 6.1.6 异常状态
- 无数据：EmptyState"当前筛选范围内无运行数据"
- 数据延迟：显示最近同步时间与延迟分钟数（数据时延等级见 8.3）
- 指标失真：黄色横幅"计量口径待校准"（触发条件：MeteringRecord 口径变更未结算完成）

#### 6.1.7 组件拆分
`KpiRow` + `ResourceTopology` + `UtilizationPanel` + `RiskPanel` + `RankTable(应用/模型)` + `TimeRangeFilter` + `DeptFilter` + `KpiDetailDrawer`

---

### 6.2 统一控制面

#### 6.2.1 页面目标
将调度、资源、模型、安全、运营规则统一配置、审批、发布和追踪。

#### 6.2.2 页面结构
- 左侧策略分类树（按 policyType 分组）
- 中部策略列表（DataTable）
- 右侧策略编辑器 / 只读详情
- 底部审批流与发布记录（Timeline）

#### 6.2.3 策略对象字段（Policy 对象，见 7.1）

| 字段 | 必填 | 说明 |
|---|---|---|
| `policyId` | ✓ | 全局唯一 |
| `policyType` | ✓ | `ROUTING/COMPUTE/MODEL/SECURITY/METERING` |
| `policyName` | ✓ | 策略名，回滚确认需输入此值 |
| `scopeType` / `scopeValue` | ✓ | 作用域：部门/应用/模型/租户/全局 |
| `priority` | ✓ | 冲突裁决优先级，数值大者优先 |
| `status` | ✓ | 见 7.1 枚举 |
| `effectiveTime` / `expireTime` | ✓ | 生效窗口 |
| `version` | ✓ | 版本号，发布+1 |
| `createdBy` / `approvedBy` | ✓ | 责任人（审计） |
| `lastPublishedAt` | ✓ | 最近发布时间 |
| `rollbackVersion` | ✓ | 回滚目标版本 |
| `rules` | ✓ | 规则集（各类型字段见下表） |

各策略类型 rules 字段：

- 调度策略：`businessScenario / taskType / dataSensitivity / slaLevel / budgetLimit / primaryModel / secondaryModel / fallbackMode`
- 资源策略：`resourcePool / allowedArch / quotaType / quotaValue / priorityClass / reservedCapacity`
- 模型策略：`allowedAssetIds / allowedVersions / grayRule / abTestRule / rollbackThreshold`
- 安全策略：`roleSet / tenantBoundary / promptCheckRule / outputMaskRule / logRetentionRule`
- 运营策略：`tokenQuota / requestQuota / costBudget / warnThreshold / limitThreshold`

#### 6.2.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 新建 / 复制策略 | ADMIN | 打开编辑器，复制保留历史版本 |
| 比较版本差异 | ADMIN / OPERATOR | Drawer 双栏 diff 展示 |
| 提交审批 | ADMIN | 生成审批流，状态 → `PENDING_APPROVAL` |
| 灰度发布 | ADMIN | 状态 → `GRAY`，按 grayRule 生效 |
| 全量发布 | ADMIN | 状态 → `ACTIVE`，version+1 |
| 回滚到旧版本 | ADMIN | 输入策略名确认后，状态 → `ROLLBACK`，见 9.3 |
| 停用 / 归档 | ADMIN | 停用=暂停生效；归档=只读 |

#### 6.2.5 交互逻辑
- 编辑器"左配置、右解释"双栏：右栏实时解释该规则影响面（命中哪些应用/模型）
- 配置项修改后即显示影响范围预估（受影响应用数/模型数）
- 发布前展示冲突检查结果：冲突策略、冲突优先级、受影响应用数、受影响模型数
- 策略生效状态变化时，顶部 Banner 提示"策略 X 已生效，影响 N 个应用"

#### 6.2.6 异常状态
- 冲突未解决：红色 Banner + 阻止发布
- 策略回滚失败：ErrorState + 建议联系后端查看策略执行记录

#### 6.2.7 组件拆分
`PolicyTree` + `PolicyTable` + `PolicyEditor`(双栏) + `DiffViewer` + `ApprovalFlow` + `PublishRecordTimeline` + `ConflictCheckDialog`

---

### 6.3 智能调度网关

#### 6.3.1 页面目标
展示业务识别、模型选择、算力匹配、限流、降级和路由解释全过程。

#### 6.3.2 页面结构
- 请求总览条（QPS/Token 双维实时）
- 路由漏斗图（入站 → 分流 → 限流/熔断 → 派发）
- 单请求 Rationale 白盒面板
- 限流/熔断面板
- 降级与切备历史（Timeline）

#### 6.3.3 请求字段（RouterLog 对象，见 7.3）

| 字段 | 必填 | 说明 |
|---|---|---|
| `traceId` | ✓ | 全链路唯一，全局搜索入口 |
| `requestId` / `appId` / `tenantId` / `userId` | ✓ | 主体信息 |
| `businessScenario` / `taskType` / `dataLevel` | ✓ | 识别结果 |
| `requestMode` | ✓ | `SYNC/ASYNC/STREAM` |
| `promptTokens` / `expectedOutputTokens` / `contextLength` | ✓ | 请求规模 |
| `slaLevel` / `budgetClass` | ✓ | 约束条件 |

#### 6.3.4 路由决策字段（RoutingDecision 对象，见 7.4）

| 字段 | 必填 | 说明 |
|---|---|---|
| `candidateModels[]` | ✓ | 每个候选必须含：`assetId/version/score/eliminateReason` |
| `selectedModel/selectedVersion/selectedEngine/selectedPool/selectedNode` | ✓ | 最终选择 |
| `routeReason` | ✓ | 决策摘要文本 |
| `scoreLatency/scoreCost/scoreRisk/scoreLoad` | ✓ | 四维评分（口径见 8.2） |
| `fallbackTriggered` / `fallbackReason` | ✓ | 降级标记与原因 |

#### 6.3.5 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 按 TraceID 检索请求 | 全部 | 打开单请求详情 |
| 查看路由解释 | 全部 | 时间线 + 决策树双视图 |
| 查看候选模型比较 | 全部 | 表格对比各候选得分与淘汰原因 |
| 查看限流命中记录 | OPERATOR | 列表 + 维度筛选 |
| 查看降级与切备链路 | OPERATOR | Timeline 回放 |
| 手动演练主备切换 | OPERATOR | 沙箱模式，不落生产，输出演练报告 |

#### 6.3.6 交互逻辑
- 单请求详情：`Timeline`（阶段顺序：鉴权→前置护栏→路由→推理→后置护栏→响应）+ `决策树`（候选→淘汰→选中）
- **候选模型比较必须展示淘汰原因**，不允许只显示最终选中结果
- 触发限流时，必须明确显示限流维度：QPS / 输入 Token / 输出 Token / 总成本 / 并发数（维度来自触发时的策略规则）
- 触发降级时，必须展示降级边界类型，并标注该请求 `requestMode` 是否支持该降级类型（见 9.2 降级边界表）

#### 6.3.7 异常状态
- TraceID 不存在：EmptyState"未检索到该 TraceID，请确认时间范围"
- 路由决策数据缺失（评分未落库）：ErrorState + 提示"该请求发生时间早于可观测期"

#### 6.3.8 组件拆分
`RequestOverviewBar` + `RoutingFunnel` + `RequestSearch` + `RationalePanel`(时间线+决策树) + `CandidateCompareTable` + `RateLimitPanel` + `FallbackTimeline` + `SwitchDrillModal`

---

### 6.4 弹性算力中心

#### 6.4.1 页面目标
纳管异构算力、连续批处理、KV Cache、大小模型混部和优先级队列。

#### 6.4.2 页面结构
- 算力资源总览（KpiRow）
- 异构资源池拓扑（节点矩阵）
- 批处理与缓存看板（双图联动）
- 优先级队列与任务视图
- 热区分析与容量趋势

#### 6.4.3 资源字段（ComputeResource 对象，见 7.2）

| 字段 | 必填 | 说明 |
|---|---|---|
| `resourceId` | ✓ | 全局唯一 |
| `resourceType` | ✓ | `GPU/CPU/NPU/RENTAL` |
| `vendor` / `architecture` / `cluster` / `node` / `pool` | ✓ | 拓扑定位 |
| `status` | ✓ | 枚举见 7.2（8 态） |
| `vramTotal` / `vramUsed` / `utilization` | ✓ | 利用率口径见 8.1 |
| `instanceCount` / `queueDepth` | ✓ | 实例数与排队深度 |
| `costTag` | ✓ | `LOCAL/RENTAL`，用于本地/外部占比 |

实例字段（Instance 对象，见 7.5）：`instanceId / assetId / engineType(vLLM|SGLang|OTHER) / deployMode(独占|共享|混部) / quantizationType / batchConfig / kvCacheEnabled / ttftMs / avgLatencyMs(P95) / tokensPerSec`

#### 6.4.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 查看资源池 | 全部 | 拓扑按 pool 分组 |
| 按模型查看部署实例 | 全部 | 以 assetId 过滤实例 |
| 查看实例批处理参数 | OPERATOR | Drawer 展示 batchConfig |
| 查看缓存命中率与节约卡时 | 全部 | 命中率口径见 8.1 |
| 查看高低优先级队列 | OPERATOR | 队列分层视图 |
| 查看节点热区与错峰建议 | OPERATOR | 热区表 + 建议卡片 |

#### 6.4.5 交互逻辑
- 拓扑图点击节点 → 右侧 Drawer 展示该节点承载实例 + 当前告警
- 批处理与 TTFT 双图联动：x 轴同一时间窗，说明"吞吐提升是否牺牲首字时延"
- 缓存命中率支持按租户 / 模型 / 应用切换
- 高优先级业务被挤压时，面板上方弹出黄色横幅："高优先级队列等待超阈值"

#### 6.4.6 异常状态
- 节点故障：拓扑节点红色 + 呼吸动画 + 告警列表置顶
- 实例异常：该实例行标红，提供"查看最近 Trace"跳转

#### 6.4.7 组件拆分
`ResourceKpiRow` + `PoolTopology` + `BatchCachePanel`(双图) + `PriorityQueueView` + `HeatmapPanel` + `CapacityTrend` + `InstanceDrawer`

---

### 6.5 计量运营中心

#### 6.5.1 页面目标
把请求、Token、卡时、成本转化为可归属、可考核、可审计的经营指标。

#### 6.5.2 页面结构
- 指标总览（KpiRow：Token 输入/输出/命中、卡时、调用量、TCO）
- 部门/业务线排行（可下钻）
- TCO 分摊分析（旭日图）
- 账单流水（DataTable，虚拟滚动）
- 成本优化建议（卡片列表）

#### 6.5.3 计量字段（MeteringRecord 对象，见 7.6）

| 字段 | 必填 | 说明 |
|---|---|---|
| `billId` / `traceId` | ✓ | 流水唯一标识，可反查 Trace |
| `tenantId` / `deptId` / `appId` | ✓ | 归属维度 |
| `assetId` / `modelVersion` | ✓ | 模型维度 |
| `requestCount` | ✓ | 调用次数 |
| `promptTokens` / `completionTokens` / `cacheHitTokens` | ✓ | Token 三维 |
| `retryTokens` / `failureTokens` | ✓ | 失败与重试单独计量（8.1 口径） |
| `retryCount` / `failureCount` | ✓ | 次数 |
| `gpuHours` / `instanceHours` / `queueWaitMs` | ✓ | 算力时长（卡时口径见 8.1） |
| `costInfra` / `costCompute` / `costLicense` / `costExternal` | ✓ | 成本拆分四类 |
| `tcoTotal` | ✓ | = 四类之和 |
| `success` | ✓ | 是否计入成功口径 |
| `retryTokensIncluded` | ✓ | "失败重试是否计入成本"开关落库标记 |

#### 6.5.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 按部门/应用/模型筛选 | 全部 | 联动排行与流水 |
| 查看账单明细 | 全部（按租户） | 流水 Drawer，可跳 Trace |
| 导出日报/月报 | ADMIN / OPERATOR | 导出前展示字段范围+脱敏说明（见 10.2） |
| 查看高消耗应用 | 全部 | 排行表下钻 |
| 查看高增长趋势 | 全部 | 趋势图下钻 |
| 查看优化建议依据 | OPERATOR | 建议卡片 → 依据 Drawer（数据+口径） |
| 采纳成本优化建议 | OPERATOR | 生成工单 → 流转到统一控制面（见 9.5 闭环） |

#### 6.5.5 交互逻辑
- 排行榜点击后必须下钻到账单流水（同租户/同应用过滤）
- TCO 图表悬停显示成本口径拆分（四类成本数值）
- 失败/重试提供开关"是否计入成本"，默认不计入；切换后 TCO 与排行即时重算，并记录口径变更审计
- 自建与租赁资源统一口径对比显示，同时保留 `costTag` 来源标签

#### 6.5.6 异常状态
- 流水加载慢：分页 + 骨架屏；超 500 行启用虚拟滚动
- 口径变更未结算：黄色横幅"计量口径待校准"

#### 6.5.7 组件拆分
`MeterKpiRow` + `DeptRankTable` + `TcoSunburst` + `BillingTable`(虚拟滚动) + `OptimizeAdviceList` + `BillDetailDrawer` + `ExportDialog`

---

### 6.6 模型资产中心

#### 6.6.1 页面目标
实现模型从登记、准入、灰度、运行、回滚到下线的全生命周期治理。

#### 6.6.2 页面结构
- 模型台账列表（DataTable，多维筛选）
- 模型画像详情（画像卡片 + 运行数据回流）
- 血缘关系图（DAG）
- 评测与准入（评测任务 + 结果）
- 灰度/A/B 控制台（切流滑块 + 指标对比）
- 下线与归档（依赖检查 + 归档流程）

#### 6.6.3 资产字段（ModelAsset 对象，见 7.7）

| 字段 | 必填 | 说明 |
|---|---|---|
| `assetId` / `assetCode` / `assetName` | ✓ | 唯一标识 |
| `assetType` | ✓ | `BASE_LLM/SMALL_LLM/MULTIMODAL/OCR/VOICE/EXTERNAL` |
| `sourceType` | ✓ | `OPEN_SOURCE/PROPRIETARY/THIRD_PARTY` |
| `baseModelId` / `derivationType` | ✓ | 血缘：`SFT/DISTILLATION/QUANTIZATION/NONE` |
| `ownerDept` / `maintainer` | ✓ | 责任主体 |
| `riskLevel` | ✓ | `A(战略)/B(核心)/C(通用)/D(候选下线)` |
| `securityLevel` | ✓ | `L1-L4` |
| `version` / `lifecycleStatus` | ✓ | 生命周期枚举见 7.7 |
| `supportedTasks` / `supportedHardware` / `contextWindow` | ✓ | 能力画像 |
| `costPer1kTokens` / `avgLatencyMs` / `successRate` / `activeApps` | ✓ | 运行画像（自动回流） |

评测字段（EvalResult 对象，见 7.8）：`evalId / evalType / evalDataset / accuracy / hallucinationRate / complianceRate / toolCallSuccessRate / longContextScore / costScore / reviewConclusion`

#### 6.6.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 新增资产登记 | MODEL_OWNER | 表单，必填血缘字段 |
| 查看血缘 | 全部 | DAG 双向追溯 |
| 提交准入评测 | MODEL_OWNER | 创建评测任务，状态流转见 9.4 |
| 发起灰度 | MODEL_OWNER（需审批） | 进入灰度控制台 |
| 发起 A/B | MODEL_OWNER（需审批） | 并行观测 |
| 执行快速回滚 | MODEL_OWNER | 输入资产名确认，见 9.4 |
| 发起下线检查 | MODEL_OWNER | 弹出依赖检查对话框（见 6.6.6） |
| 停止新增接入 | MODEL_OWNER | 仅在下线检查通过后可用 |
| 迁移流量 | MODEL_OWNER | 指定目标资产，逐步切流 |
| 保留回滚窗口 / 执行归档 | MODEL_OWNER | 归档后资产只读 |

#### 6.6.5 交互逻辑
- 列表页支持按来源、用途、风险等级、生命周期筛选
- 画像页运行/成本数据自动回流展示，禁止静态画像（数据来自 7.7 聚合查询）
- 血缘图支持从基础模型正向追到量化版，也支持反向回溯
- 灰度页必须展示：灰度范围（用户群/应用/部门/比例）、流量比例、生效时间、观察指标、回滚阈值
- **灰度参数（grayRule/abTestRule）修改 = 修改模型策略**，保存时提示"该变更将写入统一控制面模型策略并走审批"

#### 6.6.6 下线依赖检查（强制）
发起下线时弹出对话框，**未通过不允许下线**，列表项为：

- 受影响应用数（引用该 assetId 的 ApplicationRegistry）
- 受影响实例数（引用该 assetId 的 Instance）
- 受影响策略数（rules 引用该 assetId 的 Policy）
- 账单引用数（最近 30d 引用该 assetId 的 MeteringRecord）

#### 6.6.7 异常状态
- 血缘断裂（baseModelId 不存在）：黄色警示"父模型已下线或归档"
- 评测未完成发起灰度：操作禁用 + tooltip 原因

#### 6.6.8 组件拆分
`AssetTable` + `AssetDetailPanel`(画像) + `LineageGraph` + `EvalTaskPanel` + `RolloutConsole`(滑块+PK 图) + `RollbackConfirm` + `OfflineCheckDialog` + `ArchiveFlow`

---

### 6.7 安全运行中心

#### 6.7.1 页面目标
围绕权限隔离、输入输出安全、全链路审计和合规导出形成闭环。

#### 6.7.2 页面结构
- 安全态势总览（拦截统计、事件等级分布）
- 多租户/RBAC 权限矩阵
- 安全护栏拦截面板（实时列表）
- Trace 查询时间线
- 审计导出

#### 6.7.3 安全字段（SecurityEvent 对象，见 7.9）

| 字段 | 必填 | 说明 |
|---|---|---|
| `securityEventId` / `traceId` | ✓ | 事件定位 |
| `tenantId` / `userId` / `appId` / `assetId` | ✓ | 主体 |
| `eventType` | ✓ | `PROMPT_INJECTION/VIOLATION/MASKING/UNAUTHORIZED/ABNORMAL` |
| `eventLevel` | ✓ | `INFO/WARN/ERROR/CRITICAL` |
| `guardrailStage` | ✓ | `INPUT/OUTPUT/TOOL/KNOWLEDGE` |
| `ruleId` / `ruleName` | ✓ | 命中规则 |
| `masked` / `blocked` | ✓ | 脱敏/阻断标记 |
| `reasonCode` / `reasonText` | ✓ | 原因 |
| `logStorageType` | ✓ | `FULL/MASKED/HASH_ONLY` |
| `hashSignature` | ✓ | 防篡改签名 |

#### 6.7.4 核心操作（含权限）

| 操作 | 权限 | 行为 |
|---|---|---|
| 按 TraceID 检索 | AUDITOR / OPERATOR | 打开时间线 |
| 按用户/应用/部门检索 | AUDITOR | 事件列表筛选 |
| 查看完整调用链 | AUDITOR / OPERATOR | Timeline 全阶段 |
| 查看拦截原因 | AUDITOR | 详情 Drawer |
| 导出审计包 | AUDITOR | 导出前置展示（见 10.2） |
| 查看租户权限矩阵 | AUDITOR | 矩阵视图 |
| 查看越权告警 | AUDITOR | 告警列表 |

#### 6.7.5 交互逻辑
- 检索结果默认摘要模式，敏感内容（`logStorageType=MASKED/HASH_ONLY`）需按权限解锁，解锁操作留痕
- 时间线必须展示每个阶段耗时与执行结果（与 6.3 单请求视图共用 Timeline 组件）
- 日志被脱敏时，同时显示脱敏策略编号（对应 Policy 安全策略 `outputMaskRule`）
- 审计导出需展示：导出范围、字段清单、脱敏说明、签名校验值（导出的 zip 内附 manifest）

#### 6.7.6 异常状态
- 事件仅存哈希（`HASH_ONLY`）：内容区显示"仅存哈希，不可查看原文"
- 签名校验失败：红色警示"该日志签名校验失败，疑似被篡改"

#### 6.7.7 组件拆分
`SecurityOverview` + `TenantMatrix` + `GuardrailLiveList` + `TraceTimeline` + `EventDetailDrawer` + `AuditExportDialog` + `RiskAlertList`

---

### 6.8 增量面板速查（V3，实际项目已落地）

| 增量面板 | 挂载位置 | 核心内容 | 对应章节 |
|---|---|---|---|
| 运维大盘 | `/`（`?view=ops`） | 集群在线/并发/TTFT/KV 命中 4 KPI + 实例矩阵 + 集群健康与熔断 + 热区表 + 批处理吞吐↔TTFT 联动 | 九章 |
| 路由引擎配置中心 | `/routing` 路由总览顶部 | 六段流水线可视化 + 四维评分权重滑杆（自动归一）+ 5 策略开关 + 保存下发留痕 | 七章 |
| 异构算力资源矩阵 | `/routing` 算力总览 | 6 厂商卡（英伟达 H20/L20/4090D、华为昇腾 910B、沐曦 C500、Intel）+ 国产化占比 + 适配状态 | 13.4 |
| 异构调度策略 | `/routing` 资源编排顶部 | 国产化优先/跨厂商迁移/租赁削峰 + 厂商调度优先级 | 13.4 |
| 成本模型配置 | `/metering` 成本模型 tab | 四类成本权重 + 折旧年限 + 租赁折算 + 分摊基准 + 今日 TCO 拆分预览（与驾驶舱明细联动） | 九章 |
| 模型效益评估 | `/assets` 效益评估 tab | 月度效益矩阵：单位任务成本/活跃应用/采纳率/价值分/治理建议（保留/优化/替换/归档） | 十章 |
| 租户组织映射管理 | `/security` 租户管理 tab | 租户→组织条线映射 + 数据边界 L2/L3 + 模型范围 + 配额归属 + 启停留痕 | 十一章 |
| 模型体验 Playground | `/assets` 模型体验 tab | 先体验后接入，单/双模型对比，流式输出，试算通道不计部门结算 | 七章 |
| 我的工作台 | `/workbench` | 业务员自助门户 + 申请人进度中心 + 个人用量 | 五角色视角 |

> 增量对象字段见 7.12；写操作均经 `api.ts` 留痕（`recordOp`）。

---

## 7. 核心对象与字段字典（统一数据模型）

> 全平台唯一字段来源。前端开发以本字典为准，禁止页面内另造字段。
> 所有枚举值均为字符串字面量；金额单位为人民币元；时延单位为毫秒（ms）；Token 为整数。

### 7.1 Policy（策略）

```typescript
type PolicyType = 'ROUTING' | 'COMPUTE' | 'MODEL' | 'SECURITY' | 'METERING';
type PolicyStatus =
  | 'DRAFT'            // 草稿
  | 'PENDING_APPROVAL' // 待审批
  | 'GRAY'             // 灰度中
  | 'ACTIVE'           // 生效
  | 'ROLLBACK'         // 回滚中
  | 'INACTIVE'         // 停用
  | 'ARCHIVED';        // 归档

interface Policy {
  policyId: string;
  policyType: PolicyType;
  policyName: string;
  scopeType: 'DEPT' | 'APP' | 'MODEL' | 'TENANT' | 'GLOBAL';
  scopeValue: string;
  priority: number;            // 数值大者优先
  status: PolicyStatus;
  effectiveTime: string;       // ISO 8601
  expireTime: string;
  version: number;
  createdBy: string;
  approvedBy: string;
  lastPublishedAt: string;
  rollbackVersion: number;
  rules: Record<string, unknown>; // 各类型规则字段见 6.2.3
}
```

### 7.2 ComputeResource（算力资源，8 态）

```typescript
type ResourceStatus =
  | 'IDLE'      // 空闲
  | 'RUNNING'   // 运行中
  | 'HOT'       // 高负载
  | 'QUEUED'    // 排队拥堵
  | 'DEGRADED'  // 降级运行
  | 'INSTANCE_FAULT' // 实例异常
  | 'NODE_FAULT'     // 节点故障
  | 'MAINTENANCE';   // 隔离维护

interface ComputeResource {
  resourceId: string;
  resourceType: 'GPU' | 'CPU' | 'NPU' | 'RENTAL';
  vendor: string;
  architecture: string;
  cluster: string;
  node: string;
  pool: string;
  status: ResourceStatus;
  vramTotal: number;   // GB
  vramUsed: number;    // GB
  utilization: number; // 0-100，口径见 8.1
  instanceCount: number;
  queueDepth: number;
  costTag: 'LOCAL' | 'RENTAL';
}
```

### 7.3 RouterLog（请求日志）

```typescript
type RequestMode = 'SYNC' | 'ASYNC' | 'STREAM';

interface RouterLog {
  traceId: string;
  requestId: string;
  appId: string;
  tenantId: string;
  userId: string;
  businessScenario: string; // 客户服务/运营处理/信贷分析/营销辅助/研发编码/其他
  taskType: string;         // 分类/抽取/问答/摘要/生成/推理/工具规划
  dataLevel: 'L1' | 'L2' | 'L3' | 'L4';
  requestMode: RequestMode;
  promptTokens: number;
  expectedOutputTokens: number;
  contextLength: number;
  slaLevel: 'P0' | 'P1' | 'P2' | 'P3';
  budgetClass: string;
  decision: RoutingDecision; // 见 7.4
  status: 'SUCCESS' | 'BLOCKED' | 'DEGRADED' | 'FAILED';
  totalDurationMs: number;
  createdAt: string;
}
```

### 7.4 RoutingDecision（路由决策）

```typescript
interface CandidateModel {
  assetId: string;
  version: string;
  score: number | null; // 综合分（引擎无定义时为 null，前端只展示四维分），口径见 8.2
  eliminateReason: string; // 淘汰原因（必填，未淘汰则为空）
}

interface RoutingDecision {
  candidateModels: CandidateModel[]; // 必须含淘汰原因，不允许只存最终结果
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
```

### 7.5 Instance（推理实例）

```typescript
interface Instance {
  instanceId: string;
  assetId: string;
  engineType: 'VLLM' | 'SGLANG' | 'OTHER';
  deployMode: 'DEDICATED' | 'SHARED' | 'MIXED'; // 独占/共享/混部
  quantizationType: 'FP16' | 'INT8' | 'INT4' | 'NONE';
  batchConfig: { maxBatch: number; maxLatencyMs: number };
  kvCacheEnabled: boolean;
  ttftMs: number;       // 采样窗口内 P50
  avgLatencyMs: number; // 采样窗口内 P95
  tokensPerSec: number;
  cacheHitRate: number; // 0-100，口径见 8.1
}
```

### 7.6 MeteringRecord（计量流水）

```typescript
interface MeteringRecord {
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
  gpuHours: number;      // 卡时口径见 8.1
  instanceHours: number;
  queueWaitMs: number;
  costInfra: number;     // 硬件折旧/机房/电力/制冷/网络/存储
  costCompute: number;   // 推理计算
  costLicense: number;   // 软件许可/平台
  costExternal: number;  // 外部租赁
  tcoTotal: number;      // = costInfra+costCompute+costLicense+costExternal
  success: boolean;      // 是否计入成功口径
  retryTokensIncluded: boolean; // "失败重试是否计入成本"开关的落库标记
}
```

### 7.7 ModelAsset（模型资产）

```typescript
type LifecycleStatus =
  | 'DRAFT'       // 登记
  | 'TESTING'     // 测试
  | 'GRAY'        // 灰度
  | 'PRODUCTION'  // 生产
  | 'ROLLBACK'    // 回滚
  | 'OFFLINE'     // 下线中
  | 'ARCHIVED';   // 归档（只读）

type AssetType = 'BASE_LLM' | 'SMALL_LLM' | 'MULTIMODAL' | 'OCR' | 'VOICE' | 'EXTERNAL';
type DerivationType = 'SFT' | 'DISTILLATION' | 'QUANTIZATION' | 'NONE';

interface ModelAsset {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  sourceType: 'OPEN_SOURCE' | 'PROPRIETARY' | 'THIRD_PARTY';
  baseModelId: string | null; // 血缘
  derivationType: DerivationType;
  ownerDept: string;
  maintainer: string;
  riskLevel: 'A' | 'B' | 'C' | 'D';
  securityLevel: 'L1' | 'L2' | 'L3' | 'L4';
  version: string;
  lifecycleStatus: LifecycleStatus;
  supportedTasks: string[];
  supportedHardware: string[];
  contextWindow: number;
  costPer1kTokens: number; // 元
  avgLatencyMs: number;    // P95
  successRate: number;     // 0-100
  activeApps: number;
}
```

### 7.8 EvalResult（评测结果）

```typescript
interface EvalResult {
  evalId: string;
  assetId: string;
  evalType: 'ADMISSION' | 'A_B' | 'PERIODIC'; // 准入/A-B/周期性
  evalDataset: string;
  accuracy: number;
  hallucinationRate: number;
  complianceRate: number;
  toolCallSuccessRate: number;
  longContextScore: number;
  costScore: number;
  reviewConclusion: 'PASS' | 'FAIL' | 'PENDING';
  reviewedBy: string;
  reviewedAt: string;
}
```

### 7.9 SecurityEvent（安全事件）

```typescript
type SecurityEventType =
  | 'PROMPT_INJECTION' // 提示注入
  | 'VIOLATION'        // 违规内容
  | 'MASKING'          // 敏感数据脱敏
  | 'UNAUTHORIZED'     // 越权
  | 'ABNORMAL';        // 异常行为

interface SecurityEvent {
  securityEventId: string;
  traceId: string;
  tenantId: string;
  userId: string;
  appId: string;
  assetId: string;
  eventType: SecurityEventType;
  eventLevel: Severity; // 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  guardrailStage: 'INPUT' | 'OUTPUT' | 'TOOL' | 'KNOWLEDGE';
  ruleId: string;
  ruleName: string;
  masked: boolean;
  blocked: boolean;
  reasonCode: string;
  reasonText: string;
  logStorageType: 'FULL' | 'MASKED' | 'HASH_ONLY';
  hashSignature: string;
  createdAt: string;
}
```

### 7.10 ApplicationRegistry（应用注册）

```typescript
interface ApplicationRegistry {
  appId: string;
  appName: string;
  deptId: string;
  owner: string;
  businessScenario: string;
  dataLevel: 'L1' | 'L2' | 'L3' | 'L4';
  slaLevel: 'P0' | 'P1' | 'P2' | 'P3';
  quotaToken: number;
  quotaRequest: number;
  costBudget: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'OFFLINE';
}
```

### 7.11 字段通用要求

- 所有主对象必须有稳定唯一 ID
- 状态字段必须枚举化，不接受自由文本
- 金额统一人民币元；时延统一毫秒；Token 为整数
- Token 必须区分输入、输出、缓存命中、重试、失败
- 所有日志对象必须附带 `hashSignature` 或摘要信息

### 7.12 增量对象模型（V3，实际项目已落地）

```typescript
/** 多约束路由引擎配置（智能调度网关核心：权重/开关可配置） */
interface RoutingEngineConfig {
  weights: { latency: number; cost: number; risk: number; load: number }; // 四维评分权重（自动归一）
  cacheFirst: boolean;      // 缓存优先
  budgetGuard: boolean;     // 成本预算约束
  slaPriority: boolean;     // SLA 优先（P0/P1 预留）
  autoFallback: boolean;    // 自动降级
  openaiCompat: boolean;    // OpenAI 兼容入口
}

/** 异构算力厂商资源（13.4：英伟达/华为/沐曦/Intel 统一纳管） */
type ChipKind = 'GPU' | 'NPU' | 'CPU';
type CompatStatus = 'COMPATIBLE' | 'ADAPTING' | 'PLANNED';
interface HeteroVendor {
  vendorId: string; vendor: string; chip: string; kind: ChipKind;
  domestic: boolean; count: number; vramPerCard: number; utilization: number;
  hostedModels: number; compatStatus: CompatStatus;
  costTag: 'LOW' | 'MID' | 'HIGH'; pools: string[];
}
interface HeteroSchedPolicy {
  domesticFirst: boolean;     // 国产化优先
  crossVendorFailover: boolean; // 跨厂商故障迁移
  rentalPeak: boolean;        // 峰值租赁削峰
  vendorPriority: string[];   // 厂商调度优先级
}

/** TCO 成本模型配置（九章：可配置，不固化单一分摊方式） */
type CostKind = 'infra' | 'compute' | 'license' | 'external';
type CostAllocateBy = 'TOKEN' | 'CARD_HOUR' | 'CALLS';
interface CostModelConfig {
  weights: Record<CostKind, number>; // 四类成本权重（自动归一 100%）
  depreciationYears: number;  // 硬件折旧年限（3/5）
  rentalFactor: number;       // 外部租赁折算系数（自建=1.0）
  allocateBy: CostAllocateBy; // 部门分摊基准
  updatedAt: string;
}

/** 模型效益评估（十章） */
type BenefitSuggestion = 'KEEP' | 'OPTIMIZE' | 'REPLACE' | 'ARCHIVE';
interface ModelBenefit {
  assetId: string; activeApps: number; userScale: number;
  monthCost: number; unitCost: number; // 元/千次
  adoptRate: number; successRate: number;
  valueScore: 'A' | 'B' | 'C' | 'D'; suggestion: BenefitSuggestion;
}

/** 租户与组织映射（十一章） */
interface TenantOrg {
  tenantId: string; tenantName: string; mappedDepts: string[];
  dataBoundary: 'L2' | 'L3'; modelScope: 'DEPT' | 'GLOBAL';
  quotaShared: boolean; memberCount: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

/** KV 缓存治理（八章：金融数据敏感约束） */
interface KvCacheGovernance {
  tenantIsolation: boolean; forbidSensitive: boolean; // 租户隔离/敏感禁存
  ttlMin: number; auditEnabled: boolean;
  hitTokens24h: number; savedCostPct: number;
}

/** 推理引擎版本（13.3：vLLM/SGLang 灰度升级） */
interface EngineVersionInfo {
  engineId: string; engine: 'VLLM' | 'SGLANG'; version: string; latestVersion: string;
  instances: number; upgradeStatus: 'UP_TO_DATE' | 'UPGRADE_AVAILABLE' | 'GRAY_VERIFY';
  releaseNote: string; riskNote: string;
}

/** 批量推理任务（错峰排队） */
type BatchTaskStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'CANCELLED';
interface BatchTask {
  taskId: string; name: string; deptId: string; assetId: string;
  priority: 'P2' | 'P3'; window: string; rows: number;
  status: BatchTaskStatus; submitAt: string;
}

/** 我的申请单（申请人视角） */
type MyApplyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface MyApplication {
  applyId: string; kind: 'MODEL_ACCESS' | 'QUOTA_ADJUST' | 'QUOTA_RESUME' | 'API_KEY';
  title: string; reason: string; status: MyApplyStatus;
  submitAt: string; approveAt: string | null; opinion: string;
}

/** 调用质量告警规则 / 平台成员 / 公告 / 月度账单（二轮完善） */
type AlertMetric = 'P95' | 'ERROR_RATE' | 'QUEUE' | 'CALL_SPIKE';
interface QualityAlertRule {
  ruleId: string; name: string; metric: AlertMetric; threshold: number;
  unit: string; enabled: boolean; channels: ('SITE' | 'MAIL' | 'SMS')[]; hits24h: number;
}
type PlatformRole = 'ADMIN' | 'OPERATOR' | 'MODEL_OWNER' | 'AUDITOR' | 'BIZ_VIEWER';
interface MemberInfo {
  memberId: string; name: string; deptId: string; role: PlatformRole;
  status: 'ACTIVE' | 'DISABLED'; lastLoginAt: string;
}
type AnnouncementType = 'MAINTENANCE' | 'BROADCAST' | 'NOTICE';
interface Announcement {
  annId: string; type: AnnouncementType; title: string; content: string;
  createdAt: string; pinned: boolean;
}
interface MonthlyBill {
  month: string; deptId: string; deptName: string;
  tokens: number; calls: number; cost: number; mom: number; // 环比 %
}
```

> 以上对象全部位于 `src/types/index.ts`；可变数据在 `src/services/dataConfig.ts`，读写统一经 `src/services/api.ts`（写操作返回 `OperationRecord` 并留痕）。

---

## 8. 指标口径与数据来源规范

> 本章用于保证所有页面数字"能解释、可复核"。前端展示必须可 hover 查看口径说明（文案见下）。

### 8.1 关键指标口径

| 指标 | 口径定义 | 前端口径文案 |
|---|---|---|
| `avgLatencyMs` | 采样窗口（默认 5min）内 **P95** 值（关注长尾） | "最近 5 分钟 P95 响应时延" |
| `ttftMs` | 采样窗口（默认 5min）内 **P50** 值（首 Token 典型体验） | "最近 5 分钟 P50 首 Token 时延" |
| `utilization`（GPU） | 时间加权利用率 = 计算活跃时间 / 采样窗口，非显存占比 | "计算时间利用率（非显存占用）" |
| `cacheHitRate` | Token 级命中率 = 缓存命中 Token 数 / 总输入 Token 数 | "Token 级缓存命中率" |
| `gpuHours` | 卡时 = GPU 卡数 × 实际计算时长（h），利用率加权前原始值 | "卡时 = GPU 卡数 × 计算时长" |
| `retryTokens` / `failureTokens` | 重试/失败请求产生的 Token，独立于成功口径 | "失败与重试单独计量" |
| `tcoTotal` | 四类成本之和；"是否计入失败重试"由开关控制，落库 `retryTokensIncluded` | "含/不含失败重试成本" |
| `scoreLatency/scoreCost/scoreRisk/scoreLoad` | 路由引擎输出 0-100 分，仅展示与下钻，不解释算法细节 | "评分来自路由引擎，点击查看明细" |
| 本地/外部算力占比 | 按 `costTag` 分组的卡时占比 | "按 costTag 统计的卡时占比" |

### 8.2 路由评分展示规则

- 前端只展示 `RoutingDecision` 已落库的评分与淘汰原因，**不在前端计算评分**
- 候选模型比较表列：`assetId / version / scoreLatency / scoreCost / scoreRisk / scoreLoad / score(综合) / eliminateReason`
- 综合分无定义时，展示四维分数雷达图 + `routeReason` 文本，不展示虚构的综合分

### 8.3 数据来源与时效（前端数据说明）

| 数据域 | 来源 | 聚合链路 | 时效 | 页面轮询 |
|---|---|---|---|---|
| 请求/路由 | 网关日志、SDK 埋点 | Kafka → Flink → ClickHouse | 分钟级（近实时） | 实时档 10s / 其余 60s |
| 算力资源 | vLLM/SGLang metrics + 节点 exporter | Prometheus → 聚合服务 | 秒级~分钟级 | 30s |
| 计量账单 | 计量服务落库 | Flink 实时 + 离线日结 | 实时 + T+1 对账 | 60s |
| 模型资产 | 资产中心 DB + 运行画像回流 | 应用服务聚合 | 秒级 | 60s |
| 安全事件 | 护栏服务落库 | 事件流 + 离线归档 | 分钟级 | 30s |

- 页面顶部 KPI 必须标注数据时延徽标：`近实时(≤5min)` / `日结(T+1)`
- "实时"档位仅代表前端 10s 轮询，不代表数据本身实时（避免误导）

### 8.4 全行量级数据基线（V3 数据真实化，近 24h）

| 指标 | 值 | 口径自洽验证 |
|---|---|---|
| 全行请求量 | 366 万次/日 | 入站→识别→限流拦截 486→派发成功全链路一致 |
| 输入 / 输出 Token | 3.94 亿 / 1.38 亿 | 缓存命中 2.12 亿（命中率 54%） |
| GPU 卡时 | 7,860 GPU·h | 与 142 节点、72% 利用率呼应 |
| 日 TCO | ¥684,000 | 6 部门合计 18.6+15.8+10.8+8.6+7.2+7.4 万 = 68.4 万 |
| QPS / TTFT P50 / P95 | 86 / 210ms / 690ms | 366 万次/日 推算量级 |
| 纳管节点 / 资源池 | 142 / 8 | 模型 128（生产 46）/ 应用 10 |
| 语义路由节省 | ¥274 万（-42.7%） | 全量旗舰口径 ¥642 万 |
| 月度账单（2026-07） | 六部门合计 ¥1,926 万 | = 日 TCO × 28 天量级 |
| 配额基线 | 36/30/20/15/12/9 亿（六部门） | 零售预警 89%、风险超限停发审批中 |

> 组织命名贴近宁波银行条线（信息科技/零售银行/公司银行/风险管理/运营管理/金融市场）；调用日志内容池为真实业务问答（贷前尽调/反欺诈研判/合同抽取等）；全平台无「模拟/演示」出戏文案。

---

## 9. 关键操作流与闭环链路

> 本章定义跨页面闭环。前端必须为每个闭环提供入口与状态展示，不允许出现"只能看不能办"。

### 9.1 请求调度链路（展示型闭环）

1. 应用发起请求 → 2. 网关识别场景/任务/数据等级 → 3. 控制面策略匹配 → 4. 路由评分 → 5. 选择主模型与实例 → 6. 推理 → 7. 计量记录 → 8. 画像回流 → 9. 审计固化

前端要求：
- 以 Timeline 回放，每步显示"输入条件、执行结果、耗时、责任对象"
- 任一步失败必须高亮，并提供跳转到相关页（计量/资产/安全）的入口
- 入口：6.3 单请求详情；全局搜索 TraceID

### 9.2 熔断与降级闭环（执行型闭环）

触发（策略判定）→ 展示（页面高亮+横幅）→ 处置（切换/限流/转异步）→ 恢复（半开探测/人工解除）→ 留痕（熔断记录查询）→ 复盘（操作回执）

降级边界表（前端展示降级类型时使用）：

| 降级类型 | 适用 requestMode | 前端展示要求 |
|---|---|---|
| 切换备用模型 | SYNC/ASYNC/STREAM | 展示备用模型 assetId |
| 切换小模型 | 全部 | 展示替代模型 |
| 截断上下文 | 全部 | 展示截断后长度 |
| 降低并发 | 全部 | 展示并发阈值 |
| 转异步 | SYNC 可转；ASYNC/STREAM 不可转 | 不可转时禁用该选项 |
| 转人工 | 全部 | 生成人工工单号 |

熔断状态展示：
- `OPEN`（熔断中，红色）+ `HALF_OPEN`（半开探测，黄色）+ `CLOSED`（已恢复，正常色）
- 熔断记录可查询：触发时间、原因、维度（QPS/Token/成本/并发）、恢复方式（自动/人工）
- 前端操作：`一键熔断`（全局紧急操作，ADMIN，输入确认词）→ 熔断后提供"解除熔断"入口（仅 ADMIN）

### 9.3 策略发布与回滚闭环（执行型闭环）

编辑（DRAFT）→ 审批（PENDING_APPROVAL）→ 灰度（GRAY）→ 全量（ACTIVE）→ 变更/回滚（ROLLBACK）→ 停用/归档

- 回滚必须：输入策略名确认 → 展示影响面 → 回滚 → 生成操作回执（traceable receipt）
- 策略冲突未解决时禁止发布（前端红条阻止）

### 9.4 模型准入-灰度-回滚闭环（执行型闭环）

登记（DRAFT）→ 评测（TESTING，EvalResult）→ 审批通过 → 灰度（GRAY）→ A/B 观察 → 放量/回滚 → 生产（PRODUCTION）

- 每个阶段必须有状态与责任人（modelVersion 变更记录）
- 每次放量记录流量比例变化（灰度历史 Timeline）
- 触发回滚：自动生成回滚原因与影响摘要；回滚后进入 `ROLLBACK` 状态，支持重新评测后再次发布

### 9.5 成本优化建议闭环（执行型闭环）

识别（高消耗/低产出识别）→ 建议（卡片+依据）→ 采纳（生成工单）→ 执行（跳转统一控制面修改策略/路由）→ 验证（30d 后效果对比）→ 关闭

- 前端入口：6.5 优化建议卡片 → "采纳"生成工单 → 跳转 6.2 策略页
- 建议卡片必须显示"依据"（数据截图口径），禁止无依据建议

### 9.6 告警处置闭环（执行型闭环）

发现（告警列表/横幅）→ 确认（认领人）→ 处置（跳转对应页面操作）→ 关闭（结论）→ 复盘（记录归档）

- 前端入口：6.1 今日异常数 → 6.7 风险告警列表 → 告警详情 Drawer（含 TraceID 跳转）
- 告警必须有状态：`OPEN / ACKNOWLEDGED / RESOLVING / CLOSED`
- 越权告警处置必须留痕（谁、何时、结论）

### 9.7 配额预警处置闭环（执行型闭环）

预警（warnThreshold 触发，黄色横幅）→ 处置（限流/调整配额/联系负责人）→ 恢复（回落至阈值下）→ 关闭

- 横幅显示：租户/应用、当前用量/配额、剩余时间预估
- 提供"查看配额策略"跳转（6.2 运营策略）

---

## 10. 页面状态与反馈规范

### 10.1 通用状态

`loading` / `refreshing` / `empty` / `partial_error` / `error` / `read_only` / `no_permission`

### 10.2 反馈要求

- 高风险操作（回滚、熔断、归档、策略发布）使用 ConfirmDialog，必须输入操作对象名才能确认
- 长时任务（评测、导出、归档）使用 ProgressTask 进度条，禁止单一 loading
- 导出类操作提示"字段范围、脱敏范围、导出目的"
- 灰度、回滚、熔断、策略发布完成后，顶部显示可追溯操作回执（含操作人/时间/对象/结果 hash）
- **禁止仅用颜色表达状态**：状态必须图文同现（StatusTag）
- 错误提示必须含"原因 + 恢复路径"（如："该 TraceID 不在可观测期内，请扩大时间范围后重试"）

### 10.3 告警状态枚举（前端通用）

`OPEN`（红）→ `ACKNOWLEDGED`（黄）→ `RESOLVING`（黄）→ `CLOSED`（灰）

### 10.4 熔断状态枚举（前端通用）

`CLOSED`（正常绿）→ `OPEN`（熔断红）→ `HALF_OPEN`（半开黄）

---

## 11. 通用组件清单

> 全部组件基于第 5 章视觉规格与 5.5 组件规格实现，全局唯一，禁止页面内复制样式。
> 页面专属组件（如 `UtilizationPanel`、`TcoSunburst` 等）见各页 6.x.7 组件拆分；仅通用组件进入本章清单。

| 组件 | 页面使用方 |
|---|---|
| `KpiRow` / `KpiCard` | 6.1 / 6.4 / 6.5 |
| `ResourceTopology` | 6.1 / 6.4 |
| `RoutingFunnel` | 6.3 |
| `RationalePanel`（Timeline+决策树） | 6.3 / 6.7 共用 Timeline 内核 |
| `CandidateCompareTable` | 6.3 |
| `PriorityQueueView` | 6.4 |
| `TcoSunburst` | 6.5 |
| `BillingTable`（虚拟滚动） | 6.5 |
| `LineageGraph` | 6.6 |
| `RolloutConsole` | 6.6 |
| `OfflineCheckDialog` | 6.6 |
| `TenantMatrix` | 6.7 |
| `TraceTimeline` | 6.7 |
| `AuditExportDialog` | 6.7 |
| `ConfirmDialog` / `ProgressTask` / `Banner` / `StatusTag` | 全局 |
| `EmptyState` / `ErrorState` / `NoPermissionState` | 全局 |

---

## 12. 页面范围与数据机制（本地固化数据源）

### 12.1 实际页面（V3：7 页全部落地，统一控制面为可写工作台）

1. 总控驾驶舱（6.1，含运维大盘 `?view=ops`）
2. 统一控制面（6.2，策略工作台：新建/审批/发布/回滚/冲突检测）
3. 智能调度网关与弹性算力（6.3 / 6.4：路由总览 + 路由引擎配置 + 流量管控 + 应急操作 + 算力总览 + 异构算力 + 资源编排）
4. 计量与运营（6.5：计量总览/配额限流/模型统计/调用日志/应用管理/月度账单/成本模型）
5. 模型资产（6.6：资产台账/模型接入/模型广场/模型体验/效益评估/发布与归档）
6. 安全与审计（6.7：安全态势/护栏配置/租户管理/调用审计/审计日志/告警规则）
7. 我的工作台（业务员自助门户 + 申请人进度中心）

每页必须满足：

- 有真实字段（引用第 7 章对象模型），不是概念词堆砌
- 有操作按钮（含权限控制），不是纯看板
- 有联动逻辑（下钻/反查/跳转），不是静态拼图
- 有异常状态（至少 1 种：空态/错误/降级/告警），不是只展示正常路径

### 12.2 数据机制

- 页面使用**本地固化数据源**，按宁波银行全行生产口径组织：全行级量级数据（近 24h 请求量 366 万、Token 消耗、TCO ¥684,000、142 节点）、真实部门/租户命名（信息科技部、零售银行总部等条线）；不标注 DEMO 徽标，避免演示暗示
- 数据必须满足闭环：路由→计量→资产画像回流→审计事件 全链路可追（同 traceId 可跨页查到）
- 数据源独立于业务组件，仅由 service 层引用；service 层为页面唯一接入点，后续对接真实接口仅需改造该层
- KPI 聚合口径统一由 `PlatformSummary` 提供，与明细窗口（60 条）共存，杜绝量级失真
- 数据分两层：`services/data.ts`（只读基线）+ `services/dataConfig.ts`（可变内存态，写操作修改后经 api 层乐观更新 + `recordOp` 审计留痕）
- 部署形态：vite `base: '/maas-web/'` + Router `basename='/maas-web'`；资源目录 `_assets/`；线上 `http://221.229.92.112:19095/maas-web/`，CICD 由 `cicd/deploy.py --env sit` 下发（含 nginx 配置）

---

## 13. 评审检查清单

### 13.1 需求一致性

- 是否覆盖统一控制面与五大中心
- 是否体现 QPS 与 Token 双维治理
- 是否体现连续批处理、KV Cache、量化、混部
- 是否体现模型血缘、灰度、回滚、下线
- 是否体现多租户、RBAC、审计留痕、防篡改

### 13.2 可实现性

- 每个页面是否可拆成组件（第 11 章有清单）
- 每个对象是否有明确字段模型（第 7 章为唯一来源）
- 每个操作是否有前后置条件与权限（各页面操作表）
- 每个异常是否有前端反馈（第 10 章）

### 13.3 演示验收口径

- 是否支持多角色切换（第 3.2 权限矩阵）
- 是否支持路径回放（Timeline）
- 是否支持下钻与反查（KPI→账单→Trace）
- 是否支持链路解释（路由白盒）

### 13.4 闭环完整性

- 熔断是否有恢复与留痕（9.2）
- 告警是否有处置与关闭（9.6）
- 成本建议是否有采纳与验证（9.5）
- 配额预警是否有处置路径（9.7）

---

*文档编制日期：2026-08-04 | 版本：V3（实施对齐版） | 密级：内部项目研判*
