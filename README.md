# figma-bridge

一个基于 MCP (Model Context Protocol) 的工具，用于从 Figma 获取设计节点数据并转换为 AI 可理解的结构化 DSL，辅助生成 Vue 3 / React / HTML 组件代码。

## 功能特性

- **Figma API 集成**: 通过 Figma REST API 获取设计文件节点数据
- **智能数据清洗**: 过滤坐标、阴影等无关信息，保留组件树和布局结构
- **布局感知过滤**: 自动识别并过滤页面级菜单、头部等布局元素
- **组件白名单**: 保护组件内部的菜单、头部等元素不被误过滤
- **矢量地狱优化**: 检测并简化图标/插画中的大量矢量节点，减少数据量 90%+
- **智能指纹采样**: 针对 Table、List 等重复组件，保留不同结构样本，压缩数据量
- **多框架支持**: 支持生成 Vue 3、React、HTML 代码

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
FIGMA_TOKEN=your_figma_api_token
FILE_KEY=your_figma_file_key
```

获取方式：
- **FIGMA_TOKEN**: [Figma Personal Access Tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)
- **FILE_KEY**: Figma 文件 URL 中的 key，如 `https://www.figma.com/file/ABC123/...` 中的 `ABC123`

### 3. 编译

```bash
npm run build
```

### 4. 配置 MCP

在 Claude Code 或其他 MCP 客户端中添加配置：

```json
{
  "mcpServers": {
    "figma-bridge": {
      "command": "node",
      "args": ["/path/to/figma-bridge/dist/index.js"]
    }
  }
}
```

## 使用方式

### 工具: `get-figma-node`

获取 Figma 节点的结构化数据。

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `nodeId` | `string` | 必填 | Figma 节点 ID |
| `framework` | `enum` | `'vue'` | 目标框架: `vue`, `react`, `html` |
| `filterNames` | `string[]` | `[]` | 额外过滤的节点名称 |
| `useDefaultFilter` | `boolean` | `true` | 是否启用默认过滤 |
| `siderWidth` | `number` | `220` | 左侧菜单栏宽度阈值(px) |
| `headerHeight` | `number` | `64` | 顶部头部高度阈值(px) |
| `maxDepth` | `number` | `10` | 最大递归深度 |
| `enableFingerprintSampling` | `boolean` | `false` | 启用智能指纹采样（当前默认禁用）|
| `fingerprintConfig` | `object` | `{}` | 指纹采样配置 |
| `enableVectorHellOptimization` | `boolean` | `true` | 启用矢量地狱优化 |

**示例调用：**

```typescript
// 获取节点数据
const result = await getFigmaNode({
  nodeId: "1-16253",  // 支持 1-16253 或 1:16253 格式
  framework: "vue",
  siderWidth: 220,
  headerHeight: 64,
  enableFingerprintSampling: false  // 默认禁用
});
```

**返回数据结构：**

```json
{
  "_meta": {
    "framework": "vue",
    "target": "Vue 3 with Composition API",
    "filtered": ["menu", "header", ...],
    "options": { ... }
  },
  "id": "1:100",
  "name": "Button",
  "type": "FRAME",
  "component": "Button",
  "layout": "flex-row",
  "props": { ... },
  "children": [
    {
      "id": "1:101",
      "name": "Text",
      "type": "TEXT",
      "component": "Text",
      "layout": "flex-col",
      "props": {},
      "children": []
    }
  ]
}
```

## 核心功能详解

### 1. 布局过滤

自动识别并过滤页面级布局元素：

| 元素类型 | 识别条件 | 行为 |
|----------|----------|------|
| Menu/Sidebar | x≈0, width≈siderWidth | 过滤（非白名单时） |
| Header/Navbar | y≈0, height≈headerHeight | 过滤（非白名单时） |

组件内部的菜单/头部会被保留（通过白名单机制）。

### 2. 组件白名单

以下父组件内的子元素会被保护：

- `dropdown`, `select` 中的 `menu`
- `card`, `modal`, `drawer` 中的 `header`
- `list`, `table` 中的 `item`, `row`
- 更多见 `src/config.ts`

### 3. 矢量地狱优化

检测包含多个 VECTOR 的 GROUP/FRAME，自动简化：

- 移除 `vectorPaths`, `vectorNetwork` 等大数据字段
- 扁平化深层嵌套结构
- 添加 `_isIcon` 标记供 AI 识别

**优化效果：** 数据量减少 90%+

### 4. 智能指纹采样

> **注意：** 该功能当前默认禁用。实际使用中发现保留完整结构更有利于 AI 理解组件设计。如需启用，请将 `enableFingerprintSampling` 设为 `true`。

针对 Table、List 等重复组件：

- 通过结构指纹识别相同行
- 保留所有不同结构的样本
- 跳过完全重复的行
- 特殊状态（展开、选中）始终保留

**采样标记：**

```json
{
  "_isRepresentative": true,
  "_duplicateCount": 17,
  "_note": "此结构共有 18 个相同节点",
  "_samplingInfo": {
    "method": "fingerprint",
    "totalChildren": 20,
    "preservedChildren": 3,
    "skippedChildren": 17
  }
}
```

## 项目结构

```
figma-bridge/
├── src/
│   ├── index.ts              # MCP Server 入口
│   ├── transform.ts          # 转换主入口
│   ├── types.ts              # 类型定义
│   ├── config.ts             # 默认配置
│   ├── filter.ts             # 布局过滤逻辑
│   ├── whitelist.ts          # 组件白名单系统
│   ├── vector-optimization.ts # 矢量地狱优化
│   ├── fingerprint-sampling.ts # 智能指纹采样
│   ├── node-processor.ts     # 节点处理器
│   └── meta-builder.ts       # 元信息构建器
├── dist/                     # 编译输出
├── .env                      # 环境变量
├── package.json
├── tsconfig.json
└── record.md                 # 详细修改记录
```

## 模块依赖

```
transform.ts
    ├── types.ts
    ├── config.ts
    ├── filter.ts ──────→ whitelist.ts
    ├── vector-optimization.ts
    ├── fingerprint-sampling.ts
    ├── node-processor.ts ───→ filter.ts, vector-optimization.ts, fingerprint-sampling.ts
    └── meta-builder.ts
```

## 开发

### 编译

```bash
npm run build
```

### 调试

```bash
# 使用 ts-node 直接运行
npx ts-node src/index.ts
```

## 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk`
- **语言**: TypeScript 5.9+
- **模块**: ES Module (NodeNext)
- **运行时**: Node.js 18+

## 配置参考

### 指纹采样配置

```typescript
{
  similarityThreshold: 0.95,  // 相似度阈值 (0-1)
  maxUniqueStructures: 3,      // 最大保留唯一结构数
  namePatterns: ['row', 'item', 'option'], // 启用采样的名称匹配
  preservePatterns: ['expand', 'selected', 'header-row'] // 始终保留的节点
}
```

### 矢量地狱优化配置

```typescript
{
  minVectorChildren: 3,    // 判定为图标的最小 VECTOR 数量
  maxIconSize: 200,        // 最大图标尺寸(px)
  maxNestingDepth: 3       // 最大嵌套深度
}
```

## 注意事项

1. **节点 ID 格式**: 支持 `1-16253` 或 `1:16253` 两种格式，会自动转换
2. **环境变量**: 使用 `.env` 文件配置，确保文件在正确位置
3. **深度限制**: `maxDepth` 防止深层嵌套导致数据爆炸，默认 10 层
4. **数据量**: 对于大型设计，矢量优化默认启用；指纹采样默认禁用，如需压缩 Table/List 重复结构可手动启用

## License

ISC

## 相关文档

- [record.md](./record.md) - 详细修改记录和开发历史
- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Figma API 文档](https://www.figma.com/developers/api)
