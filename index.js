const express = require('express');
const { StreamChat } = require('stream-chat');
const { createClient } = require('redis');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Config GetStream (Thông số sếp cấp)
const apiKey = 'bkzgy39gxa2u';
const apiSecret = 'qtxgafghgchqev9r69x6an6duwr9c7ymf68jmphvp8h6n7dc3v4q6qp2rbna8qqd';
const serverClient = StreamChat.getInstance(apiKey, apiSecret);

// Config Redis - Với cơ chế tự kết nối lại
const redisClient = createClient({ 
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) }
});
redisClient.on('error', err => console.log('Redis Error:', err));
redisClient.connect().then(() => console.log('🚀 Redis Live!')).catch(() => console.log('⚠️ Redis Offline!'));

app.use(express.static('public'));
app.use(express.json());

// API PORTAL V2 - XÁC THỰC & SESSION 1H
app.post('/v2/portal-toc', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Vui lòng nhập đủ thông tin!' });

    try {
        const storedPwd = await redisClient.get(`auth:${username}`);
        if (storedPwd && storedPwd !== password) return res.status(401).json({ error: 'Mật khẩu không đúng sếp ơi!' });
        if (!storedPwd) await redisClient.set(`auth:${username}`, password);

        // Đăng ký/Cập nhật User trên GetStream
        await serverClient.upsertUser({ 
            id: username, 
            name: username, 
            image: `https://getstream.io/random_png/?name=${username}` 
        });

        const token = serverClient.createToken(username);
        const sid = `sess:${username}:${Date.now()}`;
        
        // Hủy Session sau 1h (3600s)
        await redisClient.setEx(sid, 3600, username);

        res.json({ status: 'success', username, token, sessionId: sid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi Portal - Check cấu hình Render!' });
    }
});

// CRON JOB: TỰ ĐỘNG XÓA TIN NHẮN SAU 7 NGÀY (Nếu không có chat mới)
setInterval(async () => {
    try {
        const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const filter = { type: 'messaging', last_message_at: { $lt: threshold } };
        const channels = await serverClient.queryChannels(filter);
        for (const chan of channels) {
            await chan.truncate();
            console.log(`🧹 Đã dọn dẹp phòng: ${chan.id}`);
        }
    } catch (e) { console.log("Cron Error:", e); }
}, 86400000); // Quét mỗi ngày một lần

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`Zalo Like V3.0 thực chiến tại port ${port}`));
