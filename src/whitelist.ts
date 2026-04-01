// --- 组件白名单系统 ---

import { COMPONENT_COMPOSITION_WHITELIST } from './config.js';
import { ProcessContext } from './types.js';

/**
 * 检查节点是否在白名单父组件下
 */
export function isInWhitelistedParent(nodeName: string, context: ProcessContext): boolean {
  if (!context.parentName) return false;

  const parentNameLower = context.parentName.toLowerCase();

  // 检查父组件是否在白名单中
  for (const [parentPattern, allowedChildren] of Object.entries(COMPONENT_COMPOSITION_WHITELIST)) {
    if (parentNameLower.includes(parentPattern.toLowerCase())) {
      // 父组件匹配，检查当前节点是否在允许列表中
      const nodeNameLower = nodeName.toLowerCase();
      const isAllowed = (allowedChildren as string[]).some((childPattern: string) =>
        nodeNameLower === childPattern.toLowerCase() ||
        nodeNameLower.includes(childPattern.toLowerCase())
      );
      if (isAllowed) return true;
    }
  }

  return false;
}

/**
 * 获取所有白名单父组件类型
 */
export function getWhitelistTypes(): string[] {
  return Object.keys(COMPONENT_COMPOSITION_WHITELIST);
}

/**
 * 检查特定父组件类型是否允许特定子组件
 */
export function isChildAllowedInParent(parentType: string, childName: string): boolean {
  const parentTypeLower = parentType.toLowerCase();

  for (const [pattern, allowedChildren] of Object.entries(COMPONENT_COMPOSITION_WHITELIST)) {
    if (parentTypeLower.includes(pattern.toLowerCase())) {
      const childNameLower = childName.toLowerCase();
      const isAllowed = (allowedChildren as string[]).some((childPattern: string) =>
        childNameLower === childPattern.toLowerCase() ||
        childNameLower.includes(childPattern.toLowerCase())
      );
      if (isAllowed) return true;
    }
  }

  return false;
}
