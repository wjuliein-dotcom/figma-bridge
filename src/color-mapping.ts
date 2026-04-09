// --- 颜色映射模块 ---
// 将 Figma 节点的颜色值映射到主题工具库的主题色

import type { ColorMappingResult, ColorMappingItem } from './types.js';
import { DEFAULT_THEME_COLORS } from './config.js';

/**
 * 将十六进制颜色转换为 RGB 对象
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * 将 RGB 对象转换为十六进制颜色
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 计算两个颜色之间的欧几里得距离
 */
function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return Infinity;

  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * 标准化十六进制颜色（处理简写形式如 #fff）
 */
function normalizeHex(hex: string): string {
  let normalized = hex.trim().toLowerCase();

  // 处理简写形式
  if (/^#([a-f\d])([a-f\d])([a-f\d])$/i.test(normalized)) {
    normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
  }

  // 确保有 # 前缀
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }

  return normalized;
}

/**
 * 颜色相似度（0-1），距离越小相似度越高
 */
function colorSimilarity(color1: string, color2: string, maxDistance: number = 441): number {
  const distance = colorDistance(color1, color2);
  return 1 - (distance / maxDistance);
}

/**
 * 主题色项
 */
interface ThemeColorItem {
  token: string;
  value: string;
  category: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  level?: number;
}

/**
 * 从主题色列表中找到最佳匹配
 */
function findBestMatch(
  targetColor: string,
  themeColors: ThemeColorItem[]
): { token: string; value: string; confidence: number } | null {
  let bestMatch: ThemeColorItem | null = null;
  let bestDistance = Infinity;

  const normalizedTarget = normalizeHex(targetColor);

  for (const colorItem of themeColors) {
    const distance = colorDistance(normalizedTarget, normalizeHex(colorItem.value));

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = colorItem;
    }
  }

  if (!bestMatch) return null;

  // 计算置信度（距离越小置信度越高）
  // 最大距离约为 441（白色到黑色的距离）
  const confidence = Math.max(0, 1 - (bestDistance / 441));

  return {
    token: bestMatch.token,
    value: bestMatch.value,
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * 从 fills 数组中提取颜色
 */
function extractFillColors(fills: any[]): string[] {
  if (!fills || !Array.isArray(fills)) return [];

  return fills
    .filter((fill: any) => fill.type === 'SOLID' && fill.color)
    .map((fill: any) => {
      const { r, g, b } = fill.color;
      const a = fill.opacity ?? 1;

      // 如果有透明度且不是完全透明
      if (a > 0 && a < 1) {
        // 对于半透明颜色，尝试匹配不透明版本
        // 这里简化处理，直接返回转换后的颜色
        return rgbToHex(
          Math.round(r * 255),
          Math.round(g * 255),
          Math.round(b * 255)
        );
      }

      return rgbToHex(
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
      );
    });
}

/**
 * 从 strokes 数组中提取描边颜色
 */
function extractStrokeColors(strokes: any[]): string[] {
  if (!strokes || !Array.isArray(strokes)) return [];

  return strokes
    .filter((stroke: any) => stroke.type === 'SOLID' && stroke.color)
    .map((stroke: any) => {
      const { r, g, b } = stroke.color;
      return rgbToHex(
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
      );
    });
}

/**
 * 创建颜色映射项
 */
function createColorMappingItem(
  originalColor: string,
  themeColors: ThemeColorItem[],
  confidenceThreshold: number = 0.8
): ColorMappingItem | null {
  const match = findBestMatch(originalColor, themeColors);

  if (!match || match.confidence < confidenceThreshold) {
    // 低于置信度阈值时不映射
    return null;
  }

  return {
    originalColor: normalizeHex(originalColor),
    mappedToken: match.token,
    mappedValue: match.value,
    confidence: match.confidence
  };
}

/**
 * 颜色映射配置
 */
export interface ColorMappingOptions {
  /** 主题色配置 */
  themeColors?: ThemeColorItem[];
  /** 置信度阈值，低于此值不进行映射 */
  confidenceThreshold?: number;
}

/**
 * 映射节点的颜色
 * @param node - Figma 节点
 * @param options - 颜色映射选项（主题色配置、置信度阈值）
 */
export function mapNodeColors(
  node: any,
  options: ColorMappingOptions = {}
): ColorMappingResult | null {
  // 使用默认主题色或自定义主题色
  const colors = options.themeColors || DEFAULT_THEME_COLORS;
  const confidenceThreshold = options.confidenceThreshold ?? 0.8;

  // 提取 fills（填充色/背景色）
  const fillColors = extractFillColors(node.fills);
  const fills: ColorMappingItem[] = [];

  for (const color of fillColors) {
    const mappingItem = createColorMappingItem(color, colors, confidenceThreshold);
    if (mappingItem) {
      fills.push(mappingItem);
    }
  }

  // 提取 strokes（描边色）
  const strokeColors = extractStrokeColors(node.strokes);
  const strokes: ColorMappingItem[] = [];

  for (const color of strokeColors) {
    const mappingItem = createColorMappingItem(color, colors, confidenceThreshold);
    if (mappingItem) {
      strokes.push(mappingItem);
    }
  }

  // 如果没有映射到任何颜色，返回 null
  if (fills.length === 0 && strokes.length === 0) {
    return null;
  }

  return {
    fills,
    strokes
  };
}

/**
 * 判断是否应该跳过颜色映射（如图标内部的颜色）
 */
export function shouldSkipColorMapping(node: any, context?: { isInsideIcon?: boolean }): boolean {
  // 如果在图标内部，跳过颜色映射
  if (context?.isInsideIcon) {
    return true;
  }

  // 如果节点名称包含特定关键词，可能不需要映射
  const skipPatterns = ['icon', 'logo', 'emoji', 'illustration'];
  const name = node.name?.toLowerCase() || '';

  for (const pattern of skipPatterns) {
    if (name.includes(pattern)) {
      return true;
    }
  }

  return false;
}

// 导出类型和配置获取函数
export type { ThemeColorItem };
export { DEFAULT_THEME_COLORS } from './config.js';