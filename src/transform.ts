// --- 转换函数主入口 ---
// 整合所有模块，将 Figma 节点转换为结构化 DSL

import { TransformOptions, ProcessContext } from './types.js';
import { FilterContext, getFilterNames } from './filter.js';
import { getVectorHellConfig } from './vector-optimization.js';
import { getFingerprintConfig } from './fingerprint-sampling.js';
import { getChartConfig } from './chart-detection.js';
import { processNode } from './node-processor.js';
import { buildMetaInfo } from './meta-builder.js';
import { DEFAULT_THEME_COLORS, DARK_THEME_COLORS, ThemeMode, generateFullLightThemeColors, generateFullDarkThemeColors } from './config.js';

/**
 * 获取颜色映射配置
 */
function getColorMappingConfig(
  userConfig: any = {},
  themeMode?: ThemeMode
): any {
  // 根据主题模式选择对应的完整颜色配置（包含预设颜色梯度）
  let defaultThemeColors = generateFullLightThemeColors();
  if (themeMode === 'dark') {
    defaultThemeColors = generateFullDarkThemeColors();
  }

  return {
    enabled: true,
    confidenceThreshold: 0.8,
    skipIconColors: true,
    themeColors: defaultThemeColors,
    ...userConfig,
  };
}

/**
 * 将 Figma 节点转换为结构化 DSL
 * @param node - Figma API 返回的原始节点
 * @param options - 转换选项
 * @returns 清洗后的结构化数据
 */
export function transformToDSL(node: any, options: TransformOptions = {}) {
  const {
    framework = 'vue',
    filterNames = [],
    useDefaultFilter = true,
    siderWidth = 220,
    headerHeight = 64,
    siderWidthTolerance,
    headerHeightTolerance,
    maxDepth = 10,
    enableFingerprintSampling = true,  // 默认启用指纹采样
    fingerprintConfig: userFingerprintConfig = {},
    enableVectorHellOptimization = true,
    vectorHellConfig: userVectorHellConfig = {},
    enableChartDetection = true,
    chartConfig: userChartConfig = {},
    enableColorMapping = true,  // 默认启用颜色映射
    colorMappingConfig: userColorMappingConfig = {},
    themeMode = 'light' as ThemeMode,  // 主题模式，默认亮色
  } = options;

  // 合并配置
  const fingerprintConfig = getFingerprintConfig(userFingerprintConfig);
  const vectorConfig = getVectorHellConfig(userVectorHellConfig);
  vectorConfig.enabled = enableVectorHellOptimization !== false;
  const chartConfig = getChartConfig(userChartConfig);
  chartConfig.enabled = enableChartDetection !== false;
  const colorMappingConfig = getColorMappingConfig(userColorMappingConfig, themeMode);
  colorMappingConfig.enabled = enableColorMapping !== false;

  // 获取过滤列表
  const namesToFilter = getFilterNames(useDefaultFilter, filterNames);

  // 构建上下文（支持容差配置）
  const filterCtx: FilterContext = {
    siderWidth,
    headerHeight,
    filterNames: namesToFilter,
    useDefaultFilter,
    siderWidthTolerance,
    headerHeightTolerance,
  };

  const deps = {
    filterCtx,
    fingerprintConfig,
    vectorConfig,
    chartConfig,
    colorMappingConfig,
    enableFingerprintSampling,
    enableColorMapping,
    maxDepth,
  };

  // 处理节点
  const processedNode = processNode(node, {
    parentName: '',
    depth: 0,
    path: [],
    isInsideIcon: false,
    iconNestingDepth: 0,
    isInsideChart: false,
    chartType: undefined,
  }, deps);

  // 构建元信息
  const meta = buildMetaInfo({
    framework,
    namesToFilter,
    useDefaultFilter,
    siderWidth,
    headerHeight,
    maxDepth,
    enableFingerprintSampling,
    vectorConfig,
    fingerprintConfig,
    chartConfig,
  });

  return {
    _meta: meta,
    ...processedNode,
  };
}

// 导出类型和配置
export * from './types.js';
export * from './config.js';
