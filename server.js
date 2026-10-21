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

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı.');
    let kickWs = null;

    socket.on('join-kick', (chatroomId) => {
        console.log(`Kick chatroom dinleniyor: ${chatroomId}`);
        
        if (kickWs) {
            kickWs.close();
        }

        // Kick WebSocket bağlantısı (Sunucu tarafında olduğu için CORS takılmaz)
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
                    // Sitedeki herkese bu mesajı ilet
                    io.emit('chat-message', chatData);
                }
            } catch (e) {
                console.log('Mesaj işleme hatası:', e);
            }
        });

        kickWs.on('close', () => {
            console.log('Kick bağlantısı kapandı.');
        });
    });

    socket.on('disconnect', () => {
        if (kickWs) kickWs.close();
        console.log('Bir kullanıcı ayrıldı.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});