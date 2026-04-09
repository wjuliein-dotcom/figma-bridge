# figma-bridge MCP 记录 - 2026年4月

## 项目概述

**figma-bridge** 是一个基于 MCP (Model Context Protocol) 的工具，用于从 Figma 获取节点数据并转换为 AI 可理解的 DSL（领域特定语言），帮助生成 Vue 3 组件代码。

## 技术栈

- **MCP Server**: `@modelcontextprotocol/sdk`
- **语言**: TypeScript
- **目标框架**: Vue 3 (Composition API + TypeScript)

---

## 修改一：图表识别与数据提取功能（2026-04-01）

### 目标
为 MCP 添加图表识别功能，自动检测 Figma 设计稿中的图表（柱状图、折线图、饼图等），提取结构化数据供 ECharts 或 G6 使用。

### 背景
在设计稿中，图表通常以矢量图形组合的形式存在。为了将这些图表转换为代码实现（如 ECharts），需要在数据层面识别图表类型、提取系列数据、坐标轴配置、图例等信息。

### 解决方案

#### 1. 新增图表检测模块

创建 `src/chart-detection.ts` 文件，实现完整的图表识别和数据提取：

**核心功能**：
- `detectChartType(node)` - 基于视觉特征和名称关键词识别图表类型
- `extractChartData(node, chartType)` - 提取坐标轴、系列数据、图例、配色方案
- `analyzeChart(node, config)` - 主入口函数，返回完整的图表信息

**支持识别的图表类型**：

| 图表类型 | 识别特征 | 输出 ECharts 类型 | 输出 G6 类型 |
|---------|---------|------------------|-------------|
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

#### 2. 识别机制

**双重识别策略**：

1. **名称关键词匹配**（高优先级）
   - 检查节点名称是否包含图表类型关键词
   - 示例：`"月度销售柱状图"` → 识别为 `bar`

2. **视觉特征分析**（辅助识别）
   - 统计子节点中的矩形、圆形、线条数量
   - 检测坐标轴、图例、网格线等特征
   - 计算置信度评分（0-1）

**识别逻辑示例**：
```typescript
// 饼图识别
if (clues.isCircularLayout && !clues.hasAxes && clues.circleCount >= 3) {
  return {
    type: 'pie',
    confidence: 0.85,
    reasons: ['圆形布局', '无坐标轴', '包含3个圆形']
  };
}

// 柱状图识别
if (clues.hasBars && clues.hasAxes) {
  return {
    type: 'bar',
    confidence: 0.85,
    reasons: ['存在矩形条', '有坐标轴']
  };
}
```

#### 3. 数据提取

**提取的数据结构**：

```typescript
interface ChartData {
  // 坐标轴信息
  axes?: {
    xAxis?: { name?: string; categories?: string[]; min?: number; max?: number };
    yAxis?: { name?: string; min?: number; max?: number };
  };
  // 系列数据
  series: ChartSeries[];
  // 图例信息
  legend?: { data: string[]; position: 'top' | 'bottom' | 'left' | 'right' };
  // 配色方案
  colorScheme?: string[];
}

interface ChartSeries {
  name: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  data: number[] | Array<{ name: string; value: number }>;
  style: {
    color?: string;
    barWidth?: number;
    lineSmooth?: boolean;
    areaFill?: boolean;
  };
}
```

**数据提取策略**：
- 从 TEXT 节点提取分类标签和数值
- 从矩形高度推断柱状图数值
- 从圆形属性提取饼图扇区数据
- 提取填充颜色作为配色方案

#### 4. 配置选项

**新增 TransformOptions 字段**：
```typescript
interface TransformOptions {
  // ... 原有选项
  enableChartDetection?: boolean;   // 启用图表识别（默认 true）
  chartConfig?: {                   // 图表配置
    minDataPoints?: number;         // 最少数据点数（默认 3）
    confidenceThreshold?: number;   // 置信度阈值（默认 0.6）
    typeKeywords?: Record<string, string[]>; // 图表类型关键词
    axisDetection?: { minLineLength: number; axisLabelPatterns: string[] };
    dataExtraction?: { maxSeries: number; inferNumericValues: boolean };
  };
}
```

**默认配置** (`src/config.ts`)：
```typescript
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  enabled: true,
  minDataPoints: 3,
  confidenceThreshold: 0.6,
  typeKeywords: {
    bar: ['柱状图', 'bar', 'column', '统计图', '对比图'],
    line: ['折线图', 'line', 'trend', '曲线', '趋势', '走势'],
    pie: ['饼图', 'pie', '环形图', 'donut', '占比', '比例', '分布'],
    scatter: ['散点图', 'scatter', '分布', '气泡图'],
    // ... 更多类型
  },
  axisDetection: {
    minLineLength: 50,
    axisLabelPatterns: ['\\d+', '年', '月', '日', 'Q[1-4]'],
  },
  dataExtraction: {
    maxSeries: 10,
    inferNumericValues: true,
    extractFromPosition: true,
  },
};
```

#### 5. 节点处理器集成

在 `src/node-processor.ts` 中集成图表处理：

```typescript
export function processNode(node: any, context: ProcessContext, deps: ProcessorDependencies) {
  // ... 原有逻辑

  // 图表检测（在图标检测之前，因为图表优先级更高）
  if (chartConfig.enabled && !context.isInsideChart && !context.isInsideIcon) {
    const chartInfo = analyzeChart(node, chartConfig);
    if (chartInfo) {
      return processChartContainer(node, context, deps, chartInfo);
    }
  }
  // ... 后续逻辑
}

function processChartContainer(node: any, context: ProcessContext, deps: ProcessorDependencies, chartInfo: any) {
  return {
    id: node.id,
    name: node.name,
    type: 'CHART',
    _isChart: true,
    chartMeta: chartInfo.meta,
    chartData: chartInfo.data,
    chartStyle: chartInfo.style,
    _detection: {
      type: chartInfo.detection.type,
      confidence: chartInfo.detection.confidence,
      reasons: chartInfo.detection.reasons,
    },
  };
}
```

#### 6. MCP 工具参数更新

在 `src/index.ts` 的 `get-figma-node` 工具中添加图表参数：

```typescript
{
  enableChartDetection: z.boolean().optional().default(true)
    .describe("是否启用图表识别（默认启用），自动检测图表类型并提取数据用于ECharts/G6生成"),
  chartConfig: z.object({
    minDataPoints: z.number().optional().describe("最少数据点数量才视为图表（默认3）"),
    confidenceThreshold: z.number().optional().describe("图表识别置信度阈值（0-1，默认0.6）"),
  }).optional().describe("图表检测配置选项")
}
```

### 输出示例

识别后的图表节点 DSL 结构：

```json
{
  "id": "123-456",
  "name": "月度销售柱状图",
  "type": "CHART",
  "component": "Chart",
  "layout": "absolute",
  "_isChart": true,
  "_note": "识别为 bar 图表，置信度 85.0%",
  "chartMeta": {
    "detectedType": "bar",
    "echartsType": "bar",
    "confidence": 0.85
  },
  "chartData": {
    "axes": {
      "xAxis": {
        "name": "月份",
        "categories": ["1月", "2月", "3月", "4月", "5月"],
        "type": "category"
      },
      "yAxis": {
        "name": "销售额(万)",
        "type": "value"
      }
    },
    "series": [
      {
        "name": "产品A",
        "type": "bar",
        "data": [120, 200, 150, 80, 70],
        "style": {
          "color": "#5470c6",
          "barWidth": 30
        }
      },
      {
        "name": "产品B",
        "type": "bar",
        "data": [80, 130, 120, 150, 90],
        "style": {
          "color": "#91cc75"
        }
      }
    ],
    "legend": {
      "data": ["产品A", "产品B"],
      "position": "top"
    },
    "colorScheme": ["#5470c6", "#91cc75", "#fac858"]
  },
  "chartStyle": {
    "width": 600,
    "height": 400,
    "title": {
      "text": "月度销售对比"
    }
  },
  "_detection": {
    "type": "bar",
    "confidence": 0.85,
    "reasons": ["存在矩形条", "有坐标轴", "包含10个矩形"]
  },
  "_chartStructure": {
    "childCount": 25,
    "childTypes": ["RECTANGLE", "TEXT", "VECTOR"]
  }
}
```

### 生成的 ECharts 配置

基于提取的数据可直接生成 ECharts 配置：

```typescript
const echartsOption = {
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
    smooth: s.style.lineSmooth,
    areaStyle: s.style.areaFill ? {} : undefined
  })),
  color: chartNode.chartData.colorScheme
};
```

### 使用示例

```typescript
// 基础使用（图表识别默认启用）
const result = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue"
});

// 禁用图表识别
const result = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  enableChartDetection: false
});

// 自定义图表配置
const result = await getFigmaNode({
  nodeId: "1-12345",
  framework: "vue",
  enableChartDetection: true,
  chartConfig: {
    minDataPoints: 5,              // 至少5个数据点
    confidenceThreshold: 0.7       // 置信度70%
  }
});
```

### 注意事项

1. **置信度阈值**：低于阈值的节点会被视为普通容器处理
2. **数据点数量**：低于 `minDataPoints` 的节点不会被识别为图表
3. **图表内部简化**：识别为图表后，内部子节点会被简化处理，避免数据爆炸
4. **命名建议**：在 Figma 中给图表节点取包含类型关键词的名称（如"月度销售柱状图"），可提高识别准确率

### 影响文件

**新增文件**：
- `src/chart-detection.ts` - 图表检测与数据提取模块

**修改文件**：
- `src/types.ts` - 添加图表相关类型定义（ChartType, ChartDetectionResult, ChartData, ChartConfig 等）
- `src/config.ts` - 添加 DEFAULT_CHART_CONFIG 配置和图表相关常量
- `src/node-processor.ts` - 集成图表处理逻辑，添加 isInsideChart 上下文
- `src/transform.ts` - 支持 enableChartDetection 和 chartConfig 选项
- `src/meta-builder.ts` - 元信息包含图表配置
- `src/index.ts` - MCP 工具参数添加图表相关配置
- `CLAUDE.md` - 文档更新，添加图表识别说明

### 模块依赖关系更新

```
transform.ts
    ├── types.ts
    ├── config.ts
    ├── filter.ts ──────→ whitelist.ts
    ├── vector-optimization.ts
    ├── fingerprint-sampling.ts
    ├── chart-detection.ts                    # 新增
    ├── node-processor.ts ───→ filter.ts, vector-optimization.ts, fingerprint-sampling.ts, chart-detection.ts
    └── meta-builder.ts
```

---

## 修改二：图表识别模块优化（2026-04-02）

### 目标
优化图表识别模块的实现逻辑，提升识别准确率和数据提取质量。

### 背景
在实现图表识别功能后，发现以下问题影响识别效果：
1. 名称关键词权重过高，缺乏视觉特征验证
2. 决策树顺序问题导致误判
3. 数值提取依赖文本，无法识别纯形状图表
4. 坐标轴识别不精确
5. 排除模式不全面

### 解决方案

#### 1. 决策树逻辑优化

**新增函数**：
- `analyzeLineOrientation()` - 分析线条方向，区分水平轴和垂直轴
- `analyzeDataPattern()` - 分析数据排列模式（水平/垂直矩形条、散点分布、堆叠模式）

**优化决策树优先级**：
```typescript
// 饼图：圆形布局最高优先级
if (clues.isCircularLayout && !clues.hasAxes && clues.circleCount >= 3) { ... }

// 柱状图：增加水平排列检测
if (dataPattern.isHorizontalBars && (clues.hasAxes || clues.rectangleCount >= 3)) { ... }

// 折线图：需要同时有水平轴和垂直轴
if (lineOrientation.hasHorizontalAxis && lineOrientation.hasVerticalAxis && clues.hasLines) { ... }
```

#### 2. 名称关键词检测优化

**新增函数**：`validateNameWithVisuals()`

- 支持组合图表名称检测（如"柱状图和折线图对比"）
- 名称匹配后进行二次视觉验证
- 视觉冲突检测（如名称是饼图但有坐标轴）
- 置信度动态调整

```typescript
// 优化后的名称提取
function extractNameKeywords(name: string): Array<{ type: string; weight: number }> {
  // 检测组合图表，降低权重
  const isComboChart = /(和|与|对比|组合).*(图|chart)/i.test(name);
  const weight = isComboChart ? 0.6 : 0.9;
  // ...
}

// 视觉特征验证
switch (kw.type) {
  case 'bar':
    if (!hasBars && !dataPattern.isHorizontalBars) {
      adjustedConfidence -= 0.3; // 降低置信度
      reasons.push('视觉特征不匹配：无可识别的矩形条');
    }
    break;
  // ...
}
```

#### 3. 数据提取逻辑优化

**数值提取增强**：
```typescript
function extractNumericValue(node: any): number | null {
  // 支持货币符号
  let cleanedText = text
    .replace(/[$¥€£]/g, '')
    .replace(/%/g, '')
    .replace(/,/g, '')  // 千分位
    .trim();

  // 支持中文数字
  cleanedText = cleanedText.replace(/一/g, '1').replace(/二/g, '2') /* ... */;

  // 支持科学计数法
  const match = cleanedText.match(/-?\d+\.?\d*(?:[eE][+-]?\d+)?/);
  // ...
}
```

**位置推断改进**：
```typescript
function inferValueFromPosition(node, nodeBounds, direction) {
  // 将实际尺寸转换为相对百分比
  const normalizedValue = Math.round((bounds.height / maxHeight) * 100);
  return normalizedValue;
}
```

**多系列提取**：
```typescript
// 按颜色分组自动提取多个系列
const colorGroups = new Map<string, number[]>();
for (const child of children) {
  if (child.type === 'RECTANGLE') {
    const colorKey = color || 'default';
    colorGroups.get(colorKey)?.push(value);
  }
}
// 将颜色分组转换为系列
```

**散点图支持**：
```typescript
// 支持 [x, y] 坐标格式
data: number[] | Array<{ name: string; value: number }> | Array<{ name: string; value: [number, number] }>;
```

#### 4. 坐标轴识别优化

```typescript
// 使用位置区域分析
const leftZone = nodeBounds.x + nodeBounds.width * 0.15;
const rightZone = nodeBounds.x + nodeBounds.width * 0.85;
const bottomZone = nodeBounds.y + nodeBounds.height * 0.7;

// 底部区域 + 宽度 > 高度 = X轴标签
// 左侧区域 + 高度 > 宽度 = Y轴标签

// 排除纯数值标签
const cleanYLabels = yAxisLabels.filter(t => {
  const num = extractNumericValue({ characters: t } as any);
  return num === null;
});
```

#### 5. 排除模式和边缘情况

**扩展排除模式**（从6个扩展到40+个）：
```typescript
const excludePatterns = [
  // 基础组件
  'button', 'btn', 'icon', 'input', 'textarea', 'select', 'checkbox', 'radio', 'switch',
  // 容器组件
  'card', 'modal', 'dialog', 'drawer', 'popup', 'tooltip', 'popover', 'dropdown', 'menu',
  // 导航组件
  'nav', 'navbar', 'tabs', 'tab', 'breadcrumb', 'pagination', 'sider', 'sidebar',
  // 展示组件
  'avatar', 'badge', 'tag', 'progress', 'skeleton', 'loading', 'empty', 'alert',
  // ...
];
```

**动态大小阈值**：
```typescript
if (bounds.width < 80 || bounds.height < 60) return false;  // 太小
if (bounds.width > 2000 || bounds.height > 1500) return false;  // 太大
```

**数据验证**：
```typescript
// 验证数值合理性
const validValues = series.data.filter((d: any) => {
  if (typeof d === 'number') {
    return !isNaN(d) && isFinite(d);
  }
  return false;
});
```

### 类型更新

```typescript
// ChartClues 新增字段
nameKeywords: Array<{ type: string; adjustedConfidence: number; reasons: string[] }>;
_lineOrientation?: { hasHorizontalAxis: boolean; hasVerticalAxis: boolean };
_dataPattern?: {
  isHorizontalBars: boolean;
  isVerticalBars: boolean;
  isScatterPattern: boolean;
  isStackedPattern: boolean;
};

// ChartSeries 支持散点图
data: number[] | Array<{ name: string; value: number }> | Array<{ name: string; value: [number, number] }>;
```

### 影响文件

- `src/chart-detection.ts` - 大幅优化，添加多个新函数
- `src/types.ts` - 更新 ChartClues 和 ChartSeries 类型定义

### 优化效果

| 优化项 | 优化前 | 优化后 |
|--------|--------|--------|
| 名称关键词权重 | 固定 0.9 | 动态调整 0.5-0.9 |
| 坐标轴识别 | 任意 LINE 节点 | 水平+垂直方向验证 |
| 数值提取 | 简单正则 | 支持货币、百分比、中文数字 |
| 多系列提取 | 仅支持单个 | 按颜色自动分组 |
| 排除模式 | 6 个 | 40+ 个常见组件 |
| 散点图支持 | 不支持 | 支持 [x,y] 坐标 |

### 注意事项

1. **识别优先级**：名称关键词 + 视觉特征双重验证
2. **组合图表**：降低置信度，需要更多视觉特征支持
3. **数据推断**：无文本值时使用相对百分比
4. **数据验证**：过滤 NaN、Infinity 等无效值

---

## 修改三：漏洞修复与功能增强（2026-04-02）

### 目标
识别并修复各核心功能中会导致生成代码与原设计产生出入的漏洞，同时增强功能灵活性。

### 背景
通过代码分析，发现以下核心功能存在潜在漏洞：
1. 布局过滤策略：硬编码阈值、名称匹配过于宽泛
2. 矢量地狱优化：图标判定简单、删除路径数据无法还原
3. 智能指纹采样：默认禁用、相似度算法不准确
4. 图表识别：数值提取有限、坐标轴识别硬编码
5. 节点处理：layout判断简单、深度截断信息不足

### 解决方案

#### 1. 布局过滤策略优化

**问题**：
- 硬编码阈值 `siderWidth=220px`、`headerHeight=64px` 无法适配不同设计
- 使用 `includes()` 匹配导致 "menuitem" 误匹配 "menu"
- 白名单匹配依赖精确名称

**解决方案**：

新增宽松匹配函数 `looseMatches()`：
```typescript
function looseMatches(name: string, keyword: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (lowerName === lowerKeyword) return true;

  // 支持前缀匹配：menu-item 匹配 menu
  const pattern = new RegExp(`^${lowerKeyword}([-_/\\s]|$)`, 'i');
  if (pattern.test(lowerName)) return true;

  // 支持单词边界匹配
  const includePattern = new RegExp(`[-_/\\s]${lowerKeyword}([-_/\\s]|$)`, 'i');
  if (includePattern.test(lowerName)) return true;

  return false;
}
```

新增容差配置接口：
```typescript
export interface FilterContext {
  siderWidth: number;
  headerHeight: number;
  siderWidthTolerance?: number;   // 新增：侧边栏容差
  headerHeightTolerance?: number; // 新增：头部容差
  filterNames: string[];
  useDefaultFilter: boolean;
}
```

白名单匹配改进：
```typescript
function looseMatch(name: string, keyword: string): boolean {
  // 与上述 looseMatches 类似
  // 支持前缀、单词边界匹配
}
```

#### 2. 矢量地狱优化增强

**问题**：
- 图标判定条件简单，只看 VECTOR 子节点数量
- 完全删除路径数据，无法还原真实矢量
- 尺寸阈值固定

**解决方案**：

多重判定条件识别图标：
```typescript
export function isIconContainer(node: any, config: VectorHellConfig): boolean {
  // 1. VECTOR 子节点数量
  const vectorCount = node.children.filter((c: any) => c.type === 'VECTOR').length;

  // 2. 检查名称是否包含图标关键词
  const hasIconName = ['icon', '图标', 'ico', 'symbol', 'logo'].some(k => nameLower.includes(k));

  // 3. 知名图标组件库命名
  const isIconLib = [/^icon-/, /^i-/, /^lucide-/, /^feather-/].some(p => p.test(nameLower));

  // 4. 尺寸比例（图标通常接近正方形）
  const isSquareRatio = ratio < 3;

  // 综合判定
  return meetsVectorThreshold && (hasIconName || isIconLib || isSquareRatio);
}
```

新增配置选项：
```typescript
export interface VectorHellConfig {
  // 原有字段...
  preserveGradientData?: boolean;   // 保留渐变数据
  preserveVectorPaths?: boolean;   // 保留路径数量信息
  preserveVectorNetwork?: boolean; // 保留网络节点数信息
  sizeToleranceRatio?: number;     // 尺寸容差比例
}
```

简化函数支持配置：
```typescript
function simplifyFillsOrStrokes(items: any[], config: VectorHellConfig): any[] {
  if (!config.preserveGradientData) {
    // 渐变数据占位符化
    simplified.gradientStops = '[GradientStops]';
  }
  // ...
}
```

#### 3. 智能指纹采样优化

**问题**：
- 默认禁用，数据量仍然爆炸
- 指纹算法依赖名称，名称变化导致失效
- 相似度判断简单，不同颜色行被误判相同

**解决方案**：

改进指纹算法（减少对名称的依赖）：
```typescript
export function calculateFingerprint(node: any, depth: number = 0): NodeFingerprint {
  // 1. 收集子节点类型序列（不包含名称）
  const childTypes = node.children
    ? node.children.map((c: any) => c.type).join('|')
    : '';

  // 2. 收集布局属性（用于区分不同布局模式）
  const layoutProps = [
    node.layoutMode,
    node.primaryAxisSizingMode,
    node.counterAxisSizingMode,
    node.itemSpacing,
  ].filter(v => v !== undefined).join(':');

  // 3. 生成结构哈希（不包含名称）
  const structureHash = `${node.type}:${node.layoutMode}:${node.children?.length}:${childTypes}`;
}
```

改进相似度算法：
```typescript
export function compareFingerprints(fp1: NodeFingerprint, fp2: NodeFingerprint): number {
  // 子节点数量差异小于20%，给予部分相似度
  const ratio = Math.min(fp1.childCount, fp2.childCount) / Math.max(fp1.childCount, fp2.childCount);
  if (ratio > 0.8) return 0.7;

  // 属性签名 Jaccard 相似度
  const keys1 = fp1.propSignature.split(',');
  const keys2 = fp2.propSignature.split(',');
  const intersection = keys1.filter(k => keys2.includes(k));
  const jaccard = intersection.length / [...new Set([...keys1, ...keys2])].length;

  if (jaccard > 0.7) return 0.9;
  // ...
}
```

增强特殊状态识别：
```typescript
export function shouldPreserveNode(node: any, preservePatterns: string[], config: FingerprintConfig): boolean {
  // 1. 先检查命名模式
  if (nodeName.includes(pattern)) return true;

  // 2. 检查变体属性
  if (node.componentProperties?.selected?.value === true ||
      node.componentProperties?.checked?.value === true ||
      node.componentProperties?.expanded?.value === true) {
    return true;
  }

  // 3. 检查禁用状态
  if (props.disabled?.value === true) {
    return config.preserveDisabled ?? true;
  }

  // 4. 检查节点尺寸（异常大的行可能是汇总行）
  if (height > 500) return true;

  return false;
}
```

新增配置选项：
```typescript
export interface FingerprintConfig {
  // 原有字段...
  preserveDisabled?: boolean;      // 保留禁用状态
  preserveHighlighted?: boolean;    // 保留高亮状态
  maxSamplingRatio?: number;       // 最大采样比例
}
```

**关键变更**：默认启用指纹采样，取消注释采样代码。

#### 4. 图表识别增强

**问题**：
- 不支持范围值（如 "100-200"）
- 坐标轴识别硬编码
- 数据提取来源单一

**解决方案**：

支持范围值提取：
```typescript
function extractNumericValue(node: any): number | null {
  // 支持范围值（如 "100-200"），取中间值
  const rangeMatch = cleanedText.match(/^(-?\d+\.?\d*)\s*[-~至到]\s*(-?\d+\.?\d*)$/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end = parseFloat(rangeMatch[2]);
    return (start + end) / 2;
  }
  // ...
}
```

改进坐标轴检测：
```typescript
// 更灵活的坐标轴区域识别
const leftZone = nodeBounds.x + nodeBounds.width * 0.12;  // 从 0.15 调整为 0.12
const bottomZone = nodeBounds.y + nodeBounds.height * 0.88; // 从 0.85 调整为 0.88

// 从 componentProperties 提取轴名称
if (child.componentProperties?.axisLabel || child.componentProperties?.xLabel) {
  xAxisLabels.push(labelValue);
}
```

改进数据提取：
```typescript
// 从 componentProperties 提取数值
let value = child.componentProperties?.value?.value ??
            child.componentProperties?.number?.value ??
            child.componentProperties?.data?.value;
```

改进位置推断（考虑 Y 轴方向）：
```typescript
// 柱状图：高度相对于容器高度，注意 Y 轴向下
const heightFromBottom = containerBottom - itemBottom;
normalizedValue = Math.round((heightFromBottom / nodeBounds.height) * 100);
```

#### 5. 节点处理优化

**问题**：
- layout 判断简单，非 HORIZONTAL 即为 flex-col
- 深度截断信息不足

**解决方案**：

改进布局判断：
```typescript
function createBaseResult(node: any): any {
  let layout: string;

  if (node.layoutMode === 'HORIZONTAL') {
    layout = 'flex-row';
  } else if (node.layoutMode === 'VERTICAL') {
    layout = 'flex-col';
  } else if (node.layoutWrap && node.layoutWrap !== 'NO_WRAP') {
    layout = 'flex-wrap';
  } else if (node.primaryAxisAlignItems || node.counterAxisAlignItems) {
    layout = 'flex-col';
  } else if (node.layoutAlign) {
    layout = 'grid';
  } else if (node.absoluteBoundingBox) {
    layout = 'absolute';
  } else {
    layout = 'flex-col';
  }

  // 保留布局相关信息
  _layoutInfo: {
    layoutMode: node.layoutMode,
    layoutAlign: node.layoutAlign,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    // ...
  }
}
```

改进深度截断：
```typescript
function createTruncatedResult(node: any, maxDepth: number, currentDepth: number): any {
  return {
    _truncated: true,
    reason: 'max-depth-reached',
    _depth: currentDepth,
    _maxDepth: maxDepth,
    _note: `已达到最大深度限制(${maxDepth}层)，${currentDepth - maxDepth}层子节点已截断`,
    children: [],
  };
}
```

#### 6. MCP 工具参数更新

**新增参数**：
```typescript
{
  // 布局过滤
  siderWidthTolerance: z.number().optional().default(50),
  headerHeightTolerance: z.number().optional().default(20),

  // 矢量地狱优化
  enableVectorHellOptimization: z.boolean().optional().default(true),
  vectorHellConfig: z.object({
    minVectorChildren: z.number().optional(),
    maxIconSize: z.number().optional(),
    maxNestingDepth: z.number().optional(),
    preserveGradientData: z.boolean().optional(),
    preserveVectorPaths: z.boolean().optional(),
    preserveVectorNetwork: z.boolean().optional(),
  }).optional(),

  // 指纹采样
  fingerprintConfig: z.object({
    preserveDisabled: z.boolean().optional(),
    preserveHighlighted: z.boolean().optional(),
    maxSamplingRatio: z.number().optional(),
  }).optional(),
}
```

**参数顺序调整**：
```typescript
{
  // 1. 基本参数
  nodeId, framework,

  // 2. 布局过滤（相关参数放一起）
  siderWidth, headerHeight, siderWidthTolerance, headerHeightTolerance,
  useDefaultFilter, filterNames,

  // 3. 深度限制
  maxDepth,

  // 4. 矢量地狱优化
  enableVectorHellOptimization, vectorHellConfig,

  // 5. 智能指纹采样
  enableFingerprintSampling, fingerprintConfig,

  // 6. 图表识别
  enableChartDetection, chartConfig
}
```

### 影响文件

| 文件 | 修改内容 |
|------|----------|
| `src/filter.ts` | 新增宽松匹配、容差配置支持 |
| `src/whitelist.ts` | 改进白名单匹配逻辑 |
| `src/vector-optimization.ts` | 多重判定图标、新增配置选项 |
| `src/fingerprint-sampling.ts` | 改进指纹算法、特殊状态识别 |
| `src/node-processor.ts` | 启用采样代码、改进布局判断和截断信息 |
| `src/chart-detection.ts` | 范围值提取、改进坐标轴和数据提取 |
| `src/types.ts` | 新增 VectorHellConfig 和 FingerprintConfig 字段 |
| `src/config.ts` | 更新默认配置 |
| `src/transform.ts` | 支持新配置选项 |
| `src/index.ts` | 参数更新、顺序调整、版本号升级到 1.1.0 |

### 优化效果

| 功能 | 优化前 | 优化后 |
|------|--------|--------|
| 布局过滤 | 硬编码阈值 ±50px/±20px | 可配置容差参数 |
| 名称匹配 | includes() 误匹配 | 宽松匹配支持前缀/边界 |
| 图标判定 | 仅看 VECTOR 数量 | 多重条件：名称+尺寸+比例 |
| 矢量优化 | 完全删除路径数据 | 可配置保留数量信息 |
| 指纹采样 | 默认禁用 | 默认启用（之前是 false） |
| 指纹算法 | 依赖名称，不稳定 | 不依赖名称，更稳定 |
| 相似度判断 | 简单相等判断 | Jaccard 相似度 + 容差 |
| 数值提取 | 单一文本提取 | 范围值 + componentProperties |
| 坐标轴识别 | 硬编码 15%/70% | 可配置 + 支持属性提取 |
| 布局判断 | 简单二选一 | 支持 grid/flex-wrap/absolute |
| 深度截断 | 仅标记截断 | 包含深度信息和截断说明 |

---

## 修改四：主题色映射功能（2026-04-09）

### 目标
为 MCP 添加颜色映射功能，将 Figma 设计稿中的颜色值映射到国利网安主题工具库的主题色，供 AI 生成代码时识别组件应使用的属性（如 `type="primary"`）。

### 背景
国利网安的主题工具库采用类似 Ant Design Design Token 的主题系统，通过 Seed Token 生成 1-10 级颜色梯度。设计稿中使用 ant-design-vue 组件时，可通过属性（如 `type="primary"`）应用主题色，不需要额外的 CSS 颜色代码。因此只需要输出映射信息供 AI 参考。

### 解决方案

#### 1. 新增颜色映射模块

创建 `src/color-mapping.ts` 文件，实现颜色映射核心逻辑：

**核心函数**：
- `hexToRgb()` / `rgbToHex()` - 颜色格式转换
- `colorDistance()` - 使用欧几里得距离计算颜色相似度
- `findBestMatch()` - 在主题色列表中找到最匹配的颜色
- `mapNodeColors()` - 映射节点的 fills 和 strokes 颜色

**颜色距离算法**：
```typescript
function colorDistance(color1: string, color2: string): number {
  // RGB 空间中两个颜色的欧几里得距离
  // 白色到黑色距离约 441
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// 置信度 = 1 - (距离 / 441)
```

#### 2. 主题色配置

**亮色主题色** (`DEFAULT_THEME_COLORS`)：

| 类别 | 颜色示例 |
|------|---------|
| 品牌色 Primary (1-10级) | colorPrimary, colorPrimaryBg, colorPrimaryHover... |
| 功能色 Success (1-10级) | colorSuccess, colorSuccessBg, colorSuccessHover... |
| 功能色 Warning (1-10级) | colorWarning, colorWarningBg... |
| 功能色 Error (1-10级) | colorError, colorErrorBg... |
| 功能色 Info (1-10级) | colorInfo, colorInfoBg... |
| 中性色 | colorText, colorTextSecondary, colorBorder, colorBgContainer... |

**暗色主题色** (`DARK_THEME_COLORS`)：
```typescript
// 暗色模式下颜色值不同
{ token: 'colorText', value: 'rgba(255,255,255,0.88)' }
{ token: 'colorBgContainer', value: '#141414' }
{ token: 'colorBorder', value: '#424242' }
```

#### 3. 预设颜色梯度生成

为支持 13 种 Ant Design 预设颜色，每种生成 1-10 级梯度：

```typescript
function generateColorPalette(baseColor: string, tokenPrefix: string): ThemeColorItem[] {
  // 根据基础颜色亮度生成 10 级梯度
  // 亮色基准：越高级别越深
  // 暗色基准：越高级别越浅
}

// 13 种预设颜色
const presetColors = [
  { name: 'blue', color: '#1677ff' },
  { name: 'purple', color: '#722ED1' },
  { name: 'cyan', color: '#13C2C2' },
  { name: 'green', color: '#52C41A' },
  { name: 'magenta', color: '#EB2F96' },
  { name: 'pink', color: '#EB2F96' },
  { name: 'red', color: '#F5222D' },
  { name: 'orange', color: '#FA8C16' },
  { name: 'yellow', color: '#FADB14' },
  { name: 'volcano', color: '#FA541C' },
  { name: 'geekblue', color: '#2F54EB' },
  { name: 'gold', color: '#FAAD14' },
  { name: 'lime', color: '#A0D911' },
];

// 生成后示例：blue1 ~ blue10, purple1 ~ purple10 等
```

**生成函数**：
```typescript
export function generateFullLightThemeColors(): ThemeColorItem[] {
  return [...DEFAULT_THEME_COLORS, ...generatePresetColorsLight()];
}

export function generateFullDarkThemeColors(): ThemeColorItem[] {
  return [...DARK_THEME_COLORS, ...generatePresetColorsDark()];
}
```

#### 4. themeMode 参数支持

添加 `themeMode` 参数自动切换明暗主题配置：

```typescript
// transform.ts
function getColorMappingConfig(userConfig: any, themeMode?: ThemeMode): any {
  let defaultThemeColors = generateFullLightThemeColors();
  if (themeMode === 'dark') {
    defaultThemeColors = generateFullDarkThemeColors();
  }
  return {
    enabled: true,
    confidenceThreshold: 0.8,
    themeColors: defaultThemeColors,
    ...userConfig,
  };
}
```

#### 5. 节点处理器集成

在 `src/node-processor.ts` 的 `createBaseResult()` 中调用颜色映射：

```typescript
function createBaseResult(node: any, context: ProcessContext, deps: ProcessorDependencies): any {
  // ... 原有逻辑

  // 颜色映射
  if (deps.enableColorMapping && deps.colorMappingConfig.enabled) {
    const skipMapping = shouldSkipColorMapping(node, { isInsideIcon: context.isInsideIcon });
    if (!skipMapping) {
      const colorMapping = mapNodeColors(node, {
        themeColors: deps.colorMappingConfig.themeColors,
        confidenceThreshold: deps.colorMappingConfig.confidenceThreshold
      });
      if (colorMapping) {
        result._colorMapping = colorMapping;
      }
    }
  }

  return result;
}
```

#### 6. MCP 工具参数更新

```typescript
{
  enableColorMapping: z.boolean().optional().default(true)
    .describe("是否启用颜色映射（默认启用），将Figma颜色映射到主题色"),
  colorMappingConfig: z.object({
    confidenceThreshold: z.number().optional()
      .describe("颜色映射置信度阈值（0-1，默认0.8），低于此值不进行映射"),
    skipIconColors: z.boolean().optional()
      .describe("是否跳过图标颜色（默认true）"),
    themeColors: z.array(z.object({
      token: z.string(),
      value: z.string(),
      category: z.enum(['primary', 'success', 'warning', 'error', 'info', 'neutral']),
      level: z.number().optional()
    })).optional().describe("自定义主题色配置，会覆盖默认配置")
  }).optional().describe("颜色映射配置选项"),
  themeMode: z.enum(['light', 'dark']).optional().default('light')
    .describe("主题模式，light 使用亮色主题色，dark 使用暗色主题色（默认 light）")
}
```

### 输出示例

```json
{
  "id": "1:123",
  "name": "Card Container",
  "type": "FRAME",
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

### 使用示例

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

// 自定义主题色（覆盖默认）
await getFigmaNode({
  nodeId: "1-123",
  themeMode: 'dark',
  colorMappingConfig: {
    themeColors: [
      { token: 'colorPrimary', value: '#1890ff', category: 'primary' },
      // ...
    ]
  }
});

// 禁用颜色映射
await getFigmaNode({
  nodeId: "1-123",
  enableColorMapping: false
});
```

### 影响文件

| 文件 | 修改内容 |
|------|----------|
| `src/color-mapping.ts` | 新增颜色映射核心逻辑 |
| `src/config.ts` | 添加 DEFAULT_THEME_COLORS、DARK_THEME_COLORS、ThemeMode 类型、生成函数 |
| `src/types.ts` | 添加 ColorMappingResult、ColorMappingItem、ColorMappingConfig 类型 |
| `src/node-processor.ts` | 集成颜色映射到节点处理 |
| `src/transform.ts` | 支持 enableColorMapping、colorMappingConfig、themeMode 选项 |
| `src/index.ts` | MCP 工具参数添加颜色映射和主题模式配置 |

### 颜色总数

| 类别 | 数量 |
|------|------|
| 功能色 (primary/success/warning/error/info) | 50 个 |
| 中性色 (text/border/fill/bg) | 约 20 个 |
| 预设颜色梯度 (13种 × 10级) | 130 个 |
| **总计** | **约 200 个颜色** |

### 注意事项

1. **映射逻辑**：将 Figma 颜色与主题色列表逐一比对，找到距离最近的值
2. **置信度阈值**：低于 0.8 的匹配不输出，避免误差
3. **图标颜色跳过**：默认跳过图标内部的颜色映射
4. **themeMode 作用**：确保同一 token 名称在不同主题下正确匹配对应颜色

---

## 修改五：智能指纹采样优化 - 保护表单项（2026-04-09）

### 目标
优化智能指纹采样逻辑，防止查询条件、表单等组件被误压缩。

### 背景
原有的指纹采样逻辑仅基于结构相似度判断，会将 TEXT 属性不同的表单项（如 `[输入框(姓名)]`、`[输入框(电话)]`、`[输入框(地址)]`）视为相同结构并压缩，导致查询条件丢失。此外，小组件（如输入框、选择框）不应该参与指纹采样。

### 解决方案

#### 1. 增加文本指纹特征（`src/fingerprint-sampling.ts`）

新增 `collectTextFingerprint()` 函数，收集 TEXT 子节点的字符内容：

```typescript
function collectTextFingerprint(node: any): string {
  // 收集所有 TEXT 节点的字符内容
  const textContents: string[] = [];
  // ...遍历子节点收集文本
  // 生成文本指纹：按内容排序后取前10个，去重后拼接
  return uniqueTexts.sort().join('|');
}
```

修改 `calculateFingerprint()` 函数，在指纹中增加 `textFingerprint` 字段。

#### 2. 修改相似度比较逻辑（`src/fingerprint-sampling.ts`）

在 `compareFingerprints()` 中增加文本差异检测：

```typescript
// 检查文本指纹差异
if (fp1.textFingerprint && fp2.textFingerprint && fp1.textFingerprint !== fp2.textFingerprint) {
  // 计算文本相似度
  const textSimilarity = commonTexts.length / allTexts.length;
  // 如果文本差异较大（低于阈值），降低相似度
  if (textSimilarity < textThreshold) {
    return 0.3; // 文本不同的表单项应该被视为不同结构
  }
}
```

#### 3. 增加最小子节点数量限制（`src/node-processor.ts`）

在触发指纹采样时增加最小子节点数量要求：

```typescript
// 条件：1. 启用了指纹采样 2. 节点名称匹配采样目标 3. 子节点数量 >= 最小要求
const minChildren = fingerprintConfig.minChildrenForSampling ?? 3;
if (enableFingerprintSampling &&
    isFingerprintSamplingTarget(node.name || '', fingerprintConfig) &&
    node.children.length >= minChildren) {
  // 智能指纹采样
}
```

#### 4. 增加配置项（`src/types.ts`, `src/config.ts`）

**新增类型**：
```typescript
interface FingerprintConfig {
  // ... 现有配置
  formFieldPatterns?: string[];       // 表单字段关键词
  textDifferenceThreshold?: number;   // 文本差异敏感度
  minChildrenForSampling?: number;   // 最少子节点数量才进行采样
}
```

**新增默认配置**：
```typescript
export const DEFAULT_FINGERPRINT_CONFIG = {
  // ... 现有配置
  minChildrenForSampling: 3, // 最少3个子节点才进行采样
  formFieldPatterns: [
    'input', 'textfield', 'textarea',
    'select', 'dropdown', 'combobox',
    'checkbox', 'radio', 'switch',
    'datepicker', 'search', 'query',
    'filter', 'form-item', 'field',
  ],
  textDifferenceThreshold: 0.8,
};
```

**在 preservePatterns 中增加表单项关键词**：
```typescript
preservePatterns: [
  // ... 现有配置
  // 查询条件/表单项
  'query', 'filter', 'search', 'form-item', 'formitem', 'field', 'condition',
],
```

#### 5. 表单字段优先保留逻辑（`src/fingerprint-sampling.ts`）

在 `fingerprintSampling()` 函数中，对表单字段进行特殊处理：

```typescript
// 如果是表单字段且有文本内容，优先保留不同文本的项
if (currentFp.isFormField && currentFp.textFingerprint) {
  const isTextDuplicate = preservedIndices.some(preservedIdx => {
    const preservedFp = fingerprints.get(preservedIdx)!;
    return preservedFp.isFormField &&
           preservedFp.textFingerprint === currentFp.textFingerprint;
  });
  if (!isTextDuplicate) {
    preservedIndices.push(i);
    // ...
  }
}
```

### 效果

| 组件类型 | 子节点数 | 修复前 | 修复后 |
|---------|---------|--------|--------|
| 查询条件(姓名) | 2 | 被压缩 | ✅ 保留 |
| 查询条件(电话) | 2 | 被压缩 | ✅ 保留 |
| 查询条件(地址) | 2 | 被压缩 | ✅ 保留 |
| 单个输入框 | 1-2 | 可能误采样 | ❌ 不采样 |
| 选择框 | 2-3 | 可能误采样 | ❌ 不采样 |
| 表格行 | 5-10 | 采样 | ✅ 采样 |
| 列表项 | 3-8 | 采样 | ✅ 采样 |

### 影响文件

- `src/fingerprint-sampling.ts` - 核心逻辑修改
- `src/types.ts` - 新增类型定义
- `src/config.ts` - 新增配置项
- `src/node-processor.ts` - 调整触发条件

---

## 修改汇总表

| 时间 | 类型 | 主要内容 | 影响文件 |
|------|------|----------|----------|
| 2026-04-01 | 功能新增 | 图表识别与数据提取功能，支持13种图表类型 | `src/chart-detection.ts`(新增), `src/types.ts`, `src/config.ts`, `src/node-processor.ts`, `src/transform.ts`, `src/meta-builder.ts`, `src/index.ts`, `CLAUDE.md` |
| 2026-04-02 | 功能优化 | 图表识别模块优化：决策树重构、名称验证、数据提取增强 | `src/chart-detection.ts`, `src/types.ts` |
| 2026-04-02 | 漏洞修复 | 布局过滤、矢量优化、指纹采样、图表识别、节点处理全面优化 | `src/filter.ts`, `src/whitelist.ts`, `src/vector-optimization.ts`, `src/fingerprint-sampling.ts`, `src/node-processor.ts`, `src/chart-detection.ts`, `src/types.ts`, `src/config.ts`, `src/transform.ts`, `src/index.ts` |
| 2026-04-09 | 功能新增 | 主题色映射功能：支持亮色/暗色主题、13种预设颜色梯度 | `src/color-mapping.ts`(新增), `src/config.ts`, `src/types.ts`, `src/node-processor.ts`, `src/transform.ts`, `src/index.ts` |
| 2026-04-09 | 功能优化 | 智能指纹采样优化：保护表单项、增加最小子节点数量限制 | `src/fingerprint-sampling.ts`, `src/types.ts`, `src/config.ts`, `src/node-processor.ts` |

---

*记录生成时间: 2026-04-09*
