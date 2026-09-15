'use strict';

const PROVIDERS = Object.freeze({ gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' });
const timeoutMs = () => Math.min(Number(process.env.EXTERNAL_API_TIMEOUT_MS || 20000), 20000);

function config(provider) {
  const keyName = PROVIDERS[provider];
  if (!keyName) throw new Error('AI_PROVIDER_UNSUPPORTED');
  const key = process.env[keyName];
  if (!key || /^your-|^replace-|^xxx/i.test(key)) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  return { provider, key, model: process.env[`${provider.toUpperCase()}_MODEL`] || (provider === 'gemini' ? 'gemini-2.0-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-latest') };
}

async function request(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try { const response = await fetch(url, { ...options, signal: controller.signal }); const text = await response.text(); if (!response.ok) throw new Error(`AI_UPSTREAM_${response.status}`); return JSON.parse(text); }
  finally { clearTimeout(timer); }
}

async function complete(provider, messages, options = {}) {
  const cfg = config(provider);
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('AI_MESSAGES_REQUIRED');
  if (provider === 'openai') {
    const data = await request('https://api.openai.com/v1/responses', { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${cfg.key}`}, body:JSON.stringify({ model:cfg.model, input:messages, max_output_tokens:Math.min(options.maxTokens || 1024, 2048) }) });
    return { provider, model:cfg.model, text:data.output_text || '' };
  }
  if (provider === 'anthropic') {
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const body = { model:cfg.model, max_tokens:Math.min(options.maxTokens || 1024, 2048), messages:messages.filter(m => m.role !== 'system').map(m => ({ role:m.role === 'assistant' ? 'assistant' : 'user', content:String(m.content) })) };
    if (system) body.system = system;
    const data = await request('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'content-type':'application/json','x-api-key':cfg.key,'anthropic-version':'2023-06-01'}, body:JSON.stringify(body) });
    return { provider, model:cfg.model, text:(data.content || []).map(x => x.text || '').join('') };
  }
  const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.key)}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ contents:messages.filter(m => m.role !== 'system').map(m => ({ role:m.role === 'assistant' ? 'model' : 'user', parts:[{ text:String(m.content) }] })) }) });
  return { provider, model:cfg.model, text:data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '' };
}

module.exports = { PROVIDERS, config, complete };
