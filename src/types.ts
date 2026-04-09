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
  /** 是否保留渐变数据（默认false，节省空间） */
  preserveGradientData?: boolean;
  /** 是否保留矢量路径信息（只保留数量，不保留完整数据） */
  preserveVectorPaths?: boolean;
  /** 是否保留矢量网络信息（只保留节点数） */
  preserveVectorNetwork?: boolean;
  /** 尺寸容差（用于判断图标的标准方比例） */
  sizeToleranceRatio?: number;
}

export interface FingerprintConfig {
  // 启用指纹采样的组件名称匹配
  namePatterns: string[];
  // 指纹相似度阈值（0-1，1 表示完全相同）
  similarityThreshold: number;
  // 最大保留的唯一结构数
  maxUniqueStructures: number;
  // 最少子节点数量才进行采样（避免对小组件进行采样），默认 3
  minChildrenForSampling?: number;
  // 始终保留的特殊节点名称匹配（如展开行、选中态等）
  preservePatterns: string[];
  // 是否保留禁用状态的行（默认true）
  preserveDisabled?: boolean;
  // 是否保留高亮/选中状态的行（默认true）
  preserveHighlighted?: boolean;
  // 最大采样比例（0-1），避免采样过多
  maxSamplingRatio?: number;
  // 表单字段关键词（这些组件的文本差异应被保留）
  formFieldPatterns?: string[];
  // 文本差异敏感度（默认0.8，低于此值视为不同结构）
  textDifferenceThreshold?: number;
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
  /** 侧边栏宽度容差（默认50px） */
  siderWidthTolerance?: number;
  /** 头部高度容差（默认20px） */
  headerHeightTolerance?: number;
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
  /** 是否启用颜色映射（将 Figma 颜色映射到主题色） */
  enableColorMapping?: boolean;
  /** 颜色映射配置 */
  colorMappingConfig?: Partial<ColorMappingConfig>;
  /** 主题模式，用于选择对应的颜色配置（light 或 dark） */
  themeMode?: 'light' | 'dark';
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
  // 文本指纹（用于区分文本内容不同的表单项）
  textFingerprint?: string;
  // 是否包含表单相关组件
  isFormField?: boolean;
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

// 颜色映射项
export interface ColorMappingItem {
  // 原始颜色值
  originalColor: string;
  // 映射到的主题色 token
  mappedToken: string;
  // 主题色的实际值
  mappedValue: string;
  // 匹配置信度 (0-1)
  confidence: number;
}

// 颜色映射结果
export interface ColorMappingResult {
  // 填充色/背景色映射
  fills: ColorMappingItem[];
  // 描边色映射
  strokes: ColorMappingItem[];
}

// 颜色映射配置
export interface ColorMappingConfig {
  // 启用颜色映射
  enabled: boolean;
  // 置信度阈值，低于此值不进行映射
  confidenceThreshold: number;
  // 跳过图标内部颜色
  skipIconColors: boolean;
  // 主题色配置
  themeColors?: Array<{
    token: string;
    value: string;
    category: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
    level?: number;
  }>;
}
