// --- 节点处理器 ---
// 整合所有转换功能，递归处理节点

import {
  ProcessContext,
  FingerprintConfig,
  VectorHellConfig,
  ChartConfig,
  ColorMappingConfig,
} from './types.js';
import { FilterContext, shouldFilter } from './filter.js';
import { PRESERVE_TYPES_IN_COMPONENTS } from './config.js';
import {
  isIconContainer,
  simplifyVectorNode,
  flattenIconChildren,
  createIconMetadata,
} from './vector-optimization.js';
import {
  isFingerprintSamplingTarget,
  fingerprintSampling,
  createSamplingInfo,
} from './fingerprint-sampling.js';
import {
  analyzeChart,
  getChartConfig,
} from './chart-detection.js';
import { mapNodeColors, shouldSkipColorMapping } from './color-mapping.js';

export interface ProcessorDependencies {
  filterCtx: FilterContext;
  fingerprintConfig: FingerprintConfig;
  vectorConfig: VectorHellConfig;
  chartConfig: ChartConfig;
  colorMappingConfig: ColorMappingConfig;
  enableFingerprintSampling: boolean;
  enableColorMapping: boolean;
  maxDepth: number;
}

/**
 * 创建基础结果对象（改进：支持更多布局类型和颜色映射）
 */
function createBaseResult(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies
): any {
  // 优化：更准确的布局类型判断
  let layout: string;

  if (node.layoutMode === 'HORIZONTAL') {
    layout = 'flex-row';
  } else if (node.layoutMode === 'VERTICAL') {
    layout = 'flex-col';
  } else if (node.layoutAlign) {
    // 有 layoutAlign 但没有 layoutMode，可能是 grid 或 absolute
    if (node.layoutWrap && node.layoutWrap !== 'NO_WRAP') {
      layout = 'flex-wrap'; // 弹性换行
    } else if (node.primaryAxisAlignItems || node.counterAxisAlignItems) {
      layout = 'flex-col'; // 弹性布局（无固定方向）
    } else {
      layout = 'grid'; // 网格布局
    }
  } else if (node.absoluteBoundingBox) {
    // 有绝对定位边界，可能是绝对定位
    layout = 'absolute';
  } else {
    layout = 'flex-col'; // 默认纵向
  }

  const result: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    component: node.name,
    layout,
    props: node.componentProperties || {},
    // 新增：保留布局相关信息
    _layoutInfo: {
      layoutMode: node.layoutMode,
      layoutAlign: node.layoutAlign,
      layoutGrow: node.layoutGrow,
      layoutShrink: node.layoutShrink,
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
      itemSpacing: node.itemSpacing,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
    },
  };

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

/**
 * 创建深度超限的截断结果（改进：包含更多信息）
 */
function createTruncatedResult(node: any, maxDepth: number, currentDepth: number): any {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    _truncated: true,
    reason: 'max-depth-reached',
    _depth: currentDepth,
    _maxDepth: maxDepth,
    _note: `已达到最大深度限制(${maxDepth}层)，${currentDepth - maxDepth}层子节点已截断`,
    children: [], // 截断时清空子节点
  };
}

/**
 * 处理图标容器节点
 */
function processIconContainer(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies
): any {
  const { vectorConfig } = deps;

  const simplifiedNode = simplifyVectorNode(node, false, vectorConfig);
  simplifiedNode._isIcon = true;
  simplifiedNode._note = `图标/插画元素（包含 ${node.children?.length || 0} 个矢量子元素，已优化）`;
  simplifiedNode._iconInfo = createIconMetadata(node);

  // 扁平化子节点
  if (node.children && node.children.length > 0) {
    simplifiedNode.children = flattenIconChildren(node.children, 0, vectorConfig);
  }

  return simplifiedNode;
}

/**
 * 处理图标内部的节点
 */
function processInsideIcon(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies
): any | null {
  const { vectorConfig, maxDepth } = deps;

  const simplifiedNode = simplifyVectorNode(node, true, vectorConfig);

  if (node.children && node.children.length > 0) {
    const currentIconDepth = context.iconNestingDepth || 0;

    if (currentIconDepth >= vectorConfig.maxNestingDepth) {
      simplifiedNode._flattened = true;
      simplifiedNode.children = [];
      return simplifiedNode;
    }

    simplifiedNode.children = node.children
      .map((child: any) => processNode(child, {
        ...context,
        parentName: node.name || '',
        depth: context.depth + 1,
        path: [...context.path, node.name || ''],
        isInsideIcon: true,
        iconNestingDepth: currentIconDepth + 1,
      }, deps))
      .filter((child: any) => child !== null);
  }

  return simplifiedNode;
}

/**
 * 处理矢量节点
 */
function processVectorNode(node: any, vectorConfig: VectorHellConfig): any {
  const simplifiedVector = simplifyVectorNode(node, false, vectorConfig);
  simplifiedVector._isVector = true;
  simplifiedVector._note = '矢量元素（已简化路径数据）';
  return simplifiedVector;
}

/**
 * 处理图表容器节点
 */
function processChartContainer(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies,
  chartInfo: ReturnType<typeof analyzeChart>
): any {
  if (!chartInfo) return null;

  const result: any = {
    id: node.id,
    name: node.name,
    type: 'CHART',
    component: 'Chart',
    layout: 'absolute',
    props: {},
    // 图表特有的元数据
    _isChart: true,
    chartMeta: chartInfo.meta,
    chartData: chartInfo.data,
    chartStyle: chartInfo.style,
    // 识别信息
    _detection: {
      type: chartInfo.detection.type,
      confidence: chartInfo.detection.confidence,
      reasons: chartInfo.detection.reasons,
    },
    _note: `识别为 ${chartInfo.detection.type} 图表，置信度 ${(chartInfo.detection.confidence * 100).toFixed(1)}%`,
  };

  // 图表的子节点可以选择性保留（用于参考）
  // 但为了避免数据爆炸，我们简化处理
  if (node.children && node.children.length > 0) {
    // 仅保留关键的结构信息，不包含完整子节点
    result._chartStructure = {
      childCount: node.children.length,
      childTypes: [...new Set(node.children.map((c: any) => c.type))],
    };
  }

  return result;
}

/**
 * 检查是否应该跳过图表内部的详细处理
 */
function shouldSkipChartChildren(node: any, chartType: string): boolean {
  // 对于饼图、仪表盘等，跳过内部详细处理
  const skipTypes = ['pie', 'gauge', 'funnel'];
  return skipTypes.includes(chartType);
}

/**
 * 处理子节点（支持指纹采样）
 */
function processChildren(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies,
  result: any
): void {
  const { fingerprintConfig, enableFingerprintSampling, maxDepth } = deps;

  if (!node.children || node.children.length === 0) {
    result.children = [];
    return;
  }

  // 检查是否启用指纹采样
  if (enableFingerprintSampling && isFingerprintSamplingTarget(node.name || '', fingerprintConfig) && node.children.length > 1) {
    // 智能指纹采样
    const { preserved, record } = fingerprintSampling(node.children, fingerprintConfig);

    const newContext = {
      parentName: node.name || '',
      depth: context.depth + 1,
      path: [...context.path, node.name || ''],
      isInsideIcon: context.isInsideIcon,
      iconNestingDepth: context.iconNestingDepth,
      isInsideChart: context.isInsideChart,
      chartType: context.chartType,
    };

    result.children = preserved.map((child: any) => {
      const originalIndex = child._originalIndex;
      delete child._originalIndex;

      const processed = processNode(child, newContext, deps);
      if (processed) {
        processed._isRepresentative = true;
        processed._originalIndex = originalIndex;

        const dupCount = record.duplicatesCount.get(originalIndex);
        if (dupCount && dupCount > 0) {
          processed._duplicateCount = dupCount;
          processed._note = `此结构共有 ${dupCount + 1} 个相同节点`;
        }
      }
      return processed;
    }).filter((child: any) => child !== null);

    result._samplingInfo = createSamplingInfo(record);
  } else {
    // 普通处理
    const newContext = {
      parentName: node.name || '',
      depth: context.depth + 1,
      path: [...context.path, node.name || ''],
      isInsideIcon: context.isInsideIcon,
      iconNestingDepth: context.iconNestingDepth,
      isInsideChart: context.isInsideChart,
      chartType: context.chartType,
    };

    result.children = node.children
      .map((child: any) => processNode(child, newContext, deps))
      .filter((child: any) => child !== null);
  }
}

/**
 * 递归处理节点
 */
export function processNode(
  node: any,
  context: ProcessContext,
  deps: ProcessorDependencies
): any | null {
  const { filterCtx, vectorConfig, chartConfig, maxDepth } = deps;

  // 深度限制
  if (context.depth > maxDepth) {
    return createTruncatedResult(node, maxDepth, context.depth);
  }

  // 检查是否应该过滤
  if (shouldFilter(node, context, filterCtx)) {
    return null;
  }

  // 如果在图表内部，简化处理
  if (context.isInsideChart && context.chartType) {
    // 检查是否应该跳过详细处理
    if (shouldSkipChartChildren(node, context.chartType)) {
      return {
        id: node.id,
        name: node.name,
        type: node.type,
        _isChartChild: true,
        _chartType: context.chartType,
        _note: '图表内部元素（已简化）',
      };
    }
  }

  // 图表检测（在图标检测之前，因为图表优先级更高）
  if (chartConfig.enabled && !context.isInsideChart && !context.isInsideIcon) {
    const chartInfo = analyzeChart(node, chartConfig);
    if (chartInfo) {
      return processChartContainer(node, context, deps, chartInfo);
    }
  }

  // 矢量地狱优化：检测图标容器
  const isIconContainerNode = isIconContainer(node, vectorConfig);

  // 如果在图标内部或者是图标容器
  if (context.isInsideIcon || isIconContainerNode) {
    if (isIconContainerNode) {
      return processIconContainer(node, context, deps);
    }
    return processInsideIcon(node, context, deps);
  }

  // 处理单个 VECTOR 节点
  if (node.type === 'VECTOR' && vectorConfig.enabled) {
    return processVectorNode(node, vectorConfig);
  }

  // 普通节点处理
  const result = createBaseResult(node, context, deps);
  processChildren(node, context, deps, result);

  return result;
}
