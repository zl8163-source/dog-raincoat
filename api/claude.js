// api/claude.js — Vercel Serverless Function
// 智谱 AI (GLM-4V) 分析 + CogView 生成图片

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { type, messages, system, prompt } = req.body;

  // ── 图片生成模式 ──────────────────────────────────────────────
  if (type === 'image') {
    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'cogview-3-flash',
          prompt: prompt,
          size: '1024x1024',
          n: 1
        })
      });

      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);

      const imageUrl = data.data?.[0]?.url || '';
      return res.status(200).json({ imageUrl });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 视觉分析模式 ──────────────────────────────────────────────
  try {
    const zhipuMessages = [];

    if (system) {
      zhipuMessages.push({ role: 'system', content: system });
    }

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
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
    if (!response.ok) return res.status(response.status).json(data);

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
