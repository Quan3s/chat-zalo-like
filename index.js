const express = require('express');
const { StreamChat } = require('stream-chat');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const apiKey = 'bkzgy39gxa2u';
const apiSecret = 'qtxgafghgchqev9r69x6an6duwr9c7ymf68jmphvp8h6n7dc3v4q6qp2rbna8qqd';
const serverClient = StreamChat.getInstance(apiKey, apiSecret);

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

app.use(express.static('public'));
app.use(express.json());

// --- PORTAL V2: AUTH & SECURITY ---
app.post('/v2/portal-toc', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });

    try {
        const storedPassword = await redisClient.get(`user:pwd:${username}`);
        
        if (storedPassword && storedPassword !== password) {
            return res.status(401).json({ error: 'Sai mật khẩu sếp ơi!' });
        }
        
        // Đăng ký nếu chưa có
        if (!storedPassword) {
            await redisClient.set(`user:pwd:${username}`, password);
        }

        await serverClient.upsertUser({ id: username, name: username });
        const token = serverClient.createToken(username);
        const sessionId = `sess_${username}_${Date.now()}`;

        // Session sống 1h, Data xác thực sống vĩnh viễn
        await redisClient.setEx(sessionId, 3600, username);

        res.json({ status: 'success', username, token, sessionId });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi Portal' });
    }
});

// --- TỰ ĐỘNG HỦY TIN NHẮN (7 NGÀY) ---
// Chạy ngầm mỗi 24h để quét các channel cũ
setInterval(async () => {
    const filter = { type: 'messaging', last_message_at: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    const channels = await serverClient.queryChannels(filter);
    for (const chan of channels) {
        await chan.truncate(); // Xóa sạch tin nhắn nếu quá 7 ngày ko có chat mới
        console.log(`Đã dọn dẹp channel: ${chan.id}`);
    }
}, 86400000);

app.listen(port, () => console.log(`Zalo Like Full Feature Live!`));
