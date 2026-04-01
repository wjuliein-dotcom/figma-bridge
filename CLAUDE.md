# figma-bridge

基于 MCP (Model Context Protocol) 的工具，将 Figma 设计节点转换为结构化 DSL，辅助生成 Vue 3 / React / HTML 组件代码。

## 项目结构

```
src/
├── index.ts              # MCP Server 入口，工具定义
├── transform.ts          # 转换主入口，整合所有模块
├── types.ts              # 类型定义
├── config.ts             # 默认配置（过滤名称、白名单、采样配置）
├── filter.ts             # 布局过滤逻辑（Menu、Header 区域识别）
├── whitelist.ts          # 组件白名单系统
├── vector-optimization.ts # 矢量地狱优化（图标/插画数据压缩）
├── fingerprint-sampling.ts # 智能指纹采样（Table/List 重复结构压缩）
├── chart-detection.ts    # 图表识别与数据提取（ECharts/G6）
├── node-processor.ts     # 节点处理器，协调过滤/优化/采样/图表
└── meta-builder.ts       # 元信息构建器
dist/                     # 编译输出 (ES Module)
docs/                     # 详细文档
├── fingerprint-sampling.md
└── optimization-guide.md
```

## 常用命令

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 调试运行 (需要 .env 配置)
npx ts-node src/index.ts
```

## MCP 配置

在 Claude Code 中添加 MCP 配置：

```json
{
  "mcpServers": {
    "figma-bridge": {
      "command": "node",
      "args": ["C:\\Users\\84275\\Desktop\\front-end+AI\\figma-bridge\\dist\\index.js"]
    }
  }
}
```

## 环境变量 (.env)

```env
FIGMA_TOKEN=your_figma_api_token
FILE_KEY=your_figma_file_key
```

- **FIGMA_TOKEN**: [Figma Personal Access Tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)
- **FILE_KEY**: Figma URL 中的 key，如 `https://www.figma.com/file/ABC123/...` 中的 `ABC123`

## 架构决策

### 1. 布局过滤策略

通过位置 + 名称双重判断，识别并过滤页面级布局元素：

| 元素 | 识别条件 | 白名单保护 |
|------|---------|-----------|
| Menu/Sidebar | x≈0, width≈siderWidth | Dropdown/Select 中的 Menu 保留 |
| Header/Navbar | y≈0, height≈headerHeight | Card/Modal 中的 Header 保留 |

### 2. 矢量地狱优化 (Vector Hell Optimization)

检测包含多个 VECTOR 的 GROUP/FRAME，自动简化：
- 移除 `vectorPaths`, `vectorNetwork` 等大数据字段
- 扁平化深层嵌套结构
- 添加 `_isIcon` 标记供 AI 识别
- **效果**: 数据量减少 90%+

### 3. 智能指纹采样 (Fingerprint Sampling)

针对 Table、List 等重复组件：
- 通过结构指纹识别相同行
- 保留所有不同结构的样本
- 特殊状态（展开、选中）始终保留
- **注意**: 当前默认禁用，如需压缩可手动启用

### 4. 图表识别与数据提取 (Chart Detection)

自动识别设计稿中的图表，提取结构化数据供 ECharts/G6 使用。

**支持的图表类型**（13种）：

| 图表类型 | 识别特征 | ECharts 类型 | G6 类型 |
|---------|---------|-------------|---------|
| 柱状图 (bar) | 矩形条 + 坐标轴 | bar | - |
| 折线图 (line) | 连续线条 + 坐标轴 | line | - |
| 饼图 (pie) | 圆形布局 + 扇区 | pie | - |
| 散点图 (scatter) | 圆点 + 坐标轴 | scatter | - |
| 面积图 (area) | 填充区域 + 坐标轴 | line (areaStyle) | - |
| 雷达图 (radar) | 多边形网格 | radar | - |
| 桑基图 (sankey) | 流向关系 | sankey | - |
| 漏斗图 (funnel) | 梯形层级 | funnel | - |
| 仪表盘 (gauge) | 半圆/圆 + 指针 | gauge | - |
| 热力图 (heatmap) | 颜色矩阵 | heatmap | - |
| K线图 (candlestick) | 蜡烛形状 | candlestick | - |
| 关系图 (graph) | 节点-边结构 | graph | graph |
| 树图 (tree) | 层级结构 | tree | tree |

**识别机制**：
1. **名称关键词匹配**（高优先级）：检查节点名称是否包含图表类型关键词，如"柱状图"、"pie"等
2. **视觉特征分析**（辅助）：统计子节点中的矩形、圆形、线条数量，检测坐标轴、图例等特征
3. **置信度评分**：综合计算识别置信度（0-1），可配置阈值过滤

**提取数据结构**：
```typescript
{
  type: "CHART",
  _isChart: true,
  chartMeta: {
    detectedType: "bar",          // 检测到的图表类型
    echartsType: "bar",           // 对应的 ECharts 类型
    g6Type: undefined,            // 对应的 G6 类型（如有）
    confidence: 0.85              // 识别置信度
  },
  chartData: {
    axes: {
      xAxis: { name: "月份", categories: ["1月", "2月", "3月"], type: "category" },
      yAxis: { name: "销售额", type: "value" }
    },
    series: [
      { name: "产品A", type: "bar", data: [120, 200, 150], style: { color: "#5470c6" } }
    ],
    legend: { data: ["产品A"], position: "top" },
    colorScheme: ["#5470c6", "#91cc75"]
  },
  chartStyle: {
    width: 600,
    height: 400,
    title: { text: "月度销售对比" }
  }
}
```

**生成的 ECharts 配置示例**：
```typescript
// 基于提取的数据生成 ECharts option
const option = {
  title: { text: "月度销售对比" },
  legend: { data: ["产品A", "产品B"], top: true },
  xAxis: { type: "category", data: ["1月", "2月", "3月"], name: "月份" },
  yAxis: { type: "value", name: "销售额" },
  series: [
    { name: "产品A", type: "bar", data: [120, 200, 150], itemStyle: { color: "#5470c6" } },
    { name: "产品B", type: "bar", data: [80, 130, 120], itemStyle: { color: "#91cc75" } }
  ],
  color: ["#5470c6", "#91cc75"]
};
```

**生成的 G6 配置示例**（关系图）：
```typescript
// 基于提取的数据生成 G6 配置
const graphData = {
  nodes: [
    { id: "node1", label: "节点1" },
    { id: "node2", label: "节点2" }
  ],
  edges: [
    { source: "node1", target: "node2" }
  ]
};
```

### 5. 模块依赖关系

```
transform.ts
    ├── types.ts
    ├── config.ts
    ├── filter.ts ──────→ whitelist.ts
    ├── vector-optimization.ts
    ├── fingerprint-sampling.ts
    ├── chart-detection.ts
    ├── node-processor.ts ───→ filter.ts, vector-optimization.ts, fingerprint-sampling.ts, chart-detection.ts
    └── meta-builder.ts
```

## 核心类型

```typescript
// 转换选项
interface TransformOptions {
  framework?: 'vue' | 'react' | 'html';
  filterNames?: string[];           // 额外过滤名称
  useDefaultFilter?: boolean;       // 启用默认过滤
  siderWidth?: number;              // 左侧菜单宽度阈值
  headerHeight?: number;            // 顶部头部高度阈值
  maxDepth?: number;                // 最大递归深度
  enableFingerprintSampling?: boolean;
  enableVectorHellOptimization?: boolean;
  enableChartDetection?: boolean;   // 启用图表识别（默认启用）
  chartConfig?: {                   // 图表配置
    minDataPoints?: number;         // 最少数据点数
    confidenceThreshold?: number;   // 置信度阈值
  };
}

// 返回 DSL 结构
{
  _meta: { framework, target, filtered, options },
  id: string,
  name: string,
  type: string,
  component: string,
  layout: 'flex-row' | 'flex-col' | 'absolute' | 'grid',
  props: Record<string, any>,
  children: DSLNode[],
  // 图表节点特有字段
  _isChart?: boolean,
  chartMeta?: { detectedType, echartsType, g6Type, confidence },
  chartData?: { axes, series, legend, colorScheme },
  chartStyle?: { width, height, backgroundColor }
}
```

## 开发指南

### 添加新的过滤规则

编辑 `src/config.ts`：

```typescript
// 添加默认过滤名称
export const DEFAULT_FILTERED_NAMES = [
  'new-element',  // 新增
  // ...
];

// 添加白名单保护
export const COMPONENT_COMPOSITION_WHITELIST = {
  'new-component': ['protected-element'],
  // ...
};
```

### 调整矢量优化参数

编辑 `src/config.ts`：

```typescript
export const DEFAULT_VECTOR_HELL_CONFIG: VectorHellConfig = {
  minVectorChildren: 3,   // 判定为图标的最小 VECTOR 数量
  maxIconSize: 200,       // 最大图标尺寸
  maxNestingDepth: 3,     // 最大嵌套深度
  // ...
};
```

### 调整指纹采样参数

编辑 `src/config.ts`：

```typescript
export const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  namePatterns: ['row', 'item', 'option'],      // 启用采样的名称
  similarityThreshold: 0.95,                     // 相似度阈值
  maxUniqueStructures: 3,                        // 最大保留唯一结构数
  preservePatterns: ['expand', 'selected'],      // 始终保留的节点
  // ...
};
```

### 调整图表识别参数

编辑 `src/config.ts`：

```typescript
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  enabled: true,                    // 启用图表识别
  minDataPoints: 3,                 // 最少数据点数量
  confidenceThreshold: 0.6,         // 置信度阈值
  // 图表类型关键词映射
  typeKeywords: {
    bar: ['柱状图', 'bar', 'column', '统计图'],
    line: ['折线图', 'line', 'trend', '走势'],
    pie: ['饼图', 'pie', '环形图', '占比'],
    // ...更多类型
  },
  // 数据提取配置
  dataExtraction: {
    maxSeries: 10,                  // 最大系列数
    inferNumericValues: true,       // 从文字推断数值
    extractFromPosition: true,      // 从位置推断数值
  }
};
```

## 工具调用示例

```typescript
// 获取 Figma 节点数据
const result = await getFigmaNode({
  nodeId: "1-16253",  // 支持 1-16253 或 1:16253 格式
  framework: "vue",
  siderWidth: 220,
  headerHeight: 64,
  enableFingerprintSampling: false,  // 默认禁用
  enableVectorHellOptimization: true // 默认启用
});

// 图表识别示例
const chartResult = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  enableChartDetection: true,        // 启用图表识别
  chartConfig: {
    minDataPoints: 3,                // 至少3个数据点才识别为图表
    confidenceThreshold: 0.7         // 置信度阈值70%
  }
});
```

## 注意事项

1. **节点 ID 格式**: 支持 `1-16253` 或 `1:16253` 两种格式，会自动转换
2. **编译要求**: 使用 `NodeNext` 模块系统，确保所有导入包含 `.js` 扩展名
3. **深度限制**: `maxDepth` 防止深层嵌套导致数据爆炸，默认 10 层
4. **数据量**: 矢量优化默认启用；指纹采样默认禁用；图表识别默认启用
5. **图表识别**: 
   - 图表节点会被标记为 `type: "CHART"`，并包含 `chartMeta`、`chartData`、`chartStyle`
   - 支持 ECharts 和 G6 的数据格式
   - 置信度低于阈值时，节点会作为普通容器处理

## 相关文档

- [record.md](./record.md) - 详细修改记录和开发历史
- [docs/fingerprint-sampling.md](./docs/fingerprint-sampling.md) - 指纹采样详细设计
- [docs/optimization-guide.md](./docs/optimization-guide.md) - 优化策略指南
- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Figma API 文档](https://www.figma.com/developers/api)
