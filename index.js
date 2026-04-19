const express = require('express');
const { StreamChat } = require('stream-chat');
const { createClient } = require('redis');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Cấu hình GetStream
const apiKey = 'bkzgy39gxa2u';
const apiSecret = 'qtxgafghgchqev9r69x6an6duwr9c7ymf68jmphvp8h6n7dc3v4q6qp2rbna8qqd';
const serverClient = StreamChat.getInstance(apiKey, apiSecret);

// Cấu hình Redis (Nếu chạy local thì dùng 'redis://localhost:6379')
// Trên Render sếp dán link Redis Internal/External vào biến môi trường REDIS_URL
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', err => console.log('Redis Error', err));
redisClient.connect();

app.use(express.static('public'));
app.use(express.json());

/**
 * API V2: PORTAL-TOC
 * Nhiệm vụ: Xác thực user, tạo session, lưu Redis với TTL 7 ngày
 */
app.post('/v2/portal-toc', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username trống' });

    try {
        // 1. Tạo GetStream Token
        await serverClient.upsertUser({ id: username, name: username });
        const chatToken = serverClient.createToken(username);

        // 2. Tạo Session ID ngẫu nhiên
        const sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);

        // 3. Lưu thông tin vào Redis với thời gian sống (TTL) là 7 ngày (604800 giây)
        // Nếu có tin nhắn mới (vào portal lại), Redis sẽ reset thời gian này
        const userData = {
            username,
            chatToken,
            lastLogin: new Date().toISOString()
        };

        await redisClient.setEx(sessionId, 604800, JSON.stringify(userData));

        res.json({
            status: 'success',
            token: chatToken,
            sessionId: sessionId,
            username: username
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi hệ thống Portal' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Zalo-Style App Live on port ${port}`));
