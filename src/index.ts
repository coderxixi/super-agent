import 'dotenv/config';
import { streamText, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMockModel } from './mock-model';
import { createInterface } from 'node:readline';
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
      model,
      system: `你是 Super Agent，一个专注于软件开发的 AI 助手。
你说话简洁直接，喜欢用代码示例来解释问题。
如果用户的问题不够清晰，你会反问而不是瞎猜。`,
      messages,
    });

    process.stdout.write('Assistant: ');
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    console.log(); // 换行

    messages.push({ role: 'assistant', content: fullResponse });

    ask();
  });
}

console.log('Super Agent v0.1 (type "exit" to quit)\n');
ask();

