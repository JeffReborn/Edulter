
## 文档状态
状态：Draft  
版本：v0.1  
所属阶段：Demo  
最后更新：2026-03-16

---

## 一、文档目标

本文件用于统一定义教育咨询顾问助手 Demo 中各类 AI 输出结果的标准结构，确保：

- Prompt 有明确输出目标
- 后端有明确校验依据
- 前端有明确渲染字段
- 数据库有明确落库结构
- Cursor 在开发时不会因字段不统一而反复返工

本文件重点约束以下三类输出：

1. 知识问答输出
2. 客户画像提取输出
3. 跟进消息生成输出

---

## 二、设计原则

### 1. 输出必须结构化
所有核心 AI 输出都必须最终落成结构化对象，而不是只返回大段自由文本。

### 2. 输出字段尽量稳定
字段名一旦确定，不要频繁改动。例如：
- `targetCountry` 不要有时写成 `country`
- `mainConcerns` 不要有时是数组、有时是长段落字符串

### 3. 高频字段应独立
高价值字段应单独暴露，便于：
- 前端展示
- 数据库落库
- 后续筛选与排序

### 4. 复杂完整结果允许保留原始结构
在独立字段之外，允许保留完整结构化对象，例如：
- `structuredJson`
- `citations`

### 5. 缺失值允许存在，但必须明确
当模型无法提取或信息不足时：
- 可以为空
- 可以返回空数组
- 可以标记为待确认

但不能编造不存在的信息。

---

## 三、统一字段命名约定

当前统一采用以下命名原则：

### 1. 使用 camelCase
例如：
- `targetCountry`
- `budgetRange`
- `mainConcerns`
- `currentStage`

### 2. 布尔值字段应清晰表达判断含义
例如：
- `hasEnoughContext`
- `isUsable`

当前 Demo 阶段尽量少用布尔字段，优先输出更可解释的信息。

### 3. 数组字段必须稳定为数组
例如：
- `mainConcerns`
- `riskFlags`
- `citations`

即使为空，也应返回空数组，而不是 `null` 或一段文本。

### 4. 时间与 ID 字段使用统一语义
例如：
- `id`
- `createdAt`
- `updatedAt`

---

## 四、知识问答输出 Schema

### 目标
知识问答模块输出的重点不是“像 AI 一样回答”，而是：

- 给出可读答案
- 给出可追溯出处
- 让顾问知道答案来自哪里

### 标准结构

#### 顶层字段
- `answer`
- `citations`
- `confidence`

### 字段说明

#### `answer`
类型：
- `string`

说明：
- 面向顾问可直接阅读的回答正文
- 应简洁、清晰、业务化
- 不应过度冗长

#### `citations`
类型：
- `array`

说明：
- 至少一条为佳
- 无法提供时也应返回空数组，而不是省略字段

#### `confidence`
类型：
- `string`

建议值：
- `low`
- `medium`
- `high`

说明：
- 当前为轻量提示字段，不代表严格概率，仅用于帮助前端做辅助展示

---

### citation 子结构

每条 citation 建议包含：

- `documentId`
- `documentTitle`
- `snippet`

#### `documentId`
类型：
- `string`

#### `documentTitle`
类型：
- `string`

#### `snippet`
类型：
- `string`

说明：
- snippet 应为可读引用片段
- 不应只是空字符串
- 不应过长，优先保留最相关部分

---

### 知识问答输出示意

标准含义应为：

- answer：回答正文
- citations：出处数组
- confidence：置信提示

注意：
这里不要求你在文档里嵌套 JSON 示例，只要求字段定义统一即可。  
真正的 JSON 示例可放在后续 Prompt 或 API 层文档中补充。

---

## 五、客户画像提取输出 Schema

### 目标
客户画像提取模块的核心不是“总结一段话”，而是输出：

**可展示、可落库、可继续驱动后续动作的结构化客户信息。**

---

### 顶层返回建议结构

顶层建议包含：

- `client`
- `conversationRecord`
- `profile`

其中：

- `client`：客户主体摘要
- `conversationRecord`：本次输入文本记录
- `profile`：本次提取出的画像结果

---

## 六、client 子结构定义

### 字段
- `id`
- `displayName`
- `currentStage`
- `updatedAt`

### 字段说明

#### `id`
类型：
- `string`

#### `displayName`
类型：
- `string`

说明：
- 客户显示名
- 可来自顾问输入，也可来自已有记录

#### `currentStage`
类型：
- `string`

建议值：
- `new_lead`
- `initial_consultation`
- `in_followup`
- `high_intent`
- `uncertain`
- `closed`

说明：
- 当前客户在顾问工作流中的阶段摘要
- 如果无法明确判断，可返回 `uncertain`

#### `updatedAt`
类型：
- `string`

说明：
- 统一按时间字符串处理

---

## 七、conversationRecord 子结构定义

### 字段
- `id`
- `createdAt`

### 字段说明

#### `id`
类型：
- `string`

#### `createdAt`
类型：
- `string`

说明：
- 本次咨询文本记录的创建时间

---

## 八、profile 子结构定义

### 必须重点稳定的字段
- `id`
- `studentStage`
- `targetCountry`
- `targetProgram`
- `budgetRange`
- `timeline`
- `englishLevel`
- `parentGoals`
- `mainConcerns`
- `riskFlags`
- `currentStage`
- `structuredJson`

---

### 字段说明

#### `id`
类型：
- `string`

#### `studentStage`
类型：
- `string`

说明：
- 例如：
  - `G8`
  - `高一`
  - `本科申请`
- 信息不足时可为空字符串或待确认值

#### `targetCountry`
类型：
- `string`

说明：
- 当前主要目标国家
- 若存在多个国家，首版建议先保留主要目标；复杂多国家情况可记录到 `structuredJson`

#### `targetProgram`
类型：
- `string`

说明：
- 目标项目或方向，例如：
  - 加拿大高中
  - 本科留学
  - 国际学校路线

#### `budgetRange`
类型：
- `string`

说明：
- 预算范围先用文本表达即可
- 不必在首版强行数值化

#### `timeline`
类型：
- `string`

说明：
- 时间线、计划推进时点
- 例如：
  - 明年入学
  - 半年内推进
  - 时间待确认

#### `englishLevel`
类型：
- `string`

说明：
- 语言基础情况
- 不足时允许为空

#### `parentGoals`
类型：
- `array`

说明：
- 家长或客户的目标诉求数组
- 即使只有一个目标，也建议返回数组

#### `mainConcerns`
类型：
- `array`

说明：
- 当前顾问判断出的主要关注点
- 必须稳定为数组

#### `riskFlags`
类型：
- `array`

说明：
- 当前识别出的风险点
- 必须稳定为数组
- 无风险信息时也应返回空数组

#### `currentStage`
类型：
- `string`

建议值：
- `new_lead`
- `initial_consultation`
- `in_followup`
- `high_intent`
- `uncertain`
- `closed`

说明：
- 当前应与 `client.currentStage` 保持一致或高度接近

#### `structuredJson`
类型：
- `object`

说明：
- 保存完整画像结构
- 用于保留当前版本中未拆出的其他字段
- 数据库落库时可整体保存

---

## 九、客户画像输出约束

### 1. `mainConcerns` 必须是数组
不允许有时返回：
- `"家长比较关心预算和学校安全"`

而有时返回：
- `["预算", "学校安全"]`

必须统一为数组。

### 2. `riskFlags` 必须是数组
即使没有风险，也应返回：
- 空数组

而不是省略字段。

### 3. 信息不足时允许为空，但不能编造
例如：
- `englishLevel` 可以为空
- `timeline` 可以写“待确认”或空值
- 不允许模型为了“看起来完整”而捏造具体考试分数、入学时间等

### 4. 高价值字段必须独立暴露
即使完整结构都存在 `structuredJson` 中，也必须把高频字段单独放出来。

---

## 十、跟进消息生成输出 Schema

### 目标
跟进消息生成模块输出的核心是：

**供顾问直接复制、微调并发送给客户的消息草稿。**

它不是系统备注，也不是 AI 长文写作。

---

### 顶层返回建议结构

顶层建议包含：

- `clientId`
- `followups`

---

## 十一、followups 子结构定义

每条 follow-up 建议包含：

- `id`
- `styleType`
- `content`

### 字段说明

#### `id`
类型：
- `string`

#### `styleType`
类型：
- `string`

当前建议值：
- `wechat_short`
- `semi_formal`
- `english_optional`

说明：
- 首版至少稳定支持前两种
- 后续可扩展更多风格

#### `content`
类型：
- `string`

说明：
- 顾问可直接阅读、复制、微调后发送的正文内容
- 必须是单条完整文本
- 不应与其他风格混在一起返回

---

## 十二、跟进消息输出约束

### 1. `followups` 必须是数组
即使只生成一种风格，也应返回数组。

### 2. 每条结果都必须明确 `styleType`
避免前端无法判断哪条是哪种风格。

### 3. `content` 必须是纯文本正文
不应返回：
- 混合解释说明
- 模型自述
- 额外注释
- “以下是为你生成的内容：”这种包装语

### 4. 不同风格结果应有实际差异
不能只是换几个词就当两种风格。

---

## 十三、当前推荐的统一输出空值策略

为了降低前后端混乱，当前建议：

### 字符串字段
- 信息缺失时优先返回空字符串
或
- 使用清晰的待确认文本，例如“待确认”

但同一字段在同一版本中不要混用过多策略。

### 数组字段
- 必须返回数组
- 无内容时返回空数组

### 对象字段
- 必须返回对象
- 没有额外字段时返回空对象也比字段缺失更稳定

---

## 十四、数据库落库映射建议

### 知识问答
- `answer` → `qa_logs.answer`
- `citations` → `qa_logs.citations_json`

### 客户画像
- `client.currentStage` → `clients.current_stage`
- `profile.studentStage` → `client_profiles.student_stage`
- `profile.targetCountry` → `client_profiles.target_country`
- `profile.budgetRange` → `client_profiles.budget_range`
- `profile.timeline` → `client_profiles.timeline`
- `profile.mainConcerns` → `client_profiles.main_concerns`
- `profile.riskFlags` → `client_profiles.risk_flags`
- `profile.structuredJson` → `client_profiles.structured_json`

### 跟进消息
- `styleType` → `generated_followups.style_type`
- `content` → `generated_followups.content`

---

## 十五、前端渲染映射建议

### 知识问答页
前端至少直接使用：
- `answer`
- `citations`
- `confidence`

### 客户画像页 / 客户详情页
前端优先直接使用：
- `client.displayName`
- `profile.studentStage`
- `profile.targetCountry`
- `profile.budgetRange`
- `profile.timeline`
- `profile.mainConcerns`
- `profile.riskFlags`
- `profile.currentStage`

### 跟进消息页 / 客户详情页
前端直接使用：
- `followups[].styleType`
- `followups[].content`

---

## 十六、当前实现提醒

### 1. Prompt 输出格式必须服从本文件
后续所有 Prompt 设计都应以本文件为上游约束，而不是反过来。

### 2. 后端 schema 校验必须对齐本文件
无论使用：
- Zod
- 自定义 parser
- 其他校验方式

最终都应和这里的字段保持一致。

### 3. 前端不要假设“模型总会很听话”
前端和后端之间的稳定性，不应依赖模型偶然输出正确格式。

### 4. 当前字段不要频繁改名
一旦开始写接口和前端页面后，频繁改名会带来高返工成本。

---

## 十七、当前不做的 Schema 复杂化事项

当前版本不处理：

- 复杂多国家目标数组结构
- 复杂权重评分字段
- 多语言并行输出结构
- Prompt 调试元信息的大规模暴露
- AI 推理解释链路字段
- 复杂多轮版本差异结构

这些都可留到 MVP / V1 再扩展。

---

## 十八、与其他文档的关系

本文件是以下文档的上游约束之一：

- [[客户画像提取模块]]
- [[跟进消息生成模块]]
- [[知识问答模块]]
- [[API合同]]
- [[数据模型]]
- [[跟进消息生成Prompt]]
- [[客户画像提取Prompt]]
- [[知识问答Prompt]]

---

## 十九、当前阶段的核心提醒

对于你这个 Demo，真正重要的不是“模型说得多聪明”，而是：

- 输出结构是否稳定
- 字段命名是否统一
- 前后端是否容易联调
- 数据能否顺利落库
- 后续能否快速迭代

所以这个文件的价值，本质上是在为后续开发减少混乱和返工。