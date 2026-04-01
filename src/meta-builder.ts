// --- 元信息构建器 ---
// 构建最终的 _meta 信息

import { TransformOptions, FingerprintConfig, VectorHellConfig, ChartConfig } from './types.js';
import {
  COMPONENT_COMPOSITION_WHITELIST,
  DEFAULT_FILTERED_NAMES,
} from './config.js';

export interface MetaBuilderInput {
  framework: 'vue' | 'react' | 'html';
  namesToFilter: string[];
  useDefaultFilter: boolean;
  siderWidth: number;
  headerHeight: number;
  maxDepth: number;
  enableFingerprintSampling: boolean;
  vectorConfig: VectorHellConfig;
  fingerprintConfig: FingerprintConfig;
  chartConfig: ChartConfig;
}

/**
 * 构建元信息
 */
export function buildMetaInfo(input: MetaBuilderInput): any {
  return {
    framework: input.framework,
    target: 'Vue 3 with Composition API, <script setup lang="ts">',
    conventions: 'Follow Vue best practices: small focused components, props down events up, composables for reusable logic',
    filtered: input.namesToFilter,
    whitelist: Object.keys(COMPONENT_COMPOSITION_WHITELIST),
    options: {
      useDefaultFilter: input.useDefaultFilter,
      siderWidth: input.siderWidth,
      headerHeight: input.headerHeight,
      maxDepth: input.maxDepth,
      enableFingerprintSampling: input.enableFingerprintSampling,
      enableVectorHellOptimization: input.vectorConfig.enabled,
      enableChartDetection: input.chartConfig.enabled,
    },
    fingerprintConfig: input.fingerprintConfig,
    vectorHellConfig: input.vectorConfig,
    chartConfig: input.chartConfig,
  };
}

/**
 * 获取过滤列表
 */
export function getFilterNames(useDefaultFilter: boolean, extraFilterNames: string[]): string[] {
  return useDefaultFilter
    ? [...DEFAULT_FILTERED_NAMES, ...extraFilterNames]
    : extraFilterNames;
}
