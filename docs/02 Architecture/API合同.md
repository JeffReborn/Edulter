
## 文档状态
状态：Draft  
版本：v0.1  
所属阶段：Demo  
最后更新：2026-03-21

---

## 一、文档目标

定义教育咨询顾问助手 Demo 阶段的核心 API 输入、输出和约束，确保：

- 前后端联调有统一标准
- Cursor 有清晰的接口开发边界
- AI 输出可以被前端稳定消费
- 后续即使前后端拆分，接口契约仍然可延续

---

## 二、当前接口设计前提

### 1. 当前采用单项目全栈架构
当前阶段采用：

- 一个 Next.js 项目
- 页面与 API 在同一工程中
- 前后端逻辑分层，但物理上不拆仓

### 2. 接口设计要兼容未来拆分
虽然当前不做前后端双项目，但 API 命名、请求结构、响应结构应保持清晰，避免未来拆分时重做契约。

### 3. API 优先服务 Demo 闭环
当前接口只围绕以下闭环设计：

1. 上传内部资料
2. 知识问答
3. 粘贴聊天记录提取客户画像
4. 生成跟进消息
5. 查看客户记录列表与详情

---

## 三、设计原则

### 1. 按业务模块拆分接口
当前 API 主要按以下模块划分：

- documents
- qa
- profiles
- followups
- clients

### 2. 响应结构稳定
前端不能直接消费模型原始输出，而应消费后端结构化后的标准响应。

### 3. 输入必须校验
所有 POST 接口都应进行参数校验，建议统一使用 Zod。

### 4. 错误必须标准化
错误响应必须统一格式，便于前端展示和后续调试。

### 5. AI 输出必须过后端清洗
客户画像、跟进消息、问答出处等结果不能让模型“想怎么回就怎么回”，必须先经后端整理。

---

## 四、统一响应结构

### 成功响应格式

- `success`: 固定为 `true`
- `data`: 业务数据主体

示意：

- success
- data

### 失败响应格式

- `success`: 固定为 `false`
- `error.code`: 错误码
- `error.message`: 用户可读的错误信息

示意：

- success
- error
  - code
  - message

---

## 五、API 列表总览

### Documents
- `POST /api/documents/upload`
- `GET /api/documents`（文档管理列表，支持分页与筛选）
- `DELETE /api/documents/:id`（软删除，Demo 治理）
- `GET /api/documents/:id`（契约保留，可选实现）

### QA
- `POST /api/qa/ask`

### Profiles
- `POST /api/profiles/extract`

### Followups
- `POST /api/followups/generate`

### Clients
- `GET /api/clients`
- `GET /api/clients/:id`
- `PATCH /api/clients/:id`

---

## 六、详细接口定义

---

## 1. POST `/api/documents/upload`

### 作用
上传知识库文档并触发处理流程。

### 请求方式
- `multipart/form-data`

### 请求字段
- `file`：文件本体，必填

### 成功返回字段
- `document.id`
- `document.title`
- `document.fileName`
- `document.fileType`
- `document.status`
- `document.createdAt`
- `document.processingError`：当 `status` 为 `failed` 时可能返回可读失败原因；否则可为 `null`

### 文档状态建议值
- `uploaded`
- `processing`
- `ready`
- `failed`

### 失败错误码建议
- `INVALID_FILE`
- `UNSUPPORTED_FILE_TYPE`
- `UPLOAD_FAILED`
- `PROCESSING_INIT_FAILED`

### 当前说明
Demo 阶段可以先用简化处理流程，但从契约上仍应保留文档状态字段。

---

## 2. GET `/api/documents`

### 作用
获取已上传文档列表，供 **文档管理页**（`/documents/manage`）等使用。  
**不包含**已软删除文档（`deletedAt` 非空的不返回）。

### 查询参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `page` | 否 | 页码，从 **1** 开始；默认 `1`。须为正整数。 |
| `pageSize` | 否 | 每页条数；默认 **15**，最大 **50**。须为正整数。 |
| `q` | 否 | 按 **标题** 或 **文件名** 模糊匹配（不区分大小写）。 |
| `status` | 否 | 按状态筛选：`uploaded` \| `processing` \| `ready` \| `failed`；传 `all` 或不传表示不限。 |

### 成功响应结构

- `data.documents`：当前页的文档数组。
- `data.pagination`：分页元数据。
  - `total`：符合当前筛选条件的总条数（不含软删）。
  - `page`：当前实际页码（若请求的 `page` 超过总页数，服务端会 **钳制到最后一页**，并以本字段为准）。
  - `pageSize`：本页大小。
  - `totalPages`：总页数（至少为 `1`）。

### `documents[]` 每项字段

- `id`
- `title`
- `fileName`
- `fileType`（扩展名，如 `pdf`、`txt`）
- `status`：`uploaded` \| `processing` \| `ready` \| `failed`
- `processingError`：`string \| null`，失败时的可读原因
- `createdAt`、`updatedAt`：ISO 8601 字符串

### 失败错误码

- `INVALID_QUERY`：非法的 `page` / `pageSize` / `status`
- `DOCUMENT_LIST_FAILED`：服务端异常

### 当前说明

- 列表为 **服务端分页**，避免一次加载过多数据。
- 与 `POST /api/documents/upload` 使用同一套文档状态语义；上传处理失败时 `processingError` 可被本接口读出并展示。

---

## 3. DELETE `/api/documents/:id`

### 作用
对文档执行 **软删除**（设置 `deletedAt`）：后续列表与知识检索均不再包含该文档。  
Demo 阶段不删除磁盘文件与 `document_chunks` 记录（可留待后续异步清理任务）。

### 路径参数
- `id`：文档 ID

### 成功响应
- `success`: `true`
- `data.id`：已软删除的文档 ID

### 失败错误码

- `INVALID_ID`：缺少或非法的 `id`
- `NOT_FOUND`：文档不存在或已删除
- `DOCUMENT_DELETE_FAILED`：服务端异常

---

## 4. GET `/api/documents/:id`

### 作用
获取单个文档详情。

### 路径参数
- `id`：文档 ID

### 成功返回字段
- `id`
- `title`
- `fileName`
- `fileType`
- `status`
- `createdAt`
- `updatedAt`

### 失败错误码建议
- `DOCUMENT_NOT_FOUND`

### 当前说明
Demo 阶段不一定要展示很复杂的文档详情，但应保留这个接口定义。

---

## 5. POST `/api/qa/ask`

### 作用
基于知识库进行问答。

### 请求字段
- `question`：用户问题，必填

### 成功返回字段
- `answer`
- `citations`
- `confidence`

### `citations` 建议结构
每条 citation 至少包含：
- `documentId`
- `documentTitle`
- `snippet`

### `confidence` 建议值
- `low`
- `medium`
- `high`

### 失败错误码建议
- `INVALID_INPUT`
- `NO_RELEVANT_CONTEXT`
- `LLM_GENERATION_FAILED`

### 当前约束
- 必须返回 `answer`
- 应尽量返回至少一条 citation
- citation 不能只是“文档名”，应有最小引用片段

### 当前说明
知识问答模块的核心价值不只是“能回答”，而是“能带出处回答”。

---

## 6. POST `/api/profiles/extract`

### 作用
从咨询文本中提取客户画像，并**新建**客户记录，或在请求携带 `clientId` 时对**既有客户**合并更新画像与摘要字段。

### 请求字段
- `conversationText`：聊天记录全文，必填。表示**已标准化的咨询文本**，可来源于：
  - 手动粘贴聊天记录
  - 录音转写结果
  - OCR 识别结果
- `clientId`：客户 ID，**可选**。若提供：视为**更新画像**，仅按该 id 定位客户，**不再**按显示名匹配；若不存在则 **404**。
- `clientDisplayName`：客户显示名，**可选**；**仅在新建流程中生效**（未提供 `clientId` 时）。若提供：须 **≥ 3** 个字符且**全库唯一**；若不提供：服务端生成唯一占位显示名。

### 成功返回字段

#### `client`
建议包含：
- `id`
- `displayName`
- `currentStage`
- `updatedAt`

#### `conversationRecord`
建议包含：
- `id`
- `createdAt`

#### `profile`
建议包含：
- `id`
- `studentStage`
- `targetCountry`
- `budgetRange`
- `timeline`
- `mainConcerns`
- `riskFlags`
- `currentStage`
- `structuredJson`

### 失败错误码建议
- `INVALID_INPUT`（HTTP 400）
- `DISPLAY_NAME_TOO_SHORT`（HTTP 400）
- `CLIENT_NOT_FOUND`（HTTP 404，更新流程）
- `CLIENT_DISPLAY_NAME_TAKEN`（HTTP 409，显示名与已有客户冲突）
- `PROFILE_EXTRACTION_FAILED`
- `PROFILE_SCHEMA_INVALID`

### 当前约束
- 必须返回 `client`
- 必须返回 `profile`
- profile 输出必须是稳定结构，而不是自由散文
- `clients.displayName` 在数据库层**唯一**；新建/改名均需满足唯一与最短长度规则

### 当前说明
这个接口是“聊天记录 → 客户画像 → 客户记录”链路的入口。新建与更新通过是否携带 `clientId` 分流；更新路径**以 id 为准**，避免同名误绑客户。

---

## 7. POST `/api/followups/generate`

### 作用
基于客户画像与聊天记录生成跟进消息。

### 请求字段
- `clientId`：客户 ID，必填
- `profileId`：画像 ID，可选
- `conversationRecordId`：聊天记录 ID，可选
- `styleTypes`：要生成的风格列表，必填

### `styleTypes` 建议值
- `wechat_short`
- `semi_formal`
- `english_optional`

### 成功返回字段
- `clientId`
- `followups`

### `followups` 建议结构
每条 follow-up 至少包含：
- `id`
- `styleType`
- `content`

### 失败错误码建议
- `CLIENT_NOT_FOUND`
- `PROFILE_NOT_FOUND`
- `FOLLOWUP_GENERATION_FAILED`
- `FOLLOWUP_SCHEMA_INVALID`

### 当前约束
- 至少支持两种风格输出中的一种
- 推荐支持：
  - 微信简短版
  - 稍正式版

### 当前说明
该接口不负责自动发送，只负责生成可编辑草稿。

---

## 8. GET `/api/clients`

### 作用
获取客户记录列表。

### 可选查询参数
- `keyword`
- `targetCountry`
- `sortBy`

### `sortBy` 建议值
- `updatedAt`
- `createdAt`

### 成功返回字段
每条客户记录建议包含：
- `id`
- `displayName`
- `studentStage`
- `targetCountry`
- `currentStage`
- `updatedAt`

### 当前说明
这是“客户记录模块”的核心列表接口。  
当前只做轻量列表，不扩展成 CRM 筛选系统。

---

## 9. GET `/api/clients/:id`

### 作用
获取单个客户详情。

### 路径参数
- `id`：客户 ID

### 成功返回字段

#### `client`
建议包含：
- `id`
- `displayName`
- `studentStage`
- `targetCountry`
- `budgetRange`
- `currentStage`
- `createdAt`
- `updatedAt`

#### `latestConversationRecord`
建议包含：
- `id`
- `rawText`
- `createdAt`

#### `latestProfile`
建议包含：
- `id`
- `studentStage`
- `targetCountry`
- `budgetRange`
- `timeline`
- `mainConcerns`
- `riskFlags`
- `currentStage`
- `structuredJson`

#### `latestFollowups`
建议包含数组，每项至少有：
- `id`
- `styleType`
- `content`

### 失败错误码建议
- `CLIENT_NOT_FOUND`

### 当前说明
这个接口支撑客户详情页，帮助顾问回看客户信息、聊天内容和最近生成结果。

---

## 10. PATCH `/api/clients/:id`

### 作用
仅更新指定客户的 **`displayName`**，不改变画像与咨询记录等其他数据。

### 路径参数
- `id`：客户 ID

### 请求体（JSON）
- `displayName`：字符串，必填（trim 后须非空、满足最短长度 **≥ 3**、**全库唯一**）

### 成功返回
- `success: true`
- `data`：更新后的客户摘要字段（至少包含 `id`、`displayName`、`updatedAt` 等，以实现为准）

### 失败错误码建议
- `INVALID_INPUT`（HTTP 400）：缺少字段、类型错误等
- `DISPLAY_NAME_EMPTY` / `DISPLAY_NAME_TOO_SHORT`（HTTP 400）
- `CLIENT_NOT_FOUND`（HTTP 404）
- `DISPLAY_NAME_TAKEN`（HTTP 409，与他人显示名冲突）
- `CLIENT_UPDATE_FAILED`（HTTP 500）

### 当前说明
用于客户列表内联改名等场景；与画像提取接口中的显示名校验规则一致（最短长度、唯一性）。

---

## 七、输入校验建议

### 1. 所有 POST 接口必须做参数校验
建议统一使用 Zod。

### 2. 问答接口
至少校验：
- `question` 非空
- 长度在合理范围内

### 3. 画像提取接口
至少校验：
- `conversationText` 非空
- 文本长度不超过系统可承受阈值

### 4. 跟进消息接口
至少校验：
- `clientId` 必填
- `styleTypes` 必填且至少一个

---

## 八、输出结构约束建议

### 1. 问答接口
后端必须保证：
- answer 是字符串
- citations 是数组
- citation 字段完整

### 2. 客户画像接口
后端必须保证：
- profile 为结构化对象
- 高价值字段明确存在
- 不允许前端直接接收模型原始文本

### 3. 跟进消息接口
后端必须保证：
- followups 为数组
- 每条结果都明确标注 styleType
- content 为可直接展示和复制的文本

---

## 九、错误处理约束

### 当前建议前端至少可识别以下错误类别

#### 文档相关
- 上传失败
- 文件格式不支持
- 文档处理失败
- 文档列表加载失败（含非法分页/筛选参数）
- 文档删除失败（含记录不存在或已删除）

#### 问答相关
- 输入无效
- 无可用上下文
- 模型生成失败

#### 画像相关
- 聊天记录为空
- 画像提取失败
- 画像结构不合法
- 显示名过短、重名（`DISPLAY_NAME_TOO_SHORT`、`CLIENT_DISPLAY_NAME_TAKEN` 等）
- 更新流程客户不存在（`CLIENT_NOT_FOUND`）

#### 跟进消息相关
- 客户不存在
- 画像不存在
- 生成失败

#### 客户记录相关
- 客户不存在
- 仅改名：显示名为空/过短、重名（`DISPLAY_NAME_EMPTY`、`DISPLAY_NAME_TOO_SHORT`、`DISPLAY_NAME_TAKEN` 等）

---

## 十、当前暂不定义的接口

为了控制 Demo 范围，当前不定义以下接口：

- 删除客户记录
- 编辑完整客户档案
- 客户阶段流转接口
- 自动发送消息
- Prompt 管理后台接口
- 复杂历史时间轴接口
- CRM 漏斗分析接口
- 多租户组织管理接口

这些能力如有需要，可进入后续版本。

---

## 十一、接口实现建议

### 1. Route Handler 保持轻薄
每个 route 文件只负责：

- 接收请求
- 参数校验
- 调用 service
- 返回结果

不要把核心业务逻辑全部堆在 route 里。

### 2. 业务逻辑放到 service 层
例如：

- 文档处理逻辑放到 `documentService`
- 问答逻辑放到 `qaService`
- 画像提取逻辑放到 `profileService`
- 跟进生成逻辑放到 `followupService`
- 客户记录读取逻辑放到 `clientService`

### 3. 这样做的额外好处
如果未来需要前后端拆分：

- route 层可以替换
- service 层大部分逻辑可复用
- API 契约本身不需要重写

---

## 十二、当前开发优先级建议

### P0 接口
- `POST /api/documents/upload`
- `POST /api/qa/ask`
- `POST /api/profiles/extract`
- `POST /api/followups/generate`

### P1 接口
- `GET /api/documents`（含分页、搜索、状态筛选）
- `DELETE /api/documents/:id`（软删除）
- `GET /api/clients`
- `GET /api/clients/:id`
- `PATCH /api/clients/:id`

### P2 接口
- `GET /api/documents/:id`

说明：

先把 AI 核心闭环打通，再补列表、治理与详情类接口，会更符合当前 Demo 开发节奏。

---

## 十三、关联文档

- [[PRD]]
- [[MVP范围]]
- [[系统架构]]
- [[数据模型]]
- [[客户记录模块]]
- [[输出Schema定义]]