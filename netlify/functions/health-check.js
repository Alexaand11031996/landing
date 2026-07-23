const { schedule } = require('@netlify/functions');

const SITE_URL = 'https://karmazin.space/';

async function runCheck() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  let problemText = null;
  try {
    const res = await fetch(SITE_URL);
    if (!res.ok) {
      problemText = `⚠️ Сайт відповів з помилкою (HTTP ${res.status})`;
    }
  } catch (error) {
    problemText = `🔴 Сайт НЕДОСТУПНИЙ: ${error.message}`;
  }

  if (!problemText) return;

  const text = `Проблема із сайтом (${new Date().toISOString()}):\n${problemText}`;

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
