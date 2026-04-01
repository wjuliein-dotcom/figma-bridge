// --- 智能指纹采样 ---
// 解决 Table、List 等重复组件导致数据量过大的问题

import { NodeFingerprint, SamplingRecord, FingerprintConfig } from './types.js';
import { DEFAULT_FINGERPRINT_CONFIG } from './config.js';

/**
 * 计算节点的结构指纹
 * 基于节点类型、子节点结构、属性等生成唯一标识
 */
export function calculateFingerprint(node: any, depth: number = 0): NodeFingerprint {
  // 1. 收集子节点类型序列
  const childTypes = node.children
    ? node.children.map((c: any) => `${c.type}:${c.name?.substring(0, 20) || ''}`).join('|')
    : '';

  // 2. 收集属性签名（排序后）
  const propKeys = node.componentProperties
    ? Object.keys(node.componentProperties).sort().join(',')
    : '';

  // 3. 生成结构哈希
  const structureHash = `${node.type}:${node.layoutMode || 'NONE'}:${node.children?.length || 0}:${childTypes}`;

  return {
    structureHash,
    childTypes,
    propSignature: propKeys,
    depth,
    childCount: node.children?.length || 0,
  };
}

/**
 * 比较两个指纹的相似度
 * 返回 0-1 的值，1 表示完全相同
 */
export function compareFingerprints(fp1: NodeFingerprint, fp2: NodeFingerprint): number {
  // 如果基本结构不同，相似度为 0
  if (fp1.structureHash !== fp2.structureHash) {
    return 0;
  }

  // 如果子节点数量不同，降低相似度
  if (fp1.childCount !== fp2.childCount) {
    return 0.5;
  }

  // 如果属性签名不同，降低相似度
  if (fp1.propSignature !== fp2.propSignature) {
    return 0.8;
  }

  // 如果子节点类型序列不同，降低相似度
  if (fp1.childTypes !== fp2.childTypes) {
    return 0.9;
  }

  // 完全匹配
  return 1;
}

/**
 * 检查节点是否应该被保留（特殊状态）
 */
export function shouldPreserveNode(nodeName: string, preservePatterns: string[]): boolean {
  const lowerName = nodeName.toLowerCase();
  return preservePatterns.some(pattern =>
    lowerName.includes(pattern.toLowerCase())
  );
}

/**
 * 对子节点进行智能指纹采样
 * 保留所有不同结构的节点，丢弃完全重复的结构
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

    // 1. 检查是否是特殊节点（展开行、选中态等）
    if (shouldPreserveNode(child.name || '', config.preservePatterns)) {
      preservedIndices.push(i);
      duplicatesCount.set(i, 0);
      const fpKey = currentFp.structureHash;
      fingerprintMap.set(fpKey, [...(fingerprintMap.get(fpKey) || []), i]);
      continue;
    }

    // 2. 检查是否与已保留的节点结构相似
    let isDuplicate = false;
    let similarToIndex = -1;

    for (const preservedIdx of preservedIndices) {
      const preservedFp = fingerprints.get(preservedIdx)!;
      const similarity = compareFingerprints(currentFp, preservedFp);

      if (similarity >= config.similarityThreshold) {
        isDuplicate = true;
        similarToIndex = preservedIdx;
        break;
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
      skippedIndices.push(i);
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
 */
export function isFingerprintSamplingTarget(nodeName: string, config: FingerprintConfig, enabled: boolean): boolean {
  if (!enabled) return false;
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
