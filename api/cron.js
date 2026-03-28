/**
 * 日日一詩 — 每日推播 Cron Job (Vercel Cron)
 *
 * 透過 Vercel Cron 每天早上 8 點（台北時間）觸發
 * 使用 LINE Messaging API 的 broadcast 對所有好友推播今日詩
 */

const { getTodayPoem } = require('../lib/poems');

const DIVIDER = '─'.repeat(16);

function formatPoemBroadcast(poem) {
  const bodyText = Array.isArray(poem.body) ? poem.body.join('\n') : poem.body;
  return [
    {
      type: 'text',
      text: `📖 今日一詩\n${DIVIDER}\n\n${poem.title}\n${poem.author}\n\n${bodyText}\n\n${DIVIDER}\n\n💭 ${poem.note}`,
    },
    {
      type: 'text',
      text: `🌿 呼吸提醒\n\n花一分鐘，試試方塊呼吸法：\n\n吸氣 4 秒 → 屏息 4 秒\n吐氣 4 秒 → 屏息 4 秒\n\n重複 3 次，感受身體的放鬆。\n\n願文字成為你的呼吸 ✨`,
    },
  ];
}

module.exports = async (req, res) => {
  // 驗證是否為 Vercel Cron 呼叫
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Cron 驗證失敗');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const poem = getTodayPoem();
  const messages = formatPoemBroadcast(poem);

  console.log(`🌅 每日推播 — ${poem.title}（${poem.author}）`);

  try {
    // 使用 broadcast API 對所有好友推播
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE broadcast 失敗:', error);
      return res.status(500).json({ error: 'Broadcast failed', detail: error });
    }

    console.log('✨ 推播完成');
    return res.status(200).json({
      ok: true,
      poem: poem.title,
      author: poem.author,
      broadcastAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('推播錯誤:', err);
    return res.status(500).json({ error: err.message });
  }
};
