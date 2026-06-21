import { BACKEND_API_KEY } from '../config/apiConfig.js'
import { systemPrompt, userPromptTemplate } from '../config/promptConfig.js'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export function hasApiKey() {
  return !!BACKEND_API_KEY && BACKEND_API_KEY !== 'your-api-key-here'
}

/**
 * AI 排版：调用 DeepSeek 将 Markdown 转为公众号 HTML
 * @param {string} text - 原始 Markdown 文本
 * @returns {Promise<string>} - 排版后的 HTML 字符串
 */
export async function formatWithAI(text) {
  const userPrompt = userPromptTemplate.replace('{{text}}', text)
  const client = new DeepSeekTypesetClient()
  return await client.requestTypeset(systemPrompt, userPrompt)
}

export class DeepSeekTypesetError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'DeepSeekTypesetError'
    this.code = code
  }
}

export class DeepSeekTypesetClient {
  constructor() {
    this.apiKey = BACKEND_API_KEY
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey !== 'your-api-key-here'
  }

  async requestTypeset(systemPrompt, userPrompt) {
    if (!this.hasApiKey()) {
      throw new DeepSeekTypesetError('API Key 未配置，请在 config/apiConfig.js 中设置', 'NO_KEY')
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 401) {
        throw new DeepSeekTypesetError('API Key 无效或已过期，请检查配置', 'AUTH_FAIL')
      } else if (status === 429) {
        throw new DeepSeekTypesetError('请求过于频繁，请稍后重试', 'RATE_LIMIT')
      } else {
        throw new DeepSeekTypesetError(`API 请求失败 (${status})，请重试`, 'API_ERROR')
      }
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new DeepSeekTypesetError('API 返回格式异常', 'PARSE_ERROR')
    }

    return data.choices[0].message.content
  }
}
