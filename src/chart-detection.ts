// --- 图表检测与数据提取模块 (优化版) ---

import {
  ChartType,
  ChartDetectionResult,
  ChartClues,
  ChartData,
  ChartMeta,
  ChartStyle,
  ChartSeries,
  ChartAxis,
  ChartLegend,
  ChartConfig,
} from './types.js';
import { DEFAULT_CHART_CONFIG, CHART_TYPE_TO_ECHARTS, CHART_TYPE_TO_G6 } from './config.js';

/**
 * 获取图表配置
 */
export function getChartConfig(userConfig?: Partial<ChartConfig>): ChartConfig {
  return {
    ...DEFAULT_CHART_CONFIG,
    ...userConfig,
    typeKeywords: { ...DEFAULT_CHART_CONFIG.typeKeywords, ...userConfig?.typeKeywords },
    axisDetection: { ...DEFAULT_CHART_CONFIG.axisDetection, ...userConfig?.axisDetection },
    dataExtraction: { ...DEFAULT_CHART_CONFIG.dataExtraction, ...userConfig?.dataExtraction },
  };
}

/**
 * 分析节点名称中的关键词
 * 优化：返回所有匹配的关键词及其权重
 */
function extractNameKeywords(name: string): Array<{ type: string; weight: number }> {
  if (!name) return [];
  const results: Array<{ type: string; weight: number }> = [];
  const lowerName = name.toLowerCase();

  // 检查是否为组合图表名称（如"柱状图和折线图对比"）
  const isComboChart = /(和|与|对比|组合).*(图|chart)/i.test(name) ||
                       /(图|chart).*(和|与|对比|组合)/i.test(name);

  for (const [type, typeKeywords] of Object.entries(DEFAULT_CHART_CONFIG.typeKeywords)) {
    for (const keyword of typeKeywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        // 组合图表降低权重
        const weight = isComboChart ? 0.6 : 0.9;
        results.push({ type, weight });
        break;
      }
    }
  }

  return results;
}

/**
 * 递归统计子节点类型
 */
function countChildTypes(node: any): {
  rectangleCount: number;
  circleCount: number;
  lineCount: number;
  textCount: number;
  vectorCount: number;
} {
  let counts = {
    rectangleCount: 0,
    circleCount: 0,
    lineCount: 0,
    textCount: 0,
    vectorCount: 0,
  };

  const type = node?.type;
  if (type === 'RECTANGLE') counts.rectangleCount++;
  else if (type === 'ELLIPSE') counts.circleCount++;
  else if (type === 'LINE') counts.lineCount++;
  else if (type === 'TEXT') counts.textCount++;
  else if (type === 'VECTOR') counts.vectorCount++;

  // 递归统计子节点
  if (node?.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const childCounts = countChildTypes(child);
      counts.rectangleCount += childCounts.rectangleCount;
      counts.circleCount += childCounts.circleCount;
      counts.lineCount += childCounts.lineCount;
      counts.textCount += childCounts.textCount;
      counts.vectorCount += childCounts.vectorCount;
    }
  }

  return counts;
}

/**
 * 优化：验证线条方向（区分坐标轴和其他线条）
 * 返回 { hasHorizontalAxis, hasVerticalAxis }
 */
function analyzeLineOrientation(node: any): { hasHorizontalAxis: boolean; hasVerticalAxis: boolean } {
  const children = node?.children || [];
  let hasHorizontalAxis = false;
  let hasVerticalAxis = false;
  const nodeBounds = node?.absoluteBoundingBox || {};

  for (const child of children) {
    if (child.type === 'LINE') {
      const bounds = child?.absoluteBoundingBox;
      if (!bounds) continue;

      const width = bounds.width || 0;
      const height = bounds.height || 0;

      // 水平线条（宽度远大于高度）→ X轴
      if (width > height * 3 && width > 30) {
        hasHorizontalAxis = true;
      }
      // 垂直线条（高度远大于宽度）→ Y轴
      if (height > width * 3 && height > 30) {
        hasVerticalAxis = true;
      }
    }
  }

  return { hasHorizontalAxis, hasVerticalAxis };
}

/**
 * 优化：检测数据点排列模式
 * 返回 { isHorizontalBars, isVerticalBars, isScatterPattern, isStackedPattern }
 */
function analyzeDataPattern(node: any): {
  isHorizontalBars: boolean;
  isVerticalBars: boolean;
  isScatterPattern: boolean;
  isStackedPattern: boolean;
} {
  const children = node?.children || [];
  const rectangles: any[] = [];
  const circles: any[] = [];

  // 收集数据元素
  for (const child of children) {
    const bounds = child?.absoluteBoundingBox;
    if (!bounds) continue;

    if (child.type === 'RECTANGLE' || child.type === 'VECTOR') {
      rectangles.push(bounds);
    } else if (child.type === 'ELLIPSE') {
      circles.push(bounds);
    }
  }

  if (rectangles.length < 2 && circles.length < 2) {
    return { isHorizontalBars: false, isVerticalBars: false, isScatterPattern: false, isStackedPattern: false };
  }

  const nodeBounds = node?.absoluteBoundingBox || {};
  const nodeWidth = nodeBounds.width || 1;
  const nodeHeight = nodeBounds.height || 1;

  // 检测水平排列的矩形条（柱状图）- 宽度相近，高度不同
  let isHorizontalBars = false;
  if (rectangles.length >= 3) {
    const widths = rectangles.map(r => r.width);
    const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
    const widthVariance = widths.reduce((sum, w) => sum + Math.pow(w - avgWidth, 2), 0) / widths.length;
    // 宽度方差小说明是水平排列的柱子
    if (widthVariance < avgWidth * 0.3) {
      isHorizontalBars = true;
    }
  }

  // 检测垂直排列的矩形条
  let isVerticalBars = false;
  if (rectangles.length >= 3) {
    const heights = rectangles.map(r => r.height);
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const heightVariance = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / heights.length;
    if (heightVariance < avgHeight * 0.3) {
      isVerticalBars = true;
    }
  }

  // 检测散点图模式：圆形随机分布
  let isScatterPattern = false;
  if (circles.length >= 3) {
    // 计算圆心位置的分布
    const xCoords = circles.map(c => c.x + c.width / 2);
    const yCoords = circles.map(c => c.y + c.height / 2);
    const xRange = Math.max(...xCoords) - Math.min(...xCoords);
    const yRange = Math.max(...yCoords) - Math.min(...yCoords);
    // 如果分布范围较大且不规则，可能是散点图
    if (xRange > nodeWidth * 0.3 && yRange > nodeHeight * 0.3) {
      isScatterPattern = true;
    }
  }

  // 检测堆叠模式（子节点中有多个矩形重叠）
  let isStackedPattern = false;
  for (const child of children) {
    if (child?.children?.length >= 2) {
      const childRects = child.children.filter((c: any) => c.type === 'RECTANGLE' || c.type === 'VECTOR');
      if (childRects.length >= 2) {
        isStackedPattern = true;
        break;
      }
    }
  }

  return { isHorizontalBars, isVerticalBars, isScatterPattern, isStackedPattern };
}

/**
 * 优化：验证名称与视觉特征是否匹配
 * 返回调整后的置信度
 */
function validateNameWithVisuals(
  nameKeywords: Array<{ type: string; weight: number }>,
  hasAxes: boolean,
  hasBars: boolean,
  hasLines: boolean,
  hasCircles: boolean,
  hasLegend: boolean,
  hasGrid: boolean,
  dataPointCount: number,
  isCircularLayout: boolean,
  rectangleCount: number,
  circleCount: number,
  lineCount: number,
  lineOrientation: { hasHorizontalAxis: boolean; hasVerticalAxis: boolean },
  dataPattern: { isHorizontalBars: boolean; isVerticalBars: boolean; isScatterPattern: boolean; isStackedPattern: boolean }
): Array<{ type: string; adjustedConfidence: number; reasons: string[] }> {
  const results: Array<{ type: string; adjustedConfidence: number; reasons: string[] }> = [];

  for (const kw of nameKeywords) {
    let adjustedConfidence = kw.weight;
    const reasons: string[] = [`名称包含图表关键词: ${kw.type}`];
    let visualMatch = true;

    // 根据图表类型验证视觉特征
    switch (kw.type) {
      case 'bar':
        if (!hasBars && !dataPattern.isHorizontalBars && !dataPattern.isVerticalBars) {
          adjustedConfidence -= 0.3;
          reasons.push('视觉特征不匹配：无可识别的矩形条');
          visualMatch = false;
        }
        if (isCircularLayout) {
          adjustedConfidence -= 0.2;
          reasons.push('视觉特征冲突：存在圆形布局');
        }
        break;

      case 'line':
        if (!hasLines && !lineOrientation.hasHorizontalAxis) {
          adjustedConfidence -= 0.3;
          reasons.push('视觉特征不匹配：无可识别的线条');
          visualMatch = false;
        }
        if (dataPattern.isHorizontalBars || dataPattern.isVerticalBars) {
          adjustedConfidence -= 0.2;
          reasons.push('视觉特征冲突：存在矩形条');
        }
        break;

      case 'pie':
        if (!isCircularLayout && circleCount < 3) {
          adjustedConfidence -= 0.3;
          reasons.push('视觉特征不匹配：无圆形布局');
          visualMatch = false;
        }
        if (lineOrientation.hasHorizontalAxis || lineOrientation.hasVerticalAxis) {
          adjustedConfidence -= 0.2;
          reasons.push('视觉特征冲突：存在坐标轴');
        }
        break;

      case 'scatter':
        if (!dataPattern.isScatterPattern && circleCount < 3) {
          adjustedConfidence -= 0.25;
          reasons.push('视觉特征不匹配：无散点分布');
          visualMatch = false;
        }
        if (!hasAxes) {
          adjustedConfidence -= 0.15;
        }
        break;

      case 'radar':
        // 雷达图通常有多个从中心发散的线条
        if (lineCount < 3) {
          adjustedConfidence -= 0.2;
        }
        break;

      case 'area':
        // 面积图需要填充区域，视觉上与折线图相似
        if (!hasLines) {
          adjustedConfidence -= 0.2;
        }
        break;

      case 'graph':
      case 'tree':
        // 这些主要靠名称识别
        break;

      case 'funnel':
      case 'gauge':
      case 'heatmap':
      case 'sankey':
      case 'candlestick':
        // 这些图表主要靠名称识别，降低置信度
        adjustedConfidence *= 0.8;
        break;
    }

    // 至少需要一定程度的视觉匹配
    if (visualMatch || adjustedConfidence >= 0.7) {
      results.push({
        type: kw.type,
        adjustedConfidence: Math.max(0, Math.min(1, adjustedConfidence)),
        reasons
      });
    }
  }

  return results;
}
function analyzeChartClues(node: any): ChartClues {
  const name = node?.name || '';
  const children = node?.children || [];
  const nodeBounds = node?.absoluteBoundingBox || {};

  // 统计子节点类型
  const childCounts = countChildTypes(node);

  // 优化：检测线条方向
  const lineOrientation = analyzeLineOrientation(node);

  // 优化：检测数据排列模式
  const dataPattern = analyzeDataPattern(node);

  // 优化：更精确的坐标轴检测
  // 需要满足：名称匹配 OR (水平线条 + 垂直线条同时存在)
  const hasExplicitAxisName = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    return childName.includes('axis') ||
           childName.includes('x轴') ||
           childName.includes('y轴') ||
           childName.includes('坐标');
  });

  const hasAxes = hasExplicitAxisName ||
    (lineOrientation.hasHorizontalAxis && lineOrientation.hasVerticalAxis) ||
    (lineOrientation.hasHorizontalAxis && childCounts.rectangleCount >= 3) ||
    (lineOrientation.hasVerticalAxis && childCounts.rectangleCount >= 3);

  // 检测是否有图例
  const hasLegend = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    return childName.includes('legend') ||
           childName.includes('图例');
  });

  // 检测是否有网格线
  const hasGrid = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    // 网格线通常是多条平行线条
    const isGridLine = child.type === 'LINE' && childName.includes('grid');
    const isGridContainer = childName.includes('grid') || childName.includes('网格');
    return isGridLine || isGridContainer;
  });

  // 检测圆形布局（饼图特征）
  const isCircularLayout = childCounts.circleCount > 3 &&
    childCounts.rectangleCount < childCounts.circleCount;

  // 优化：检测矩形条（柱状图特征）- 结合数量和排列模式
  const hasBars = childCounts.rectangleCount >= 3 ||
    dataPattern.isHorizontalBars ||
    dataPattern.isVerticalBars;

  // 优化：检测线条（折线图特征）
  const hasLines = childCounts.lineCount >= 2 ||
    childCounts.vectorCount >= 3 ||
    lineOrientation.hasHorizontalAxis;

  // 数据点数量估算 - 使用更合理的计算
  const dataPointCount = Math.max(
    childCounts.rectangleCount,
    childCounts.circleCount,
    childCounts.lineCount,
    dataPattern.isScatterPattern ? childCounts.circleCount : 0
  );

  // 提取关键词（返回权重信息）
  const nameKeywordResults = extractNameKeywords(name);

  // 优化：验证名称与视觉特征的匹配度
  const validatedKeywords = validateNameWithVisuals(
    nameKeywordResults,
    hasAxes,
    hasBars,
    hasLines,
    childCounts.circleCount > 0,
    hasLegend,
    hasGrid,
    dataPointCount,
    isCircularLayout,
    childCounts.rectangleCount,
    childCounts.circleCount,
    childCounts.lineCount,
    lineOrientation,
    dataPattern
  );

  return {
    hasAxes,
    hasBars,
    hasLines,
    hasCircles: childCounts.circleCount > 0,
    hasLegend,
    hasGrid,
    dataPointCount,
    isCircularLayout,
    nameKeywords: validatedKeywords, // 现在返回带置信度的关键词
    rectangleCount: childCounts.rectangleCount,
    circleCount: childCounts.circleCount,
    lineCount: childCounts.lineCount,
    // 新增：详细的特征分析
    _lineOrientation: lineOrientation,
    _dataPattern: dataPattern,
  };
}

/**
 * 基于线索检测图表类型（优化版）
 * 采用优先级决策树 + 置信度验证
 */
export function detectChartType(node: any): ChartDetectionResult {
  const clues = analyzeChartClues(node);
  const name = (node?.name || '').toLowerCase();
  // 添加默认值以防止 undefined
  const lineOrientation = clues._lineOrientation || { hasHorizontalAxis: false, hasVerticalAxis: false };
  const dataPattern = clues._dataPattern || { isHorizontalBars: false, isVerticalBars: false, isScatterPattern: false, isStackedPattern: false };

  // 优化：使用经过验证的关键词检测结果
  if (clues.nameKeywords.length > 0) {
    // 取置信度最高的关键词
    const bestMatch = clues.nameKeywords[0];
    return {
      type: bestMatch.type as ChartType,
      confidence: bestMatch.adjustedConfidence,
      reasons: bestMatch.reasons,
    };
  }

  // 基于视觉特征的决策树（按优先级排序）

  // 1. 饼图：圆形布局、无坐标轴、多个圆形（最高优先级）
  if (clues.isCircularLayout && !clues.hasAxes && clues.circleCount >= 3) {
    return {
      type: 'pie',
      confidence: 0.85,
      reasons: ['圆形布局', '无坐标轴', `包含 ${clues.circleCount} 个圆形`],
    };
  }

  // 2. 柱状图：有明确的水平排列矩形条 + 坐标轴
  if (dataPattern.isHorizontalBars && (clues.hasAxes || clues.rectangleCount >= 3)) {
    return {
      type: 'bar',
      confidence: 0.9,
      reasons: ['水平排列的矩形条', `包含 ${clues.rectangleCount} 个矩形`, clues.hasAxes ? '有坐标轴' : '无坐标轴'],
    };
  }

  // 3. 柱状图：有多个矩形条 + 坐标轴
  if (clues.hasBars && clues.hasAxes) {
    return {
      type: 'bar',
      confidence: 0.85,
      reasons: ['存在矩形条', '有坐标轴', `包含 ${clues.rectangleCount} 个矩形`],
    };
  }

  // 4. 折线图：有水平轴 + 垂直轴 + 线条/矢量
  if (lineOrientation.hasHorizontalAxis && lineOrientation.hasVerticalAxis && clues.hasLines) {
    return {
      type: 'line',
      confidence: 0.85,
      reasons: ['有水平坐标轴', '有垂直坐标轴', '存在线条'],
    };
  }

  // 5. 折线图：有坐标轴 + 线条（但没有明显的矩形条）
  if (clues.hasLines && clues.hasAxes && !dataPattern.isHorizontalBars) {
    return {
      type: 'line',
      confidence: 0.8,
      reasons: ['存在线条', '有坐标轴'],
    };
  }

  // 6. 柱状图（无坐标轴但有多个矩形）- 降低置信度
  if (clues.hasBars && clues.rectangleCount >= 5) {
    return {
      type: 'bar',
      confidence: 0.65,
      reasons: ['存在多个矩形条（无坐标轴）', `包含 ${clues.rectangleCount} 个矩形`],
    };
  }

  // 7. 散点图：有圆形、有坐标轴、无连续线条、分散分布
  if (clues.hasCircles && clues.hasAxes && !clues.hasLines && dataPattern.isScatterPattern) {
    return {
      type: 'scatter',
      confidence: 0.8,
      reasons: ['圆形分散分布', '有坐标轴'],
    };
  }

  // 8. 散点图：有圆形、有坐标轴
  if (clues.hasCircles && clues.hasAxes && clues.circleCount >= 3) {
    return {
      type: 'scatter',
      confidence: 0.7,
      reasons: ['散点分布', '有坐标轴', `包含 ${clues.circleCount} 个圆形`],
    };
  }

  // 9. 面积图：名称包含 area + 有线条 + 有坐标轴
  if ((name.includes('area') || name.includes('面积')) && clues.hasLines && clues.hasAxes) {
    return {
      type: 'area',
      confidence: 0.75,
      reasons: ['名称包含面积', '有线条', '有坐标轴'],
    };
  }

  // 10. 雷达图：有多个从中心发散的线条
  if (clues.lineCount >= 5 && !clues.hasAxes) {
    return {
      type: 'radar',
      confidence: 0.7,
      reasons: ['多线条从中心发散'],
    };
  }

  // 11. 关系图：节点名称提示 + 无规则布局
  if (name.includes('graph') || name.includes('network') || name.includes('关系')) {
    return {
      type: 'graph',
      confidence: 0.7,
      reasons: ['节点名称提示为关系图'],
    };
  }

  // 12. 树图
  if (name.includes('tree') || name.includes('树')) {
    return {
      type: 'tree',
      confidence: 0.7,
      reasons: ['节点名称提示为树图'],
    };
  }

  // 13. 漏斗图
  if (name.includes('funnel') || name.includes('漏斗')) {
    return {
      type: 'funnel',
      confidence: 0.75,
      reasons: ['节点名称提示为漏斗图'],
    };
  }

  // 14. 仪表盘
  if (name.includes('gauge') || name.includes('仪表盘') || name.includes('仪表')) {
    return {
      type: 'gauge',
      confidence: 0.75,
      reasons: ['节点名称提示为仪表盘'],
    };
  }

  // 15. 热力图
  if (name.includes('heatmap') || name.includes('热力图') || name.includes('热图')) {
    return {
      type: 'heatmap',
      confidence: 0.75,
      reasons: ['节点名称提示为热力图'],
    };
  }

  // 16. 桑基图
  if (name.includes('sankey') || name.includes('桑基')) {
    return {
      type: 'sankey',
      confidence: 0.75,
      reasons: ['节点名称提示为桑基图'],
    };
  }

  // 17. K线图
  if (name.includes('candlestick') || name.includes('k线') || name.includes('蜡烛图')) {
    return {
      type: 'candlestick',
      confidence: 0.75,
      reasons: ['节点名称提示为K线图'],
    };
  }

  // 未达到识别阈值
  return {
    type: 'none',
    confidence: 0,
    reasons: [],
  };
}

/**
 * 提取颜色值
 */
function extractColor(fill: any): string | undefined {
  if (!fill || fill.type !== 'SOLID') return undefined;

  const { r, g, b } = fill.color || {};
  if (r === undefined || g === undefined || b === undefined) return undefined;

  // 转换为 hex
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 提取文本内容
 */
function extractText(node: any): string {
  if (node?.type === 'TEXT' && node?.characters) {
    return node.characters;
  }

  // 递归查找子文本节点
  if (node?.children) {
    for (const child of node.children) {
      const text = extractText(child);
      if (text) return text;
    }
  }

  return '';
}

/**
 * 从节点中提取数值（优化版）
 * 支持：普通数字、负数、小数、货币符号（$、¥）、百分比、逗号分隔、范围值
 */
function extractNumericValue(node: any): number | null {
  const text = extractText(node);
  if (!text) return null;

  // 清理文本：移除货币符号、百分号、逗号等
  let cleanedText = text
    .replace(/[$¥€£]/g, '')      // 货币符号
    .replace(/%/g, '')             // 百分比
    .replace(/,/g, '')             // 千分位
    .replace(/\s/g, '')            // 空格
    .trim();

  // 处理中文数字（简化版）
  const cnNumberMap: Record<string, string> = {
    '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
    '五': '5', '六': '6', '七': '7', '八': '8', '九': '9',
    '十': '10', '百': '100', '千': '1000', '万': '10000'
  };
  for (const [cn, num] of Object.entries(cnNumberMap)) {
    cleanedText = cleanedText.replace(new RegExp(cn, 'g'), num);
  }

  // 新增：支持范围值（如 "100-200"），取中间值
  const rangeMatch = cleanedText.match(/^(-?\d+\.?\d*)\s*[-~至到]\s*(-?\d+\.?\d*)$/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1]);
    const end = parseFloat(rangeMatch[2]);
    if (!isNaN(start) && !isNaN(end) && isFinite(start) && isFinite(end)) {
      return (start + end) / 2; // 返回中间值
    }
  }

  // 尝试提取数字（支持负数、科学计数法）
  const match = cleanedText.match(/-?\d+\.?\d*(?:[eE][+-]?\d+)?/);
  if (match) {
    const value = parseFloat(match[0]);
    // 验证数值合理性
    if (isNaN(value) || !isFinite(value)) return null;
    return value;
  }

  return null;
}

/**
 * 从节点位置推断相对数值（优化版）
 * 用于没有文本标签的图表
 */
function inferValueFromPosition(
  node: any,
  nodeBounds: { width: number; height: number; x: number; y: number },
  direction: 'vertical' | 'horizontal' = 'vertical'
): number | null {
  const bounds = node?.absoluteBoundingBox;
  if (!bounds) return null;

  let normalizedValue: number;

  if (direction === 'vertical') {
    // 柱状图：高度相对于容器高度
    // 注意：Figma坐标系Y轴向下，需要反转计算
    const containerTop = nodeBounds.y;
    const containerBottom = nodeBounds.y + nodeBounds.height;
    const itemTop = bounds.y;
    const itemBottom = bounds.y + bounds.height;

    // 从底部向上计算比例
    const heightFromBottom = containerBottom - itemBottom;
    normalizedValue = Math.round((heightFromBottom / nodeBounds.height) * 100);
  } else {
    // 水平柱状图：宽度相对于容器宽度
    const maxWidth = nodeBounds.width;
    normalizedValue = Math.round((bounds.width / maxWidth) * 100);
  }

  // 限制范围
  if (normalizedValue < 0 || normalizedValue > 100) return null;

  return normalizedValue;
}

/**
 * 提取坐标轴数据（优化版）
 * 改进：使用更灵活的坐标轴检测策略
 */
function extractAxesData(node: any, chartType: ChartType): { xAxis?: ChartAxis; yAxis?: ChartAxis } | undefined {
  if (chartType === 'pie' || chartType === 'gauge') {
    return undefined; // 这些类型没有坐标轴
  }

  const children = node?.children || [];
  const nodeBounds = node?.absoluteBoundingBox || { width: 400, height: 300, x: 0, y: 0 };
  const categories: string[] = [];
  const xAxisLabels: string[] = [];
  const yAxisLabels: string[] = [];
  let xAxisName = '';
  let yAxisName = '';

  // 优化：更灵活的坐标轴区域识别（基于节点大小动态调整）
  const leftZone = nodeBounds.x + nodeBounds.width * 0.12;
  const rightZone = nodeBounds.x + nodeBounds.width * 0.88;
  const topZone = nodeBounds.y + nodeBounds.height * 0.12;
  const bottomZone = nodeBounds.y + nodeBounds.height * 0.88;

  // 查找坐标轴相关的文本
  for (const child of children) {
    const name = (child?.name || '').toLowerCase();
    const text = extractText(child);
    const bounds = child?.absoluteBoundingBox;

    if (!text) continue;

    // 明确的坐标轴名称匹配
    if (name.includes('x-axis') || name.includes('x轴') || name.includes('x axis')) {
      if (name.includes('title') || name.includes('label')) {
        xAxisName = text;
      } else {
        xAxisLabels.push(text);
      }
    }

    if (name.includes('y-axis') || name.includes('y轴') || name.includes('y axis')) {
      if (name.includes('title') || name.includes('label')) {
        yAxisName = text;
      } else {
        yAxisLabels.push(text);
      }
    }

    // 基于位置的分类（优化版）- 更宽松的阈值
    if (bounds && categories.length < 50) {
      const centerX = bounds.x + (bounds.width || 0) / 2;
      const centerY = bounds.y + (bounds.height || 0) / 2;

      // 底部区域（宽度较大，高度较小的文本）-> X轴分类
      const isBottomText = centerY > bottomZone * 0.95 && bounds.width > bounds.height;
      // 左侧区域（高度较大，宽度较小的文本）-> Y轴标签
      const isLeftText = centerX < leftZone * 1.1 && bounds.height > bounds.width;

      // 只添加短文本（避免误识别长文本为标签）
      if (isBottomText && text.length > 0 && text.length < 20) {
        if (!xAxisLabels.includes(text)) {
          xAxisLabels.push(text);
        }
      }

      if (isLeftText && text.length > 0 && text.length < 15) {
        if (!yAxisLabels.includes(text)) {
          yAxisLabels.push(text);
        }
      }
    }

    // 尝试从 componentProperties 中提取轴名称
    if (child.componentProperties) {
      const props = child.componentProperties;
      if (props.axisLabel || props.axis_name || props.xLabel || props.yLabel) {
        const labelValue = props.axisLabel?.value || props.axis_name?.value || props.xLabel?.value || props.yLabel?.value;
        if (labelValue && typeof labelValue === 'string') {
          if (!xAxisLabels.includes(labelValue)) xAxisLabels.push(labelValue);
        }
      }
    }
  }

  // 合并所有X轴分类
  const allCategories = [...new Set([...categories, ...xAxisLabels])];

  // 清理Y轴标签中的数值
  const cleanYLabels = yAxisLabels.filter(t => {
    const num = extractNumericValue({ characters: t } as any);
    return num === null; // 排除纯数值
  });

  return {
    xAxis: {
      name: xAxisName || undefined,
      categories: allCategories.length > 0 ? allCategories : undefined,
      type: allCategories.length > 0 ? 'category' : 'value',
    },
    yAxis: {
      name: yAxisName || undefined,
      type: 'value',
    },
  };
}

/**
 * 提取系列数据（优化版）
 * 改进：支持更多数据来源，增强多系列识别
 */
function extractSeriesData(node: any, chartType: ChartType): ChartSeries[] {
  const children = node?.children || [];
  const nodeBounds = node?.absoluteBoundingBox || { width: 400, height: 300, x: 0, y: 0 };
  const series: ChartSeries[] = [];

  if (chartType === 'pie') {
    // 饼图：从圆形提取数据
    const pieData: Array<{ name: string; value: number }> = [];
    const colors: string[] = [];

    for (const child of children) {
      if (child.type === 'ELLIPSE' || child.type === 'VECTOR' || child.type === 'GROUP') {
        // 尝试多种方式提取数值
        let value = extractNumericValue(child);
        if (value === null) {
          // 从 componentProperties 提取
          value = child.componentProperties?.value?.value ?? child.componentProperties?.number?.value ?? child.componentProperties?.data?.value;
        }
        if (value === null) {
          // 从位置推断
          value = inferValueFromPosition(child, nodeBounds, 'horizontal');
        }

        const name = extractText(child) || child.name || `数据${pieData.length + 1}`;
        const color = child.fills?.[0] ? extractColor(child.fills[0]) : undefined;

        if (value !== null) {
          pieData.push({ name, value });
          if (color) colors.push(color);
        }
      }
    }

    if (pieData.length > 0) {
      series.push({
        name: '数据',
        type: 'pie',
        data: pieData,
        style: { color: colors[0] },
      });
    }
  } else if (chartType === 'bar' || chartType === 'line') {
    // 优化：尝试按颜色分组提取多个系列
    const colorGroups = new Map<string, number[]>();
    const seriesNames = new Map<string, string>();

    for (const child of children) {
      if (child.type === 'RECTANGLE' || child.type === 'VECTOR' || child.type === 'GROUP') {
        // 尝试多种方式提取数值
        let finalValue: number | null = extractNumericValue(child);

        if (finalValue === null) {
          // 从 componentProperties 提取
          const props = child.componentProperties;
          if (props) {
            finalValue = props.value?.value ?? props.number?.value ?? props.data?.value ?? props.amount?.value ?? props.count?.value;
          }
        }

        if (finalValue === null) {
          // 从位置推断
          finalValue = inferValueFromPosition(child, nodeBounds, 'vertical');
        }

        if (finalValue !== null) {
          const color = child.fills?.[0] ? extractColor(child.fills[0]) : undefined;
          const colorKey = color || 'default';

          if (!colorGroups.has(colorKey)) {
            colorGroups.set(colorKey, []);
            // 尝试从名称推断系列名
            const childName = child.name?.toLowerCase() || '';
            if (childName.includes('系列') || childName.includes('series') || childName.includes('group')) {
              seriesNames.set(colorKey, child.name);
            }
          }

          colorGroups.get(colorKey)!.push(finalValue);
        }
      }
    }

    // 将颜色分组转换为系列
    let seriesIndex = 1;
    const usedColors: string[] = [];

    for (const [color, data] of colorGroups) {
      if (data.length > 0) {
        const customName = seriesNames.get(color);
        series.push({
          name: customName || `系列${seriesIndex}`,
          type: chartType,
          data,
          style: {
            color: color !== 'default' ? color : undefined,
            barWidth: chartType === 'bar' ? undefined : undefined,
            lineSmooth: chartType === 'line',
          },
        });
        if (color !== 'default') usedColors.push(color);
        seriesIndex++;
      }
    }

    // 如果没有提取到任何数据，尝试更宽松的提取
    if (series.length === 0) {
      const data: number[] = [];
      for (const child of children) {
        if (child.type === 'RECTANGLE' || child.type === 'VECTOR' || child.type === 'GROUP') {
          const bounds = child?.absoluteBoundingBox;
          if (bounds && bounds.height > 5) {
            // 使用相对值（改进：考虑Y轴位置）
            const heightRatio = bounds.height / nodeBounds.height;
            const normalizedHeight = Math.round(heightRatio * 100);
            data.push(normalizedHeight);
          }
        }
      }

      if (data.length > 0) {
        series.push({
          name: '数据',
          type: chartType,
          data,
          style: {
            lineSmooth: chartType === 'line',
          },
        });
      }
    }
  } else if (chartType === 'scatter') {
    // 散点图：提取坐标点
    const scatterData: Array<{ name: string; value: [number, number] }> = [];

    for (const child of children) {
      if (child.type === 'ELLIPSE' || child.type === 'CIRCLE' || child.type === 'RECTANGLE') {
        const bounds = child?.absoluteBoundingBox;
        if (bounds) {
          // 转换为相对坐标
          const x = Math.round((bounds.x - nodeBounds.x) / nodeBounds.width * 100);
          const y = Math.round(100 - (bounds.y - nodeBounds.y) / nodeBounds.height * 100); // Y轴反转
          const name = extractText(child) || child.name || `点${scatterData.length + 1}`;
          scatterData.push({ name, value: [x, y] });
        }
      }
    }

    if (scatterData.length > 0) {
      series.push({
        name: '数据',
        type: 'scatter',
        data: scatterData,
        style: { symbolSize: 10 },
      });
    }
  }

  return series;
}

/**
 * 提取图例数据
 */
function extractLegendData(node: any): ChartLegend | undefined {
  const children = node?.children || [];
  const legendItems: string[] = [];
  let position: 'top' | 'bottom' | 'left' | 'right' = 'top';

  for (const child of children) {
    const name = (child?.name || '').toLowerCase();

    if (name.includes('legend') || name.includes('图例')) {
      const text = extractText(child);
      if (text) {
        legendItems.push(text);
      }

      // 查找图例子项
      if (child.children) {
        for (const subChild of child.children) {
          const subText = extractText(subChild);
          if (subText && !legendItems.includes(subText)) {
            legendItems.push(subText);
          }
        }
      }

      // 判断图例位置
      const bounds = child?.absoluteBoundingBox;
      const nodeBounds = node?.absoluteBoundingBox;
      if (bounds && nodeBounds) {
        if (bounds.y < nodeBounds.y + nodeBounds.height * 0.2) {
          position = 'top';
        } else if (bounds.y > nodeBounds.y + nodeBounds.height * 0.8) {
          position = 'bottom';
        } else if (bounds.x < nodeBounds.x + nodeBounds.width * 0.2) {
          position = 'left';
        } else if (bounds.x > nodeBounds.x + nodeBounds.width * 0.8) {
          position = 'right';
        }
      }
    }
  }

  if (legendItems.length > 0) {
    return { data: legendItems, position };
  }

  return undefined;
}

/**
 * 提取配色方案
 */
function extractColorScheme(node: any): string[] {
  const colors: string[] = [];
  const children = node?.children || [];

  for (const child of children) {
    if (child.fills && child.fills.length > 0) {
      const color = extractColor(child.fills[0]);
      if (color && !colors.includes(color)) {
        colors.push(color);
      }
    }

    // 递归提取子节点颜色
    if (child.children) {
      const childColors = extractColorScheme(child);
      for (const c of childColors) {
        if (!colors.includes(c)) {
          colors.push(c);
        }
      }
    }

    // 限制颜色数量
    if (colors.length >= 10) break;
  }

  return colors;
}

/**
 * 提取图表样式
 */
function extractChartStyle(node: any): ChartStyle {
  const bounds = node?.absoluteBoundingBox || {};
  const fills = node?.fills || [];

  return {
    width: bounds.width || 400,
    height: bounds.height || 300,
    backgroundColor: fills[0] ? extractColor(fills[0]) : undefined,
    title: node?.name ? { text: node.name, style: {} } : undefined,
  };
}

/**
 * 提取完整的图表数据
 */
export function extractChartData(node: any, chartType: ChartType): ChartData {
  const axes = extractAxesData(node, chartType);
  const series = extractSeriesData(node, chartType);
  const legend = extractLegendData(node);
  const colorScheme = extractColorScheme(node);

  return {
    axes,
    series: series.length > 0 ? series : [{ name: '数据', type: 'bar', data: [], style: {} }],
    legend,
    colorScheme: colorScheme.length > 0 ? colorScheme : undefined,
  };
}

/**
 * 构建图表元数据
 */
export function buildChartMeta(detectionResult: ChartDetectionResult): ChartMeta {
  return {
    detectedType: detectionResult.type,
    echartsType: CHART_TYPE_TO_ECHARTS[detectionResult.type] || 'bar',
    g6Type: CHART_TYPE_TO_G6[detectionResult.type],
    confidence: detectionResult.confidence,
  };
}

/**
 * 检查是否应该作为图表处理
 */
export function shouldProcessAsChart(node: any, config: ChartConfig): boolean {
  // 检查节点大小（图表通常较大）
  const bounds = node?.absoluteBoundingBox;
  if (bounds) {
    // 优化：根据节点大小动态调整阈值
    // 极小的节点不可能是图表（可能是图标、按钮等）
    // 过大的节点可能是整个页面（不是单个图表）
    if (bounds.width < 80 || bounds.height < 60) {
      return false;
    }
    // 排除异常大的节点（可能是整个画板）
    if (bounds.width > 2000 || bounds.height > 1500) {
      return false;
    }
  }

  // 检查节点名称
  const name = (node?.name || '').toLowerCase();

  // 优化：扩展排除模式 - 常见UI组件
  const excludePatterns = [
    // 基础组件
    'button', 'btn', 'icon', 'input', 'textarea', 'select', 'checkbox', 'radio', 'switch',
    // 容器组件
    'card', 'modal', 'dialog', 'drawer', 'popup', 'tooltip', 'popover', 'dropdown', 'menu',
    // 导航组件
    'nav', 'navbar', 'tabs', 'tab', 'breadcrumb', 'pagination', 'sider', 'sidebar',
    // 展示组件
    'avatar', 'badge', 'tag', 'progress', 'skeleton', 'loading', 'empty', 'alert', 'notification',
    // 表单组件
    'form', 'field', 'input-group', 'form-item',
    // 列表组件
    'list', 'table', 'row', 'cell', 'item',
    // 其他
    'header', 'footer', 'aside', 'wrapper', 'container', 'layout', 'page', 'screen',
    // 状态
    'loading', 'error', 'success', 'warning', 'disabled', 'active', 'hover', 'focus',
    // 变体
    '-variant', 'variant', 'default', 'primary', 'secondary', 'tertiary',
  ];

  for (const pattern of excludePatterns) {
    if (name.includes(pattern)) return false;
  }

  // 排除明显的非图表名称
  const excludeNames = [
    'logo', 'brand', 'copyright', 'contact', 'social', 'footer', 'header',
    '背景', '背景图', '装饰', '分隔线', 'divider',
  ];

  for (const pattern of excludeNames) {
    if (name === pattern || name.startsWith(pattern)) return false;
  }

  // 优化：检查是否有足够的数据点候选（至少需要3个）
  const childCounts = countChildTypes(node);
  const dataPointCandidate = Math.max(
    childCounts.rectangleCount,
    childCounts.circleCount,
    childCounts.lineCount
  );

  if (dataPointCandidate < 2) {
    // 如果名称中明确包含图表关键词，则放宽限制
    const hasChartKeyword = ['chart', '图', 'graph', 'diagram'].some(k => name.includes(k));
    if (!hasChartKeyword) {
      return false;
    }
  }

  return true;
}

/**
 * 主入口：分析节点并提取图表信息
 * @returns 如果是图表返回图表信息，否则返回 null
 */
export function analyzeChart(
  node: any,
  config: ChartConfig
): {
  isChart: boolean;
  detection: ChartDetectionResult;
  meta: ChartMeta;
  data: ChartData;
  style: ChartStyle;
} | null {
  // 首先检查是否应该作为图表处理
  if (!shouldProcessAsChart(node, config)) {
    return null;
  }

  // 检测图表类型
  const detection = detectChartType(node);

  // 检查置信度是否达到阈值
  if (detection.confidence < config.confidenceThreshold) {
    return null;
  }

  // 检查数据点数量
  if (detection.type === 'none') {
    return null;
  }

  // 提取数据
  const meta = buildChartMeta(detection);
  const data = extractChartData(node, detection.type);
  const style = extractChartStyle(node);

  // 验证数据点数量
  const totalDataPoints = data.series.reduce((sum, s) => sum + s.data.length, 0);
  if (totalDataPoints < config.minDataPoints) {
    return null;
  }

  // 优化：验证数据合理性
  let hasValidData = false;
  for (const series of data.series) {
    if (Array.isArray(series.data) && series.data.length > 0) {
      // 检查是否有有效数值
      const validValues = series.data.filter((d: any) => {
        if (typeof d === 'number') {
          return !isNaN(d) && isFinite(d);
        }
        if (typeof d === 'object' && d !== null) {
          return typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value);
        }
        return false;
      });

      if (validValues.length > 0) {
        hasValidData = true;
        break;
      }
    }
  }

  if (!hasValidData) {
    return null;
  }

  // 优化：检查X/Y轴数据点数量是否匹配（对于类别轴）
  if (data.axes?.xAxis?.categories && data.axes.xAxis.categories.length > 0) {
    const categoryCount = data.axes.xAxis.categories.length;
    for (const series of data.series) {
      if (Array.isArray(series.data)) {
        // 如果数据点远多于分类，可能是误识别
        if (series.data.length > categoryCount * 2 && categoryCount < 10) {
          // 但如果是饼图则忽略
          if (detection.type !== 'pie') {
            // 添加警告但不阻断
          }
        }
      }
    }
  }

  return {
    isChart: true,
    detection,
    meta,
    data,
    style,
  };
}
