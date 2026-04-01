// --- 图表检测与数据提取模块 ---

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
 */
function extractNameKeywords(name: string): string[] {
  if (!name) return [];
  const keywords: string[] = [];
  const lowerName = name.toLowerCase();

  // 遍历所有图表类型的关键词
  for (const [type, typeKeywords] of Object.entries(DEFAULT_CHART_CONFIG.typeKeywords)) {
    for (const keyword of typeKeywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        keywords.push(type);
        break;
      }
    }
  }

  return [...new Set(keywords)];
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
 * 分析图表识别线索
 */
function analyzeChartClues(node: any): ChartClues {
  const name = node?.name || '';
  const children = node?.children || [];

  // 统计子节点类型
  const childCounts = countChildTypes(node);

  // 检测是否有坐标轴（通过名称或类型）
  const hasAxes = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    return childName.includes('axis') ||
           childName.includes('轴') ||
           childName.includes('坐标') ||
           child.type === 'LINE';
  });

  // 检测是否有图例
  const hasLegend = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    return childName.includes('legend') ||
           childName.includes('图例');
  });

  // 检测是否有网格线
  const hasGrid = children.some((child: any) => {
    const childName = (child?.name || '').toLowerCase();
    return childName.includes('grid') ||
           childName.includes('网格');
  });

  // 检测圆形布局（饼图特征）
  const isCircularLayout = childCounts.circleCount > 3 &&
    childCounts.rectangleCount < childCounts.circleCount;

  // 检测矩形条（柱状图特征）
  const hasBars = childCounts.rectangleCount >= 3;

  // 检测线条（折线图特征）
  const hasLines = childCounts.lineCount >= 2 || childCounts.vectorCount >= 3;

  // 数据点数量估算
  const dataPointCount = Math.max(
    childCounts.rectangleCount,
    childCounts.circleCount,
    childCounts.lineCount
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
    nameKeywords: extractNameKeywords(name),
    rectangleCount: childCounts.rectangleCount,
    circleCount: childCounts.circleCount,
    lineCount: childCounts.lineCount,
  };
}

/**
 * 基于线索检测图表类型
 */
export function detectChartType(node: any): ChartDetectionResult {
  const clues = analyzeChartClues(node);
  const name = (node?.name || '').toLowerCase();

  // 如果名称中明确包含图表关键词，优先使用
  if (clues.nameKeywords.length > 0) {
    const detectedType = clues.nameKeywords[0] as ChartType;
    return {
      type: detectedType,
      confidence: 0.9,
      reasons: [`节点名称包含图表关键词: ${detectedType}`],
    };
  }

  // 基于视觉特征的决策树

  // 饼图：圆形布局、无坐标轴、多个圆形
  if (clues.isCircularLayout && !clues.hasAxes && clues.circleCount >= 3) {
    return {
      type: 'pie',
      confidence: 0.85,
      reasons: ['圆形布局', '无坐标轴', `包含 ${clues.circleCount} 个圆形`],
    };
  }

  // 柱状图：有矩形条、有坐标轴
  if (clues.hasBars && clues.hasAxes) {
    return {
      type: 'bar',
      confidence: 0.85,
      reasons: ['存在矩形条', '有坐标轴', `包含 ${clues.rectangleCount} 个矩形`],
    };
  }

  // 柱状图（无坐标轴但有多条）
  if (clues.hasBars && clues.rectangleCount >= 5) {
    return {
      type: 'bar',
      confidence: 0.7,
      reasons: ['存在多个矩形条', `包含 ${clues.rectangleCount} 个矩形`],
    };
  }

  // 折线图：有线条、有坐标轴
  if (clues.hasLines && clues.hasAxes) {
    return {
      type: 'line',
      confidence: 0.8,
      reasons: ['存在连续线条', '有坐标轴'],
    };
  }

  // 散点图：有圆形、有坐标轴、无连续线条
  if (clues.hasCircles && clues.hasAxes && !clues.hasLines) {
    return {
      type: 'scatter',
      confidence: 0.75,
      reasons: ['散点分布', '有坐标轴'],
    };
  }

  // 面积图：有填充区域、有坐标轴
  if (clues.hasLines && clues.hasAxes && name.includes('area')) {
    return {
      type: 'area',
      confidence: 0.75,
      reasons: ['填充区域', '有坐标轴'],
    };
  }

  // 关系图：节点名称提示
  if (name.includes('graph') || name.includes('network') || name.includes('关系')) {
    return {
      type: 'graph',
      confidence: 0.7,
      reasons: ['节点名称提示为关系图'],
    };
  }

  // 树图
  if (name.includes('tree') || name.includes('树')) {
    return {
      type: 'tree',
      confidence: 0.7,
      reasons: ['节点名称提示为树图'],
    };
  }

  // 漏斗图
  if (name.includes('funnel') || name.includes('漏斗')) {
    return {
      type: 'funnel',
      confidence: 0.75,
      reasons: ['节点名称提示为漏斗图'],
    };
  }

  // 仪表盘
  if (name.includes('gauge') || name.includes('仪表盘') || name.includes('仪表')) {
    return {
      type: 'gauge',
      confidence: 0.75,
      reasons: ['节点名称提示为仪表盘'],
    };
  }

  // 热力图
  if (name.includes('heatmap') || name.includes('热力图') || name.includes('热图')) {
    return {
      type: 'heatmap',
      confidence: 0.75,
      reasons: ['节点名称提示为热力图'],
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
 * 从节点中提取数值
 */
function extractNumericValue(node: any): number | null {
  const text = extractText(node);
  if (!text) return null;

  // 尝试提取数字
  const match = text.match(/-?\d+\.?\d*/);
  if (match) {
    return parseFloat(match[0]);
  }

  return null;
}

/**
 * 提取坐标轴数据
 */
function extractAxesData(node: any, chartType: ChartType): { xAxis?: ChartAxis; yAxis?: ChartAxis } | undefined {
  if (chartType === 'pie' || chartType === 'gauge') {
    return undefined; // 这些类型没有坐标轴
  }

  const children = node?.children || [];
  const categories: string[] = [];
  let xAxisName = '';
  let yAxisName = '';

  // 查找坐标轴相关的文本
  for (const child of children) {
    const name = (child?.name || '').toLowerCase();
    const text = extractText(child);

    if (!text) continue;

    // X轴标签通常在底部
    if (name.includes('x-axis') || name.includes('x轴') || name.includes('category')) {
      if (text) categories.push(text);
      if (!xAxisName && name.includes('title')) {
        xAxisName = text;
      }
    }

    // Y轴标签
    if (name.includes('y-axis') || name.includes('y轴') || name.includes('value')) {
      if (name.includes('title')) {
        yAxisName = text;
      }
    }

    // 底部文本通常作为X轴分类
    const bounds = child?.absoluteBoundingBox;
    const nodeBounds = node?.absoluteBoundingBox;
    if (bounds && nodeBounds && categories.length < 20) {
      const isBottom = bounds.y > nodeBounds.y + nodeBounds.height * 0.7;
      if (isBottom && text.length < 20) {
        categories.push(text);
      }
    }
  }

  return {
    xAxis: {
      name: xAxisName,
      categories: categories.length > 0 ? [...new Set(categories)] : undefined,
      type: categories.length > 0 ? 'category' : 'value',
    },
    yAxis: {
      name: yAxisName,
      type: 'value',
    },
  };
}

/**
 * 提取系列数据
 */
function extractSeriesData(node: any, chartType: ChartType): ChartSeries[] {
  const children = node?.children || [];
  const series: ChartSeries[] = [];

  if (chartType === 'pie') {
    // 饼图：从圆形提取数据
    const pieData: Array<{ name: string; value: number }> = [];
    const colors: string[] = [];

    for (const child of children) {
      if (child.type === 'ELLIPSE' || child.type === 'VECTOR' || child.type === 'GROUP') {
        const value = extractNumericValue(child);
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
    // 柱状图/折线图：从矩形或线条提取
    const data: number[] = [];
    const colors: string[] = [];

    for (const child of children) {
      if (child.type === 'RECTANGLE' || child.type === 'VECTOR') {
        const value = extractNumericValue(child);
        if (value !== null) {
          data.push(value);
        } else {
          // 从高度推断数值
          const height = child?.absoluteBoundingBox?.height;
          if (height && height > 5) {
            data.push(Math.round(height));
          }
        }

        const color = child.fills?.[0] ? extractColor(child.fills[0]) : undefined;
        if (color) colors.push(color);
      }
    }

    if (data.length > 0) {
      series.push({
        name: '系列1',
        type: chartType,
        data,
        style: {
          color: colors[0],
          barWidth: chartType === 'bar' ? undefined : undefined,
          lineSmooth: chartType === 'line',
        },
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
    if (bounds.width < 100 || bounds.height < 100) {
      return false; // 太小的节点不太可能是图表
    }
  }

  // 检查节点名称
  const name = (node?.name || '').toLowerCase();

  // 排除明显不是图表的节点
  const excludePatterns = ['button', 'icon', 'input', 'card', 'modal', 'avatar'];
  for (const pattern of excludePatterns) {
    if (name.includes(pattern)) return false;
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

  return {
    isChart: true,
    detection,
    meta,
    data,
    style,
  };
}
