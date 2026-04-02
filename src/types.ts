// --- 类型定义 ---

/**
 * 图表类型
 */
export type ChartType =
  | 'bar'        // 柱状图
  | 'line'       // 折线图
  | 'pie'        // 饼图
  | 'scatter'    // 散点图
  | 'area'       // 面积图
  | 'radar'      // 雷达图
  | 'graph'      // 关系图 (G6)
  | 'tree'       // 树图 (G6)
  | 'sankey'     // 桑基图
  | 'funnel'     // 漏斗图
  | 'gauge'      // 仪表盘
  | 'heatmap'    // 热力图
  | 'candlestick' // K线图
  | 'none';      // 非图表

/**
 * 图表识别结果
 */
export interface ChartDetectionResult {
  /** 检测到的图表类型 */
  type: ChartType;
  /** 置信度 0-1 */
  confidence: number;
  /** 识别依据 */
  reasons: string[];
}

/**
 * 图表识别线索
 */
export interface ChartClues {
  /** 是否有坐标轴 */
  hasAxes: boolean;
  /** 是否有矩形条（柱状图） */
  hasBars: boolean;
  /** 是否有连续线条（折线图） */
  hasLines: boolean;
  /** 是否有圆形元素（饼图/散点） */
  hasCircles: boolean;
  /** 是否有图例 */
  hasLegend: boolean;
  /** 是否有网格线 */
  hasGrid: boolean;
  /** 数据点数量 */
  dataPointCount: number;
  /** 是否圆形布局 */
  isCircularLayout: boolean;
  /** 节点名称中的关键词（优化版：带置信度） */
  nameKeywords: Array<{ type: string; adjustedConfidence: number; reasons: string[] }>;
  /** 子节点中包含的矩形数量 */
  rectangleCount: number;
  /** 子节点中包含的圆形数量 */
  circleCount: number;
  /** 子节点中包含的线数量 */
  lineCount: number;
  /** 线条方向分析（优化） */
  _lineOrientation?: {
    hasHorizontalAxis: boolean;
    hasVerticalAxis: boolean;
  };
  /** 数据排列模式（优化） */
  _dataPattern?: {
    isHorizontalBars: boolean;
    isVerticalBars: boolean;
    isScatterPattern: boolean;
    isStackedPattern: boolean;
  };
}

/**
 * 坐标轴信息
 */
export interface ChartAxis {
  /** 轴名称 */
  name?: string;
  /** 分类数据（类目轴） */
  categories?: string[];
  /** 最小值（数值轴） */
  min?: number;
  /** 最大值（数值轴） */
  max?: number;
  /** 轴类型 */
  type?: 'category' | 'value' | 'time';
}

/**
 * 图表系列数据
 */
export interface ChartSeries {
  /** 系列名称 */
  name: string;
  /** 系列类型 */
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  /** 数据 */
  data: number[] | Array<{ name: string; value: number }> | Array<{ name: string; value: [number, number] }>;
  /** 样式线索 */
  style: {
    color?: string;
    barWidth?: number;
    lineSmooth?: boolean;
    areaFill?: boolean;
    symbolSize?: number;
  };
}

/**
 * 图例信息
 */
export interface ChartLegend {
  /** 图例数据 */
  data: string[];
  /** 图例位置 */
  position: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * 图表数据
 */
export interface ChartData {
  /** 坐标轴信息 */
  axes?: {
    xAxis?: ChartAxis;
    yAxis?: ChartAxis;
  };
  /** 系列数据 */
  series: ChartSeries[];
  /** 图例 */
  legend?: ChartLegend;
  /** 配色方案 */
  colorScheme?: string[];
}

/**
 * 图表样式
 */
export interface ChartStyle {
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 内边距 */
  padding?: { top: number; right: number; bottom: number; left: number };
  /** 背景色 */
  backgroundColor?: string;
  /** 标题 */
  title?: { text: string; style: any };
}

/**
 * 图表元数据
 */
export interface ChartMeta {
  /** 检测到的图表类型 */
  detectedType: ChartType;
  /** 对应的 ECharts 类型 */
  echartsType: string;
  /** 对应的 G6 类型（关系图） */
  g6Type?: string;
  /** 置信度 */
  confidence: number;
}

/**
 * 图表配置
 */
export interface ChartConfig {
  /** 启用图表识别 */
  enabled: boolean;
  /** 最少数据点数量才视为图表 */
  minDataPoints: number;
  /** 置信度阈值 */
  confidenceThreshold: number;
  /** 图表类型关键词映射 */
  typeKeywords: Record<string, string[]>;
  /** 轴检测配置 */
  axisDetection: {
    minLineLength: number;
    axisLabelPatterns: string[];
  };
  /** 数据提取配置 */
  dataExtraction: {
    maxSeries: number;
    inferNumericValues: boolean;
    extractFromPosition: boolean;
  };
}

export interface VectorHellConfig {
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

export interface FingerprintConfig {
  // 启用指纹采样的组件名称匹配
  namePatterns: string[];
  // 指纹相似度阈值（0-1，1 表示完全相同）
  similarityThreshold: number;
  // 最大保留的唯一结构数
  maxUniqueStructures: number;
  // 始终保留的特殊节点名称匹配（如展开行、选中态等）
  preservePatterns: string[];
}

export interface TransformOptions {
  framework?: 'vue' | 'react' | 'html';
  /** 要过滤掉的节点名称列表（大小写不敏感） */
  filterNames?: string[];
  /** 是否启用默认过滤（Menu, Header等） */
  useDefaultFilter?: boolean;
  /** 左侧菜单栏宽度阈值（默认220px），用于判断左侧菜单区域 */
  siderWidth?: number;
  /** 顶部头部高度阈值（默认64px），用于判断顶部header区域 */
  headerHeight?: number;
  /** 最大递归深度（防止深层嵌套） */
  maxDepth?: number;
  /** 是否启用智能指纹采样 */
  enableFingerprintSampling?: boolean;
  /** 指纹采样配置 */
  fingerprintConfig?: Partial<FingerprintConfig>;
  /** 是否启用矢量地狱优化（默认启用） */
  enableVectorHellOptimization?: boolean;
  /** 矢量地狱配置 */
  vectorHellConfig?: Partial<VectorHellConfig>;
  /** 是否启用图表识别（默认启用） */
  enableChartDetection?: boolean;
  /** 图表检测配置 */
  chartConfig?: Partial<ChartConfig>;
}

export interface ProcessContext {
  parentName: string;
  depth: number;
  path: string[];
  /** 是否是图标容器内部 */
  isInsideIcon?: boolean;
  /** 图标嵌套深度 */
  iconNestingDepth?: number;
  /** 是否是图表容器内部 */
  isInsideChart?: boolean;
  /** 图表类型（如果在图表内部） */
  chartType?: ChartType;
}

// 节点结构指纹
export interface NodeFingerprint {
  // 结构哈希（基于节点类型和层级）
  structureHash: string;
  // 子节点类型序列
  childTypes: string;
  // 属性签名
  propSignature: string;
  // 深度
  depth: number;
  // 子节点数量
  childCount: number;
}

// 采样结果记录
export interface SamplingRecord {
  // 保留的节点索引
  preservedIndices: number[];
  // 跳过的节点索引
  skippedIndices: number[];
  // 指纹到索引的映射
  fingerprintMap: Map<string, number[]>;
  // 每个保留节点对应的重复数量
  duplicatesCount: Map<number, number>;
}
