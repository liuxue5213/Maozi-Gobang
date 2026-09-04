/**
 * 猫子五子棋 - 主服务器入口
 * Express + Socket.IO
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { RoomManager } = require('./game/roomManager');
const { verifyToken } = require('./middleware/auth');
const { updatePlayerRating, saveGameRecord } = require('./utils/rating');
const db = require('./utils/database');

// 路由
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// 房间管理器
const roomManager = new RoomManager();
app.set('roomManager', roomManager);

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件 (Web 前端)
const webPath = path.join(__dirname, '../web');
app.use(express.static(webPath));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    online: roomManager.getOnlineCount(),
    uptime: process.uptime(),
  });
});

// ==================== Socket.IO 事件处理 ====================

io.use((socket, next) => {
  // JWT 认证中间件
  const token = socket.handshake.auth.token;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      socket.userId = decoded.userId;
      const user = db
        .prepare('SELECT id, username, nickname, rating FROM users WHERE id = ?')
        .get(decoded.userId);
      if (user) {
        socket.user = user;
      }
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`用户连接: ${socket.id} (${socket.user?.username || '匿名'})`);

  // 加入匹配队列
  socket.on('find-match', () => {
    if (!socket.user) {
      socket.emit('error', { message: '请先登录' });
      return;
    }

    socket.emit('match-status', { status: 'searching' });
    const result = roomManager.joinMatchQueue(
      socket,
      socket.user.id,
      socket.user.username
    );

    if (result.matched) {
      const room = result.room;
      const players = Array.from(room.players.values());

      // 双方自动加入 Socket.IO 房间
      players.forEach((player) => {
        player.socket.join(room.id);
      });

      // 通知双方匹配成功
      players.forEach((player) => {
        player.socket.emit('match-found', {
          roomId: room.id,
          yourColor: player.color,
          opponent: players.find((p) => p.socket.id !== player.socket.id)?.username,
          gameState: room.getGameState(),
        });
      });

      console.log(`匹配成功: ${room.id}`);
    }
  });

  // 取消匹配
  socket.on('cancel-match', () => {
    roomManager.leaveMatchQueue(socket.id);
    socket.emit('match-status', { status: 'idle' });
  });

  // 创建人机对战 (允许匿名)
  socket.on('create-ai-game', (data = {}) => {
    const difficulty = data.difficulty || 3;
    const userId = socket.user?.id || `guest_${socket.id}`;
    const username = socket.user?.username || '游客';

    const room = roomManager.createAiRoom(socket, userId, username, difficulty);

    // 自动加入 Socket.IO 房间
    socket.join(room.id);

    socket.emit('ai-game-created', {
      roomId: room.id,
      yourColor: 1, // 玩家执黑
      difficulty,
      gameState: room.getGameState(),
    });

    console.log(`创建人机对战: ${room.id}, 难度: ${difficulty}, 用户: ${username}`);
  });

  // 落子
  socket.on('make-move', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) {
      socket.emit('error', { message: '不在游戏房间中' });
      return;
    }

    const { row, col } = data;
    const result = room.makeMove(socket.id, row, col);

    if (!result.valid) {
      socket.emit('move-rejected', { reason: result.reason });
      return;
    }

    // 广播落子结果
    io.to(room.id).emit('move-made', {
      row,
      col,
      playerColor: result.playerColor,
      board: room.board.serialize(),
    });

    // 游戏结束
    if (room.status === 'finished') {
      handleGameEnd(room, io);
      return;
    }

    // 人机模式下 AI 落子
    if (room.isAiGame && room.status === 'playing') {
      setTimeout(async () => {
        const aiResult = await room.makeAiMove();
        if (aiResult) {
          io.to(room.id).emit('move-made', {
            row: aiResult.row,
            col: aiResult.col,
            playerColor: aiResult.playerColor || (room.board.currentPlayer === 1 ? 2 : 1),
            board: room.board.serialize(),
            thinking: aiResult.thinking,
          });

          if (room.status === 'finished') {
            handleGameEnd(room, io);
          }
        }
      }, 300); // 稍微延迟，模拟思考
    }
  });

  // 认输
  socket.on('resign', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room || room.status !== 'playing') return;

    const player = room.players.get(socket.id);
    room.status = 'finished';
    room.winner = player.color === 1 ? 2 : 1;

    io.to(room.id).emit('game-resigned', {
      resigner: player.username,
      winner: room.winner,
    });

    handleGameEnd(room, io);
  });

  // 求和
  socket.on('offer-draw', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    for (const [, player] of room.players) {
      if (player.socket.id !== socket.id) {
        player.socket.emit('draw-offered', {
          from: socket.user?.username || '对手',
        });
      }
    }
  });

  // 接受求和
  socket.on('accept-draw', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room || room.status !== 'playing') return;

    room.status = 'finished';
    room.winner = 0; // 平局

    io.to(room.id).emit('game-draw');
    handleGameEnd(room, io);
  });

  // 聊天
  socket.on('chat', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    io.to(room.id).emit('chat-message', {
      from: socket.user?.username || '匿名',
      message: data.message,
      timestamp: Date.now(),
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开: ${socket.id}`);
    roomManager.removePlayer(socket.id);
  });

  // 加入房间 (用于接收房间事件)
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });
});

/**
 * 处理游戏结束
 */
function handleGameEnd(room, io) {
  try {
  const duration = room.startedAt ? Date.now() - room.startedAt : 0;
  const players = Array.from(room.players.values());

  // 计算积分变化 (仅 PvP 模式)
  let ratingChanges = {};
  if (!room.isAiGame && players.length === 2) {
    const black = players.find((p) => p.color === 1);
    const white = players.find((p) => p.color === 2);

    if (black && white) {
      const blackUser = db
        .prepare('SELECT rating, current_streak FROM users WHERE id = ?')
        .get(black.userId);
      const whiteUser = db
        .prepare('SELECT rating, current_streak FROM users WHERE id = ?')
        .get(white.userId);

      let blackResult, whiteResult;
      if (room.winner === 1) {
        blackResult = 1;
        whiteResult = 0;
      } else if (room.winner === 2) {
        blackResult = 0;
        whiteResult = 1;
      } else {
        blackResult = 0.5;
        whiteResult = 0.5;
      }

      const blackRating = updatePlayerRating(
        black.userId,
        room.id,
        whiteUser.rating,
        blackResult,
        blackUser.current_streak
      );
      const whiteRating = updatePlayerRating(
        white.userId,
        room.id,
        blackUser.rating,
        whiteResult,
        whiteUser.current_streak
      );

      ratingChanges = {
        [black.userId]: blackRating,
        [white.userId]: whiteRating,
      };
    }
  }

  // 保存对局记录
  const black = players.find((p) => p.color === 1);
  const white = players.find((p) => p.color === 2);
  saveGameRecord({
    roomId: room.id,
    playerBlack: black?.userId,
    playerWhite: white?.userId,
    winner: room.winner || 0,
    isAiGame: room.isAiGame,
    aiDifficulty: room.aiDifficulty,
    moves: room.board.moveHistory,
    duration: Math.floor(duration / 1000),
    ratingChangeBlack: ratingChanges[black?.userId]?.change || 0,
    ratingChangeWhite: ratingChanges[white?.userId]?.change || 0,
  });

  // 广播游戏结束
  io.to(room.id).emit('game-over', {
    winner: room.winner,
    winLine: room.winLine,
    duration,
    ratingChanges,
    gameState: room.getGameState(),
  });

  console.log(`游戏结束: ${room.id}, 胜者: ${room.winner}`);
  } catch (err) {
    console.error('处理游戏结束出错:', err);
    // 仍然尝试广播游戏结束
    try {
      io.to(room.id).emit('game-over', {
        winner: room.winner,
        winLine: room.winLine,
        duration: 0,
        ratingChanges: {},
        gameState: room.getGameState(),
      });
    } catch (e) {
      console.error('广播游戏结束失败:', e);
    }
  }
}

// 启动服务器
server.listen(config.port, () => {
  console.log(`
  ===================================
    猫子五子棋服务器已启动
    端口: ${config.port}
    环境: ${process.env.NODE_ENV || 'development'}
  ===================================
  `);
});

module.exports = { app, server, io };
