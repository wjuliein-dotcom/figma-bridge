# figma-bridge

基于 MCP (Model Context Protocol) 的工具，将 Figma 设计节点转换为结构化 DSL，辅助生成 Vue 3 / React / HTML 组件代码。

## 项目结构

```
src/
├── index.ts              # MCP Server 入口，工具定义
├── transform.ts          # 转换主入口，整合所有模块
├── types.ts              # 类型定义
├── config.ts             # 默认配置（过滤名称、白名单、采样配置、主题色）
├── filter.ts             # 布局过滤逻辑（Menu、Header 区域识别）
├── whitelist.ts          # 组件白名单系统（支持宽松匹配）
├── vector-optimization.ts # 矢量地狱优化（图标/插画数据压缩）
├── fingerprint-sampling.ts # 智能指纹采样（Table/List 重复结构压缩）
├── chart-detection.ts    # 图表识别与数据提取（ECharts/G6）
├── color-mapping.ts      # 主题色映射（将 Figma 颜色映射到主题 Token）
├── node-processor.ts     # 节点处理器，协调过滤/优化/采样/图表/颜色映射
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

## 核心功能

### 1. 布局过滤策略

通过位置 + 名称双重判断，识别并过滤页面级布局元素：

| 元素 | 识别条件 | 白名单保护 |
|------|---------|-----------|
| Menu/Sidebar | x≈0, width≈siderWidth | Dropdown/Select 中的 Menu 保留 |
| Header/Navbar | y≈0, height≈headerHeight | Card/Modal 中的 Header 保留 |

**配置参数**：
```typescript
{
  siderWidth: number,              // 侧边栏宽度阈值，默认 220px
  headerHeight: number,            // 头部高度阈值，默认 64px
  siderWidthTolerance?: number,    // 侧边栏容差，默认 50px
  headerHeightTolerance?: number,  // 头部容差，默认 20px
  useDefaultFilter: boolean,       // 启用默认过滤，默认 true
  filterNames: string[],           // 额外过滤名称
}
```

**宽松匹配**：
- 使用前缀匹配：`menu-item` 匹配 `menu`
- 使用单词边界匹配：`/sidebar/menu` 中的 `menu` 被匹配
- 避免误匹配：`menuitem` 不会误匹配 `menu`

### 2. 矢量地狱优化 (Vector Hell Optimization)

检测包含多个 VECTOR 的 GROUP/FRAME，自动简化：
- 移除 `vectorPaths`, `vectorNetwork` 等大数据字段
- 扁平化深层嵌套结构
- 添加 `_isIcon` 标记供 AI 识别
- **效果**: 数据量减少 90%+

**图标判定**（多重条件）：
1. VECTOR 子节点数量 ≥ minVectorChildren
2. 名称包含图标关键词（icon、logo、emoji 等）
3. 知名图标库命名（icon-、lucide-、feather- 等）
4. 尺寸接近正方形（长宽比 < 3）

**配置参数**：
```typescript
{
  enableVectorHellOptimization: boolean, // 默认启用
  vectorHellConfig: {
    minVectorChildren: number,      // 最小 VECTOR 数量，默认 3
    maxIconSize: number,             // 最大图标尺寸，默认 200px
    maxNestingDepth: number,         // 最大嵌套深度，默认 3
    preserveGradientData?: boolean,  // 保留渐变数据，默认 false
    preserveVectorPaths?: boolean,   // 保留路径数量信息，默认 false
    preserveVectorNetwork?: boolean, // 保留网络节点数，默认 false
  }
}
```

### 3. 智能指纹采样 (Fingerprint Sampling)

针对 Table、List 等重复组件：
- 通过结构指纹识别相同行（不依赖名称，更稳定）
- 保留所有不同结构的样本
- 特殊状态（展开、选中、禁用）始终保留
- **默认启用**，可手动关闭

**特殊状态识别**：
- 命名模式：`expand`、`selected`、`active`、`disabled` 等
- 变体属性：`componentProperties.selected.value`、`expanded.value` 等
- 异常尺寸：高度 > 500px 的行（可能是汇总行）

**配置参数**：
```typescript
{
  enableFingerprintSampling: boolean, // 默认启用
  fingerprintConfig: {
    similarityThreshold: number,    // 相似度阈值，默认 0.95
    maxUniqueStructures: number,    // 最大保留结构数，默认 5
    preserveDisabled?: boolean,     // 保留禁用状态，默认 true
    preserveHighlighted?: boolean,   // 保留高亮状态，默认 true
    maxSamplingRatio?: number,      // 最大采样比例，默认 0.5
  }
}
```

### 4. 图表识别与数据提取 (Chart Detection)

自动识别设计稿中的图表，提取结构化数据供 ECharts/G6 使用。

#### 4.1 支持的图表类型（13种）

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

#### 4.2 识别机制

**双重识别策略 + 置信度验证**：

1. **名称关键词匹配**（高优先级）
   - 检查节点名称是否包含图表类型关键词
   - 示例：`"月度销售柱状图"` → 识别为 `bar`
   - 组合图表（如"柱状图和折线图对比"）会降低权重

2. **视觉特征验证**（二次验证）
   - 名称匹配后进行视觉特征校验
   - 存在冲突特征时降低置信度
   - 例如：名称是"饼图"但有坐标轴 → 置信度降低

3. **视觉特征分析**（独立识别）
   - 统计子节点中的矩形、圆形、线条数量
   - 检测坐标轴方向（水平/垂直）
   - 分析数据排列模式（水平/垂直矩形条、散点分布）
   - 计算置信度评分（0-1）

**决策树优先级**：
```
1. 饼图：圆形布局 + 无坐标轴 + ≥3个圆形 → confidence: 0.85
2. 柱状图：水平排列矩形条 + 坐标轴 → confidence: 0.9
3. 柱状图：多个矩形条 + 坐标轴 → confidence: 0.85
4. 折线图：水平轴 + 垂直轴 + 线条 → confidence: 0.85
5. 散点图：分散圆形 + 坐标轴 → confidence: 0.7-0.8
```

#### 4.3 数据提取

**提取的数值类型**：
- 文本数值：直接从 TEXT 节点提取
- 货币符号：支持 `$¥€£` 等
- 百分比：自动移除 `%` 符号
- 千分位：自动移除 `,` 分隔符
- 中文数字：一二三四五六七八九十
- 范围值：支持 "100-200" 格式（取中间值）
- 相对数值：从位置推断（百分比）
- 组件属性：从 `componentProperties.value/number/data` 提取
- 散点坐标：`[x, y]` 格式

**多系列提取**：
- 按颜色自动分组提取多个系列
- 从名称推断系列名（如"系列1"、"产品A"）
- 支持堆叠图、分组图数据

**坐标轴识别**：
- 基于位置区域分析（左侧12%、底部88%）
- 从 `componentProperties.axisLabel` 提取
- 区分 X 轴和 Y 轴标签
- 排除纯数值作为标签

#### 4.4 排除机制

**排除的 UI 组件**（40+个）：
- 基础组件：button, icon, input, checkbox, radio, switch
- 容器组件：card, modal, dialog, drawer, tooltip, popup
- 导航组件：nav, navbar, tabs, tab, pagination, sider
- 展示组件：avatar, badge, tag, progress, skeleton, loading

**大小阈值**：
- 最小：80x60px（过小不是图表）
- 最大：2000x1500px（过大可能是整个页面）

#### 4.5 输出数据结构

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
      { name: "产品A", type: "bar", data: [120, 200, 150], style: { color: "#5470c6" } },
      { name: "产品B", type: "bar", data: [80, 130, 120], style: { color: "#91cc75" } }
    ],
    legend: { data: ["产品A", "产品B"], position: "top" },
    colorScheme: ["#5470c6", "#91cc75"]
  },
  chartStyle: {
    width: 600,
    height: 400,
    title: { text: "月度销售对比" }
  }
}
```

#### 4.6 ECharts 配置生成

```typescript
const option = {
  title: chartNode.chartStyle.title,
  legend: {
    data: chartNode.chartData.legend?.data,
    top: chartNode.chartData.legend?.position === 'top'
  },
  xAxis: chartNode.chartData.axes?.xAxis,
  yAxis: chartNode.chartData.axes?.yAxis,
  series: chartNode.chartData.series.map(s => ({
    name: s.name,
    type: s.type,
    data: s.data,
    itemStyle: { color: s.style.color },
    smooth: s.style.lineSmooth
  })),
  color: chartNode.chartData.colorScheme
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
    ├── color-mapping.ts
    ├── node-processor.ts ───→ filter.ts, vector-optimization.ts, fingerprint-sampling.ts, chart-detection.ts, color-mapping.ts
    └── meta-builder.ts
```

### 6. 主题色映射 (Color Mapping)

将 Figma 设计稿中的颜色值映射到国利网安主题工具库的主题 Token，供 AI 生成代码时识别组件应使用的属性（如 `type="primary"`）。

#### 6.1 颜色匹配算法

使用 RGB 空间的欧几里得距离计算颜色相似度：

```typescript
// 距离计算
colorDistance('#1677ff', '#1890ff')  // 距离约 37
// 相似度 = 1 - (距离 / 441)，441 是白色到黑色的最大距离

// 置信度
confidence = 1 - (distance / 441)
// 距离 0 → 置信度 100%
// 距离 37 → 置信度 91.6%
// 低于 0.8 置信度不输出
```

#### 6.2 主题色配置

**亮色主题** (`themeMode: 'light'`，默认)：
- 品牌色：colorPrimary (1-10级)
- 功能色：colorSuccess/Warning/Error/Info (各 1-10 级)
- 中性色：colorText, colorBorder, colorFill, colorBgContainer 等
- 预设颜色：blue/purple/cyan/green/magenta/pink/red/orange/yellow/volcano/geekblue/gold/lime (各 1-10 级)

**暗色主题** (`themeMode: 'dark'`)：
- 颜色值自动切换为暗色模式对应值
- 例如：`colorText: 'rgba(255,255,255,0.88)'`、`colorBgContainer: '#141414'`

#### 6.3 预设颜色梯度（13种 × 10级）

| 预设颜色 | 基础色 |
|---------|--------|
| blue | #1677ff |
| purple | #722ED1 |
| cyan | #13C2C2 |
| green | #52C41A |
| magenta | #EB2F96 |
| pink | #EB2F96 |
| red | #F5222D |
| orange | #FA8C16 |
| yellow | #FADB14 |
| volcano | #FA541C |
| geekblue | #2F54EB |
| gold | #FAAD14 |
| lime | #A0D911 |

每种颜色生成 1-10 级梯度（如 blue1 ~ blue10），**总计约 200 个颜色**。

#### 6.4 输出数据结构

```typescript
{
  "_colorMapping": {
    "fills": [
      {
        "originalColor": "#1677ff",
        "mappedToken": "colorPrimary",
        "mappedValue": "#1677ff",
        "confidence": 0.95
      }
    ],
    "strokes": [
      {
        "originalColor": "#d9d9d9",
        "mappedToken": "colorBorder",
        "mappedValue": "#d9d9d9",
        "confidence": 0.88
      }
    ]
  }
}
```

#### 6.5 使用示例

```typescript
// 亮色主题（默认）
await getFigmaNode({
  nodeId: "1-123",
  themeMode: 'light'
});

// 暗黑主题
await getFigmaNode({
  nodeId: "1-123",
  themeMode: 'dark'
});

// 自定义主题色
await getFigmaNode({
  nodeId: "1-123",
  themeMode: 'light',
  colorMappingConfig: {
    confidenceThreshold: 0.8,
    skipIconColors: true,
    themeColors: [
      { token: 'colorPrimary', value: '#1890ff', category: 'primary' },
      { token: 'colorSuccess', value: '#52c41a', category: 'success' }
    ]
  }
});

// 禁用颜色映射
await getFigmaNode({
  nodeId: "1-123",
  enableColorMapping: false
});
```

#### 6.6 配置参数

```typescript
{
  enableColorMapping: boolean,     // 是否启用，默认 true
  themeMode: 'light' | 'dark',      // 主题模式，默认 'light'
  colorMappingConfig: {
    confidenceThreshold: number,    // 置信度阈值，默认 0.8
    skipIconColors: boolean,        // 跳过图标颜色，默认 true
    themeColors: ThemeColorItem[]   // 自定义主题色配置
  }
}
```

## 核心类型

```typescript
// 转换选项
interface TransformOptions {
  // 基本参数
  framework?: 'vue' | 'react' | 'html';

  // 布局过滤
  filterNames?: string[];
  useDefaultFilter?: boolean;
  siderWidth?: number;
  headerHeight?: number;
  siderWidthTolerance?: number;   // 侧边栏容差，默认 50px
  headerHeightTolerance?: number; // 头部容差，默认 20px

  // 深度限制
  maxDepth?: number;

  // 矢量优化
  enableVectorHellOptimization?: boolean;
  vectorHellConfig?: Partial<VectorHellConfig>;

  // 指纹采样（默认启用）
  enableFingerprintSampling?: boolean;
  fingerprintConfig?: Partial<FingerprintConfig>;

  // 图表识别
  enableChartDetection?: boolean;
  chartConfig?: Partial<ChartConfig>;

  // 颜色映射
  enableColorMapping?: boolean;
  colorMappingConfig?: Partial<ColorMappingConfig>;
  themeMode?: 'light' | 'dark';
}

// 矢量优化配置
interface VectorHellConfig {
  enabled: boolean;
  minVectorChildren: number;
  maxIconSize: number;
  maxNestingDepth: number;
  preserveVectorProps: string[];
  preserveGradientData?: boolean;
  preserveVectorPaths?: boolean;
  preserveVectorNetwork?: boolean;
  sizeToleranceRatio?: number;
}

// 指纹采样配置
interface FingerprintConfig {
  namePatterns: string[];
  similarityThreshold: number;
  maxUniqueStructures: number;
  preservePatterns: string[];
  preserveDisabled?: boolean;
  preserveHighlighted?: boolean;
  maxSamplingRatio?: number;
}

// 图表配置
interface ChartConfig {
  enabled: boolean;
  minDataPoints: number;
  confidenceThreshold: number;
  typeKeywords: Record<string, string[]>;
  axisDetection: { minLineLength: number; axisLabelPatterns: string[] };
  dataExtraction: { maxSeries: number; inferNumericValues: boolean; extractFromPosition: boolean };
}

// 颜色映射配置
interface ColorMappingConfig {
  enabled: boolean;
  confidenceThreshold: number;
  skipIconColors: boolean;
  themeColors?: Array<{
    token: string;
    value: string;
    category: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
    level?: number;
  }>;
}

// DSL 返回结构
{
  _meta: { framework, target, filtered, options },
  id: string,
  name: string,
  type: string,
  component: string,
  layout: 'flex-row' | 'flex-col' | 'flex-wrap' | 'grid' | 'absolute',
  props: Record<string, any>,
  _layoutInfo?: { layoutMode, layoutAlign, primaryAxisAlignItems, ... },
  children: DSLNode[],
  // 图表节点特有字段
  _isChart?: boolean,
  chartMeta?: { detectedType, echartsType, g6Type, confidence },
  chartData?: { axes, series, legend, colorScheme },
  chartStyle?: { width, height, backgroundColor },
  // 颜色映射特有字段
  _colorMapping?: {
    fills: Array<{ originalColor, mappedToken, mappedValue, confidence }>,
    strokes: Array<{ originalColor, mappedToken, mappedValue, confidence }>
  }
}
```

## 开发指南

### 添加新的过滤规则

编辑 `src/config.ts`：

```typescript
export const DEFAULT_FILTERED_NAMES = [
  'new-element',  // 新增
  // ...
];

export const COMPONENT_COMPOSITION_WHITELIST = {
  'new-component': ['protected-element'],
  // ...
};
```

### 调整布局过滤参数

编辑 `src/config.ts` 或通过 MCP 参数：

```typescript
// 通过参数调整容差
const result = await getFigmaNode({
  nodeId: "1-12345",
  siderWidth: 200,              // 自定义侧边栏宽度
  siderWidthTolerance: 30,     // 较小容差
  headerHeight: 80,            // 较高头部
  headerHeightTolerance: 15,   // 较小容差
});
```

### 调整矢量优化参数

编辑 `src/config.ts` 或通过 MCP 参数：

```typescript
const result = await getFigmaNode({
  nodeId: "1-12345",
  enableVectorHellOptimization: true,
  vectorHellConfig: {
    minVectorChildren: 5,      // 更多 VECTOR 才视为图标
    maxIconSize: 150,           // 更小的图标尺寸阈值
    preserveGradientData: true, // 保留渐变数据
    preserveVectorPaths: true,  // 保留路径数量信息
  }
});
```

### 调整指纹采样参数

编辑 `src/config.ts` 或通过 MCP 参数：

```typescript
const result = await getFigmaNode({
  nodeId: "1-12345",
  enableFingerprintSampling: true,
  fingerprintConfig: {
    similarityThreshold: 0.9,   // 更严格的相似度
    maxUniqueStructures: 10,   // 保留更多结构
    preserveDisabled: true,    // 保留禁用状态
    preserveHighlighted: true, // 保留高亮状态
    maxSamplingRatio: 0.3,     // 最多采样30%
  }
});
```

### 调整图表识别参数

编辑 `src/config.ts` 或通过 MCP 参数：

```typescript
const result = await getFigmaNode({
  nodeId: "1-12345",
  enableChartDetection: true,
  chartConfig: {
    minDataPoints: 5,           // 至少5个数据点
    confidenceThreshold: 0.7   // 更高置信度阈值
  }
});
```

### 调整颜色映射参数

编辑 `src/config.ts` 或通过 MCP 参数：

```typescript
// 亮色/暗色主题切换
const result = await getFigmaNode({
  nodeId: "1-12345",
  themeMode: 'dark'  // 使用暗色主题颜色配置
});

// 自定义置信度
const result = await getFigmaNode({
  nodeId: "1-12345",
  colorMappingConfig: {
    confidenceThreshold: 0.9   // 更严格的匹配要求
  }
});

// 自定义主题色
const result = await getFigmaNode({
  nodeId: "1-12345",
  themeMode: 'light',
  colorMappingConfig: {
    themeColors: [
      { token: 'colorPrimary', value: '#1890ff', category: 'primary' },
      { token: 'colorSuccess', value: '#52c41a', category: 'success' }
    ]
  }
});
```

## 工具调用示例

```typescript
// 基础使用（所有优化默认启用）
const result = await getFigmaNode({
  nodeId: "1-16253",  // 支持 1-16253 或 1:16253 格式
  framework: "vue"
});

// 自定义布局过滤
const result = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  siderWidth: 200,
  headerHeight: 60,
  siderWidthTolerance: 30,
  headerHeightTolerance: 15,
  filterNames: ['extra-menu', 'banner'],  // 额外过滤
  useDefaultFilter: true
});

// 指纹采样（默认启用）
const result = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  enableFingerprintSampling: true,
  fingerprintConfig: {
    similarityThreshold: 0.95,
    maxUniqueStructures: 5
  }
});

// 图表识别
const chartResult = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  enableChartDetection: true,
  chartConfig: {
    minDataPoints: 3,
    confidenceThreshold: 0.7
  }
});

// 颜色映射（亮色主题）
const colorResult = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  themeMode: 'light',
  enableColorMapping: true
});

// 颜色映射（暗色主题）
const darkColorResult = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  themeMode: 'dark'
});

// 完整配置示例
const fullResult = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",

  // 布局过滤
  siderWidth: 220,
  headerHeight: 64,
  siderWidthTolerance: 50,
  headerHeightTolerance: 20,
  useDefaultFilter: true,
  filterNames: [],

  // 深度限制
  maxDepth: 10,

  // 矢量优化
  enableVectorHellOptimization: true,
  vectorHellConfig: {
    minVectorChildren: 3,
    maxIconSize: 200,
    maxNestingDepth: 3,
    preserveGradientData: false,
    preserveVectorPaths: false,
    preserveVectorNetwork: false
  },

  // 指纹采样（默认启用）
  enableFingerprintSampling: true,
  fingerprintConfig: {
    similarityThreshold: 0.95,
    maxUniqueStructures: 5,
    preserveDisabled: true,
    preserveHighlighted: true,
    maxSamplingRatio: 0.5
  },

  // 图表识别（默认启用）
  enableChartDetection: true,
  chartConfig: {
    minDataPoints: 3,
    confidenceThreshold: 0.6
  },

  // 颜色映射（默认启用）
  enableColorMapping: true,
  themeMode: 'light',  // 或 'dark'
  colorMappingConfig: {
    confidenceThreshold: 0.8,
    skipIconColors: true
  }
});
```

## 注意事项

1. **节点 ID 格式**: 支持 `1-16253` 或 `1:16253` 两种格式，会自动转换
2. **编译要求**: 使用 `NodeNext` 模块系统，确保所有导入包含 `.js` 扩展名
3. **深度限制**: `maxDepth` 防止深层嵌套导致数据爆炸，默认 10 层
4. **数据量**:
   - 矢量优化：默认启用
   - 指纹采样：默认启用
   - 图表识别：默认启用
   - 颜色映射：默认启用
5. **布局类型**: 支持 `flex-row`、`flex-col`、`flex-wrap`、`grid`、`absolute`
6. **图表识别**:
   - 图表节点标记为 `type: "CHART"`，包含 `chartMeta`、`chartData`、`chartStyle`
   - 支持 ECharts 和 G6 的数据格式
   - 置信度低于阈值时作为普通容器处理
   - 名称匹配后会进行视觉特征验证
   - 多系列图表按颜色自动分组提取
7. **颜色映射**:
   - 将 Figma 颜色映射到主题 Token（如 colorPrimary）
   - 通过 `themeMode` 参数区分亮色/暗色主题
   - 支持 13 种预设颜色 × 10 级梯度（约 200 个颜色）
   - 低于置信度阈值的匹配不输出

## 版本信息

- **当前版本**: 1.2.0
- **更新内容**: 新增主题色映射功能，支持亮色/暗色主题、13种预设颜色梯度

## 相关文档

- [record-2026.04.md](./record-2026.04.md) - 详细修改记录
- [docs/fingerprint-sampling.md](./docs/fingerprint-sampling.md) - 指纹采样详细设计
- [docs/optimization-guide.md](./docs/optimization-guide.md) - 优化策略指南
- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Figma API 文档](https://www.figma.com/developers/api)