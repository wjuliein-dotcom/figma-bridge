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

## 修改汇总表

| 时间 | 类型 | 主要内容 | 影响文件 |
|------|------|----------|----------|
| 2026-04-01 | 功能新增 | 图表识别与数据提取功能，支持13种图表类型，提取数据供ECharts/G6使用 | `src/chart-detection.ts`(新增), `src/types.ts`, `src/config.ts`, `src/node-processor.ts`, `src/transform.ts`, `src/meta-builder.ts`, `src/index.ts`, `CLAUDE.md` |

---

*记录生成时间: 2026-04-01*
