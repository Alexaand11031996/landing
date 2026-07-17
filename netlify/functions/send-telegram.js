exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
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
        remoteip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '',
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
