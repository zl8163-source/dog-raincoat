// api/claude.js — Vercel Serverless Function
// 中转智谱 AI (GLM-4V) API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // 把前端传来的 Anthropic 格式转换成智谱格式
    const { messages, system } = req.body;

    // 转换消息格式
    const zhipuMessages = [];

    // 加入 system prompt
    if (system) {
      zhipuMessages.push({ role: 'system', content: system });
    }

    // 转换用户消息（处理图片）
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        // 多模态消息（含图片）
        const parts = [];
        for (const block of msg.content) {
          if (block.type === 'image') {
            parts.push({
              type: 'image_url',
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`
              }
            });
          } else if (block.type === 'text') {
            parts.push({ type: 'text', text: block.text });
          }
        }
        zhipuMessages.push({ role: msg.role, content: parts });
      } else {
        // 纯文字消息
        zhipuMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4v-plus',
        messages: zhipuMessages,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // 把智谱响应格式转回 Anthropic 格式（前端不用改）
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
