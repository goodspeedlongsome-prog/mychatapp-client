const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('ユーザー接続:', socket.id);

  // チャット用ルーム参加
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`ユーザー ${socket.id} がチャットルーム ${roomId} に参加`);
  });

  // メッセージ送信
  socket.on('send_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
  });

  // 通話＋参加者管理
  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);

    // 参加者リストを更新
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: userName });

    const names = rooms[roomId].map((p) => p.name);
    io.to(roomId).emit('update-participants', names);

    // 通話シグナリング
    socket.to(roomId).emit('user-joined', { id: socket.id });

    socket.on('offer', ({ offer, to }) => {
      io.to(to).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ answer, to }) => {
      io.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    // 退出時の処理
    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id);
        const names = rooms[roomId].map((p) => p.name);
        io.to(roomId).emit('update-participants', names);
      }
      console.log('ユーザー切断:', socket.id);
    });
  });
});

server.listen(3000, () => {
  console.log('サーバー起動中 http://localhost:3000');
});


