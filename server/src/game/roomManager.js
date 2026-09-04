/**
 * 游戏房间管理器
 * 处理在线匹配、房间状态、实时对战
 */

const { v4: uuidv4 } = require('uuid');
const { Board, BLACK, WHITE } = require('./board');
const { GomokuAI } = require('../ai/engine');
const config = require('../config');

class GameRoom {
  constructor(id, isAiGame = false, aiDifficulty = 3) {
    this.id = id;
    this.board = new Board();
    this.players = new Map(); // socketId -> { userId, username, color, socket }
    this.spectators = new Set();
    this.isAiGame = isAiGame;
    this.aiDifficulty = aiDifficulty;
    this.ai = isAiGame ? new GomokuAI(aiDifficulty) : null;
    this.status = 'waiting'; // waiting, playing, finished
    this.ended = false; // game-over 结算是否已执行
    this.winner = null;
    this.winLine = [];
    this.createdAt = Date.now();
    this.startedAt = null;
    this.turnTimer = null;
    this.turnTimeLimit = config.game.turnTimeLimit * 1000;
  }

  addPlayer(socket, userId, username) {
    if (this.players.size >= 2) return false;

    const color = this.players.size === 0 ? BLACK : WHITE;
    this.players.set(socket.id, { userId, username, color, socket });

    if (this.players.size === 2) {
      this.status = 'playing';
      this.startedAt = Date.now();
    }

    return { color, playerCount: this.players.size };
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.status === 'playing') {
      this.status = 'finished';
      // 对手获胜
    }
  }

  makeMove(socketId, row, col) {
    const player = this.players.get(socketId);
    if (!player) return { valid: false, reason: 'not_in_room' };
    if (this.status !== 'playing') return { valid: false, reason: 'game_not_active' };
    if (player.color !== this.board.currentPlayer) return { valid: false, reason: 'not_your_turn' };

    const result = this.board.makeMove(row, col, player.color);
    if (!result.valid) return result;

    if (result.win) {
      this.status = 'finished';
      this.winner = player.color;
      this.winLine = result.line;
      this._clearTurnTimer();
    } else if (result.isDraw) {
      this.status = 'finished';
      this._clearTurnTimer();
    } else {
      this._resetTurnTimer();
    }

    return { ...result, playerColor: player.color };
  }

  /**
   * AI 落子
   */
  async makeAiMove() {
    if (!this.ai || this.status !== 'playing') return null;

    const move = this.ai.getBestMove(this.board);
    const result = this.board.makeMove(move.row, move.col, this.board.currentPlayer);

    if (result.win) {
      this.status = 'finished';
      this.winner = this.board.currentPlayer === BLACK ? WHITE : BLACK;
      this.winLine = result.line;
    } else if (result.isDraw) {
      this.status = 'finished';
    }

    return { ...move, ...result };
  }

  getGameState() {
    return {
      roomId: this.id,
      board: this.board.serialize(),
      status: this.status,
      winner: this.winner,
      winLine: this.winLine,
      isAiGame: this.isAiGame,
      players: Array.from(this.players.values()).map((p) => ({
        username: p.username,
        color: p.color,
      })),
    };
  }

  _resetTurnTimer() {
    this._clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      // 超时判负
      this.status = 'finished';
      const currentColor = this.board.currentPlayer;
      this.winner = currentColor === BLACK ? WHITE : BLACK;
      this._broadcast('timeout', { loser: currentColor });
    }, this.turnTimeLimit);
  }

  _clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  _broadcast(event, data) {
    for (const player of this.players.values()) {
      player.socket.emit(event, data);
    }
    for (const spectator of this.spectators) {
      spectator.emit(event, data);
    }
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> GameRoom
    this.playerRooms = new Map(); // socketId -> roomId
    this.matchQueue = []; // 等待匹配的玩家 socketId 队列
  }

  createAiRoom(socket, userId, username, difficulty = 3) {
    const roomId = uuidv4();
    const room = new GameRoom(roomId, true, difficulty);
    room.addPlayer(socket, userId, username);
    // 人机对战直接开始
    room.status = 'playing';
    room.startedAt = Date.now();
    this.rooms.set(roomId, room);
    this.playerRooms.set(socket.id, roomId);
    return room;
  }

  createPvPRoom(socket1, player1, socket2, player2) {
    const roomId = uuidv4();
    const room = new GameRoom(roomId, false);
    room.addPlayer(socket1, player1.userId, player1.username);
    room.addPlayer(socket2, player2.userId, player2.username);
    this.rooms.set(roomId, room);
    this.playerRooms.set(socket1.id, roomId);
    this.playerRooms.set(socket2.id, roomId);
    return room;
  }

  joinMatchQueue(socket, userId, username) {
    // 检查是否已在队列中
    const existing = this.matchQueue.find((p) => p.userId === userId);
    if (existing) return { matched: false, reason: 'already_in_queue' };

    // 尝试匹配
    if (this.matchQueue.length > 0) {
      const opponent = this.matchQueue.shift();
      if (opponent.socket.id === socket.id) {
        this.matchQueue.push({ socket, userId, username });
        return { matched: false };
      }
      const room = this.createPvPRoom(opponent.socket, opponent, socket, {
        userId,
        username,
      });
      return { matched: true, roomId: room.id, room };
    }

    this.matchQueue.push({ socket, userId, username });
    return { matched: false, reason: 'waiting' };
  }

  leaveMatchQueue(socketId) {
    this.matchQueue = this.matchQueue.filter((p) => p.socket.id !== socketId);
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  removePlayer(socketId) {
    this.leaveMatchQueue(socketId);

    const room = this.getPlayerRoom(socketId);
    if (room) {
      room.removePlayer(socketId);
      if (room.players.size === 0) {
        this.rooms.delete(room.id);
      }
      this.playerRooms.delete(socketId);
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getOnlineCount() {
    return this.playerRooms.size;
  }
}

module.exports = { RoomManager, GameRoom };
