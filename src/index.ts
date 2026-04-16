/*
 * @Author: coderxixi 976344695@qq.com
 * @Date: 2026-04-16 09:57:47
 * @LastEditors: coderxixi 976344695@qq.com
 * @LastEditTime: 2026-04-16 13:40:42
 * @FilePath: /super-agent/src/index.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import 'dotenv/config';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMockModel } from './mock-model';
const qwen = createOpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.DASHSCOPE_API_KEY,
});

const model = process.env.DASHSCOPE_API_KEY
  ? qwen.chat('qwen-plus-latest')
  : createMockModel();

async function main() {
  const { text } = await generateText({
    model,
    prompt: '用一句话介绍你自己',
  });

  console.log(text);
}

main();
