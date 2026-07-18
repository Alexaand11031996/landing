const { schedule } = require('@netlify/functions');

const SITE_URL = 'https://karmazin.netlify.app/';

async function runCheck() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const startedAt = Date.now();
  let statusText;
  try {
    const res = await fetch(SITE_URL);
    const ms = Date.now() - startedAt;
    statusText = res.ok
      ? `✅ Сайт живий (HTTP ${res.status}), ${ms}мс`
      : `⚠️ Сайт відповів з помилкою (HTTP ${res.status}), ${ms}мс`;
  } catch (error) {
    statusText = `🔴 Сайт НЕДОСТУПНИЙ: ${error.message}`;
  }

  const text = `Перевірка сайту (${new Date().toISOString()}):\n${statusText}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

exports.handler = schedule('0 */4 * * *', async () => {
  await runCheck();
  return { statusCode: 200 };
});
