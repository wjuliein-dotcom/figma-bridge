# figma-bridge MCP 记录

## 项目概述

**figma-bridge** 是一个基于 MCP (Model Context Protocol) 的工具，用于从 Figma 获取节点数据并转换为 AI 可理解的 DSL（领域特定语言），帮助生成 Vue 3 组件代码。

## 技术栈

- **MCP Server**: `@modelcontextprotocol/sdk`
- **语言**: TypeScript
- **目标框架**: Vue 3 (Composition API + TypeScript)

## 核心功能

通过 Figma API 获取节点数据，经过 `transformToDSL` 函数处理，过滤掉无关的布局信息（坐标、阴影、混合模式等），保留组件树层级和布局模式，输出结构化的 DSL 供 AI 生成代码使用。

---

## 修改一：过滤左侧菜单和页头（2026-03-05）

### 1. 新增配置参数

在 `transform.ts` 和 `index.ts` 中新增了两个配置参数：

- **`siderWidth`**: 左侧菜单栏宽度阈值（默认 220px）
- **`headerHeight`**: 顶部头部高度阈值（默认 64px）

### 2. 位置判断函数

新增两个位置判断函数：

- **`isPageLevelSider(node)`**: 判断节点是否在左侧菜单区域
  - 条件：`x < 50` (靠近左侧) 且 `width` 在 `siderWidth ± 50` 范围内，且 `height > 100`
- **`isPageLevelHeader(node)`**: 判断节点是否在顶部头部区域
  - 条件：`y < 50` (靠近顶部) 且 `height` 在 `headerHeight ± 20` 范围内，且 `width > 100`

### 3. 过滤逻辑优化

**原来的逻辑**：通过节点名称（menu、header 等）和层级深度（depth）来判断是否过滤

**优化后的逻辑**：
- **Menu/Sidebar/Sider**: 只在**左侧区域**内识别并过滤，其他位置保留
- **Header/Navbar/Navigation**: 只在**顶部区域**内识别并过滤，其他位置保留
- 组件内部的 Menu/Header 不会被错误过滤（如 Dropdown 中的 Menu、Card 中的 Header）

### 4. API 参数更新

在 `index.ts` 的 `get-figma-node` 工具中添加了两个可选参数：
```typescript
siderWidth: z.number().optional().default(220).describe("左侧菜单栏宽度阈值"),
headerHeight: z.number().optional().default(64).describe("顶部头部高度阈值")
```

### 过滤规则总结

| 节点名称 | 位置条件 | 结果 |
|---------|---------|------|
| Menu/Sidebar/Sider | 左侧区域 (x≈0, width≈siderWidth) | 过滤 |
| Menu/Sidebar/Sider | 其他位置 | 保留 |
| Header/Navbar/Navigation | 顶部区域 (y≈0, height≈headerHeight) | 过滤 |
| Header/Navbar/Navigation | 其他位置 | 保留 |
| 基本图形 (TEXT/VECTOR/ELLIPSE/RECTANGLE) | 任意位置 | 保留 |
| 白名单组件内的子节点 | 任意位置 | 保留 |

### 文件结构

```
figma-to-code-mcp/
├── src/
│   ├── index.ts          # MCP 工具定义和 API 调用
│   └── transform.ts      # DSL 转换逻辑（过滤、映射）
├── .env                  # 环境变量（FIGMA_TOKEN, FILE_KEY）
├── package.json
└── tsconfig.json
```

### 环境变量

- `FIGMA_TOKEN`: Figma API Token
- `FILE_KEY`: Figma 文件 Key

### 使用示例

```typescript
// 调用 transformToDSL
const dsl = transformToDSL(node, {
  framework: 'vue',
  filterNames: [],
  useDefaultFilter: true,
  siderWidth: 220,    // 自定义侧边栏宽度
  headerHeight: 64    // 自定义头部高度
});
```

### 后续优化方向

1. **自适应尺寸检测**: 根据页面整体尺寸自动推断 siderWidth 和 headerHeight
2. **多区域支持**: 支持右侧菜单、底部 footer 等区域的识别
3. **组件识别增强**: 通过 Figma 的 componentId 识别组件类型

---

## 修改二：Bug 修复（2026-03-06）

#### 问题描述
调用 MCP 工具 `get-figma-node` 时返回错误：`Cannot read properties of undefined (reading 'document')`

#### 问题原因

1. **节点ID格式不匹配**：Figma API 返回的节点ID使用冒号 `:` 分隔（如 `1:16253`），但用户传入的是连字符 `-` 分隔的格式（如 `1-16253`）。这导致 `data.nodes[nodeId]` 返回 `undefined`。

2. **环境变量加载失败**：使用 `import 'dotenv/config'` 时，当 MCP 服务器通过绝对路径启动，无法正确找到 `.env` 文件，导致 `FIGMA_TOKEN` 和 `FILE_KEY` 为 `undefined`。

#### 解决方案

**1. 节点ID标准化处理**（`src/index.ts`）

```typescript
// 标准化节点ID：将连字符替换为冒号（Figma标准格式）
const normalizedNodeId = nodeId.replace(/-/g, ':');
```

用户现在可以使用 `1-16253` 或 `1:16253` 两种格式调用工具。

**2. 修复环境变量加载**（`src/index.ts`）

```typescript
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

// 验证环境变量
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FILE_KEY;

if (!FIGMA_TOKEN) {
    console.error('错误: 环境变量 FIGMA_TOKEN 未设置');
    process.exit(1);
}
if (!FILE_KEY) {
    console.error('错误: 环境变量 FILE_KEY 未设置');
    process.exit(1);
}
```

**3. 增强错误处理**

添加了完整的 try-catch 错误处理，包括：
- Figma API 响应状态检查
- 节点存在性验证
- 返回结构化的错误信息


## 修改三：Table、List 组件数据量过大问题（2026-03-06）

### 问题描述
Table、List 等组件在 Figma 设计中通常包含大量重复的行/项（如 20+ 行数据），导致生成的 DSL 数据量过大，超出 AI 上下文限制。

### 解决方案

实现了**两种采样策略**，分别位于不同文件：

#### 方案 A：基础采样（transform-optimized.ts）

**原理**：通过预扫描统计节点数量，对超过阈值的组件进行采样。

**核心配置** (`SAMPLING_COMPONENTS`):
```typescript
const SAMPLING_COMPONENTS: Record<string, SamplingConfig> = {
  'table': { maxSamples: 2, structureOnly: false },
  'row': { maxSamples: 3, structureOnly: true },
  'list': { maxSamples: 2, structureOnly: false },
  'item': { maxSamples: 3, structureOnly: true },
  'option': { maxSamples: 3, structureOnly: true },
  // ...
};
```

**处理逻辑**：
1. 预扫描阶段统计各类型节点数量
2. 当节点数量超过 `maxSamples` 阈值时启用采样
3. 只保留前 N 个样本，其余标记为跳过
4. 在 `_samplingInfo` 中记录采样信息

**输出标记**：
```typescript
{
  _samplingInfo: {
    totalChildren: 20,      // 原始子节点数
    displayedChildren: 2,   // 保留的子节点数
    skipped: 18,            // 跳过的子节点数
    note: "仅显示前 2 项，共 20 项，其余项结构相同"
  }
}
```

#### 方案 B：智能指纹采样（transform-fingerprint.ts）【推荐】

**原理**：通过结构指纹识别，保留所有**不同结构**的样本，丢弃完全重复的行。

**核心概念**：
1. **节点指纹** (`NodeFingerprint`): 基于节点类型、子节点结构、属性等生成的唯一标识
2. **相似度计算**: 比较两个指纹的相似度（0-1），1 表示完全相同
3. **智能选择**: 保留不同结构的节点，跳过完全重复的结构

**指纹计算**:
```typescript
interface NodeFingerprint {
  structureHash: string;    // 结构哈希（类型+布局+子节点数）
  childTypes: string;       // 子节点类型序列
  propSignature: string;    // 属性签名
  depth: number;
  childCount: number;
}
```

**特殊保留规则** (`preservePatterns`):
- 展开/收起状态: `expand`, `collapsed`, `展开`
- 选中/激活状态: `selected`, `active`, `checked`, `选中`
- 交互状态: `focus`, `hover`, `disabled`, `loading`, `error`
- Table/List 特有: `header-row`, `summary`, `loadmore`, `pagination`

**配置选项**:
```typescript
interface FingerprintConfig {
  namePatterns: string[];        // 启用采样的组件名称匹配
  similarityThreshold: number;   // 相似度阈值（默认 0.95）
  maxUniqueStructures: number;   // 最大保留的唯一结构数（默认 3）
  preservePatterns: string[];    // 始终保留的特殊节点名称
}
```

**输出标记**：
```typescript
{
  _isRepresentative: true,      // 标记为代表节点
  _originalIndex: 0,            // 原始索引
  _duplicateCount: 17,          // 重复数量
  _note: "此结构共有 18 个相同节点",
  _samplingInfo: {
    method: 'fingerprint',
    totalChildren: 20,
    preservedChildren: 3,
    skippedChildren: 17,
    fingerprints: [...]  // 指纹详情
  }
}
```

### 两种方案对比

| 特性 | 基础采样 (transform-optimized.ts) | 智能指纹采样 (transform-fingerprint.ts) |
|------|----------------------------------|----------------------------------------|
| **采样策略** | 保留前 N 个 | 保留所有不同结构 |
| **结构识别** | 无 | 有（指纹相似度） |
| **特殊状态保留** | 不支持 | 支持（展开、选中态等） |
| **数据完整性** | 可能丢失不同结构 | 保留所有独特结构 |
| **复杂度** | 低 | 中等 |
| **推荐场景** | 简单列表 | 复杂 Table/List |

### API 参数更新

在 `get-figma-node` 工具中新增参数（以指纹采样版为例）：
```typescript
{
  enableFingerprintSampling: z.boolean().optional().default(true)
    .describe("是否启用智能指纹采样"),
  fingerprintConfig: z.object({
    similarityThreshold: z.number().optional(),
    maxUniqueStructures: z.number().optional(),
  }).optional().describe("指纹采样配置")
}
```

### 影响文件
- `src/transform-optimized.ts` - 基础采样版
- `src/transform-fingerprint.ts` - 智能指纹采样版（推荐）

---

## 修改四：指纹采样功能集成到主代码（2026-03-06）

### 目标
将智能指纹采样方案从 `transform-fingerprint.ts` 集成到主代码 `transform.ts` 中，使其成为默认功能。

### 集成过程

#### 1. 添加类型定义

在 `transform.ts` 中添加指纹采样相关的类型定义：

```typescript
// ===== 指纹采样配置 =====
interface FingerprintConfig {
  namePatterns: string[];           // 启用采样的组件名称匹配
  similarityThreshold: number;      // 指纹相似度阈值（0-1）
  maxUniqueStructures: number;      // 最大保留的唯一结构数
  preservePatterns: string[];       // 始终保留的特殊节点名称
}

// 节点结构指纹
interface NodeFingerprint {
  structureHash: string;            // 结构哈希
  childTypes: string;               // 子节点类型序列
  propSignature: string;            // 属性签名
  depth: number;
  childCount: number;
}

// 采样结果记录
interface SamplingRecord {
  preservedIndices: number[];
  skippedIndices: number[];
  fingerprintMap: Map<string, number[]>;
  duplicatesCount: Map<number, number>;
}
```

#### 2. 添加默认配置

```typescript
const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  namePatterns: [
    'row', 'tr', 'tbody',                     // Table 相关
    'list-item', 'listitem', 'item',          // List 相关
    'option',                                 // Select/Dropdown
    'step', 'tab', 'panel', 'timeline-item',  // Steps/Tab/Timeline
    'menu-item', 'menuitem',                  // Menu
  ],
  similarityThreshold: 0.95,
  maxUniqueStructures: 3,
  preservePatterns: [
    // 展开/收起
    'expand', 'expanded', 'collapse', 'collapsed', '展开', '收起',
    // 选中/激活
    'selected', 'active', 'current', 'checked', '选中', '激活', '当前',
    // 交互状态
    'focus', 'hover', 'disabled', 'loading', 'error', '空状态',
    // 特殊行
    'loadmore', 'load-more', 'pagination', 'header', 'footer',
    'header-row', 'headerrow', 'summary', 'summary-row',
  ],
};
```

#### 3. 扩展 TransformOptions 接口

```typescript
interface TransformOptions {
  // ... 原有选项
  maxDepth?: number;                           // 最大递归深度
  enableFingerprintSampling?: boolean;         // 是否启用指纹采样
  fingerprintConfig?: Partial<FingerprintConfig>; // 采样配置
}
```

#### 4. 实现核心函数

**calculateFingerprint()** - 计算节点指纹：
```typescript
function calculateFingerprint(node: any, depth: number = 0): NodeFingerprint {
  const childTypes = node.children
    ? node.children.map((c: any) => `${c.type}:${c.name?.substring(0, 20) || ''}`).join('|')
    : '';
  const propKeys = node.componentProperties
    ? Object.keys(node.componentProperties).sort().join(',')
    : '';
  const structureHash = `${node.type}:${node.layoutMode || 'NONE'}:${node.children?.length || 0}:${childTypes}`;

  return { structureHash, childTypes, propSignature: propKeys, depth, childCount: node.children?.length || 0 };
}
```

**compareFingerprints()** - 比较指纹相似度：
```typescript
function compareFingerprints(fp1: NodeFingerprint, fp2: NodeFingerprint): number {
  if (fp1.structureHash !== fp2.structureHash) return 0;
  if (fp1.childCount !== fp2.childCount) return 0.5;
  if (fp1.propSignature !== fp2.propSignature) return 0.8;
  if (fp1.childTypes !== fp2.childTypes) return 0.9;
  return 1; // 完全匹配
}
```

**fingerprintSampling()** - 智能采样算法：
```typescript
function fingerprintSampling(children: any[], config: FingerprintConfig): { preserved: any[]; record: SamplingRecord } {
  // 1. 计算所有指纹
  // 2. 遍历子节点，保留不同结构，跳过重复
  // 3. 特殊节点（展开态、选中态）始终保留
  // 4. 返回保留的节点和采样记录
}
```

#### 5. 修改 processNode 函数

在递归处理子节点时集成指纹采样：

```typescript
function processNode(node: any, context: ProcessContext): any | null {
  // 深度限制检查
  if (context.depth > maxDepth) {
    return { id: node.id, name: node.name, type: node.type, _truncated: true, reason: 'max-depth-reached' };
  }

  // ... 过滤逻辑 ...

  // 递归处理子节点
  if (node.children && node.children.length > 0) {
    // 检查是否启用指纹采样
    if (isFingerprintSamplingTarget(node.name || '') && node.children.length > 1) {
      // 智能指纹采样
      const { preserved, record } = fingerprintSampling(node.children, config);

      result.children = preserved.map((child) => {
        const processed = processNode(child, newContext);
        if (processed) {
          processed._isRepresentative = true;
          processed._originalIndex = child._originalIndex;
          // 添加重复计数标记
          const dupCount = record.duplicatesCount.get(child._originalIndex);
          if (dupCount && dupCount > 0) {
            processed._duplicateCount = dupCount;
            processed._note = `此结构共有 ${dupCount + 1} 个相同节点`;
          }
        }
        return processed;
      }).filter((child: any) => child !== null);

      // 添加采样信息
      result._samplingInfo = {
        method: 'fingerprint',
        totalChildren: node.children.length,
        preservedChildren: record.preservedIndices.length,
        skippedChildren: record.skippedIndices.length,
        // ... 指纹详情
      };
    } else {
      // 普通处理
      result.children = node.children
        .map((child: any) => processNode(child, newContext))
        .filter((child: any) => child !== null);
    }
  }

  return result;
}
```

#### 6. 更新 index.ts API 参数

```typescript
server.tool("get-figma-node", {
  // ... 原有参数
  maxDepth: z.number().optional().default(10),
  enableFingerprintSampling: z.boolean().optional().default(true),
  fingerprintConfig: z.object({
    similarityThreshold: z.number().optional(),
    maxUniqueStructures: z.number().optional(),
  }).optional(),
}, async ({ ..., maxDepth, enableFingerprintSampling, fingerprintConfig }) => {
  const dsl = transformToDSL(nodeData, {
    // ... 原有选项
    maxDepth,
    enableFingerprintSampling,
    fingerprintConfig,
  });
});
```

### 输出标记

启用采样后，节点会包含以下标记：

```typescript
{
  _isRepresentative: true,          // 标记为代表节点
  _originalIndex: 0,                // 原始索引
  _duplicateCount: 17,              // 重复数量
  _note: "此结构共有 18 个相同节点",
  _samplingInfo: {
    method: 'fingerprint',
    totalChildren: 20,
    preservedChildren: 3,
    skippedChildren: 17,
    preservedIndices: [0, 5, 12],
    skippedIndices: [1, 2, 3, ...],
    fingerprints: [...]
  }
}
```

### 影响文件
- `src/transform.ts` - 主转换逻辑（集成指纹采样）
- `src/index.ts` - API 参数更新

---



# Figma 矢量地狱（Vector Hell）优化方案

## 问题描述
Figma 中的矢量图标（Icon/Illustration）常由大量嵌套的 `GROUP` 和 `VECTOR` 节点组成，形成典型的“矢量地狱”：

- **数据爆炸**：一个简单图标可能包含几十个 `VECTOR` 节点。
- **路径数据庞大**：每个 `VECTOR` 节点包含 `vectorPaths`、`vectorNetwork`、`fillGeometry` 等复杂几何数据。
- **深层嵌套**：`GROUP > GROUP > VECTOR` 的嵌套结构可达 5-10 层。
- **Token 浪费**：直接传递给 AI 会消耗大量 Token，且严重干扰其对页面布局的理解。

---

## 核心优化策略

### 1. 智能图标检测（isIconContainer）
**判定条件：**

- 节点类型为 `GROUP` 或 `FRAME`。
- 包含 3 个以上 `VECTOR` 子节点（可配置 `minVectorChildren`）。
- 尺寸不超过 200px（大容器不视为图标）。

```typescript
function isIconContainer(node: any): boolean {
  if (!['GROUP', 'FRAME'].includes(node.type)) return false;
  const vectorCount = node.children.filter((c: any) => c.type === 'VECTOR').length;
  return vectorCount >= vectorConfig.minVectorChildren; // 默认 3
}

```

---

### 2. 矢量数据简化（simplifyVectorNode）
**保留属性（白名单）：**

- `id`, `name`, `type`, `visible`, `opacity`
- `absoluteBoundingBox`（位置和尺寸）
- `fills`, `strokes`（颜色和样式）
- `effects`, `styles`（效果）
- `componentProperties`（组件属性）
**过滤属性（导致数据爆炸）：**

```typescript
const VECTOR_BLOAT_PROPS = [
  'vectorPaths',       // 矢量路径数据（最大的罪魁祸首）
  'vectorNetwork',     // 矢量网络
  'fillGeometry',      // 填充几何
  'strokeGeometry',    // 描边几何
  'strokeCap',         // 描边端点
  'strokeJoin',        // 描边连接
  'strokeMiterAngle',  // 描边斜接角度
  'dashPattern',       // 虚线模式
  'fillOverrideTable', // 填充覆盖表
  'strokeOverrideTable',// 描边覆盖表
  'styleOverrideTable', // 样式覆盖表
  'arcData',            // 弧线数据
  'lineIndentation',    // 行缩进
  'lineSpacing',        // 行间距
  'paragraphSpacing',   // 段落间距
  'paragraphIndent',    // 段落缩进
  'hyperlink',          // 超链接
];

```
**Fills/Strokes 特殊处理：**

- 移除 `imageRef`, `imageTransform` 等二进制引用。
- 将渐变数据替换为占位符 `[GradientStops]`。

---

### 3. 扁平化嵌套（flattenIconChildren）
**处理逻辑：**

- 将 `GROUP > GROUP > VECTOR` 的深层嵌套扁平化。
- 超过 `maxNestingDepth`（默认 3 层）后返回占位符。
- 直接提取 `VECTOR` 子节点，跳过中间 `GROUP` 层级。
**效果对比：**

- **优化前**：
`GROUP (icon-user) -> GROUP (Vector 1) -> VECTOR (path 1)`
- **优化后**：
`GROUP (icon-user) [_isIcon: true] -> VECTOR (path 1) [_isIconPart: true]`

---

### 4. AI 友好标记
输出结构中的特殊字段：

- `_isIcon: true`：标记图标容器，AI 可识别为图标元素。
- `_isIconPart: true`：标记图标内部的矢量子元素。
- `_iconInfo`：图标元数据（子元素数量、矢量数量、边界框）。
- `_note`：人类可读的说明文字。
- `_flattened: true`：标记被扁平化的节点。

---

## 配置接口

```typescript
interface VectorHellConfig {
  /** 启用矢量地狱检测 */
  enabled: boolean;
  /** 判定为图标的最小 VECTOR 子节点数量 */
  minVectorChildren: number;
  /** 判定为图标的最大尺寸（像素），超过此尺寸视为普通容器 */
  maxIconSize: number;
  /** 最大嵌套深度，超过则扁平化 */
  maxNestingDepth: number;
  /** 要保留的矢量属性白名单 */
  preserveVectorProps: string[];
}

// 默认配置
const DEFAULT_VECTOR_HELL_CONFIG: VectorHellConfig = {
  enabled: true,
  minVectorChildren: 3,      // 3个及以上 VECTOR 子节点视为图标
  maxIconSize: 200,          // 大于 200px 的容器不视为图标
  maxNestingDepth: 3,        // 超过3层嵌套则扁平化
  preserveVectorProps: [
    'id', 'name', 'type', 'visible', 'opacity',
    'absoluteBoundingBox', 'layoutMode', 'fills', 'strokes',
    'effects', 'styles', 'componentProperties'
  ],
};

```

---

## 使用方式

### MCP 工具参数

```json
{
  "enableVectorHellOptimization": true,
  "vectorHellConfig": {
    "minVectorChildren": 5,
    "maxIconSize": 150,
    "maxNestingDepth": 2
  }
}

```

---

## 优化效果对比

### 优化前（总大小：50KB - 500KB+）
包含数千字节的 `vectorPaths` 和 `vectorNetwork` 数据。

### 优化后（总大小：2KB - 5KB，减少 90%+）

```json
{
  "id": "1:123",
  "name": "icon-user",
  "type": "GROUP",
  "_isIcon": true,
  "_note": "图标/插画元素（包含 12 个矢量子元素，已优化）",
  "children": [
    {
      "id": "1:124",
      "name": "Vector 1",
      "type": "VECTOR",
      "_isIconPart": true,
      "fills": [...]
    }
  ]
}

```

---

## 对 AI 的提示意义
当 AI 识别到 `_isIcon: true` 时：

1. **识别意图**：这是一个图标，不是布局容器。
2. **避免冗余**：子元素是矢量路径，不需要分析内部结构或尝试用 `div` 还原。
3. **组件映射**：优先使用图标库（如 `@ant-design/icons-vue`）或 `<img>` 标签。

---

## 实现位置

- **文件**：`src/transform.ts`
- **关键函数**：`isIconContainer`, `simplifyVectorNode`, `flattenIconChildren`
- **集成点**：`processNode` 函数中的矢量地狱优化分支。

---

## 修改五：调整布局过滤与白名单判断逻辑（2026-03-31）

### 目标
调整 `shouldFilter` 函数的判断顺序，使其先判断节点位置区域，再判断白名单状态。

### 逻辑变更

**原逻辑**：
1. 先检查白名单 → 在白名单内则保留
2. 再检查位置区域 → 在区域内则过滤
3. 不在区域内但匹配过滤列表 → 过滤

**新逻辑**：
1. 先检查是否在特定区域（左侧区域检测 Menu，顶部区域检测 Header）
2. 在区域内 → 检查白名单
   - 是白名单组件 → **保留**
   - 非白名单组件 → **过滤**
3. 不在区域内 → 按原有逻辑判断是否过滤

### 代码实现

```typescript
// 在 filter.ts 中的 shouldFilter 函数
function shouldFilter(node: any, context: ProcessContext, filterCtx: FilterContext): boolean {
  // 1. 基本图形类型保留
  if (PRESERVE_TYPES_IN_COMPONENTS.includes(node.type)) {
    return false;
  }

  // 2. Menu/Sidebar/Sider：在左侧区域内识别
  if (isMenuOrSidebar(nodeName)) {
    if (isPageLevelSider(node, siderWidth)) {
      // 在区域内，检查白名单
      return !isInWhitelistedParent(nodeName, context);
    }
    // 不在左侧区域，按正常逻辑判断
    return matchesFilter(nodeName, filterNames);
  }

  // 3. Header：在顶部区域内识别
  if (isHeaderOrNavbar(nodeName)) {
    if (isPageLevelHeader(node, headerHeight)) {
      // 在区域内，检查白名单
      return !isInWhitelistedParent(nodeName, context);
    }
    // 不在顶部区域，按正常逻辑判断
    return matchesFilter(nodeName, filterNames);
  }

  // 4. 其他节点原有逻辑...
}
```

### 影响
- 确保只有非白名单的 Menu/Header 在特定区域内才会被过滤
- 白名单组件（如 Card 中的 Header、Dropdown 中的 Menu）即使在区域内也会保留

### 影响文件
- `src/filter.ts` - 布局过滤逻辑

---

## 修改六：解耦 transform.ts 核心功能（2026-03-31）

### 目标
将 `transform.ts` 中的多个核心功能解耦，拆分为独立的模块文件，提高代码可维护性和可测试性。

### 解耦前的问题
- `transform.ts` 文件超过 850 行，包含多个功能混杂
- 类型定义、配置、过滤逻辑、矢量优化、指纹采样全部耦合在一起
- 难以单独测试和维护某个功能模块

### 解耦后的文件结构

| 文件 | 职责 | 导出内容 |
|------|------|----------|
| `types.ts` | 类型定义 | 所有接口类型 |
| `config.ts` | 默认配置 | 过滤名称、白名单、配置常量 |
| `filter.ts` | 布局过滤 | `shouldFilter`, `isPageLevelSider`, `isPageLevelHeader` |
| `whitelist.ts` | 白名单系统 | `isInWhitelistedParent`, `getWhitelistTypes` |
| `vector-optimization.ts` | 矢量地狱优化 | `isIconContainer`, `simplifyVectorNode`, `flattenIconChildren` |
| `fingerprint-sampling.ts` | 智能指纹采样 | `calculateFingerprint`, `fingerprintSampling` |
| `node-processor.ts` | 节点处理器 | `processNode`（整合各功能） |
| `meta-builder.ts` | 元信息构建 | `buildMetaInfo` |
| `transform.ts` | 主入口 | `transformToDSL`（整合各模块） |

### 模块依赖关系

```
transform.ts (主入口)
    ├── types.ts
    ├── config.ts
    ├── filter.ts ──────→ whitelist.ts
    ├── vector-optimization.ts
    ├── fingerprint-sampling.ts
    ├── node-processor.ts ───→ filter.ts, vector-optimization.ts, fingerprint-sampling.ts
    └── meta-builder.ts
```

### 关键改动

**1. 类型定义独立（types.ts）**
```typescript
export interface TransformOptions { ... }
export interface ProcessContext { ... }
export interface VectorHellConfig { ... }
export interface FingerprintConfig { ... }
export interface NodeFingerprint { ... }
export interface SamplingRecord { ... }
```

**2. 配置独立（config.ts）**
```typescript
export const DEFAULT_FILTERED_NAMES = [...];
export const COMPONENT_COMPOSITION_WHITELIST = {...};
export const DEFAULT_VECTOR_HELL_CONFIG = {...};
export const DEFAULT_FINGERPRINT_CONFIG = {...};
```

**3. 过滤逻辑独立（filter.ts）**
```typescript
export function isPageLevelSider(node: any, siderWidth: number): boolean
export function isPageLevelHeader(node: any, headerHeight: number): boolean
export function shouldFilter(node: any, context: ProcessContext, filterCtx: FilterContext): boolean
```

**4. 矢量优化独立（vector-optimization.ts）**
```typescript
export function isIconContainer(node: any, config: VectorHellConfig): boolean
export function simplifyVectorNode(node: any, isInsideIcon: boolean, config: VectorHellConfig): any
export function flattenIconChildren(children: any[], currentDepth: number, config: VectorHellConfig): any[]
```

**5. 指纹采样独立（fingerprint-sampling.ts）**
```typescript
export function calculateFingerprint(node: any, depth: number): NodeFingerprint
export function compareFingerprints(fp1: NodeFingerprint, fp2: NodeFingerprint): number
export function fingerprintSampling(children: any[], config: FingerprintConfig): { preserved: any[]; record: SamplingRecord }
```

**6. transform.ts 简化为整合入口**
```typescript
import { processNode } from './node-processor.js';
import { buildMetaInfo } from './meta-builder.js';

export function transformToDSL(node: any, options: TransformOptions = {}) {
  // 合并配置
  // 构建依赖
  // 调用 processNode
  // 返回结果
}
```

### 删除的文件
- `src/transform-fingerprint.ts` - 已集成到独立模块
- `src/transform-optimized.ts` - 已集成到独立模块

### 影响
- 代码职责清晰，每个文件专注于单一功能
- 便于单元测试（可单独测试各个模块）
- 便于后续扩展（新增功能只需添加新模块）
- 主入口 `transform.ts` 从 850+ 行简化到约 80 行

---

## 当前状态

- 所有已知问题已修复
- Table、List 等重复组件的数据量问题已通过指纹采样方案解决
- **智能指纹采样已集成到主代码 `transform.ts`**（默认启用）
- 备用方案 `transform-optimized.ts` 和 `transform-fingerprint.ts` 保留用于参考

---

## 修改七：过滤 Figma 隐藏节点（2026-03-31）

### 问题描述
Figma 设计中存在一些被隐藏的节点（`visible: false`），这些节点在设计稿中不可见，但会被 Figma API 返回。当前转换逻辑未过滤这些节点，导致生成不必要的 DSL 数据。

### 解决方案
在 `shouldFilter` 函数中添加对隐藏节点的检测和过滤。

### 代码实现

**在 `src/filter.ts` 中新增辅助函数**：

```typescript
/**
 * 检查节点是否被隐藏
 */
function isNodeHidden(node: any): boolean {
  // visible: false 表示节点在 Figma 中被隐藏
  return node.visible === false;
}
```

**在 `shouldFilter` 函数开头添加过滤逻辑**：

```typescript
export function shouldFilter(
  node: any,
  context: ProcessContext,
  filterCtx: FilterContext
): boolean {
  // 过滤隐藏的节点
  if (isNodeHidden(node)) {
    return true;
  }

  // ... 原有逻辑
}
```

### 过滤规则

| 节点状态 | 处理结果 |
|---------|---------|
| `visible: false` | **过滤** |
| `visible: true` 或 `undefined` | 按原有逻辑处理 |

### 影响文件
- `src/filter.ts` - 布局过滤逻辑

### 后续优化方向
1. 可考虑添加配置选项 `includeHiddenNodes` 允许用户选择是否保留隐藏节点
2. 在 `_meta` 中记录被过滤的隐藏节点数量

---

## 修改八：禁用智能指纹采样功能（2026-03-31）

### 目标
将智能指纹采样功能从默认流程中解除，改为默认禁用状态。实际使用中发现该功能并非必需，且保留完整结构更有利于 AI 理解组件设计。

### 修改内容

**1. 修改默认配置**

在 `transform.ts` 中将 `enableFingerprintSampling` 的默认值从 `true` 改为 `false`：

```typescript
const {
  // ... 其他选项
  enableFingerprintSampling = false,  // 原值为 true
  // ...
} = options;
```

**2. 注释指纹采样执行逻辑**

在 `node-processor.ts` 的 `processChildren` 函数中，将指纹采样逻辑注释掉，改为普通处理：

```typescript
function processChildren(...) {
  // 指纹采样功能已禁用（2026-03-31）
  // 如需重新启用，取消注释以下代码块：
  /*
  // 检查是否启用指纹采样
  if (isFingerprintSamplingTarget(...) && node.children.length > 1) {
    // 智能指纹采样逻辑...
  }
  */
  {
    // 普通处理（默认行为）
    result.children = node.children
      .map((child: any) => processNode(child, newContext, deps))
      .filter((child: any) => child !== null);
  }
}
```

**3. 更新函数注释**

将 `processChildren` 函数的注释从"处理子节点（带指纹采样）"改为"处理子节点（指纹采样已禁用）"。

### 注意事项

- `fingerprint-sampling.ts` 文件保留，未被删除
- 如需重新启用该功能，只需：
  1. 将 `transform.ts` 中的默认值改回 `true`
  2. 取消 `node-processor.ts` 中的代码块注释

### 影响文件
- `src/transform.ts` - 修改默认配置
- `src/node-processor.ts` - 注释指纹采样执行逻辑

---


## 修改汇总表

| 时间 | 类型 | 主要内容 | 影响文件 |
|------|------|----------|----------|
| 2026-03-05 | 功能增强 | 智能过滤左侧菜单和页头 | `src/transform.ts`, `src/index.ts` |
| 2026-03-06 | Bug 修复 | 节点ID标准化、环境变量加载修复 | `src/index.ts` |
| 2026-03-06 | 性能优化 | Table/List 数据采样（两种方案） | `src/transform-optimized.ts`, `src/transform-fingerprint.ts` |
| 2026-03-06 | 功能集成 | 指纹采样功能集成到 transform.ts | `src/transform.ts`, `src/index.ts` |
| 2026-03-31 | 逻辑调整 | 调整布局过滤与白名单判断顺序 | `src/filter.ts` |
| 2026-03-31 | 代码重构 | 解耦 transform.ts 核心功能 | `src/types.ts`, `src/config.ts`, `src/filter.ts`, `src/whitelist.ts`, `src/vector-optimization.ts`, `src/fingerprint-sampling.ts`, `src/node-processor.ts`, `src/meta-builder.ts`, `src/transform.ts` |
| 2026-03-31 | 功能增强 | 过滤 Figma 隐藏节点（visible: false）| `src/filter.ts` |
| 2026-03-31 | 功能调整 | 禁用智能指纹采样（默认关闭）| `src/transform.ts`, `src/node-processor.ts` |

---