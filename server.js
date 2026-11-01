const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// ĐÃ GẮN SẴN CHO SÁNG - PAGE LITTLE SOUL WISDOM
const PAGE_ID = '107388517817542';
const PAGE_ACCESS_TOKEN = 'EAIZCKwLI4fVEBS5f2qOuW7vMqhKqxdnwoSn70W4LTHG14MZAWXIqckZBPTzfE7DsDsZCX0S2YiXQK7Jn8uGdZC6cdIK5vzuAiJyyrkd9dwzyISFC9OOV0DJT5bEP85kTjXYHFqdXgk6q7BflMNbQGShe4aKWheUdrAZBMefVW90AFRM8CwkSXve42i7ZAjGeRKbk9SG7QZAxpq2SbPcINplH45ZBYFAdV8ZBiW5d2BWAZDZD';
const VERIFY_TOKEN = 'sang_verify_123';

let commentsCache = [];
let logsCache = [];

function log(msg) {
  const time = new Date().toLocaleTimeString('vi-VN');
  const entry = `[${time}] ${msg}`;
  logsCache.unshift(entry);
  if (logsCache.length > 50) logsCache.pop();
  console.log(entry);
}

function kiemSangBinhLuan(text) {
  if (!text) return { isSpam: false, score: 0 };
  const blacklist = ['vay von','vay vốn','telegram','t.me','trung thuong','trúng thưởng','co bac','cờ bạc','mua coin','buy follow','vay tien','duyệt 15p','link rác'];
  const lower = text.toLowerCase();
  let score = 0;
  let reason = '';
  for (let w of blacklist) {
    if (lower.includes(w)) { score += 40; reason = w; }
  }
  if (/(.)\1{4,}/.test(text)) score += 20;
  return { isSpam: score >= 30, score: Math.min(score, 98), reason };
}

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    log('Webhook verified by Facebook!');
    res.send(req.query['hub.challenge']);
  } else {
    res.send('Error, wrong token');
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    
    if (change && change.field === 'feed') {
      const v = change.value;
      if (v.item === 'comment') {
        const check = kiemSangBinhLuan(v.message);
        log(`REAL-TIME: Comment mới từ ${v.from?.name}: "${v.message}" - Spam: ${check.isSpam} (${check.score}%)`);
        
        const newComment = {
          id: v.comment_id,
          message: v.message,
          from: v.from,
          post_id: v.post_id,
          created_time: new Date().toISOString(),
          spam: check.isSpam,
          spamScore: check.score,
          reason: check.reason
        };
        commentsCache.unshift(newComment);
        
        if (check.isSpam) {
          try {
            await axios.post(`https://graph.facebook.com/v19.0/${v.comment_id}/?is_hidden=true&access_token=${PAGE_ACCESS_TOKEN}`);
            log(`Đã tự động ẩn spam: ${v.comment_id}`);
          } catch (e) { log(`Lỗi ẩn: ${e.response?.data?.error?.message || e.message}`); }
        } else {
          if (v.message.toLowerCase().includes('còn hàng') || v.message.toLowerCase().includes('giá') || v.message.toLowerCase().includes('mua')) {
            setTimeout(async () => {
              try {
                await axios.post(`https://graph.facebook.com/v19.0/${v.comment_id}/comments`, {
                  message: `Chào ${v.from?.name || 'bạn'} ạ, cảm ơn bạn đã quan tâm Page Little Soul Wisdom. Shop đã inbox tư vấn rồi ạ! ❤️`,
                  access_token: PAGE_ACCESS_TOKEN
                });
                log(`Đã tự động trả lời: ${v.comment_id}`);
              } catch (e) { log(`Lỗi trả lời: ${e.response?.data?.error?.message || e.message}`); }
            }, 4000);
          }
        }
      }
    }
    if (entry?.messaging) {
      log(`Tin nhắn Messenger mới từ ${entry.messaging[0]?.sender?.id}`);
    }
  } catch (e) {
    log(`Lỗi webhook: ${e.message}`);
  }
  res.sendStatus(200);
});

app.get('/api/comments', (req, res) => {
  res.json({ page: 'Little Soul Wisdom', page_id: PAGE_ID, data: commentsCache, logs: logsCache });
});

app.get('/api/posts', async (req, res) => {
  try {
    const r = await axios.get(`https://graph.facebook.com/v19.0/${PAGE_ID}/posts?fields=id,message,created_time,comments{id,message,from,created_time,like_count}&limit=5&access_token=${PAGE_ACCESS_TOKEN}`);
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get('/', (req, res) => {
  res.send(`
    <h1>✅ Sang Comment Guard - ĐÃ GẮN ĂNG-TEN!</h1>
    <p><b>Page:</b> Little Soul Wisdom (${PAGE_ID})</p>
    <p><b>Trạng thái:</b> Đã kết nối Token thật - Sẵn sàng real-time</p>
    <p><b>Webhook URL:</b> /webhook (dùng để dán vào Facebook Developers)</p>
    <p><b>Xem comment thật:</b> <a href="/api/comments">/api/comments</a></p>
    <p><b>Xem bài viết:</b> <a href="/api/posts">/api/posts</a></p>
    <hr>
    <h3>Logs real-time:</h3>
    <pre>${logsCache.join('\n') || 'Chưa có log - Hãy comment thử vào Page!'}</pre>
    <script>setTimeout(()=>location.reload(), 5000)</script>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`Server Sáng đã chạy! Port ${PORT} - ĐÃ GẮN ĂNG-TEN CHO PAGE ${PAGE_ID}`);
  log(`Webhook URL: /webhook - Verify Token: ${VERIFY_TOKEN}`);
});
