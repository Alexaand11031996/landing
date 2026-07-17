exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');
    const telegramId = String(body.telegramId || '').trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = telegramId || String(process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token || !chatId) {
      return { statusCode: 500, body: 'Telegram credentials are not configured' };
    }
    if (!telegramId && !process.env.TELEGRAM_CHAT_ID) {
      return { statusCode: 400, body: 'telegramId not provided in CMS and no fallback chat ID is configured' };
    }

    const text = `Нова заявка:\nІм'я: ${body.name || '-'}\nТелефон: ${body.phone || '-'}\nДата: ${body.date || '-'}\nНотатка: ${body.note || '-'}\nTelegram ID від CMS: ${telegramId || '(fallback)'}`;
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

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: String(error.message) };
  }
};
