import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { transformToDSL } from './transform.js';

// 获取当前文件目录（ES Module 兼容方式）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从项目根目录加载 .env 文件（无论从哪里启动服务器）
config({ path: resolve(__dirname, '../.env') });

// 验证环境变量
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FILE_KEY;

if (!FIGMA_TOKEN) {
    console.error('错误: 环境变量 FIGMA_TOKEN 未设置');
    console.error('请在 .env 文件中添加 FIGMA_TOKEN=你的_token');
    process.exit(1);
}

if (!FILE_KEY) {
    console.error('错误: 环境变量 FILE_KEY 未设置');
    console.error('请在 .env 文件中添加 FILE_KEY=你的_file_key');
    process.exit(1);
}

// --- 步骤 2：初始化 Server ---
const server = new McpServer({
    name: "figma-bridge",
    version: "1.0.0",
});

// --- 步骤 3：定义工具，并调用转换函数 ---
server.tool(
    "get-figma-node",
    "获取Figma节点的结构化数据，用于生成Vue 3组件代码（Composition API + TypeScript）。支持图表识别，自动检测ECharts/G6图表并提取数据。",
    {
        nodeId: z.string().describe("Figma节点的ID"),
        filterNames: z.array(z.string()).optional().describe("要过滤掉的节点名称列表（大小写不敏感），默认会过滤Menu、Header、菜单等"),
        useDefaultFilter: z.boolean().optional().default(true).describe("是否启用默认过滤（过滤Menu、Header等常见布局组件）"),
        framework: z.enum(['vue', 'react', 'html']).optional().default('vue').describe("目标框架"),
        siderWidth: z.number().optional().default(220).describe("左侧菜单栏宽度阈值（默认220px），用于判断左侧菜单区域"),
        headerHeight: z.number().optional().default(64).describe("顶部头部高度阈值（默认64px），用于判断顶部header区域"),
        maxDepth: z.number().optional().default(10).describe("最大递归深度（默认10层），防止深层嵌套导致数据量过大"),
        enableFingerprintSampling: z.boolean().optional().default(false).describe("是否启用智能指纹采样（默认禁用），用于压缩Table、List等重复组件的数据量"),
        fingerprintConfig: z.object({
            similarityThreshold: z.number().optional().describe("指纹相似度阈值（0-1，默认0.95），高于此阈值视为相同结构"),
            maxUniqueStructures: z.number().optional().describe("最大保留的唯一结构数（默认3）"),
        }).optional().describe("指纹采样配置选项"),
        enableChartDetection: z.boolean().optional().default(true).describe("是否启用图表识别（默认启用），自动检测图表类型并提取数据用于ECharts/G6生成"),
        chartConfig: z.object({
            minDataPoints: z.number().optional().describe("最少数据点数量才视为图表（默认3）"),
            confidenceThreshold: z.number().optional().describe("图表识别置信度阈值（0-1，默认0.6）"),
        }).optional().describe("图表检测配置选项")
    },
    async ({ nodeId, filterNames = [], useDefaultFilter = true, framework = 'vue', siderWidth = 220, headerHeight = 64, maxDepth = 10, enableFingerprintSampling = false, fingerprintConfig = {}, enableChartDetection = true, chartConfig = {} }: { nodeId: string, filterNames?: string[], useDefaultFilter?: boolean, framework?: 'vue' | 'react' | 'html', siderWidth?: number, headerHeight?: number, maxDepth?: number, enableFingerprintSampling?: boolean, fingerprintConfig?: any, enableChartDetection?: boolean, chartConfig?: any }) => {
        try {
            // 标准化节点ID：将连字符替换为冒号（Figma标准格式）
            const normalizedNodeId = nodeId.replace(/-/g, ':');

            const response = await fetch(
                `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(normalizedNodeId)}`,
                {
                    headers: { "X-Figma-Token": FIGMA_TOKEN }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Figma API 请求失败 (${response.status}): ${errorText}`);
            }

            const data = await response.json() as { nodes: Record<string, { document: any }> };

            // 验证返回数据
            if (!data.nodes || !data.nodes[normalizedNodeId]) {
                throw new Error(`未找到节点: ${nodeId} (标准化后: ${normalizedNodeId})。请检查节点ID是否正确，以及该节点是否存在于文件 ${FILE_KEY} 中。`);
            }

            const nodeData = data.nodes[normalizedNodeId].document;
            if (!nodeData) {
                throw new Error(`节点 ${nodeId} 没有 document 数据`);
            }

            const dsl = transformToDSL(nodeData, {
                framework,
                filterNames,
                useDefaultFilter,
                siderWidth,
                headerHeight,
                maxDepth,
                enableFingerprintSampling,
                fingerprintConfig,
                enableChartDetection,
                chartConfig
            });

            return {
                content: [{ type: "text", text: JSON.stringify(dsl, null, 2) }],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: JSON.stringify({ error: errorMessage }, null, 2) }],
                isError: true
            };
        }
    }
);

// --- 步骤 4：连接 ---
const transport = new StdioServerTransport();
await server.connect(transport);
