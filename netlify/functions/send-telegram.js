const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

async function checkRateLimit(ip) {
  if (!ip) return true;
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('rate-limit');
    const key = 'booking:' + ip;
    const now = Date.now();
    const raw = await store.get(key, { type: 'json' });
    let timestamps = Array.isArray(raw) ? raw.filter(t => now - t < RATE_LIMIT_WINDOW_MS) : [];
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return false;
    }
    timestamps.push(now);
    await store.setJSON(key, timestamps);
    return true;
  } catch (error) {
    console.error('Rate limit check failed, allowing request:', error);
    return true;
  }
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '';
    const allowed = await checkRateLimit(clientIp);
    if (!allowed) {
      return { statusCode: 429, body: JSON.stringify({ ok: false, error: 'Too many requests, try again later' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

    if (!token || !chatId || !turnstileSecret) {
      return { statusCode: 500, body: 'Telegram credentials are not configured' };
    }

    const turnstileToken = String(body.turnstileToken || '').trim();
    if (!turnstileToken) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Captcha verification required' }) };
    }

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: turnstileSecret,
        response: turnstileToken,
        remoteip: clientIp,
      }),
    });
    const verifyResult = await verifyRes.json();
    if (!verifyResult.success) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Captcha verification failed' }) };
    }

    const text = `Нова заявка:\nІм'я: ${body.name || '-'}\nТелефон: ${body.phone || '-'}\nДата: ${body.date || '-'}\nНотатка: ${body.note || '-'}`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.description || 'Telegram API error');
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Failed to send notification' }) };
  }
};
