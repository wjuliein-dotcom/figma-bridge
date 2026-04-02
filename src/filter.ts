// --- 布局过滤逻辑 ---

import { ProcessContext } from './types.js';
import {
  DEFAULT_FILTERED_NAMES,
  PRESERVE_TYPES_IN_COMPONENTS,
} from './config.js';
import { isInWhitelistedParent } from './whitelist.js';

export interface FilterContext {
  siderWidth: number;
  headerHeight: number;
  filterNames: string[];
  useDefaultFilter: boolean;
  // 新增：容差配置
  siderWidthTolerance?: number;
  headerHeightTolerance?: number;
  siderXTolerance?: number;
  headerYTolerance?: number;
}

/**
 * 宽松匹配：检查 name 是否以 keyword 开头或等于 keyword
 * 避免 "menuitem" 匹配 "menu" 的问题
 */
function looseMatches(name: string, keyword: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // 完全相等
  if (lowerName === lowerKeyword) return true;

  // 名称以关键词开头，后面是边界字符（-、_、空格、/）
  const pattern = new RegExp(`^${lowerKeyword}([-_/\\s]|$)`, 'i');
  if (pattern.test(lowerName)) return true;

  // 名称包含关键词，且前后是边界字符
  const includePattern = new RegExp(`[-_/\\s]${lowerKeyword}([-_/\\s]|$)`, 'i');
  if (includePattern.test(lowerName)) return true;

  return false;
}

/**
 * 通过位置和尺寸判断是否是页面级侧边菜单
 * 左侧菜单栏：x 接近 0，宽度接近 siderWidth
 */
export function isPageLevelSider(node: any, siderWidth: number, tolerance?: number): boolean {
  const box = node.absoluteBoundingBox;
  if (!box) return false;

  const { x, width, height } = box;
  // 可配置的误差范围，默认 ±50px
  const xTol = tolerance ?? 50;
  const widthTol = tolerance ?? 50;

  // 左侧菜单栏特征：x 接近 0，宽度接近 siderWidth
  const isLeftAligned = Math.abs(x) < xTol;
  const hasSiderWidth = Math.abs(width - siderWidth) < widthTol;

  return isLeftAligned && hasSiderWidth && height > 100; // 高度大于100排除小元素
}

/**
 * 通过位置和尺寸判断是否是页面级头部
 * 顶部头部：y 接近 0，高度接近 headerHeight
 */
export function isPageLevelHeader(node: any, headerHeight: number, tolerance?: number): boolean {
  const box = node.absoluteBoundingBox;
  if (!box) return false;

  const { y, width, height } = box;
  // 可配置的误差范围，默认 ±20px
  const yTol = tolerance ?? 20;
  const heightTol = tolerance ?? 20;

  // 顶部头部特征：y 接近 0，高度接近 headerHeight
  const isTopAligned = Math.abs(y) < yTol;
  const hasHeaderHeight = Math.abs(height - headerHeight) < heightTol;

  return isTopAligned && hasHeaderHeight && width > 100; // 宽度大于100排除小元素
}

/**
 * 检查节点名称是否匹配过滤列表（改进版：使用宽松匹配）
 */
export function matchesFilter(nodeName: string, filterNames: string[]): boolean {
  return filterNames.some(filterName => looseMatches(nodeName, filterName));
}

/**
 * 检查节点是否被隐藏
 */
function isNodeHidden(node: any): boolean {
  // visible: false 表示节点在 Figma 中被隐藏
  return node.visible === false;
}

/**
 * 检查是否应该过滤
 * 新逻辑：先判断位置区域，再判断白名单
 * 优化：支持自定义容差，改用宽松匹配
 */
export function shouldFilter(
  node: any,
  context: ProcessContext,
  filterCtx: FilterContext
): boolean {
  // 过滤隐藏的节点
  if (isNodeHidden(node)) {
    return true;
  }

  if (!node.name) return false;

  const nodeName = node.name;
  const { siderWidth, headerHeight, filterNames, siderWidthTolerance, headerHeightTolerance, siderXTolerance, headerYTolerance } = filterCtx;

  // 1. 如果节点类型是基本图形，不过滤（这些是内容）
  if (PRESERVE_TYPES_IN_COMPONENTS.includes(node.type)) {
    return false;
  }

  // 2. 检查是否在特定区域内 + 匹配过滤列表
  // 2.1 Menu/Sidebar/Sider：在左侧区域内识别
  if (
    nodeName.toLowerCase().includes('menu') ||
    nodeName.includes('菜单') ||
    nodeName.toLowerCase().includes('sidebar') ||
    nodeName.toLowerCase().includes('sider')
  ) {
    // 使用可配置的容差参数
    const effectiveTolerance = siderWidthTolerance ?? siderXTolerance;
    if (isPageLevelSider(node, siderWidth, effectiveTolerance)) {
      // 在区域内，检查是否是白名单组件
      // 如果是白名单组件，保留；否则过滤
      return !isInWhitelistedParent(nodeName, context);
    }
    // 不在左侧区域，按正常逻辑判断是否过滤
    return matchesFilter(nodeName, filterNames);
  }

  // 2.2 Header：在顶部区域内识别
  if (
    nodeName.toLowerCase().includes('header') ||
    nodeName.includes('头部') ||
    nodeName.includes('页头') ||
    nodeName.toLowerCase().includes('navbar') ||
    nodeName.toLowerCase().includes('navigation') ||
    nodeName.includes('导航栏')
  ) {
    // 使用可配置的容差参数
    const effectiveTolerance = headerHeightTolerance ?? headerYTolerance;
    if (isPageLevelHeader(node, headerHeight, effectiveTolerance)) {
      // 在区域内，检查是否是白名单组件
      // 如果是白名单组件，保留；否则过滤
      return !isInWhitelistedParent(nodeName, context);
    }
    // 不在顶部区域，按正常逻辑判断是否过滤
    return matchesFilter(nodeName, filterNames);
  }

  // 3. 不在特定区域内的其他节点
  // 如果匹配白名单父组件，不过滤
  if (isInWhitelistedParent(nodeName, context)) {
    return false;
  }

  // 4. 检查是否匹配过滤列表（使用改进的宽松匹配）
  if (!matchesFilter(nodeName, filterNames)) {
    return false;
  }

  // 5. 其他情况：过滤
  return true;
}

/**
 * 获取过滤列表
 */
export function getFilterNames(useDefaultFilter: boolean, extraFilterNames: string[]): string[] {
  return useDefaultFilter
    ? [...DEFAULT_FILTERED_NAMES, ...extraFilterNames]
    : extraFilterNames;
}
