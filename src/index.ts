import 'dotenv/config';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMockModel } from './mock-model';
import { createInterface } from 'node:readline';
import { weatherTool, calculatorTool } from './tools';
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


function ask() {
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
      system: `你是 Super Agent，一个专注于软件开发的 AI 助手。
你说话简洁直接，喜欢用代码示例来解释问题。
如果用户的问题不够清晰，你会反问而不是瞎猜。`,
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

console.log('Super Agent v0.1 (type "exit" to quit)\n');
ask();

