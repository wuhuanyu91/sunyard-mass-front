# MAAS 平台前端功能完善方案（实施完成版 v3）

> 依据：《信雅达Maas解决方案_0730.pdf》（45 页，下文以 P页码 引用）+《MAAS平台前端设计与功能规范 V3》
> **本版为实施完成记录**：原 v2 方案的 M1–M10 已全部落地，并在此基础上新增了异构算力纳管、路由引擎可配置、运维大盘、成本模型可配置、模型效益评估、租户组织管理、模型体验 Playground、我的工作台、双主题与数据真实化等增量能力（见第二章）。
> 线上地址：`http://221.229.92.112:19095/maas-web/`（vite `base` 与 Router `basename` 均为 `/maas-web/`）。

---

## 〇、实施须知（执行 AI 必读）

1. **技术栈**：React 18 + TypeScript + Vite + Tailwind（暗色主题，色板见 `index.css`：primary=#18C3FF、success=#14E7A0、warning=#FFB340、danger=#FF4D6D）+ recharts + lucide-react + react-router-dom。不引入任何新依赖。
2. **架构约束**：
   - 数据一律经 `services/api.ts`（内部 mock 内存态数据，来自 `services/data.ts`），页面不直接持有静态数据。
   - 所有写操作 = `api.xxx()` 修改内存态 → 返回 `OperationRecord` → 页面乐观更新 + Toast + 留痕。
   - `store/app.tsx` 的 `readOnly=true` 时：所有写操作按钮 `disabled` + 鼠标悬停 tooltip「只读模式下写操作已禁用」+ 点击无效。
3. **现有可复用资产**：`Panel`、`Banner`、`Drawer`、`StatusTag`、`EmptyState`、`KpiCard`、`statusMap`；页面布局风格（`panel` class、`grid grid-cols-N gap-3`、表格样式）必须与现有页面一致。
4. **编码约定**：中文注释；组件文件 PascalCase；新增组件放 `src/components/ui/`（通用）或各页面目录（专用）；类型全部进 `src/types/index.ts`。
5. **实施顺序**：严格按第七章批次执行，每完成一个批次运行 `npm run build`（工作目录 `maas/`）确保零 TS 错误。

---

## 一、全局交互设计规范（所有模块统一遵守）

### 1.1 反馈组件规范（本次先实现，供全模块复用）

| 组件 | 规格 |
|---|---|
| `Toast` | 固定右上角，距顶 64px；success 绿色描边 3s 自动消失、error 红色 5s、info 蓝色 3s；滑入动画 200ms；同时最多堆叠 3 条；文案格式「动作 + 对象 + 结果」如「限流规则 RL-005 已启用」 |
| `ConfirmDialog` | 三级：`info`（蓝，确认按钮 primary）、`warning`（黄，需勾选"我已知晓影响"才可确认）、`danger`（红，需在输入框输入指定确认词如 Key 后 4 位/模型名才可确认）；标题 ≤16 字；正文必须包含**影响面描述**；Esc/点击遮罩关闭 |
| `FormDialog` | 宽度 480px（复杂表单 640px）；标题栏 + 表单区 + 底部按钮区（左「取消」右「保存/提交」，主按钮在表单合法前 `disabled`）；**脏检查**：有未保存修改时点取消/遮罩 → 弹 ConfirmDialog「有未保存的修改，确定放弃？」 |
| `Tabs` | 二级 Tab 容器：下划线滑动指示器（200ms ease）、切换时内容区淡入（opacity 150ms）；Tab 项可带 badge 数字（如待审批数） |
| `ToggleSwitch` | 44×24px，开启=primary 色；禁用态 50% 透明度；切换即生效类操作需包 ConfirmDialog |
| `Slider` | 带数值气泡（拖动时显示当前值）、刻度标签、步长吸附 |
| `Segmented` | 分段选择器（用于视图切换，如 部门/个人/应用） |
| `QuotaBar` | 进度条：<80% primary、80~100% warning、超限 danger + 右侧红色「已超限」徽标；hover 显示「已用 X / 总额 Y（Z%）」 |
| `StepBar` | 五步条：已完成=success 对勾、当前=primary 高亮脉冲、未到=灰；步骤间连线 |
| `OperationTimeline` | 留痕时间线：时间 + 操作人 + 动作 + 对象，倒序，最新在上 |
| `TagEditor` | 回车/逗号确认生成 chip，chip 可点 × 删除；支持格式校验回调（IP/CIDR、敏感词） |
| `CopyButton` | 复制成功 → 图标变对勾 1.5s + Toast「已复制」 |

### 1.2 体验基线规则

1. **加载**：所有异步数据先渲染与最终布局一致的 `animate-pulse` 骨架屏（现有页面已如此，保持一致）。
2. **空态**：列表为空用 `EmptyState`，且必须附**引导操作按钮**（如「创建第一个 API Key」）。
3. **表单**：失焦校验 + 实时错误红字（字段下方 12px）；数字输入统一 `inputMode="numeric"` 并钳制范围；必填项标红星。
4. **成功反馈**：写操作成功 = Toast + 列表行短暂高亮（bg-primary/10 闪烁 800ms）；耗时操作（发布/回滚/连通性测试）显示按钮内 loading 转圈。
5. **危险操作**：删除/下线/停用/回滚/超限停发 → 必须 ConfirmDialog（见 1.1 分级）。
6. **联动提示**：配置保存若影响其他模块，Toast 附加「已同步至统一控制面（POL-xxx，待审批）」类说明。
7. **键盘**：弹窗内 Enter=提交（表单合法时）、Esc=关闭；列表检索框 Enter=搜索。
8. **数字展示**：千分位 `toLocaleString('zh-CN')`；大数用「万/亿」；金额 `¥` 前缀。

---

## 二、实施状态与增量能力（v3 更新）

### 2.1 原方案 M1–M10 实施状态：全部完成

原 v2 方案识别的四大配置域缺失（①精细化流量管控 ②配额治理 ③模型接入与生命周期 ④安全护栏配置）及控制面写操作、算力编排、应急操作，均已按 M1–M10 落地并通过 `npm run build` 零错误与浏览器巡检。各模块现状：

| 模块 | 落点 | 状态 |
|---|---|---|
| M1 统一控制面策略工作台 | `/control` | ✅ 五类策略新建/审批/发布/回滚 + 冲突检测 + 影响面预估 |
| M2 流量管控配置 | `/routing` 流量管控 | ✅ API Key 全生命周期 + QPS/Token 双维限流 + 场景路由 |
| M3 应急操作台 | `/routing` 应急操作 | ✅ 灰度降级/流量切备/关停非核心 + 工单回滚 |
| M4 弹性算力编排 | `/routing` 资源编排 | ✅ vGPU/量化/混部/优先级/批处理缓存/扩缩容 |
| M5 配额与限流 | `/metering` 配额与限流 | ✅ 业务组配额治理 + 超限停发/恢复审批 + 应用限流 |
| M6 模型统计与调用日志 | `/metering` | ✅ 部门/个人/应用三视图 + 节省测算 + 真实日志池 |
| M7 模型接入与广场 | `/assets` | ✅ 云端/本地/租赁接入 + 连通性测试 + 广场自助申请 |
| M8 发布与归档 | `/assets` 发布与归档 | ✅ 五步灰度 + A/B + 一键回滚 + 归档复活/依赖检查 |
| M9 安全护栏配置 | `/security` | ✅ 护栏接入 + 策略 CRUD + 10 检测模块 + 词库 + 多维审计 |
| M10 总控驾驶舱增强 | `/` | ✅ KPI 下钻 + 运营简报导出 + Tab 定位 |

### 2.2 实施后新增能力（原方案之外）

| 增量能力 | 落点 | 说明 |
|---|---|---|
| 异构算力厂商纳管 | `/routing` 算力总览 + 资源编排 | 英伟达/华为昇腾/沐曦/Intel 厂商矩阵、国产化占比、厂商级调度策略（13.4 章） |
| 多约束路由引擎可配置 | `/routing` 路由总览 | 六段流水线 + 四维评分权重滑杆 + 5 策略开关，保存下发留痕 |
| 运维大盘（双视图） | `/`（`?view=ops`） | 面向技术团队，与管理驾驶舱同一套数据口径（九章） |
| TCO 成本模型可配置 | `/metering` 成本模型 | 四类成本权重归一 + 折旧年限 + 租赁折算 + 分摊基准（九章） |
| 模型效益评估 | `/assets` 效益评估 | 单位任务成本/活跃应用/采纳率/价值分/治理建议（十章） |
| 多租户组织映射管理 | `/security` 租户管理 | 租户→组织条线映射、数据边界、启停留痕（十一章） |
| 模型体验 Playground | `/assets` 模型体验 | 先体验后接入，双模型同屏对比 + 流式输出 |
| 我的工作台 | `/workbench` | 业务员自助门户 + 申请人进度中心（五角色视角） |
| 明暗双主题 | 全局右上角切换 | 深色专业/浅色简约，localStorage 持久化 |
| 数据真实化 | 全局 | 全行量级口径自洽 + 宁波银行组织/应用/日志真实命名（见 2.3） |
| CICD 自动部署 | `cicd/` | paramiko 部署 + nginx 配置下发 + 路径前缀 `/maas-web/` |

### 2.3 全行量级数据基线（真实化后，近 24h）

| 指标 | 值 | 指标 | 值 |
|---|---|---|---|
| 全行请求量 | 366 万次/日 | GPU 卡时 | 7,860 GPU·h |
| 输入/输出 Token | 3.94 亿 / 1.38 亿 | 日 TCO | ¥684,000 |
| 缓存命中 Token | 2.12 亿（命中率 54%） | QPS | 86 |
| TTFT P50 / P95 | 210ms / 690ms | GPU 利用率 | 72% |
| 纳管节点/资源池 | 142 / 8 | 模型总数/生产 | 128 / 46 |
| 语义路由节省 | ¥274 万（-42.7%，全量旗舰口径 ¥642 万） | 部门条线 | 信息科技/零售/公司/风险/运营/金融市场 6 部 |

> 部门 TCO 排行合计（18.6+15.8+10.8+8.6+7.2+7.4 万）= 日 TCO 68.4 万，全平台口径自洽。

---

## 三、模块详细设计

> 每模块含：**核心功能**（一句话卖点）→ 页面结构 → 字段规格 → 交互流程 → 状态与联动。

### M1 统一控制面 · 策略工作台（路由 `/control`）

**核心功能**：五类策略的 **新建 → 审批 → 发布 → 回滚** 全生命周期操作（P6「配置一处生效全局」）。

**页面结构**：顶部操作条（新建策略按钮 + 状态筛选 chips + 类型筛选）→ 策略列表表格 → 右侧详情 Drawer（规则详情/diff/留痕）。

**策略字段规格**（新建/编辑表单，按类型动态渲染）：

| 字段 | 类型 | 必填 | 校验 | 默认值 |
|---|---|---|---|---|
| 策略名称 | 文本 | ✓ | 2~30 字，同类型下唯一 | — |
| 策略类型 | 单选 | ✓ | ROUTING/COMPUTE/MODEL/SECURITY/METERING | ROUTING |
| 作用域 | 单选+下拉 | ✓ | GLOBAL/TENANT/DEPT/APP/MODEL + 对应目标下拉 | GLOBAL |
| 规则参数 | 动态 | ✓ | 按类型渲染（见下） | — |
| 生效方式 | 单选 | ✓ | 立即生效（分钟级下发）/ 定时（日期时间选择器） | 立即 |
| 备注 | 文本 | ✗ | ≤200 字 | — |

规则参数按类型：ROUTING=场景+候选模型多选+降级模型+时延上限(200~10000ms, 默认1200)；COMPUTE=资源池+副本数(1~64)+vGPU开关；MODEL=资产下拉+灰度比例(1~100)+回滚阈值（成功率 %、P95 ms）；SECURITY=护栏策略引用下拉；METERING=配额值/限流规则引用。

**交互流程**：
1. **新建**：点「新建策略」→ FormDialog 三步（①类型卡片五选一 → ②规则表单 → ③影响面预估：展示将影响的部门/应用/模型数 + 提交审批）。提交后状态=DRAFT，Toast「已创建，已提交审批」。
2. **审批**：状态 PENDING_REVIEW 的行显示「通过 / 驳回」按钮 → 弹窗必填审批意见（≥5 字）→ 通过后状态 APPROVED，顶栏「审批待办」badge 数联动减 1。
3. **发布**：APPROVED 行「发布」→ ConfirmDialog(warning，影响面描述) → 按钮 loading 1.2s → 状态 PUBLISHED + 顶栏事件广播「策略 POL-xxx 已发布」+ 列表「生效状态」列显示「已下发 N 节点」。
4. **编辑**：已发布策略编辑 → 保存生成 version+1，状态回到 PENDING_REVIEW；Drawer 内「版本对比」按钮 → diff 表格（字段 / 原值 / 新值，变更行高亮）。
5. **回滚**：PUBLISHED 行「回滚」→ ConfirmDialog(danger，输入策略名确认) → 180s SLA 倒计时进度条（加速模拟 3s）→ 状态 ROLLED_BACK，上一版本自动恢复为 PUBLISHED。
6. **留痕**：Drawer 底部 OperationTimeline（创建/编辑/审批/发布/回滚全记录）。

**状态机**：`DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED → (编辑→PENDING_REVIEW) / ROLLED_BACK`。statusMap 需补充这些状态标签色。

---

### M2 流量管控配置（`/routing` → 智能路由 Tab → 新增二级 Tab「流量管控」，P14）

**核心功能**：**API Key 全生命周期管理 + QPS/Token 双维限流规则配置 + 场景路由规则**——PPT 截图直接还原对象。

本 Tab 内部用三级分区（不嵌套 Tab，纵向堆叠三个 Panel）：API Key 管理 / 限流策略 / 场景路由规则。

#### M2.1 API Key 管理

**列表列**：Key（`sk-maas-****` + 后 4 位，CopyButton 复制完整值需 ConfirmDialog(info)）、描述、归属（部门/应用）、状态（ENABLED/DISABLED 徽标）、使用次数/剩余次数（剩余为 0 显示红色「已耗尽」）、挂载限流规则（链接到下方规则）、创建时间、操作。

**行操作**：启用/禁用（ToggleSwitch 直切；禁用时若该 Key 近 24h 有调用 → 先弹 ConfirmDialog(warning)）、编辑、重置、删除。

**新建/编辑表单**：

| 字段 | 校验 | 默认值 |
|---|---|---|
| 描述 | 2~50 字 | — |
| 归属部门 | 下拉（6 部门） | 信息科技部 |
| 归属应用 | 下拉（随部门级联过滤） | — |
| 有效期 | 单选：永久/30天/90天/365天/自定义日期 | 90天 |
| 调用额度 | 整数 0~100,000,000，0=不限 | 0 |
| 可用模型服务 | 多选弹窗（勾选模型列表，含成本/K 提示），≥1 项 | — |
| 挂载限流规则 | 下拉（已有规则，可为空） | 空 |

**重置流程**：ConfirmDialog(warning「重置后旧 Key 立即失效，调用方需同步更新」)→ 生成新 Key 弹窗：完整 Key 仅展示一次 + CopyButton + 「我已保存」确认关闭。
**删除流程**：ConfirmDialog(danger，输入 Key 后 4 位确认)。

#### M2.2 限流策略配置

**规则表单字段**：

| 字段 | 类型 | 校验 | 默认值 |
|---|---|---|---|
| 规则名称 | 文本 | 2~30 字唯一 | — |
| 启用状态 | 开关 | — | 开 |
| 作用对象 | 单选 GLOBAL/DEPT/APP/API_KEY + 目标下拉 | 必填目标 | GLOBAL |
| 请求频率 | 数字 | 1~10,000 次/分钟 | 60 |
| 输入 Token 上限 | 数字 | 1,024~1,000,000 /单请求 | 32,768 |
| 输出 Token 上限 | 数字 | 512~256,000 /单请求 | 8,192 |
| 并发连接数 | 数字 | 1~1,000 | 20 |
| IP 白名单 | TagEditor | 每条 IPv4 或 CIDR 格式校验，≤100 条，空=不限制 | 空 |
| 超限行为 | 单选 | 拒绝(返回429)/排队等待/降级至低成本模型 | 拒绝 |

**列表列**：规则名、作用对象、四维阈值摘要、超限行为、近 24h 命中次数（联动现有 RateLimitHit 数据统计）、启用 ToggleSwitch、编辑、删除（danger 确认）。
**冲突校验**：保存时若同一目标已存在启用规则 → warning 横幅提示「与规则 RL-x 重叠，更具体对象的规则优先生效」，允许保存。

#### M2.3 场景路由规则（P11）

四张场景卡片（信贷审批/风控反欺诈/营销触达/客服问答），每卡字段：业务优先级（P0~P3 分段）、允许模型（多选 chips）、降级目标模型（下拉）、时延上限（200~10000ms，默认 1200）。保存 → Toast「已生成 POL-ROUTING-xxx，已提交控制面审批」并跳转链接。

---

### M3 应急操作台（`/routing` → 智能路由 Tab → 二级 Tab「应急操作」，P11）

**核心功能**：**灰度降级 / 流量切备 / 关停非核心**三大应急动作，一键执行、进度可视、可撤销。

布局：三张大操作卡（grid-cols-3）+ 底部「应急工单记录」表。

| 操作卡 | 配置项 | 执行流程 |
|---|---|---|
| 灰度降级 | 场景（四选一）、降级比例（10%/30%/50% 分段）、目标备选模型（下拉） | ConfirmDialog(warning) → 执行按钮 loading → 进度条 0→100%（模拟 3s）→ 生成工单 + 顶栏广播 + Toast |
| 流量切备 | 场景、目标备用池（下拉：4090开发池/租赁池/云端） | 同上；执行后卡片变「切备中·可回切」，出现「回切」按钮（同样走确认） |
| 关停非核心 | 勾选应用列表（checkbox，默认勾选所有标记非核心的应用）+ **联动影响预览**（将置 0 配额数、禁用 Key 数） | ConfirmDialog(danger) → 执行 → 相关应用状态变「已停发」，卡片提供「恢复」按钮 |

**应急工单表**：工单号（EM-日期-序号）、类型、执行人、对象、执行时间、状态（执行中/已生效/已回滚）、操作（回滚）。回滚需 danger 确认。

---

### M4 弹性算力编排（`/routing` → 弹性算力 Tab → 二级 Tab「资源编排」，P17-P22）

**核心功能**：**vGPU 切分 / 量化 / 混部 / 优先级隔离 / 批处理与缓存 / 扩缩容**的资源编排操作。

#### M4.1 节点详情 Drawer 增加写操作（现有 Drawer 扩展）

| 功能 | 控件与规格 |
|---|---|
| vGPU 切分 | 开关 + 算力百分比 Slider（1~100%，步长 1）+ 显存 Slider（256MB~80GB，步长 256MB）；实时显示「单卡可切分 N 片」与收益预估「切分前需 3 卡 → 切分后 1~2 卡」（P18）；应用需 ConfirmDialog(warning「需重启实例，预计 2 分钟」) |
| 量化配置 | 分段 FP16/INT8/INT4；下方提示：显存节省 0%/50%/75%，INT4 附「精度可能下降，建议先评测」warning 文案 |
| 扩缩容 | 副本数 stepper（1~32）+「扩展至租赁池」开关（开启后 costTag=RENTAL 提示「将产生租赁费用」） |

#### M4.2 资源编排面板（新增区块，grid-cols-2 四个 Panel）

1. **混部配置**：大小模型混部 ToggleSwitch + 亲和规则 TagEditor（选择可同卡的小模型）+ 显存预留 Slider（5~30%，默认 15%）。
2. **优先级隔离**（P17）：P0/P1/P2 三条权重 Slider（1~10，默认 8/5/2）+ 「低优任务自动降速排队」开关 + 「允许 P0 抢占」开关。
3. **批处理与缓存**：连续批处理开关 + 批大小上限（1~512，默认 64）；前缀 KV 缓存开关 + 策略分段（轮询/语义感知负载均衡），选语义感知时提示「命中率 25%→50%+」（P19）；投机解码开关 + 草稿模型下拉（EAGLE 系列）（P20）。
4. **错峰调度**：列出现有热区建议，每条「采纳」按钮 → 生成调度任务卡（目标节点、迁移窗口、预计影响）+ Toast。

**统一交互**：每个 Panel 底部「保存配置」按钮（dirty 检查：未修改时禁用）；保存成功 Toast「已下发至 N 节点」。

---

### M5 配额与限流（`/metering` → 二级 Tab「配额与限流」，P29）

**核心功能**：**业务组 Token 配额治理（设置额度/进度监控/超限即停/余额预警）+ 应用限流规则**——Token 精细化管控截图还原对象。

#### M5.1 业务组配额管理

**列表列**：部门名称、月度 Token 配额、**已用/总额 QuotaBar**、本月费用、超限即停（ToggleSwitch）、预警阈值、状态（正常/预警/已停发）。

**字段规格**：

| 字段 | 校验 | 默认值 |
|---|---|---|
| 月度 Token 配额 | 1万~1,000亿（以「万」为单位输入，展示自动转万/亿） | — |
| 生效时间 | 单选：本月立即生效 / 次月生效 | 本月 |
| 调整原因 | 文本 5~100 字，必填（留痕） | — |
| 超限即停 | 开关；开启需 ConfirmDialog(warning「超限后该部门所有请求将被拒绝」) | 开 |
| 预警阈值 | 分段 80%/90%/95% | 80% |
| 通知渠道 | 多选 chips：站内信/邮件/短信，≥1 | 站内信 |

**交互流程**：
1. 行「调整配额」→ FormDialog（上表字段）→ 保存 → QuotaBar 重算 + Toast + OperationRecord。
2. 已用 ≥ 阈值 → 状态变「预警」，行背景 warning/5 + 顶部汇总横幅「2 个部门配额已超 80%」。
3. 已用 > 100% 且超限即停=开 → 状态「已停发」：行背景 danger/5 + 页面顶部红色 Banner「xx部门已触发超限停发」+ 行内「申请恢复」按钮 → 弹窗填恢复理由 → 提交后生成审批待办（控制面审批，通过后状态恢复）。
4. 空余额预警：剩余 < 阈值时自动在顶栏告铃 badge +1（联动 summary.alertOpen 口径）。

#### M5.2 应用限流规则

复用 M2.2 的规则表单组件（targetType 锁定 APP），列表按应用分组展示；每应用显示当前限流命中趋势小 sparkline。

---

### M6 模型统计与调用日志（`/metering` → 二级 Tab「模型统计」「调用日志」，P26/P27/P41）

#### M6.1 模型统计（P26 截图还原）

**核心功能**：分模型用量结算 + **语义路由节省测算** + 推荐模型。

- 顶部 Segmented 三视图：**部门结算 / 个人用量 / 应用统计**（P27）。
- **节省测算条**（Banner 样式，success 色）：「若全部使用 {旗舰模型下拉可切换，默认 GLM-5-旗舰}，本月费用 ¥6,420,000；智能路由实际节省 ¥2,740,000（-42.7%）」。
- 用量表：模型、调用次数、输入/输出 Token、费用、占比条；支持列排序（点击表头，箭头指示）。
- 右侧「推荐模型」Panel：场景 → 当前模型 → 推荐模型 → 预计月节省；行操作「生成优化建议」→ 一键创建 OptimizeAdvice（联动现有成本优化建议模块）。
- **个人用量视图**：员工表（姓名/部门/Token/费用/行为标签分布 chips）；行点击 → Drawer 展示该员工调用行为审计（时间段活跃分布、Top 用途标签）。

#### M6.2 调用日志（P41 截图还原）

**筛选条**：时间范围（近1h/24h/7d 分段）、模型下拉、状态下拉（成功/失败/限流/拦截）、行为标签下拉、Key 搜索框。
**列**：调用时间、状态+状态码（200/429/403/500 色彩区分）、API Key（脱敏）、路由名称、模型、提供商、应用类型、**行为分析标签 chip**（业务办公=success、开发调试=primary、私人娱乐=warning、疑似违规=danger）、输入/输出 Token。
**详情 Drawer**：请求/响应内容（折叠面板，默认脱敏：身份证/手机号/卡号打码；AUDITOR 角色可见「解锁原文」按钮，点击留痕）、关联安全事件跳转按钮。
**分页**：20 条/页，底部页码。

#### M6.3 账单中心（P24，增强现有导出）

现有「导出日报」弹窗升级为「账单中心」Drawer：月份选择器 → 部门账单汇总表（部门/Token/费用/环比）→ 时/日/月趋势切换图 → 导出 CSV（沿用脱敏说明文案）。

---

### M7 模型接入与广场（`/assets` → 二级 Tab「模型接入」「模型广场」，P37/P38）

#### M7.1 统一模型接入（P37 截图还原）

**核心功能**：**云端/本地/租赁三类模型统一接入配置 + 连通性测试 + 自动资产登记**。

- 顶部汇总条（3 KpiCard）：纳管模型数（128）/ GPU 服务器数（128）/ 平均利用率（80%）。
- 接入列表列：接入名称、来源（云端/本地/租赁 chip）、供应商、模型类型、状态（在线=success/离线=danger/测试中=warning）、最近检测时间、操作（测试连通性/编辑/删除）。
- **云端接入表单**：

| 字段 | 校验 | 默认值 |
|---|---|---|
| 供应商 | 下拉：OpenRouter/阿里云百炼/火山引擎/自定义 | 阿里云百炼 |
| 模型类型 | 下拉：文本生成/Embedding/图像生成/OCR/语音 | 文本生成 |
| API Key | 密码框 + 显示/隐藏切换，8~128 字符 | — |
| API Base URL | 必须 https:// 开头 URL 校验；选供应商时自动预填官方地址（可改） | 按供应商预填 |
| 模型清单 | TagEditor 手填 或「拉取列表」按钮（loading 1s 后填充该供应商示例模型） | — |

- **本地/租赁接入表单**：算力来源（下拉）、节点数（1~512）、卡型（下拉 H20/L20/4090D/昇腾910B）、接入说明（≤200 字）。
- **连通性测试流程**：按钮 loading（模拟 1.2s）→ 成功：状态转「在线」+ Toast「连通正常，时延 238ms」+ 自动创建资产（生成 AST-xxx，台账 DRAFT 态，Toast 附跳转链接）；失败：状态「离线」+ error Toast + 表单顶部红色原因提示。
- 删除：已关联在用资产的接入 → danger 确认并提示「将同时下线资产 AST-xxx」。

#### M7.2 模型广场（P38 截图还原）

**核心功能**：**模型卡片浏览 + 分类筛选 + 自助申请加入**。

- 工具条：分类 chips（全部/文本生成/Embedding/图像生成/OCR/语音）+ 关键词搜索框 + 排序下拉（调用量/成本/评分）。
- 卡片（grid-cols-4）：模型名 + 来源徽标、分类 chip、一句话描述（2 行截断）、成本/K Token、评分（1~5 星）、月调用量、底部按钮：未申请=「申请接入」、审批中=「审批中…」(disabled)、已开通=「已开通」(success 态)。
- **申请弹窗**：申请部门（下拉）、用途说明（文本域，≥20 字，实时字数提示）、预估月调用量（数字）。提交 → Toast「申请已提交，等待模型负责人审批」+ 顶栏审批待办 +1 + 卡片状态变「审批中」。
- 多级组织说明区（P38）：底部 Banner 说明「业务组 → 员工 → 应用」三级组织与 Key 分配关系（静态说明卡）。

---

### M8 发布与归档（`/assets` → 二级 Tab「发布与归档」，P34/P35）

#### M8.1 灰度发布控制台（P34）

**核心功能**：**提交发布 → 灰度切流 → A/B 对照 → 放量/回滚 → 版本归档**五步可操作闭环。

- 顶部：灰度任务选择下拉（列出 lifecycleStatus=GRAY 的资产）+ StepBar 五步条。
- 步骤 2 灰度切流面板：比例 Slider（档位 1/5/10/20/50，默认 5%）+ 灰度范围多选（应用/部门）+「应用切流」按钮 → ConfirmDialog(info「分钟级生效」) → 生效倒计时 60s 进度环 → 完成 Toast。
- 步骤 3 A/B 对照面板：双栏（现网版本 vs 灰度版本）实时指标表：准确率、平均时延、合规率、成本/K；优胜项单元格 success 高亮 + 「推荐放量」提示条。
- 步骤 4：「放量 50%」「放量 100%」快捷按钮（写控制面 MODEL 策略 → Toast「已提交审批」）；**「一键回滚」danger 按钮 → ConfirmDialog(danger) → 180s SLA 倒计时进度条（模拟 3s）→ 状态 ROLLBACK + 广播**。
- 步骤 5：100% 放量后自动展示「版本归档」卡（版本号、归档时间、「已归档」徽标）。
- 现有资产画像 Drawer 的灰度只读区 → 替换为「打开灰度控制台」按钮（切换 Tab）。

#### M8.2 下线与归档管理（P35）

- 归档列表列：模型、下线原因 chip（90天无调用/版本替代/合规下线/人工标记）、归档时间、**保留策略**（24个月/监管永久 徽标，永久=不可删除）、**价值评分**（A战略/B核心/C通用/D候选下线 色彩徽标）、操作。
- 行操作：**一键复活**（ConfirmDialog(warning「将恢复至下线前状态并重新占用算力」）→ 恢复 lifecycle + 留痕）；永久删除（仅保留策略=24个月 的可删，danger 确认；监管永久项该按钮 disabled + tooltip「监管模型永久留存，不可删除」）。
- 评分依据弹窗：三维条形（算力成本 30% / 业务转化 40% / 风险识别准确率 30%）合成总分 → 映射 A/B/C/D。
- **自动触发规则配置**（Panel）：checkbox 列表「90 天无调用自动建议下线」「版本被替代自动建议归档」「合规名单变更自动下线」+ 保存；命中规则的模型在台账显示「建议下线」黄色徽标。

---

### M9 安全护栏配置（`/security` → 二级 Tab「护栏配置」，P42-P44）

**核心功能**：**护栏接入配置 + 安全策略 CRUD + 10 大检测模块开关 + 词库管理**——护栏配置界面截图还原对象。

#### M9.1 护栏接入卡（P44 截图还原）

| 字段 | 校验 | 默认值 |
|---|---|---|
| 开启安全护栏 | 总开关；关闭需 ConfirmDialog(danger「关闭后所有请求将绕过内容安全检测」) + 页面顶部常驻红色 Banner 提示「护栏已关闭」 | 开 |
| 护栏 API 地址 | https:// URL 校验 | https://guardrail.local/api/v1 |
| API Key | 密码框 + 显隐切换 | — |

操作：「保存」（dirty 检查）+「测试连通性」（loading 1.2s → 成功 Toast「连通正常：文本时延 200ms / 多模态 1200ms」（P43 口径）；失败 error Toast）。
**接入指引**：卡片下方三步引导条（① 配置护栏地址 → ② 创建安全策略 → ③ 绑定应用），完成一步自动点亮下一步。

#### M9.2 安全策略 CRUD

- 列表列：接入 ID（GD-xxx）、策略名称、描述、检测模块数、动作（阻断/脱敏/告警 chip）、绑定应用数、编辑/删除。
- 表单：名称（2~30 唯一）、描述（≤100）、检测模块（10 模块 checkbox 组，≥1）、动作（单选 阻断/脱敏/告警）、绑定应用（多选）。

#### M9.3 检测模块矩阵（P42）

10 张模块卡（grid-cols-5 两行）：**违法信息过滤 / 不良信息过滤 / 恶意代码识别 / 隐私信息拦截 / 模型代答 / 会话阻断 / 防提示词注入 / 输入合规检测 / 模型滥用检测 / DDOS 检测**。每卡：图标 + 名称 + ToggleSwitch + 灵敏度分段（低/中/高，默认中）。切换即生效 + Toast；关闭核心模块（违法/隐私/注入）需 warning 确认。

#### M9.4 词库与安全管理（P43）

- **系统词库卡**：当前版本（如 v2026.07）+ 词条数 + 更新时间 +「更新词库」按钮（loading 2s → 版本号+1 + Toast「词库已更新至 v2026.08，新增 312 条」）。
- **自定义词库**：表格（词库名/词条数/更新时间/操作）；新建/编辑弹窗含 TagEditor 批量录入（去重校验、单词 ≤32 字、单库 ≤500 条）。
- **检测模型管理**：版本列表（模型名/版本/状态/时延），支持「设为默认」。
- **举报反馈**：列表（时间/内容摘要/来源）+ 行操作「处理」（弹窗：判定 有效/误报 + 处理意见）/「忽略」。

#### M9.5 调用审计增强（`/security` → 二级 Tab「调用审计」，P40/P41）

- 检索区：维度 Segmented（TraceID/客户ID/业务单号）+ 输入框 + 时间范围快捷（近1h/24h/7d/自定义）；命中结果列表点击 → 现有全链路时间线 Drawer。
- **租户数据留存视图**：租户卡片 ×3（租户名/日志留存周期(如 180天)/存储策略(独立存储)/日志量/「导出审计包」按钮复用现有导出弹窗）。

---

### M10 总控驾驶舱增强（`/`）

- KPI 卡可点击：告警数 → `/security`；审批待办 → `/control`；配额预警 → `/metering`（Tab 定位用 query 参数 `?tab=quota`）。
- 新增「今日运营简报」Panel（3 卡）：成本节省（语义路由本月省 ¥274 万 / -42.7%）、灰度进展（进行中任务数与当前步骤）、安全拦截（今日拦截 N 次，Top 类型）。
- Tab 定位支持：`/metering?tab=quota`、`/assets?tab=gray` 等，页面 useEffect 读取 searchParams 设置初始 Tab。

---

## 四、数据模型（追加到 `src/types/index.ts`，完整 TS）

```ts
export interface ApiKey { keyId: string; keyFull: string; keyMasked: string; desc: string;
  ownerDept: string; appId: string; status: 'ENABLED' | 'DISABLED'; expireAt: string | null;
  callQuota: number; usedCount: number; allowedModels: string[]; rateLimitRuleId?: string; createdAt: string }

export type RateLimitTarget = 'GLOBAL' | 'DEPT' | 'APP' | 'API_KEY';
export interface RateLimitRule { ruleId: string; name: string; targetType: RateLimitTarget; targetId?: string;
  enabled: boolean; qpsPerMin: number; inputTokenLimit: number; outputTokenLimit: number;
  concurrency: number; ipWhitelist: string[]; overAction: 'REJECT' | 'QUEUE' | 'DOWNGRADE'; hits24h: number }

export interface RoutingRuleSet { sceneKey: 'CREDIT' | 'RISK' | 'MARKETING' | 'SERVICE'; sceneName: string;
  priority: SlaLevel; allowedModels: string[]; fallbackModel: string; latencyCeilMs: number; policyId?: string }

export interface AggregationGroup { groupId: string; name: string; members: string[];
  strategy: 'ROUND_ROBIN' | 'WEIGHTED' | 'LATENCY'; autoSkipFault: boolean; healthCheckSec: number }

export type QuotaStatus = 'NORMAL' | 'WARNING' | 'STOPPED';
export interface QuotaProfile { deptId: string; deptName: string; monthTokenQuota: number; usedTokens: number;
  monthCost: number; overLimitStop: boolean; warnThreshold: 80 | 90 | 95;
  notifyChannels: ('SITE' | 'MAIL' | 'SMS')[]; status: QuotaStatus }

export interface ModelConnection { connId: string; name: string; source: 'CLOUD' | 'LOCAL' | 'RENTAL';
  provider: string; modelType: string; apiKeyMasked?: string; baseUrl?: string; nodes?: number; cardType?: string;
  status: 'ONLINE' | 'OFFLINE' | 'TESTING'; assetId?: string; lastCheckAt: string; createdAt: string }

export interface ModelCard { assetId: string; name: string; category: 'TEXT' | 'EMBEDDING' | 'IMAGE' | 'OCR' | 'VOICE';
  provider: string; desc: string; costPer1k: number; rating: number; monthCalls: number;
  applyStatus: 'NONE' | 'PENDING' | 'GRANTED' }

export type GrayStep = 1 | 2 | 3 | 4 | 5;
export interface GrayRelease { releaseId: string; assetId: string; assetName: string; step: GrayStep;
  percent: number; scope: string[]; abMetrics: { accuracy: [number, number]; latencyMs: [number, number];
  compliance: [number, number]; costPer1k: [number, number] }; startedAt: string }

export type ArchiveReason = 'NO_CALL_90D' | 'REPLACED' | 'COMPLIANCE' | 'MANUAL';
export interface ArchivedModel { assetId: string; assetName: string; reason: ArchiveReason; archivedAt: string;
  retention: '24M' | 'PERMANENT'; valueScore: 'A' | 'B' | 'C' | 'D'; scoreDetail: { cost: number; conversion: number; riskAcc: number } }

export interface GuardrailConfig { enabled: boolean; apiUrl: string; apiKeyMasked: string;
  textLatencyMs: number; multimodalLatencyMs: number }
export interface GuardrailPolicy { policyId: string; name: string; desc: string; modules: string[];
  action: 'BLOCK' | 'MASK' | 'ALERT'; bindApps: string[] }
export interface DetectModule { moduleKey: string; label: string; critical: boolean;
  enabled: boolean; sensitivity: 'LOW' | 'MED' | 'HIGH' }
export interface KeywordLibrary { libId: string; name: string; type: 'SYSTEM' | 'CUSTOM';
  version: string; wordCount: number; updatedAt: string }

export type BehaviorTag = '业务办公' | '开发调试' | '私人娱乐' | '疑似违规';
export interface CallLog { logId: string; ts: string; status: 'SUCCESS' | 'FAILED' | 'RATE_LIMITED' | 'BLOCKED';
  statusCode: number; apiKeyMasked: string; routeName: string; model: string; provider: string;
  appType: string; behaviorTag: BehaviorTag; inputTokens: number; outputTokens: number;
  requestContent: string; responseContent: string }

export interface PersonalUsage { userId: string; name: string; deptId: string; tokens: number;
  cost: number; tagDist: { tag: BehaviorTag; pct: number }[] }

export interface EmergencyTicket { ticketId: string; type: 'GRAY_DEGRADE' | 'SWITCH_BACKUP' | 'STOP_NONCORE';
  operator: string; target: string; params: string; status: 'RUNNING' | 'ACTIVE' | 'ROLLED_BACK'; createdAt: string }

export interface OperationRecord { opId: string; opType: string; operator: string; targetId: string;
  detail: string; createdAt: string }
```

---

## 五、Service 层扩展（`services/api.ts` + `services/data.ts`）

- 查询（均 mock + 120ms 延迟）：`getApiKeys / getRateLimitRules / getRoutingRuleSets / getAggregationGroups / getQuotas / getModelConnections / getModelCards / getGrayReleases / getArchivedModels / getGuardrailConfig / getGuardrailPolicies / getDetectModules / getKeywordLibs / getCallLogs / getPersonalUsage / getEmergencyTickets / getOperationRecords`
- 写操作（内存态修改 + 返回 `OperationRecord`）：
  `saveApiKey / toggleApiKey / resetApiKey / deleteApiKey`
  `saveRateLimitRule / toggleRateLimitRule / deleteRateLimitRule / saveRoutingRuleSet`
  `execEmergency(type, params) / rollbackEmergency(ticketId)`
  `applyNodeConfig(resourceId, config) / saveOrchestration(config)`
  `setQuota / toggleQuotaStop / requestQuotaResume / saveAppRateLimit`
  `saveModelConnection / testConnection(connId) / deleteConnection`
  `applyModelCard(assetId, form) / advanceGray(releaseId, step, payload) / rollbackGray(releaseId)`
  `reviveArchived(assetId) / deleteArchived(assetId) / saveArchiveRules`
  `saveGuardrailConfig / testGuardrail / saveGuardrailPolicy / deleteGuardrailPolicy / toggleDetectModule / setModuleSensitivity / updateSystemLib / saveCustomLib / handleReport`
  `createPolicy / approvePolicy / rejectPolicy / publishPolicy / rollbackPolicy`
- mock 数据量基线：API Key 6 条、限流规则 5 条、配额 6 部门（含 1 个预警 + 1 个已停发）、接入 6 条（云端3/本地2/租赁1）、卡片 12 张、灰度任务 2 个（分别在步骤 2 与步骤 3）、归档 4 条（含 1 条监管永久）、策略列表沿用现有 policies 并补全状态、调用日志 40 条（覆盖四种状态与四类行为标签）。

---

## 六、文件落点清单

| 新增文件 | 职责 |
|---|---|
| `components/ui/Tabs.tsx` `Toast.tsx` `ConfirmDialog.tsx` `FormDialog.tsx` `ToggleSwitch.tsx` `Slider.tsx` `Segmented.tsx` `QuotaBar.tsx` `StepBar.tsx` `TagEditor.tsx` `OperationTimeline.tsx` `CopyButton.tsx` | 全局交互组件（第一章规格） |
| `pages/control/PolicyWizard.tsx` `pages/control/PolicyDrawer.tsx` | M1 新建向导 / 详情与审批 |
| `pages/routing/TrafficConfig.tsx` `pages/routing/EmergencyConsole.tsx` | M2 / M3 |
| `pages/routing/OrchestrationPanel.tsx` | M4.2（M4.1 直接改 ComputePanel.tsx） |
| `pages/metering/QuotaPanel.tsx` `pages/metering/ModelStats.tsx` `pages/metering/CallLogs.tsx` | M5 / M6.1 / M6.2 |
| `pages/assets/ModelConnections.tsx` `pages/assets/ModelPlaza.tsx` `pages/assets/ReleaseArchive.tsx` | M7 / M8 |
| `pages/security/GuardrailConfig.tsx` `pages/security/AuditSearch.tsx` | M9.1-M9.4 / M9.5 |

改造文件：`types/index.ts`（第四章）、`services/data.ts` + `api.ts`（第五章）、`control/index.tsx`、`routing/index.tsx`、`metering/index.tsx`、`assets/index.tsx`、`security/index.tsx`（各加 Tabs 壳）、`dashboard/index.tsx`（M10）、`statusMap.ts`（补新状态）、`MainLayout.tsx`（审批待办跳转带参）。

---

## 七、实施批次（已全部完成，每批次均通过 `npm run build` 零错误验证）

| 批次 | 内容 | 状态 |
|---|---|---|
| **B0** | 第一章全部交互组件 + statusMap 补充 + 类型定义 + mock 数据 | ✅ 完成 |
| **B1（P0 核心配置）** | M2（API Key+限流+场景路由）、M5（配额+应用限流）、M7.1（模型接入）、M9.1-M9.4（护栏配置） | ✅ 完成 |
| **B2（生命周期）** | M1（策略工作台）、M8（灰度控制台+归档） | ✅ 完成 |
| **B3（运营深化）** | M6（模型统计+调用日志+账单）、M7.2（模型广场）、M3（应急操作台） | ✅ 完成 |
| **B4（算力与增强）** | M4（资源编排）、M9.5（多维审计）、M10（驾驶舱增强） | ✅ 完成 |
| **B5（亮点）** | 算力网关 Agent 对话条（GatewayAgent） | ✅ 完成 |
| **B6（增量补强）** | 第二章 2.2 所列增量能力（异构算力/路由引擎/运维大盘/成本模型/效益评估/租户管理/工作台/双主题/数据真实化） | ✅ 完成 |

---

## 八、验收清单（均已通过）

1. ✅ PPT 截图还原度：P14/P26/P29/P37/P38/P41/P44 逐一可操作复现。
2. ✅ 每模块写操作闭环：配置 → 校验 → 确认 → 生效（Toast/状态变化）→ 留痕（OperationTimeline 可见）。
3. ✅ readOnly 模式下所有写按钮禁用并有 tooltip；`npm run build` 零错误；无 console 报错。
4. ✅ 危险操作 100% 有分级 ConfirmDialog；表单 100% 有校验提示与默认值；空态 100% 有引导按钮。
5. ✅ 顶栏联动：审批待办 badge、事件广播、告警铃铛数字随相应操作实时变化。
6. ✅ 数据真实化：全行量级口径自洽（见 2.3），无「模拟/演示」出戏文案，组织/应用/日志命名贴近宁波银行真实场景。
7. ✅ 双主题：深色/浅色切换正常且跨页持久化，图表对比度在两种主题下均可读。

---

## 九、部署与运行（v3 新增）

- **本地开发**：`cd maas && npm run dev`，访问 `http://localhost:5173/maas-web/`（dev 与生产同带 `/maas-web/` 前缀）。
- **构建**：`cd maas && npm run build`，产物 `dist/`（资源目录 `_assets/`，避开前端 `/assets` 路由名）。
- **CICD 部署**：`py cicd/deploy.py --env sit`，三项目（maas-web 产物 / maas-nginx-config 配置下发 / maas-nginx-cleanup 旧配置清理）。
- **线上**：`http://221.229.92.112:19095/maas-web/`，与存量 findata 共用 19095 端口、靠路径前缀隔离；nginx `location /maas-web/` + `_assets/` 长缓存 + `/assets` 精确匹配兜底。
- **子路由直达**：`/maas-web/control`、`/maas-web/routing?tab=traffic`、`/maas-web/metering?tab=cost`、`/maas-web/assets?tab=benefit`、`/maas-web/security?tab=tenant`、`/maas-web/dashboard?view=ops`。
- **数据层**：`services/data.ts`（只读基线）+ `services/dataConfig.ts`（可变内存态）+ `services/api.ts`（统一读写 + 审计留痕）；后续对接真实后端仅需改造 api.ts。
