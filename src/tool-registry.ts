import { jsonSchema } from 'ai';
import type { MCPClient, MockMCPClient } from './mcp-client.js';
export interface ToolDefinition {
  name: string;// 工具名字，Agent 用这个名字来调用
  description: string;// 给模型看的说明书，"这个工具能干嘛"
  parameters: Record<string, unknown>;// 参数规则，比如"读文件需要传 path"
  isConcurrencySafe?: boolean;// 能不能和其他工具一起跑（并发安全）
  isReadOnly?: boolean;  // 会不会改东西（只读还是读写）
  maxResultChars?: number; // 返回结果最多多长
  execute: (input: any) => Promise<unknown>;// 真正干活的方法
}

const DEFAULT_MAX_RESULT_CHARS = 3000;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  private exclusiveLock = false;
  private concurrentCount = 0;
  private waitQueue: Array<() => void> = [];
  private mcpClients: Array<MCPClient | MockMCPClient> = [];
  // 注册工具
  register(...tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }
  async registerMCPServer(
    serverName: string,
    client: MCPClient | MockMCPClient,
  ): Promise<string[]> {
    await client.connect();
    this.mcpClients.push(client);

    const tools = await client.listTools();
    const registered: string[] = [];

    for (const tool of tools) {
      const prefixedName = `mcp__${serverName}__${tool.name}`;

      if (this.tools.has(prefixedName)) continue;

      const toolClient = client;
      const originalName = tool.name;

      this.register({
        name: prefixedName,
        description: `[MCP:${serverName}] ${tool.description}`,
        parameters: tool.inputSchema as Record<string, unknown>,
        isConcurrencySafe: true,
        isReadOnly: true,
        maxResultChars: 3000,
        execute: async (input: any) => {
          return toolClient.callTool(originalName, input);
        },
      });

      registered.push(prefixedName);
    }

    return registered;
  }

  async closeAllMCP(): Promise<void> {
    for (const client of this.mcpClients) {
      await client.close();
    }
    this.mcpClients = [];
  }

  // 按名字查找
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  // 获取所有工具
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  private async acquireConcurrent(): Promise<void> {
    while (this.exclusiveLock) {
      await new Promise<void>(r => this.waitQueue.push(r));
    }
    this.concurrentCount++;
  }

  private releaseConcurrent(): void {
    this.concurrentCount--;
    if (this.concurrentCount === 0) this.drainQueue();
  }

  private async acquireExclusive(): Promise<void> {
    while (this.exclusiveLock || this.concurrentCount > 0) {
      await new Promise<void>(r => this.waitQueue.push(r));
    }
    this.exclusiveLock = true;
  }

  private releaseExclusive(): void {
    this.exclusiveLock = false;
    this.drainQueue();
  }

  private drainQueue(): void {
    const waiting = this.waitQueue.splice(0);
    for (const resolve of waiting) resolve();
  }
  // 转成 AI SDK 能吃的格式
  toAISDKFormat(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, tool] of this.tools) {
      const maxChars = tool.maxResultChars;
      const executeFn = tool.execute;
      const isSafe = tool.isConcurrencySafe === true;
      const registry = this;

      result[name] = {
        description: tool.description,
        inputSchema: jsonSchema(tool.parameters as any),
        execute: async (input: any) => {
          if (isSafe) {
            await registry.acquireConcurrent();
            console.log(`  [并发] ${name} 获取共享锁`);
          } else {
            await registry.acquireExclusive();
            console.log(`  [串行] ${name} 获取独占锁，等待其他工具完成`);
          }
          try {
            const raw = await executeFn(input);
            const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
            return truncateResult(text, maxChars);
          } finally {
            if (isSafe) {
              registry.releaseConcurrent();
            } else {
              registry.releaseExclusive();
            }
          }
        },
      };
    }
    return result;
  }
}

export function truncateResult(text: string, maxChars: number = DEFAULT_MAX_RESULT_CHARS): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = maxChars - headSize;
  const head = text.slice(0, headSize);
  const tail = text.slice(-tailSize);
  const dropped = text.length - headSize - tailSize;

  return `${head}\n\n... [省略 ${dropped} 字符] ...\n\n${tail}`;
}
