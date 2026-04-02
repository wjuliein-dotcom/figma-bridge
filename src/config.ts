// --- 默认配置 ---

import type { VectorHellConfig, FingerprintConfig, ChartConfig } from './types.js';

/**
 * 默认图表配置
 */
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  /** 启用图表识别 */
  enabled: true,
  /** 最少数据点数量才视为图表 */
  minDataPoints: 3,
  /** 置信度阈值 */
  confidenceThreshold: 0.6,
  /** 图表类型关键词映射 */
  typeKeywords: {
    bar: ['柱状图', 'bar', 'column', 'chart', '统计图', '对比图'],
    line: ['折线图', 'line', 'trend', '曲线', '趋势', '走势'],
    pie: ['饼图', 'pie', '环形图', 'donut', '占比', '比例', '分布'],
    scatter: ['散点图', 'scatter', '分布', '气泡图'],
    area: ['面积图', 'area', '堆叠'],
    radar: ['雷达图', 'radar', '蛛网图'],
    graph: ['关系图', 'graph', 'network', '拓扑', 'G6', '关系', '网络'],
    tree: ['树图', 'tree', '树形', '层级', '组织结构'],
    sankey: ['桑基图', 'sankey', '能量流'],
    funnel: ['漏斗图', 'funnel', '转化率'],
    gauge: ['仪表盘', 'gauge', '仪表', '进度'],
    heatmap: ['热力图', 'heatmap', '热图', '密度'],
    candlestick: ['K线图', 'candlestick', '股票', '蜡烛图'],
  },
  /** 轴检测配置 */
  axisDetection: {
    minLineLength: 50,
    axisLabelPatterns: ['\\d+', '年', '月', '日', 'Q[1-4]', 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'],
  },
  /** 数据提取配置 */
  dataExtraction: {
    maxSeries: 10,
    inferNumericValues: true,
    extractFromPosition: true,
  },
};

// 默认要过滤的节点名称（大小写不敏感）
export const DEFAULT_FILTERED_NAMES = [
  'menu',           // 页面侧边菜单，但 Dropdown 中的 Menu 保留
  'header',         // 页面头部，但 Card/Modal 的 Header 保留
  'sidebar',        // 侧边栏
  'sider',          // Ant Design Layout.Sider
  'footer',         // 页面底部
  'navbar',         // 导航栏
  'navigation',     // 导航
  '侧边菜单',       // 中文菜单
  '菜单',
  '头部',
  '页头',
  '导航栏',
  '侧边栏',
];

// 定义组件组合白名单：这些父组件中的"过滤词"会被保留
export const COMPONENT_COMPOSITION_WHITELIST: Record<string, string[]> = {
  // Dropdown 组件中保留 Menu
  'dropdown': ['menu', '菜单'],
  'popover': ['menu', '菜单', 'content'],
  'tooltip': ['content'],

  // Select 组件中保留相关选项
  'select': ['option', 'options', 'menu', 'item'],

  // Card 组件中保留 Header
  'card': ['header', 'extra', 'title', '头部'],

  // Modal/Dialog 组件中保留 Header/Footer
  'modal': ['header', 'footer', 'title', '头部', '底部'],
  'dialog': ['header', 'footer', 'title', '头部', '底部'],
  'drawer': ['header', 'footer', 'title', '头部', '底部'],

  // Collapse 面板
  'collapse': ['panel', 'item'],

  // Tabs 标签页
  'tabs': ['tabpane', 'tab', 'item'],

  // Steps 步骤条
  'steps': ['step', 'item'],

  // Timeline 时间轴
  'timeline': ['item'],

  // Breadcrumb 面包屑
  'breadcrumb': ['item'],

  // List 列表
  'list': ['item', 'header', 'footer'],

  // Table 表格
  'table': ['column', 'columns'],

  // Form 表单
  'form': ['item', 'formitem'],

  // PageHeader 页头
  'pageheader': ['title', 'subtitle', 'extra', 'back', 'header'],

  // Anchor 锚点
  'anchor': ['link'],

  // Menu 内部的 SubMenu/MenuItemGroup
  'menu': ['submenu', 'itemgroup', 'item', 'divider'],
};

// 保留在组件内部的特定类型
export const PRESERVE_TYPES_IN_COMPONENTS = ['TEXT', 'VECTOR', 'ELLIPSE', 'RECTANGLE'];

// 默认矢量地狱配置
export const DEFAULT_VECTOR_HELL_CONFIG: VectorHellConfig = {
  enabled: true,
  minVectorChildren: 3,      // 3个及以上 VECTOR 子节点视为图标
  maxIconSize: 200,          // 大于 200px 的容器不视为图标
  maxNestingDepth: 3,        // 超过3层嵌套则扁平化
  preserveVectorProps: [
    'id', 'name', 'type', 'visible', 'opacity',
    'absoluteBoundingBox', 'layoutMode', 'fills', 'strokes',
    'effects', 'styles', 'componentProperties'
  ],
  preserveGradientData: false,   // 默认不保留渐变数据，节省空间
  preserveVectorPaths: false,    // 默认不保留路径信息
  preserveVectorNetwork: false,   // 默认不保留网络信息
  sizeToleranceRatio: 3,          // 长宽比小于3认为接近正方形
};

// 矢量节点要过滤的属性（这些属性会导致数据爆炸）
export const VECTOR_BLOAT_PROPS = [
  'vectorPaths',           // 矢量路径数据（最大的罪魁祸首）
  'vectorNetwork',         // 矢量网络
  'fillGeometry',          // 填充几何
  'strokeGeometry',        // 描边几何
  'strokeCap',             // 描边端点
  'strokeJoin',            // 描边连接
  'strokeMiterAngle',      // 描边斜接角度
  'dashPattern',           // 虚线模式
  'fillOverrideTable',     // 填充覆盖表
  'strokeOverrideTable',   // 描边覆盖表
  'styleOverrideTable',    // 样式覆盖表
  'arcData',               // 弧线数据
  'lineIndentation',       // 行缩进
  'lineSpacing',           // 行间距
  'paragraphSpacing',      // 段落间距
  'paragraphIndent',       // 段落缩进
  'hyperlink',             // 超链接
];

// 默认指纹采样配置
export const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  // 启用指纹采样的组件名称匹配 - 包含 Table、List 等重复组件
  namePatterns: [
    // Table 相关
    'row', 'tr', 'tbody',
    // List 相关
    'list-item', 'listitem', 'item',
    // Select/Dropdown 选项
    'option',
    // Steps/Tab/Timeline
    'step', 'tab', 'panel', 'timeline-item',
    // Menu 菜单项
    'menu-item', 'menuitem',
  ],
  similarityThreshold: 0.95, // 95% 相似度视为相同结构
  maxUniqueStructures: 5,    // 增加到5个唯一结构
  // 始终保留的特殊节点名称匹配
  preservePatterns: [
    // 展开/收起
    'expand', 'expanded', 'collapse', 'collapsed', '展开', '收起',
    // 选中/激活状态
    'selected', 'active', 'current', 'checked', '选中', '激活', '当前',
    // 交互状态
    'focus', 'hover', 'disabled', 'loading', 'error', '空状态',
    // List 特有
    'loadmore', 'load-more', 'pagination', 'header', 'footer',
    // Table 特有
    'header-row', 'headerrow', 'summary', 'summary-row',
    // 高亮/强调
    'highlight', 'emphasized', 'important', 'primary', 'featured',
  ],
  preserveDisabled: true,    // 默认保留禁用状态
  preserveHighlighted: true,  // 默认保留高亮状态
  maxSamplingRatio: 0.5,      // 最多采样50%的数据
};

// 图表相关的属性白名单
export const CHART_NODE_PRESERVE_PROPS = [
  'id', 'name', 'type', 'visible', 'opacity',
  'absoluteBoundingBox', 'layoutMode', 'fills', 'strokes',
  'effects', 'styles', 'componentProperties',
  // 图表相关
  'chartMeta', 'chartData', 'chartStyle',
];

// 图表节点要跳过的子节点类型（避免数据爆炸）
export const CHART_SKIP_CHILD_TYPES = [
  'VECTOR',          // 矢量元素（已提取为数据）
  'ELLIPSE',         // 圆形（饼图扇区）
  'LINE',            // 线条（坐标轴/网格线）
];

// 图表类型到 ECharts 类型的映射
export const CHART_TYPE_TO_ECHARTS: Record<string, string> = {
  bar: 'bar',
  line: 'line',
  pie: 'pie',
  scatter: 'scatter',
  area: 'line',
  radar: 'radar',
  sankey: 'sankey',
  funnel: 'funnel',
  gauge: 'gauge',
  heatmap: 'heatmap',
  candlestick: 'candlestick',
  graph: 'graph',
  tree: 'tree',
};

// 图表类型到 G6 类型的映射（关系图/树图）
export const CHART_TYPE_TO_G6: Record<string, string> = {
  graph: 'graph',
  tree: 'tree',
};
