# MCP Figma Bridge 数据量优化方案

## 问题背景

使用 ant-design-vue 等组件库的设计稿时，Table、List 等组件包含大量重复行数据。每行数据可能包含多个单元格，每个单元格又有嵌套结构，导致返回的 JSON 数据量巨大（可能达到数 MB）。

## 核心优化策略

### 1. **智能采样（Smart Sampling）**

对于列表类组件，只保留前 N 行作为示例，标注剩余行数。

```typescript
// 配置示例
const SAMPLING_CONFIG = {
  'table': { maxSamples: 2, structureOnly: false },
  'list': { maxSamples: 2, structureOnly: true },
  'option': { maxSamples: 3, structureOnly: true },
}
```

**效果**：10 行 Table 数据 → 只返回 2 行 + "还有 8 行"的标记

### 2. **深度限制（Max Depth）**

防止无限递归导致的深层嵌套。

```typescript
const MAX_DEPTH = 10; // 超过 10 层的节点会被截断
```

### 3. **结构简化（Structure Simplification）**

对于采样的节点，只保留关键信息，移除冗余属性。

```typescript
// 原始节点：包含位置、样式、效果等大量字段
{
  id: "123",
  name: "Table Row",
  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 },
  effects: [...],
  fills: [...],
  strokes: [...],
  // ... 几十个个字段
}

// 简化后：只保留必要信息
{
  id: "123",
  name: "Table Row",
  type: "INSTANCE",
  _sampled: true,
  exampleTexts: ["示例文本1", "示例文本2"]
}
```

## 使用方法

### 方式一：使用优化版 transform（推荐）

将 `index.ts` 中的导入改为：

```typescript
import { transformToDSL } from './transform-optimized.js';
```

### 方式二：添加采样参数

```typescript
const dsl = transformToDSL(nodeData, {
  framework: 'vue',
  // 采样相关配置
  maxTableRows: 2,      // Table 最多保留 2 行
  maxDepth: 10,         // 最大递归深度
  enableSampling: true, // 启用智能采样
});
```

### 方式三：过滤 Table 子节点（激进方案）

如果 Table 数据完全不需要，可以通过 filterNames 过滤：

```typescript
const dsl = transformToDSL(nodeData, {
  framework: 'vue',
  filterNames: ['table-row', 'tr', 'td', 'cell'], // 过滤表格行/单元格
});
```

## 采样前后的数据对比

### 优化前（10 行 Table）

```json
{
  "name": "Table",
  "children": [
    { "name": "Row-1", "children": [/* 20+ 个单元格节点 */] },
    { "name": "Row-2", "children": [/* 20+ 个单元格节点 */] },
    { "name": "Row-3", "children": [/* 20+ 个单元格节点 */] },
    ... // 还有 7 行
  ]
}
// 数据大小：~500KB - 数 MB
```

### 优化后（采样 2 行）

```json
{
  "name": "Table",
  "_samplingInfo": {
    "totalChildren": 10,
    "displayedChildren": 2,
    "skipped": 8,
    "note": "仅显示前 2 项，共 10 项，其余项结构相同"
  },
  "children": [
    { "name": "Row-1", "_isSample": true, "children": [/* 精简后 */] },
    { "name": "Row-2", "_isSample": true, "children": [/* 精简后 */] }
  ]
}
// 数据大小：~10KB - 50KB
```

## 针对不同场景的优化建议

### 场景 1：只需要 Table 结构，不需要数据

```typescript
const dsl = transformToDSL(nodeData, {
  maxTableRows: 1,
  enableSampling: true,
  // 或者完全过滤掉行数据，只保留列定义
  filterNames: ['row', 'tr', 'tbody'],
});
```

### 场景 2：需要完整的列表数据（如 Select 选项）

```typescript
const dsl = transformToDSL(nodeData, {
  maxTableRows: 10,  // 增加采样数
  enableSampling: true,
});
```

### 场景 3：设计稿包含大量图标/图片

添加自定义过滤器：

```typescript
const dsl = transformToDSL(nodeData, {
  filterNames: ['icon', 'image', 'img', 'picture'],
  useDefaultFilter: true,
});
```

## 更新 transform.ts 的简易方案

如果不想使用新文件，可以直接修改现有的 `transform.ts`：

### 步骤 1：添加采样配置（在文件顶部）

```typescript
const SAMPLING_CONFIG = {
  'table': 2,
  'list': 2,
  'row': 2,
};
```

### 步骤 2：修改 processNode 函数

在递归处理 children 时，添加采样逻辑：

```typescript
// 在 processNode 函数中，处理 children 的部分
if (node.children && node.children.length > 0) {
  const maxSamples = SAMPLING_CONFIG[node.name?.toLowerCase()] || Infinity;

  result.children = node.children
    .slice(0, maxSamples)  // 只取前 N 个
    .map((child: any) => processNode(child, newContext))
    .filter((child: any) => child !== null);

  // 如果有截断，添加标记
  if (node.children.length > maxSamples) {
    result._truncated = true;
    result._totalChildren = node.children.length;
  }
}
```

## 预期效果

| 组件类型 | 原始数据量 | 优化后数据量 | 压缩比 |
|---------|-----------|-------------|--------|
| Table (10行) | 2-5 MB | 20-50 KB | 100x |
| List (20项) | 1-3 MB | 15-30 KB | 100x |
| Select (50选项) | 500 KB | 30 KB | 15x |
| Timeline (10节点) | 800 KB | 40 KB | 20x |

## 注意事项

1. **AI 理解能力**：保留的样本足以让 AI 理解组件结构，生成正确的代码模板
2. **数据完整性**：`_samplingInfo` 字段明确告知 AI 数据已被采样，避免误解
3. **可配置性**：根据实际需求调整采样参数，平衡数据完整性和大小
