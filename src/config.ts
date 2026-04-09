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
  minChildrenForSampling: 3, // 最少3个子节点才进行采样，避免对小组件（如输入框、选择框）进行采样
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
    // 查询条件/表单项（新增）
    'query', 'filter', 'search', 'form-item', 'formitem', 'field', 'condition',
  ],
  preserveDisabled: true,    // 默认保留禁用状态
  preserveHighlighted: true,  // 默认保留高亮状态
  maxSamplingRatio: 0.5,     // 最多采样50%的数据
  // 表单字段关键词（这些组件的文本差异应被保留）
  formFieldPatterns: [
    'input', 'textfield', 'text-field', 'textarea',
    'select', 'dropdown', 'combobox',
    'checkbox', 'radio', 'switch', 'toggle',
    'datepicker', 'date-picker', 'timepicker', 'time-picker',
    'search', 'query', 'filter', 'form-item', 'formitem',
    'field', 'condition', 'criteria', 'param',
  ],
  textDifferenceThreshold: 0.8, // 文本差异阈值，低于此值视为不同结构
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

// 主题色配置（基于国利网安主题工具库）
// 对应 SeedToken 和 ColorMapToken 中的关键颜色
export interface ThemeColorItem {
  token: string;
  value: string;
  category: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  level?: number;
}

// 默认主题色配置
export const DEFAULT_THEME_COLORS: ThemeColorItem[] = [
  // ===== 品牌色 Primary =====
  { token: 'colorPrimary', value: '#1677ff', category: 'primary', level: 6 },
  { token: 'colorPrimaryBg', value: '#e6f4ff', category: 'primary', level: 1 },
  { token: 'colorPrimaryBgHover', value: '#b4dbfd', category: 'primary', level: 2 },
  { token: 'colorPrimaryBorder', value: '#91baf2', category: 'primary', level: 3 },
  { token: 'colorPrimaryBorderHover', value: '#6aa3e0', category: 'primary', level: 4 },
  { token: 'colorPrimaryHover', value: '#4096ff', category: 'primary', level: 5 },
  { token: 'colorPrimaryActive', value: '#0958d9', category: 'primary', level: 7 },
  { token: 'colorPrimaryTextHover', value: '#4096ff', category: 'primary', level: 8 },
  { token: 'colorPrimaryText', value: '#1677ff', category: 'primary', level: 9 },
  { token: 'colorPrimaryTextActive', value: '#0958d9', category: 'primary', level: 10 },

  // ===== 功能色 Success =====
  { token: 'colorSuccess', value: '#52c41a', category: 'success', level: 6 },
  { token: 'colorSuccessBg', value: '#f6ffed', category: 'success', level: 1 },
  { token: 'colorSuccessBgHover', value: '#d9f7be', category: 'success', level: 2 },
  { token: 'colorSuccessBorder', value: '#b7eb8f', category: 'success', level: 3 },
  { token: 'colorSuccessBorderHover', value: '#95de64', category: 'success', level: 4 },
  { token: 'colorSuccessHover', value: '#73d13d', category: 'success', level: 5 },
  { token: 'colorSuccessActive', value: '#389e0d', category: 'success', level: 7 },
  { token: 'colorSuccessTextHover', value: '#73d13d', category: 'success', level: 8 },
  { token: 'colorSuccessText', value: '#52c41a', category: 'success', level: 9 },
  { token: 'colorSuccessTextActive', value: '#389e0d', category: 'success', level: 10 },

  // ===== 功能色 Warning =====
  { token: 'colorWarning', value: '#faad14', category: 'warning', level: 6 },
  { token: 'colorWarningBg', value: '#fffbe6', category: 'warning', level: 1 },
  { token: 'colorWarningBgHover', value: '#fff1b8', category: 'warning', level: 2 },
  { token: 'colorWarningBorder', value: '#ffe58f', category: 'warning', level: 3 },
  { token: 'colorWarningBorderHover', value: '#ffd666', category: 'warning', level: 4 },
  { token: 'colorWarningHover', value: '#ffc53d', category: 'warning', level: 5 },
  { token: 'colorWarningActive', value: '#d48806', category: 'warning', level: 7 },
  { token: 'colorWarningTextHover', value: '#ffc53d', category: 'warning', level: 8 },
  { token: 'colorWarningText', value: '#faad14', category: 'warning', level: 9 },
  { token: 'colorWarningTextActive', value: '#d48806', category: 'warning', level: 10 },

  // ===== 功能色 Error =====
  { token: 'colorError', value: '#ff4d4f', category: 'error', level: 6 },
  { token: 'colorErrorBg', value: '#fff2f0', category: 'error', level: 1 },
  { token: 'colorErrorBgHover', value: '#ffccc7', category: 'error', level: 2 },
  { token: 'colorErrorBorder', value: '#ffa39e', category: 'error', level: 3 },
  { token: 'colorErrorBorderHover', value: '#f77474', category: 'error', level: 4 },
  { token: 'colorErrorHover', value: '#ff7875', category: 'error', level: 5 },
  { token: 'colorErrorActive', value: '#cf1322', category: 'error', level: 7 },
  { token: 'colorErrorTextHover', value: '#ff7875', category: 'error', level: 8 },
  { token: 'colorErrorText', value: '#ff4d4f', category: 'error', level: 9 },
  { token: 'colorErrorTextActive', value: '#cf1322', category: 'error', level: 10 },

  // ===== 功能色 Info =====
  { token: 'colorInfo', value: '#1677ff', category: 'info', level: 6 },
  { token: 'colorInfoBg', value: '#e6f4ff', category: 'info', level: 1 },
  { token: 'colorInfoBgHover', value: '#b4dbfd', category: 'info', level: 2 },
  { token: 'colorInfoBorder', value: '#91baf2', category: 'info', level: 3 },
  { token: 'colorInfoBorderHover', value: '#6aa3e0', category: 'info', level: 4 },
  { token: 'colorInfoHover', value: '#4096ff', category: 'info', level: 5 },
  { token: 'colorInfoActive', value: '#0958d9', category: 'info', level: 7 },
  { token: 'colorInfoTextHover', value: '#4096ff', category: 'info', level: 8 },
  { token: 'colorInfoText', value: '#1677ff', category: 'info', level: 9 },
  { token: 'colorInfoTextActive', value: '#0958d9', category: 'info', level: 10 },

  // ===== 中性色 Neutral - Text =====
  { token: 'colorTextBase', value: '#000000', category: 'neutral' },
  { token: 'colorText', value: 'rgba(0, 0, 0, 0.88)', category: 'neutral' },
  { token: 'colorTextSecondary', value: 'rgba(0, 0, 0, 0.65)', category: 'neutral' },
  { token: 'colorTextTertiary', value: 'rgba(0, 0, 0, 0.45)', category: 'neutral' },
  { token: 'colorTextQuaternary', value: 'rgba(0, 0, 0, 0.25)', category: 'neutral' },

  // ===== 中性色 Neutral - Border =====
  { token: 'colorBorder', value: '#d9d9d9', category: 'neutral' },
  { token: 'colorBorderSecondary', value: '#f0f0f0', category: 'neutral' },

  // ===== 中性色 Neutral - Fill =====
  { token: 'colorFill', value: 'rgba(0, 0, 0, 0.15)', category: 'neutral' },
  { token: 'colorFillSecondary', value: 'rgba(0, 0, 0, 0.06)', category: 'neutral' },
  { token: 'colorFillTertiary', value: 'rgba(0, 0, 0, 0.04)', category: 'neutral' },
  { token: 'colorFillQuaternary', value: 'rgba(0, 0, 0, 0.02)', category: 'neutral' },

  // ===== 中性色 Neutral - Background =====
  { token: 'colorBgLayout', value: '#f5f5f5', category: 'neutral' },
  { token: 'colorBgContainer', value: '#ffffff', category: 'neutral' },
  { token: 'colorBgElevated', value: '#ffffff', category: 'neutral' },
  { token: 'colorBgSpotlight', value: 'rgba(0, 0, 0, 0.85)', category: 'neutral' },
  { token: 'colorBgBase', value: '#ffffff', category: 'neutral' },
  { token: 'colorBgMask', value: 'rgba(0, 0, 0, 0.45)', category: 'neutral' },

  // ===== 纯色 =====
  { token: 'colorWhite', value: '#ffffff', category: 'neutral' },
  { token: 'colorBlack', value: '#000000', category: 'neutral' },
];

// 暗黑主题颜色配置（基于国利网安主题工具库 dark 模式）
export const DARK_THEME_COLORS: ThemeColorItem[] = [
  // ===== 品牌色 Primary =====
  { token: 'colorPrimary', value: '#1668ff', category: 'primary', level: 6 },
  { token: 'colorPrimaryBg', value: '#1a1f2e', category: 'primary', level: 1 },
  { token: 'colorPrimaryBgHover', value: '#1e2538', category: 'primary', level: 2 },
  { token: 'colorPrimaryBorder', value: '#2d3685', category: 'primary', level: 3 },
  { token: 'colorPrimaryBorderHover', value: '#3d4a9e', category: 'primary', level: 4 },
  { token: 'colorPrimaryHover', value: '#3d4fa3', category: 'primary', level: 5 },
  { token: 'colorPrimaryActive', value: '#0c50d3', category: 'primary', level: 7 },
  { token: 'colorPrimaryTextHover', value: '#3d4fa3', category: 'primary', level: 8 },
  { token: 'colorPrimaryText', value: '#1668ff', category: 'primary', level: 9 },
  { token: 'colorPrimaryTextActive', value: '#0c50d3', category: 'primary', level: 10 },

  // ===== 功能色 Success =====
  { token: 'colorSuccess', value: '#53c41a', category: 'success', level: 6 },
  { token: 'colorSuccessBg', value: '#1b2a1b', category: 'success', level: 1 },
  { token: 'colorSuccessBgHover', value: '#213321', category: 'success', level: 2 },
  { token: 'colorSuccessBorder', value: '#2d4a2d', category: 'success', level: 3 },
  { token: 'colorSuccessBorderHover', value: '#3d613d', category: 'success', level: 4 },
  { token: 'colorSuccessHover', value: '#4a7a4a', category: 'success', level: 5 },
  { token: 'colorSuccessActive', value: '#3c8c12', category: 'success', level: 7 },
  { token: 'colorSuccessTextHover', value: '#4a7a4a', category: 'success', level: 8 },
  { token: 'colorSuccessText', value: '#53c41a', category: 'success', level: 9 },
  { token: 'colorSuccessTextActive', value: '#3c8c12', category: 'success', level: 10 },

  // ===== 功能色 Warning =====
  { token: 'colorWarning', value: '#faad14', category: 'warning', level: 6 },
  { token: 'colorWarningBg', value: '#2a2614', category: 'warning', level: 1 },
  { token: 'colorWarningBgHover', value: '#38321d', category: 'warning', level: 2 },
  { token: 'colorWarningBorder', value: '#4a4020', category: 'warning', level: 3 },
  { token: 'colorWarningBorderHover', value: '#605228', category: 'warning', level: 4 },
  { token: 'colorWarningHover', value: '#786a35', category: 'warning', level: 5 },
  { token: 'colorWarningActive', value: '#d0920d', category: 'warning', level: 7 },
  { token: 'colorWarningTextHover', value: '#786a35', category: 'warning', level: 8 },
  { token: 'colorWarningText', value: '#faad14', category: 'warning', level: 9 },
  { token: 'colorWarningTextActive', value: '#d0920d', category: 'warning', level: 10 },

  // ===== 功能色 Error =====
  { token: 'colorError', value: '#ff4d4f', category: 'error', level: 6 },
  { token: 'colorErrorBg', value: '#2a1b1b', category: 'error', level: 1 },
  { token: 'colorErrorBgHover', value: '#382323', category: 'error', level: 2 },
  { token: 'colorErrorBorder', value: '#4a2828', category: 'error', level: 3 },
  { token: 'colorErrorBorderHover', value: '#613a3a', category: 'error', level: 4 },
  { token: 'colorErrorHover', value: '#794b4b', category: 'error', level: 5 },
  { token: 'colorErrorActive', value: '#d9363e', category: 'error', level: 7 },
  { token: 'colorErrorTextHover', value: '#794b4b', category: 'error', level: 8 },
  { token: 'colorErrorText', value: '#ff4d4f', category: 'error', level: 9 },
  { token: 'colorErrorTextActive', value: '#d9363e', category: 'error', level: 10 },

  // ===== 功能色 Info =====
  { token: 'colorInfo', value: '#1668ff', category: 'info', level: 6 },
  { token: 'colorInfoBg', value: '#1a1f2e', category: 'info', level: 1 },
  { token: 'colorInfoBgHover', value: '#1e2538', category: 'info', level: 2 },
  { token: 'colorInfoBorder', value: '#2d3685', category: 'info', level: 3 },
  { token: 'colorInfoBorderHover', value: '#3d4a9e', category: 'info', level: 4 },
  { token: 'colorInfoHover', value: '#3d4fa3', category: 'info', level: 5 },
  { token: 'colorInfoActive', value: '#0c50d3', category: 'info', level: 7 },
  { token: 'colorInfoTextHover', value: '#3d4fa3', category: 'info', level: 8 },
  { token: 'colorInfoText', value: '#1668ff', category: 'info', level: 9 },
  { token: 'colorInfoTextActive', value: '#0c50d3', category: 'info', level: 10 },

  // ===== 中性色 Neutral - Text =====
  { token: 'colorTextBase', value: '#ffffff', category: 'neutral' },
  { token: 'colorText', value: 'rgba(255, 255, 255, 0.88)', category: 'neutral' },
  { token: 'colorTextSecondary', value: 'rgba(255, 255, 255, 0.65)', category: 'neutral' },
  { token: 'colorTextTertiary', value: 'rgba(255, 255, 255, 0.45)', category: 'neutral' },
  { token: 'colorTextQuaternary', value: 'rgba(255, 255, 255, 0.25)', category: 'neutral' },

  // ===== 中性色 Neutral - Border =====
  { token: 'colorBorder', value: '#424242', category: 'neutral' },
  { token: 'colorBorderSecondary', value: '#303030', category: 'neutral' },

  // ===== 中性色 Neutral - Fill =====
  { token: 'colorFill', value: 'rgba(255, 255, 255, 0.15)', category: 'neutral' },
  { token: 'colorFillSecondary', value: 'rgba(255, 255, 255, 0.08)', category: 'neutral' },
  { token: 'colorFillTertiary', value: 'rgba(255, 255, 255, 0.04)', category: 'neutral' },
  { token: 'colorFillQuaternary', value: 'rgba(255, 255, 255, 0.02)', category: 'neutral' },

  // ===== 中性色 Neutral - Background =====
  { token: 'colorBgLayout', value: '#000000', category: 'neutral' },
  { token: 'colorBgContainer', value: '#141414', category: 'neutral' },
  { token: 'colorBgElevated', value: '#1f1f1f', category: 'neutral' },
  { token: 'colorBgSpotlight', value: 'rgba(255, 255, 255, 0.85)', category: 'neutral' },
  { token: 'colorBgBase', value: '#141414', category: 'neutral' },
  { token: 'colorBgMask', value: 'rgba(0, 0, 0, 0.45)', category: 'neutral' },

  // ===== 纯色 =====
  { token: 'colorWhite', value: '#141414', category: 'neutral' },
  { token: 'colorBlack', value: '#ffffff', category: 'neutral' },
];

// 主题模式类型
export type ThemeMode = 'light' | 'dark';

/**
 * 生成预设颜色的 1-10 级梯度
 * 基于 @ant-design/colors 生成的规则
 * 1-10 级分别对应：极浅、浅、浅、浅、浅、主色、深、深、深、深
 */
function generateColorPalette(baseColor: string, tokenPrefix: string, category: ThemeColorItem['category']): ThemeColorItem[] {
  // 将 hex 转为 RGB (0-1 范围)
  const hexToRgb1 = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.replace('#', ''));
    if (!result) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    };
  };

  // 简单的颜色亮度计算
  const getLuminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

  // 基础颜色的 RGB
  const baseRgb = hexToRgb1(baseColor);
  const baseLum = getLuminance(baseRgb.r, baseRgb.g, baseRgb.b);

  // 根据基础颜色亮度生成 10 级梯度
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const isLightBase = baseLum > 0.5;

  return levels.map(level => {
    let r: number, g: number, b: number;

    if (isLightBase) {
      // 亮色基准：越高级别越深
      const factor = 1 - (level - 1) * 0.1;
      r = Math.min(1, baseRgb.r * factor + (1 - factor) * 0);
      g = Math.min(1, baseRgb.g * factor + (1 - factor) * 0);
      b = Math.min(1, baseRgb.b * factor + (1 - factor) * 0);
    } else {
      // 暗色基准：越高级别越浅
      const factor = (level - 1) * 0.1;
      r = Math.min(1, baseRgb.r + (1 - baseRgb.r) * factor);
      g = Math.min(1, baseRgb.g + (1 - baseRgb.g) * factor);
      b = Math.min(1, baseRgb.b + (1 - baseRgb.b) * factor);
    }

    // 转换回 0-255 并转为 hex
    const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
    const value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    return {
      token: `${tokenPrefix}${level}`,
      value,
      category,
      level
    };
  });
}

// 生成完整的预设颜色配置（亮色模式）
function generatePresetColorsLight(): ThemeColorItem[] {
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

  const result: ThemeColorItem[] = [];

  for (const preset of presetColors) {
    const palette = generateColorPalette(preset.color, `color${capitalize(preset.name)}`, 'primary');
    result.push(...palette);
  }

  return result;
}

// 生成完整的预设颜色配置（暗色模式）
function generatePresetColorsDark(): ThemeColorItem[] {
  const presetColors = [
    { name: 'blue', color: '#1668ff' },
    { name: 'purple', color: '#7c3aed' },
    { name: 'cyan', color: '#14b8a6' },
    { name: 'green', color: '#53c41a' },
    { name: 'magenta', color: '#ec4899' },
    { name: 'pink', color: '#ec4899' },
    { name: 'red', color: '#f87171' },
    { name: 'orange', color: '#fb923c' },
    { name: 'yellow', color: '#facc15' },
    { name: 'volcano', color: '#f97316' },
    { name: 'geekblue', color: '#6366f1' },
    { name: 'gold', color: '#fbbf24' },
    { name: 'lime', color: '#84cc16' },
  ];

  const result: ThemeColorItem[] = [];

  for (const preset of presetColors) {
    const palette = generateColorPalette(preset.color, `color${capitalize(preset.name)}`, 'primary');
    result.push(...palette);
  }

  return result;
}

// 首字母大写辅助函数
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 生成完整的亮色主题颜色（包含预设颜色梯度）
export function generateFullLightThemeColors(): ThemeColorItem[] {
  return [
    ...DEFAULT_THEME_COLORS,
    ...generatePresetColorsLight()
  ];
}

// 生成完整的暗色主题颜色（包含预设颜色梯度）
export function generateFullDarkThemeColors(): ThemeColorItem[] {
  return [
    ...DARK_THEME_COLORS,
    ...generatePresetColorsDark()
  ];
}
