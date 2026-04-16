/**
 * 工具定义模块
 * 将普通的 JavaScript 对象转换成大模型能听懂的严格格式说明书（JSON Schema），
 * 使 AI Agent 能够理解并正确调用这些工具。
 */
import { jsonSchema } from "ai";

/**
 * 天气查询工具
 * 用于查询指定城市的天气信息，当前使用模拟数据
 *
 * @description 查询指定城市的天气信息
 * @param city - 要查询的城市名称
 * @returns 对应城市的天气描述字符串
 */
export const weatherTool = {
  description: "查询指定城市的天气信息",
  inputSchema: jsonSchema({
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "要查询的城市名称",
      },
    },
    // required 未指定时默认所有字段可选
  }),
  execute: async ({ city }: { city: string }) => {
    // TODO: 替换为真实天气 API（如和风天气、OpenWeatherMap 等）
    const mockWeather: Record<string, string> = {
      北京: "晴，15-25°C，东南风 2 级",
      上海: "多云，18-22°C，西南风 3 级",
      深圳: "阵雨，22-28°C，南风 2 级",
    };
    return mockWeather[city] || `${city}：暂无数据`;
  },
};

/**
 * 数学计算器工具
 * 用于解析并计算数学表达式，适用于用户提问涉及数学运算的场景
 *
 * @description 计算数学表达式的结果。当用户提问涉及数学运算时使用
 * @expression - 数学表达式，支持基本运算符（+、-、*、/ 等）
 * @returns 包含表达式和计算结果的字符串
 *
 * @warning 当前使用 new Function 执行表达式，生产环境应替换为安全的数学表达式解析库（如 mathjs）
 */
export const calculatorTool = {
  description: "计算数学表达式的结果。当用户提问涉及数学运算时使用",
  inputSchema: jsonSchema({
    type: "object",
    properties: {
      expression: { type: "string", description: "数学表达式，如 \"2 + 3 * 4\"" },
    },
    required: ["expression"],
    additionalProperties: false, // 严格模式：拒绝额外字段
  }),
  execute: async ({ expression }: { expression: string }) => {
    try {
      // ⚠️ 安全提示：new Function 存在代码注入风险，仅用于演示/学习场景
      // 生产环境建议使用 math.js、expr-eval 等安全替代方案
      const result = new Function(`return ${expression}`)();
      return `${expression} = ${result}`;
    } catch {
      return `无法计算: ${expression}`;
    }
  },
};

