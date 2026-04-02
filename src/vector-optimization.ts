// --- 矢量地狱优化 ---
// 检测图标容器，简化矢量节点属性（移除 vectorPaths 等大数据字段）

import { VectorHellConfig } from './types.js';
import {
  DEFAULT_VECTOR_HELL_CONFIG,
} from './config.js';

/**
 * 改进：检测节点是否为图标容器
 * 使用多重判定条件，更准确识别图标
 */
export function isIconContainer(node: any, config: VectorHellConfig): boolean {
  if (!config.enabled) return false;
  if (!node.children || node.children.length < config.minVectorChildren) return false;

  // 只考虑 GROUP 和 FRAME 类型
  if (!['GROUP', 'FRAME'].includes(node.type)) return false;

  // 检查尺寸限制（可配置）
  const box = node.absoluteBoundingBox;
  if (box) {
    const maxDim = Math.max(box.width, box.height);
    if (maxDim > config.maxIconSize) return false;
  }

  // 改进：多重判定条件
  // 1. VECTOR 子节点数量
  const vectorCount = node.children.filter((c: any) => c.type === 'VECTOR').length;
  const meetsVectorThreshold = vectorCount >= config.minVectorChildren;

  // 2. 检查名称是否包含图标相关关键词（增强判定）
  const nameLower = (node.name || '').toLowerCase();
  const iconKeywords = ['icon', '图标', 'ico', 'symbol', 'logo', 'emoji', 'avatar'];
  const hasIconName = iconKeywords.some(k => nameLower.includes(k));

  // 3. 检查是否是知名图标组件库命名
  const iconLibPatterns = [
    /^icon-/, /^i-/, /^ic-/, /^lucide-/, /^feather-/, /^fa[srlb]-/,
    /-icon$/, /icon$/, /icon-/, /^material-ui/,
  ];
  const isIconLib = iconLibPatterns.some(p => p.test(nameLower));

  // 4. 检查尺寸比例（图标通常是方形或接近方形）
  let isSquareRatio = false;
  if (box && box.width > 0 && box.height > 0) {
    const ratio = Math.max(box.width, box.height) / Math.min(box.width, box.height);
    isSquareRatio = ratio < 3; // 长宽比小于3认为是接近正方形
  }

  // 综合判定：满足 VECTOR 数量要求 + 至少一个辅助条件
  if (meetsVectorThreshold) {
    if (hasIconName || isIconLib || isSquareRatio) {
      return true;
    }
    // 如果有足够的 VECTOR 且尺寸较小，也认为是图标
    if (box && Math.max(box.width, box.height) < 100) {
      return true;
    }
  }

  return false;
}

/**
 * 简化 fills 或 strokes 数据
 * 优化：可配置是否保留渐变数据
 */
function simplifyFillsOrStrokes(items: any[], config: VectorHellConfig): any[] {
  if (!Array.isArray(items)) return items;

  return items.map(item => {
    const simplified: any = { ...item };

    // 移除大型二进制引用
    delete simplified.imageRef;
    delete simplified.imageTransform;

    // 渐变数据：可配置是否保留
    if (!config.preserveGradientData) {
      if (simplified.gradientHandlePositions) {
        simplified.gradientHandlePositions = '[GradientHandles]'; // 占位符
      }
      if (simplified.gradientStops) {
        simplified.gradientStopsCount = simplified.gradientStops.length;
        simplified.gradientStops = '[GradientStops]'; // 占位符
      }
    }
    // 如果保留渐变数据，只简化字段名但保留数量信息
    else {
      if (simplified.gradientStops) {
        simplified.gradientStopsCount = simplified.gradientStops.length;
      }
    }

    return simplified;
  });
}

/**
 * 简化矢量节点，移除会导致数据爆炸的属性
 * 优化：可配置保留路径数据用于关键场景
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
    result._note = '图标矢量元素';
  }

  // 特殊处理 fills 和 strokes
  if (result.fills) {
    result.fills = simplifyFillsOrStrokes(result.fills, config);
  }
  if (result.strokes) {
    result.strokes = simplifyFillsOrStrokes(result.strokes, config);
  }

  // 可选：保留关键路径数据用于特殊场景（如需要精确还原图标）
  if (config.preserveVectorPaths && node.vectorPaths) {
    result._hasVectorPaths = true;
    result._vectorPathCount = node.vectorPaths.length;
    // 保留路径数量信息，但不保留完整路径数据
  }

  // 可选：保留网络数据
  if (config.preserveVectorNetwork && node.vectorNetwork) {
    result._hasVectorNetwork = true;
    result._vectorNodeCount = node.vectorNetwork.nodes?.length || 0;
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
