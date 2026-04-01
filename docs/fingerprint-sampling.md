# 智能指纹采样方案详解

## 核心思想

不同于简单的"截取前 N 行"，指纹采样通过**结构识别**保留所有**独特结构**的节点，丢弃完全重复的节点。

## 工作流程

```
Table (10行)
  ├── Row 1: [TextCell, TextCell, ActionCell] ───┐
  ├── Row 2: [TextCell, TextCell, ActionCell] ───┼── 结构相同，指纹匹配
  ├── Row 3: [TextCell, TextCell, ActionCell] ───┤   → 只保留 Row 1
  ├── Row 4: [TextCell, TextCell, ActionCell] ───┘   → 标记 "+3 个相同"
  ├── Row 5: [TextCell, TextCell, ExpandedContent] ──┐
  ├── Row 6: [TextCell, TextCell, ExpandedContent] ──┼── 展开行，结构不同
  │                                                    → 保留作为第二样本
  ├── Row 7: [TextCell, TextCell, ActionCell] ────┐
  ├── Row 8: [TextCell, TextCell, ActionCell] ────┼── 与 Row 1 相同
  ├── Row 9: [TextCell, TextCell, ActionCell] ────┤   → 跳过
  └── Row 10: [SelectedRow, TextCell, ActionCell] ─── 选中态，特殊保留
                                                    → 保留作为第三样本
```

## 输出结果

```json
{
  "name": "Table",
  "children": [
    {
      "name": "Row 1",
      "_isRepresentative": true,
      "_duplicateCount": 5,
      "_note": "此结构共有 6 个相同节点",
      "children": [...]
    },
    {
      "name": "Row 5",
      "_isRepresentative": true,
      "_duplicateCount": 1,
      "_note": "此结构共有 2 个相同节点",
      "children": [...]
    },
    {
      "name": "Row 10",
      "_isRepresentative": true,
      "_note": "特殊状态节点",
      "children": [...]
    }
  ],
  "_samplingInfo": {
    "method": "fingerprint",
    "totalChildren": 10,
    "preservedChildren": 3,
    "skippedChildren": 7,
    "fingerprints": [
      { "hash": "INSTANCE:HORIZONTAL:3:...", "count": 7, "indices": [0,1,2,3,6,7,8] },
      { "hash": "INSTANCE:HORIZONTAL:4:...", "count": 2, "indices": [4,5] },
      { "hash": "INSTANCE:HORIZONTAL:3:...", "count": 1, "indices": [9] }
    ]
  }
}
```

## 指纹计算算法

### 1. 结构指纹组成

```typescript
interface NodeFingerprint {
  // 结构哈希 = 节点类型 + 布局模式 + 子节点数量 + 子节点类型序列
  structureHash: "INSTANCE:HORIZONTAL:3:TEXT:TEXT:INSTANCE"

  // 子节点类型详细序列
  childTypes: "TEXT:Cell1|TEXT:Cell2|INSTANCE:ActionButton"

  // 属性签名（排序后的属性名）
  propSignature: "disabled,selected,title"

  // 深度和数量
  depth: 2
  childCount: 3
}
```

### 2. 相似度计算

```typescript
function compareFingerprints(fp1, fp2): number {
  // 基本结构不同 → 0
  if (fp1.structureHash !== fp2.structureHash) return 0;

  // 子节点数量不同 → 0.5
  if (fp1.childCount !== fp2.childCount) return 0.5;

  // 属性签名不同 → 0.8（可能状态不同）
  if (fp1.propSignature !== fp2.propSignature) return 0.8;

  // 完全匹配 → 1
  return 1;
}
```

### 3. 特殊状态识别

始终保留包含以下关键词的节点：
- `expand`, `expanded`, `展开` - 展开行
- `selected`, `选中` - 选中态
- `active`, `激活` - 激活态
- `focus`, `hover`, `disabled` - 特殊交互态

## 配置选项

```typescript
const config = {
  // 启用指纹采样的组件名称匹配
  namePatterns: ['row', 'tr', 'item', 'option', 'step'],

  // 相似度阈值（0.95 = 95% 相似视为相同）
  similarityThreshold: 0.95,

  // 最大保留的唯一结构数
  maxUniqueStructures: 3,

  // 始终保留的特殊状态
  preservePatterns: ['expand', 'selected', 'active', '展开', '选中'],
};
```

## 使用方式

### 方式 1：使用指纹采样版本

```typescript
import { transformToDSL } from './transform-fingerprint.js';

const dsl = transformToDSL(nodeData, {
  enableFingerprintSampling: true,
  fingerprintConfig: {
    maxUniqueStructures: 3,
    similarityThreshold: 0.95,
  }
});
```

### 方式 2：添加到现有 transform.ts

将 `fingerprintSampling` 函数和 `calculateFingerprint` 函数复制到现有文件中，然后在处理子节点时调用。

## 对比：简单截取 vs 指纹采样

### 场景：Table 有 10 行，第 5 行是展开行，第 10 行是选中态

| 方案 | 保留的行 | 结果 |
|-----|---------|------|
| 简单截取前 2 行 | Row 1, Row 2 | ❌ 丢失展开行和选中态示例 |
| 智能指纹采样 | Row 1, Row 5, Row 10 | ✅ 保留所有独特结构 |

### 生成的代码影响

**简单截取（丢失展开行）：**
```vue
<a-table :dataSource="dataSource">
  <a-table-column title="Name" dataIndex="name" />
  <a-table-column title="Action">
    <template #default="{ record }">
      <a-button>Edit</a-button>
    </template>
  </a-table-column>
</a-table>
```

**指纹采样（识别展开行）：**
```vue
<a-table :dataSource="dataSource" :expandedRowRender="expandedRowRender">
  <a-table-column title="Name" dataIndex="name" />
  <a-table-column title="Action">
    <template #default="{ record }">
      <a-button>Edit</a-button>
    </template>
  </a-table-column>
  <!-- 展开行内容模板 -->
  <template #expandedRowRender="{ record }">
    <div class="expanded-content">
      <!-- 展开行特有的内容 -->
    </div>
  </template>
</a-table>
```

## 性能优化

指纹采样在遍历时计算，时间复杂度 O(n²)，但对于：
- 普通 Table（< 100 行）：< 10ms
- 大型 List（< 500 项）：< 50ms

实际使用中可以接受。

## 扩展：更智能的采样策略

未来可以扩展：

1. **分层采样**：
   - 第一层：保留所有不同结构
   - 第二层：对相同结构只保留 1 个

2. **状态识别**：
   - 自动识别 disabled、loading、error 等状态
   - 保留每个状态的示例

3. **权重排序**：
   - 优先保留靠前的行（通常更重要）
   - 但特殊状态行（如选中态）权重更高

4. **内容相似度**：
   - 不仅比较结构，还比较内容长度
   - 识别内容差异大的行（如长文本 vs 短文本）
