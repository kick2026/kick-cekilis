const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Kick kanal adından ID bulma fonksiyonu (Sunucu tarafında çalışır)
async function getChannelId(slug) {
    const url = `https://kick.com/api/v2/channels/${slug}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const text = await response.text();
        const match = text.match(/"chatroom"\s*:\s*\{[^}]*?"id"\s*:\s*(\d+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı.');
    let kickWs = null;

    socket.on('join-kick', async (slugOrId) => {
        let chatroomId = slugOrId;

        // Eğer girilen değer sayı değilse, kanal adı olarak kabul edip ID'sini bulalım
        if (isNaN(slugOrId)) {
            console.log(`Kanal aranıyor: ${slugOrId}`);
            chatroomId = await getChannelId(slugOrId.toLowerCase().trim());
        }

        if (!chatroomId) {
            socket.on('error-msg', 'Chatroom ID bulunamadı.');
            return;
        }

        console.log(`Kick chatroom dinleniyor ID: ${chatroomId}`);
        
        if (kickWs) {
            kickWs.close();
        }

        kickWs = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false');

        kickWs.on('open', () => {
            kickWs.send(JSON.stringify({
                event: 'pusher:subscribe',
                data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
            }));
        });

        kickWs.on('message', (data) => {
            try {
                const parsed = JSON.parse(data);
                if (/ChatMessageEvent$/.test(parsed.event)) {
                    const chatData = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
                    io.emit('chat-message', chatData);
                }
            } catch (e) {}
        });

        kickWs.on('close', () => {});
    });

    socket.on('disconnect', () => {
        if (kickWs) kickWs.close();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});