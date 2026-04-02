// --- 智能指纹采样 ---
// 解决 Table、List 等重复组件导致数据量过大的问题

import { NodeFingerprint, SamplingRecord, FingerprintConfig } from './types.js';
import { DEFAULT_FINGERPRINT_CONFIG } from './config.js';

/**
 * 计算节点的结构指纹
 * 优化：使用更稳定的指纹算法，减少对名称的依赖
 */
export function calculateFingerprint(node: any, depth: number = 0): NodeFingerprint {
  // 1. 收集子节点类型序列（不包含名称，只包含类型）
  const childTypes = node.children
    ? node.children.map((c: any) => c.type).join('|')
    : '';

  // 2. 收集属性签名（排序后，不包含名称相关属性）
  const propKeys = node.componentProperties
    ? Object.keys(node.componentProperties).sort().join(',')
    : '';

  // 3. 收集布局属性（用于区分不同的布局模式）
  const layoutProps = [
    node.layoutMode,
    node.primaryAxisSizingMode,
    node.counterAxisSizingMode,
    node.primaryAxisAlignItems,
    node.counterAxisAlignItems,
    node.itemSpacing,
    node.paddingTop,
    node.paddingBottom,
    node.paddingLeft,
    node.paddingRight,
  ].filter(v => v !== undefined && v !== 'FIXED' && v !== 'AUTO').join(':');

  // 4. 生成结构哈希（不包含名称）
  const structureHash = `${node.type}:${node.layoutMode || 'NONE'}:${node.children?.length || 0}:${childTypes.substring(0, 100)}`;

  return {
    structureHash,
    childTypes,
    propSignature: propKeys,
    depth,
    childCount: node.children?.length || 0,
  };
}

/**
 * 改进：比较两个指纹的相似度
 * 增加更多考量因素：布局属性、尺寸比例等
 */
export function compareFingerprints(fp1: NodeFingerprint, fp2: NodeFingerprint): number {
  // 如果基本结构不同，相似度为 0
  if (fp1.structureHash !== fp2.structureHash) {
    return 0;
  }

  // 如果子节点数量不同，降低相似度
  if (fp1.childCount !== fp2.childCount) {
    // 子节点数量差异小于20%，给予部分相似度
    const ratio = Math.min(fp1.childCount, fp2.childCount) / Math.max(fp1.childCount, fp2.childCount);
    if (ratio > 0.8) {
      return 0.7; // 略降低但不是0
    }
    return 0.5;
  }

  // 属性签名完全匹配
  if (fp1.propSignature === fp2.propSignature) {
    return 1;
  }

  // 属性签名部分匹配
  if (fp1.propSignature && fp2.propSignature) {
    const keys1 = fp1.propSignature.split(',');
    const keys2 = fp2.propSignature.split(',');
    const intersection = keys1.filter(k => keys2.includes(k));
    const union = [...new Set([...keys1, ...keys2])];
    const jaccard = intersection.length / union.length;

    if (jaccard > 0.7) return 0.9;
    if (jaccard > 0.5) return 0.8;
  }

  // 如果子节点类型序列不同，降低相似度
  if (fp1.childTypes !== fp2.childTypes) {
    return 0.85;
  }

  // 完全匹配
  return 1;
}

/**
 * 改进：检查节点是否应该被保留（特殊状态）
 * 不仅依赖命名，还检查节点的可见性、交互状态等
 */
export function shouldPreserveNode(node: any, preservePatterns: string[], config: FingerprintConfig): boolean {
  const nodeName = (node.name || '').toLowerCase();

  // 1. 先检查命名模式
  for (const pattern of preservePatterns) {
    if (nodeName.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // 2. 检查变体属性（variant properties）
  if (node.componentProperties) {
    const props = node.componentProperties;

    // 检查是否明确标记为特殊状态
    if (props.selected?.value === true ||
        props.checked?.value === true ||
        props.active?.value === true ||
        props.expanded?.value === true ||
        props.current?.value === true) {
      return true;
    }

    // 检查禁用状态
    if (props.disabled?.value === true) {
      return config.preserveDisabled ?? true; // 默认保留禁用状态
    }
  }

  // 3. 检查节点在 Figma 中的状态
  if (node.visible === false) {
    return false; // 隐藏的节点不保留
  }

  // 4. 检查节点尺寸（异常大的行可能是汇总行）
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    // 如果行高异常大（大于500px），可能是汇总行
    if (height > 500) {
      return true;
    }
  }

  return false;
}

/**
 * 对子节点进行智能指纹采样
 * 保留所有不同结构的节点，丢弃完全重复的结构
 * 优化：改进采样逻辑，支持更多配置选项
 */
export function fingerprintSampling(
  children: any[],
  config: FingerprintConfig
): { preserved: any[]; record: SamplingRecord } {
  const fingerprints: Map<number, NodeFingerprint> = new Map();
  const preservedIndices: number[] = [];
  const skippedIndices: number[] = [];
  const fingerprintMap: Map<string, number[]> = new Map();
  const duplicatesCount: Map<number, number> = new Map();

  // 第一轮：计算所有指纹
  for (let i = 0; i < children.length; i++) {
    fingerprints.set(i, calculateFingerprint(children[i], 0));
  }

  // 第二轮：智能选择保留的节点
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const currentFp = fingerprints.get(i)!;

    // 1. 检查是否是特殊节点（展开行、选中态等）- 使用改进后的函数
    if (shouldPreserveNode(child, config.preservePatterns, config)) {
      preservedIndices.push(i);
      duplicatesCount.set(i, 0);
      const fpKey = currentFp.structureHash;
      fingerprintMap.set(fpKey, [...(fingerprintMap.get(fpKey) || []), i]);
      continue;
    }

    // 2. 检查是否与已保留的节点结构相似
    let isDuplicate = false;
    let similarToIndex = -1;
    let highestSimilarity = 0;

    for (const preservedIdx of preservedIndices) {
      const preservedFp = fingerprints.get(preservedIdx)!;
      const similarity = compareFingerprints(currentFp, preservedFp);

      if (similarity >= config.similarityThreshold && similarity > highestSimilarity) {
        isDuplicate = true;
        similarToIndex = preservedIdx;
        highestSimilarity = similarity;
      }
    }

    // 3. 决策：保留或跳过
    if (!isDuplicate && preservedIndices.length < config.maxUniqueStructures) {
      // 新结构，且未达到最大保留数
      preservedIndices.push(i);
      duplicatesCount.set(i, 0);
      const fpKey = currentFp.structureHash;
      fingerprintMap.set(fpKey, [...(fingerprintMap.get(fpKey) || []), i]);
    } else if (isDuplicate && similarToIndex >= 0) {
      // 重复结构，跳过并记录
      skippedIndices.push(i);
      duplicatesCount.set(similarToIndex, (duplicatesCount.get(similarToIndex) || 0) + 1);
    } else if (!isDuplicate && preservedIndices.length >= config.maxUniqueStructures) {
      // 新结构但已达到最大保留数，跳过后面的
      // 但保留最后几个以保持数据完整性
      const remainingThreshold = Math.floor(children.length * 0.1); // 保留最后10%
      if (i >= children.length - remainingThreshold) {
        preservedIndices.push(i);
        duplicatesCount.set(i, 0);
      } else {
        skippedIndices.push(i);
      }
    }
  }

  // 构建保留的子节点数组
  const preserved = preservedIndices.map(idx => ({
    ...children[idx],
    _originalIndex: idx,
  }));

  return {
    preserved,
    record: {
      preservedIndices,
      skippedIndices,
      fingerprintMap,
      duplicatesCount,
    },
  };
}

/**
 * 检查节点是否启用指纹采样
 * 优化：简化签名，由调用方控制启用
 */
export function isFingerprintSamplingTarget(nodeName: string, config: FingerprintConfig): boolean {
  const lowerName = nodeName.toLowerCase();
  return config.namePatterns.some((pattern: string) =>
    lowerName.includes(pattern.toLowerCase())
  );
}

/**
 * 获取指纹采样配置（合并默认和用户配置）
 */
export function getFingerprintConfig(userConfig?: Partial<FingerprintConfig>): FingerprintConfig {
  return {
    ...DEFAULT_FINGERPRINT_CONFIG,
    ...userConfig,
  };
}

/**
 * 生成采样信息元数据
 */
export function createSamplingInfo(record: SamplingRecord): any {
  return {
    method: 'fingerprint',
    totalChildren: record.preservedIndices.length + record.skippedIndices.length,
    preservedChildren: record.preservedIndices.length,
    skippedChildren: record.skippedIndices.length,
    preservedIndices: record.preservedIndices,
    skippedIndices: record.skippedIndices,
    fingerprints: Array.from(record.fingerprintMap.entries()).map((entry: [string, number[]]) => {
      const [hash, indices] = entry;
      return {
        hash: hash.substring(0, 50) + '...',
        count: indices.length,
        indices,
      };
    }),
  };
}
