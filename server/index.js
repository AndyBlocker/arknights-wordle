const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

// 仅做一个健康检查
app.get('/arknights-wordle/health', (req, res) => {
  res.json({ status: 'ok' });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  // 如果你要在 Nginx 下使用 websocket，需要做一些 path 设置 
  path: '/arknights-wordle/socket.io', 
  cors: {
    origin: "*"
  }
});

// 用内存来保存房间数据
// roomData[roomId] = { 
//   players: {
//     [socketId]: { nickname, score, ... },
//   },
//   maxScore: 5, // 先猜对5次即可赢
//   isStarted: false,
//   isFinished: false
// }
const roomData = {};

// 监听连接
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 客户端请求创建房间
  socket.on('createRoom', (payload, callback) => {
    // 你可以自己生成随机 roomId
    const roomId = 'room_' + Math.floor(Math.random() * 1000000);
    
    // 把一些配置存在 roomData
    roomData[roomId] = {
      players: {},
      maxScore: payload.maxScore || 5, 
      isStarted: false,
      isFinished: false
    };

    // 把当前socket加到房间内
    socket.join(roomId);
    roomData[roomId].players[socket.id] = {
      nickname: payload.nickname || 'PlayerA',
      score: 0
    };

    console.log(`Room created: ${roomId}`);
    callback({ roomId });
  });

  // 客户端请求加入房间
  socket.on('joinRoom', (payload, callback) => {
    const { roomId, nickname } = payload;
    if (!roomData[roomId]) {
      callback({ error: 'Room not found' });
      return;
    }
    if (roomData[roomId].isFinished) {
      callback({ error: 'Room game already finished' });
      return;
    }

    // 加入房间
    socket.join(roomId);
    // 在 roomData 中记录这个玩家
    roomData[roomId].players[socket.id] = {
      nickname: nickname || 'PlayerB',
      score: 0
    };

    // 通知房间里其他人，有新人加入
    socket.to(roomId).emit('playerJoined', {
      playerId: socket.id,
      nickname: nickname || 'PlayerB'
    });

    // 返回成功给当前客户端
    callback({ success: true });
  });

  // 客户端通知：我本轮赢了一分
  socket.on('playerScored', (payload) => {
    const { roomId } = payload;
    if (!roomData[roomId]) return;

    // 如果游戏已结束，忽略
    if (roomData[roomId].isFinished) return;

    const player = roomData[roomId].players[socket.id];
    if (!player) return;

    // 分数加1
    player.score += 1;

    // 判断是否达到胜利条件
    if (player.score >= roomData[roomId].maxScore) {
      roomData[roomId].isFinished = true;
      // 通知所有人，哪个玩家胜利
      io.to(roomId).emit('gameOver', {
        winnerId: socket.id,
        nickname: player.nickname
      });
    } else {
      // 向所有人广播新的分数
      io.to(roomId).emit('scoreUpdate', {
        playerId: socket.id,
        nickname: player.nickname,
        score: player.score
      });
    }
  });

  // 客户端可以开始游戏
  socket.on('startGame', (payload) => {
    const { roomId } = payload;
    if (!roomData[roomId]) return;

    if (!roomData[roomId].isStarted) {
      roomData[roomId].isStarted = true;
      // 广播游戏开始
      io.to(roomId).emit('gameStarted', {});
    }
  });

  // 断开
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    // 找到其房间并移除
    for (const rid in roomData) {
      if (roomData[rid].players[socket.id]) {
        delete roomData[rid].players[socket.id];
        // 广播有人离开
        socket.to(rid).emit('playerLeft', { playerId: socket.id });
      }
    }
  });
});

const port = 3012;
httpServer.listen(port, () => {
  console.log(`Ark Wordle server listening on port ${port}`);
});