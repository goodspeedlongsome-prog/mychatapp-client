const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS設定（ReactアプリのURLを指定）
app.use(cors({
  origin: 'https://xv1hufepxueser-ui.vercel.app', // ← あなたのReactアプリのURL
  methods: ['GET', 'POST'],
  credentials: true
}));

// Socket.ioのCORS設定
const io = new Server(server, {
  cors: {
    origin: 'https://xv1hufepxueser-ui.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.ioのイベント処理
io.on('connection', (socket) => {
  console.log('ユーザーが接続しました:', socket.id);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    io.to(roomId).emit('user-joined', { id: socket.id, userName });
  });

  socket.on('offer', ({ offer, to }) => {
    io.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('send_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('ユーザーが切断しました:', socket.id);
  });
});

// サーバー起動
server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
