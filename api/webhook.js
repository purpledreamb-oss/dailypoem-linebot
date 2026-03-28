/**
 * 日日一詩 — LINE Bot Webhook (Vercel Serverless)
 *
 * Vercel Serverless Function 處理 LINE Webhook 事件
 */

const crypto = require('crypto');
const { getTodayPoem, poems, getRandomPoem } = require('../lib/poems');

// ===== LINE API Helper =====
async function callLineAPI(endpoint, body) {
  const res = await fetch(`https://api.line.me/v2/bot/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`LINE API Error [${endpoint}]:`, error);
  }
  return res;
}

function replyMessage(replyToken, messages) {
  return callLineAPI('message/reply', { replyToken, messages });
}

// ===== 驗證 LINE Signature =====
function validateSignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// ===== 格式化訊息 =====
const DIVIDER = '─'.repeat(16);
const PUSH_HOUR = process.env.PUSH_HOUR || 8;

function formatPoemMessage(poem) {
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

function formatRandomPoemMessage() {
  const poem = getRandomPoem();
  const bodyText = Array.isArray(poem.body) ? poem.body.join('\n') : poem.body;
  return [
    {
      type: 'text',
      text: `🎲 隨機一詩\n${DIVIDER}\n\n${poem.title}\n${poem.author}\n\n${bodyText}\n\n${DIVIDER}\n\n💭 ${poem.note}`,
    },
  ];
}

function getHelpMessage() {
  return [
    {
      type: 'text',
      text: `📖 日日一詩 使用指南\n${DIVIDER}\n\n傳送以下文字來互動：\n\n✦「今日」— 查看今天的詩\n✦「隨機」— 隨機抽一首詩\n✦「呼吸」— 呼吸練習引導\n✦「說明」— 查看使用指南\n\n每天早上 ${PUSH_HOUR} 點\n會自動推送一首詩給你 🌅`,
    },
  ];
}

function getBreatheMessage() {
  return [
    {
      type: 'text',
      text: `🌿 方塊呼吸練習\n${DIVIDER}\n\n找一個舒服的姿勢，開始：\n\n1️⃣ 吸氣（數 1、2、3、4）\n   讓空氣慢慢充滿\n\n2️⃣ 屏息（數 1、2、3、4）\n   穩穩地停在這裡\n\n3️⃣ 吐氣（數 1、2、3、4）\n   輕輕地放掉一切\n\n4️⃣ 屏息（數 1、2、3、4）\n   安靜地等待下一次\n\n🔁 重複 3–5 次\n\n你做得很好。\n此刻，你只需要呼吸。✨`,
    },
  ];
}

// ===== 處理使用者訊息 =====
async function handleMessage(event) {
  const text = event.message.text?.trim();
  if (!text) return;

  switch (text) {
    case '今日':
    case '今天':
    case '今日的詩':
      return replyMessage(event.replyToken, formatPoemMessage(getTodayPoem()));

    case '隨機':
    case '再一首':
    case '抽詩':
      return replyMessage(event.replyToken, formatRandomPoemMessage());

    case '呼吸':
    case '放鬆':
      return replyMessage(event.replyToken, getBreatheMessage());

    case '說明':
    case '幫助':
    case '選單':
    case 'help':
    case '開始':
    case '訂閱':
    case '啟用':
      return replyMessage(event.replyToken, getHelpMessage());

    default:
      return replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `謝謝你的文字 🍂\n\n試試傳「今日」看今天的詩\n或傳「呼吸」來一段放鬆練習\n\n（傳「說明」查看完整功能）`,
        },
      ]);
  }
}

// ===== 處理追蹤事件 =====
async function handleFollow(event) {
  return replyMessage(event.replyToken, [
    {
      type: 'text',
      text: `🌿 歡迎來到「日日一詩」\n\n這裡，每天有一首詩等著你\n還有一段呼吸的時光\n\n傳送「今日」立即閱讀今天的詩\n傳送「隨機」抽一首隨機的詩\n傳送「呼吸」來一段放鬆練習\n\n願文字成為你的呼吸 ✨`,
    },
  ]);
}

// ===== Vercel Serverless Handler =====
module.exports = async (req, res) => {
  // GET 請求 — 健康檢查
  if (req.method === 'GET') {
    return res.status(200).json({
      name: '日日一詩 LINE Bot',
      status: 'running',
      poemCount: poems.length,
      todayPoem: getTodayPoem().title,
    });
  }

  // 只接受 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 取得 raw body 用於驗簽
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // 驗證 LINE 簽章
  const signature = req.headers['x-line-signature'];
  if (!validateSignature(rawBody, signature)) {
    console.error('❌ 簽章驗證失敗');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const events = body.events || [];

  // 處理所有事件
  const results = await Promise.allSettled(
    events.map(async (event) => {
      switch (event.type) {
        case 'message':
          if (event.message.type === 'text') {
            return handleMessage(event);
          }
          break;
        case 'follow':
          return handleFollow(event);
        default:
          break;
      }
    })
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Event ${i} failed:`, result.reason);
    }
  });

  return res.status(200).json({ ok: true });
};
