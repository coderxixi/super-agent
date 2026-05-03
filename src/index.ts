import 'dotenv/config';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMockModel } from './mock-model';
import { createInterface } from 'node:readline';
import { weatherTool, calculatorTool } from './tools';
import { agentLoop } from './agent-loop.js';
//工具列表
const tools = { get_weather: weatherTool, calculator: calculatorTool };
//创建模型
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.DASHSCOPE_API_KEY,
});

const model = process.env.DASHSCOPE_API_KEY
  ? qwen.chat('qwen-plus-latest')
  : createMockModel();
// 创建了一个问答管理器
const rl = createInterface({
  input: process.stdin,//“盯着键盘看，用户敲的字都从这里进来”
  output: process.stdout,//“说完话后，把字打印到这个屏幕上”（就像对着屏幕这个喇叭说话）。
});

const messages: ModelMessage[] = [];
const SYSTEM = `你是 Super Agent，一个有工具调用能力的 AI 助手。
需要查询信息时，主动使用工具，不要编造数据。
回答要简洁直接。`;


//方案-使用SDK
function ask1() {
  rl.question('\nYou: ', async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'exit') {
      console.log('Bye!');
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: trimmed });

    const result = streamText({
      tools,
      model,
      system: SYSTEM,
      messages,
      stopWhen: stepCountIs(5), // 最多跑 5 步
    });

    process.stdout.write('Assistant: ');
    let fullResponse = '';
    //使用SDK自动循环
    for await (const part of result.fullStream) {
      switch (part.type) {
        //文本片段（跟 textStream 一样）
        case 'text-delta':
          process.stdout.write(part.text);
          fullResponse += part.text;
          break;
        //模型决定调用某个工具，包含工具名和参数
        case 'tool-call':
          console.log(`\n  [调用工具: ${part.toolName}(${JSON.stringify(part.input)})]`);
          break;
        //工具执行完毕，包含返回值
        case 'tool-result':
          console.log(`  [工具返回: ${JSON.stringify(part.output)}]`);
          break;
      }
    }
    console.log(); // 换行

    messages.push({ role: 'assistant', content: fullResponse });

    ask();
  });
}



//方案二：手动循环
function ask() {
  rl.question('\nYou: ', async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === 'exit') {
      console.log('Bye!');
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: trimmed });

    await agentLoop(model, tools, messages, SYSTEM);

    ask();
  });
}

console.log('Super Agent v0.3 — Fuses (type "exit" to quit)\n');
console.log('试试输入："测试死循环"、"测试重试" 或随便聊几轮观察 Token 用量\n');
ask();


