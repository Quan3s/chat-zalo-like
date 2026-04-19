const express = require('express');
const { StreamChat } = require('stream-chat');
const { createClient } = require('redis');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Config GetStream (Thông số sếp cung cấp)
const apiKey = 'bkzgy39gxa2u';
const apiSecret = 'qtxgafghgchqev9r69x6an6duwr9c7ymf68jmphvp8h6n7dc3v4q6qp2rbna8qqd';
const serverClient = StreamChat.getInstance(apiKey, apiSecret);

// Config Redis
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(e => console.error("Redis Connection Error", e));

app.use(express.static('public'));
app.use(express.json());

/** * API /v2/portal-toc: Đăng nhập/Đăng ký & Cấp Session
 */
app.post('/v2/portal-toc', async (req, res) => {
    const { username } = req.body;
    if (!username || username.length < 3) return res.status(400).json({ error: 'Tên quá ngắn' });

    try {
        // Đăng ký user lên GetStream
        await serverClient.upsertUser({ id: username, name: username, role: 'user' });
        
        // Tạo Token Chat
        const chatToken = serverClient.createToken(username);

        // Tạo Session ID và lưu vào Redis (TTL: 7 ngày = 604800s)
        const sessionId = `zalo_sess_${Math.random().toString(36).substring(2)}`;
        await redisClient.setEx(sessionId, 604800, JSON.stringify({ username, token: chatToken }));

        res.json({
            status: 'success',
            username,
            token: chatToken,
            sessionId: sessionId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi Portal' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Zalo Like Live tại port ${port}`));
