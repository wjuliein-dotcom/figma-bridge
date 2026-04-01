// --- 矢量地狱优化 ---
// 检测图标容器，简化矢量节点属性（移除 vectorPaths 等大数据字段）

import { VectorHellConfig } from './types.js';
import {
  DEFAULT_VECTOR_HELL_CONFIG,
} from './config.js';

/**
 * 检测节点是否为图标容器（包含多个 VECTOR 的 GROUP/FRAME）
 */
export function isIconContainer(node: any, config: VectorHellConfig): boolean {
  if (!config.enabled) return false;
  if (!node.children || node.children.length < config.minVectorChildren) return false;

  // 只考虑 GROUP 和 FRAME 类型
  if (!['GROUP', 'FRAME'].includes(node.type)) return false;

  // 检查尺寸限制（大容器不太可能是图标）
  const box = node.absoluteBoundingBox;
  if (box) {
    const maxDim = Math.max(box.width, box.height);
    if (maxDim > config.maxIconSize) return false;
  }

  // 统计 VECTOR 子节点数量
  const vectorCount = node.children.filter((c: any) => c.type === 'VECTOR').length;

  // 如果 VECTOR 子节点数量达到阈值，判定为图标
  return vectorCount >= config.minVectorChildren;
}

/**
 * 简化 fills 或 strokes 数据，移除 imageRef 等不必要的大字段
 */
function simplifyFillsOrStrokes(items: any[]): any[] {
  if (!Array.isArray(items)) return items;

  return items.map(item => {
    const simplified: any = { ...item };

    // 移除大型二进制引用
    delete simplified.imageRef;
    delete simplified.imageTransform;

    // 简化渐变数据
    if (simplified.gradientHandlePositions) {
      simplified.gradientHandlePositions = '[GradientHandles]'; // 占位符
    }
    if (simplified.gradientStops) {
      simplified.gradientStopsCount = simplified.gradientStops.length;
      simplified.gradientStops = '[GradientStops]'; // 占位符
    }

    return simplified;
  });
}

/**
 * 简化矢量节点，移除会导致数据爆炸的属性
 */
export function simplifyVectorNode(node: any, isInsideIcon: boolean, config: VectorHellConfig): any {
  if (!config.enabled) return node;

  const result: any = {};

  // 只保留白名单中的属性
  for (const key of config.preserveVectorProps) {
    if (key in node) {
      result[key] = node[key];
    }
  }

  // 如果是图标内部的矢量节点，添加标记
  if (isInsideIcon) {
    result._isIconPart = true;
    result._note = '图标矢量元素（已简化路径数据）';
  }

  // 特殊处理 fills 和 strokes，移除其中的复杂几何数据
  if (result.fills) {
    result.fills = simplifyFillsOrStrokes(result.fills);
  }
  if (result.strokes) {
    result.strokes = simplifyFillsOrStrokes(result.strokes);
  }

  return result;
}

/**
 * 扁平化图标容器的子节点
 * 将深层的 GROUP > VECTOR 结构扁平化为简单的标记
 */
export function flattenIconChildren(children: any[], currentDepth: number, config: VectorHellConfig): any[] {
  if (!config.enabled) return children;

  const result: any[] = [];

  for (const child of children) {
    // 如果是 VECTOR，直接简化
    if (child.type === 'VECTOR') {
      result.push(simplifyVectorNode(child, true, config));
      continue;
    }

    // 如果是 GROUP 且还有 VECTOR 子节点，继续扁平化
    if (child.type === 'GROUP' && child.children) {
      const hasVectors = child.children.some((c: any) => c.type === 'VECTOR');

      if (hasVectors && currentDepth < config.maxNestingDepth) {
        // 递归扁平化，但增加深度计数
        const flattened = flattenIconChildren(child.children, currentDepth + 1, config);
        result.push(...flattened);
      } else if (hasVectors) {
        // 超过最大深度，添加占位符
        result.push({
          id: child.id,
          name: child.name,
          type: 'GROUP',
          _flattened: true,
          _note: `矢量组（${child.children.length} 个子元素，已扁平化）`,
        });
      } else {
        // 没有 VECTOR 的普通 GROUP，保留但简化
        result.push(simplifyVectorNode(child, true, config));
      }
      continue;
    }

    // 其他类型直接简化
    result.push(simplifyVectorNode(child, true, config));
  }

  return result;
}

/**
 * 创建图标容器的元信息
 */
export function createIconMetadata(node: any): any {
  return {
    childCount: node.children?.length || 0,
    vectorCount: node.children?.filter((c: any) => c.type === 'VECTOR').length || 0,
    boundingBox: node.absoluteBoundingBox,
  };
}

/**
 * 获取矢量地狱配置（合并默认和用户配置）
 */
export function getVectorHellConfig(userConfig?: Partial<VectorHellConfig>): VectorHellConfig {
  return {
    ...DEFAULT_VECTOR_HELL_CONFIG,
    ...userConfig,
  };
}
