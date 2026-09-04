/**
 * 猫子五子棋 - 完整功能测试
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`等待 ${eventName} 超时 (${timeout}ms)`));
    }, timeout);
    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  猫子五子棋 - 功能测试');
  console.log(`  服务器: ${SERVER_URL}`);
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message}`);
      failed++;
    }
  }

  // 创建独立的 socket 用于每个测试组
  function createSocket() {
    return io(SERVER_URL, { transports: ['websocket', 'polling'] });
  }

  function connectSocket(socket) {
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('连接超时')), 5000);
    });
  }

  // ========================================
  // 测试 1: WebSocket 连接
  // ========================================
  console.log('\n[测试 1] WebSocket 连接');
  const socket1 = createSocket();
  try {
    await connectSocket(socket1);
    assert(true, `WebSocket 连接成功 (ID: ${socket1.id})`);
  } catch (err) {
    assert(false, `连接失败: ${err.message}`);
  }
  socket1.disconnect();

  // ========================================
  // 测试 2: 创建人机对战
  // ========================================
  console.log('\n[测试 2] 创建人机对战');
  const socket2 = createSocket();
  try {
    await connectSocket(socket2);
    const gameData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket2.once('ai-game-created', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket2.emit('create-ai-game', { difficulty: 3 });
    });

    assert(gameData.roomId != null, '房间 ID 存在');
    assert(gameData.yourColor === 1, '玩家执黑 (先手)');
    assert(gameData.difficulty === 3, '难度为中等');
    assert(gameData.gameState != null, '游戏状态存在');
  } catch (err) {
    assert(false, `创建游戏失败: ${err.message}`);
  }
  socket2.disconnect();

  // ========================================
  // 测试 3: 玩家落子 + AI 响应
  // ========================================
  console.log('\n[测试 3] 玩家落子 + AI 响应');
  const socket3 = createSocket();
  try {
    await connectSocket(socket3);

    // 创建游戏
    const gameData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket3.once('ai-game-created', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket3.emit('create-ai-game', { difficulty: 3 });
    });

    // 玩家落子
    const moveData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('落子超时')), 5000);
      socket3.once('move-made', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket3.emit('make-move', { row: 7, col: 7 });
    });

    assert(moveData.row === 7 && moveData.col === 7, '玩家落子成功 (7,7)');
    assert(moveData.playerColor === 1, '落子颜色为黑');

    // AI 落子
    const aiData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AI 落子超时')), 15000);
      const handler = (data) => {
        if (data.playerColor === 2) {
          clearTimeout(timer);
          socket3.off('move-made', handler);
          resolve(data);
        }
      };
      socket3.on('move-made', handler);
    });

    assert(aiData.row >= 0 && aiData.row < 15, `AI 落子有效 (${aiData.row},${aiData.col}), 思考 ${aiData.thinking || 0}ms`);
  } catch (err) {
    assert(false, `落子测试失败: ${err.message}`);
  }
  socket3.disconnect();

  // ========================================
  // 测试 4: 非法落子检测
  // ========================================
  console.log('\n[测试 4] 非法落子检测');
  const socket4 = createSocket();
  try {
    await connectSocket(socket4);

    // 创建游戏
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket4.once('ai-game-created', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket4.emit('create-ai-game', { difficulty: 1 });
    });

    // 落子 (7,7)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket4.once('move-made', () => {
        clearTimeout(timer);
        resolve();
      });
      socket4.emit('make-move', { row: 7, col: 7 });
    });

    // 等待 AI 落子
    await new Promise((resolve) => {
      const handler = (data) => {
        if (data.playerColor === 2) {
          socket4.off('move-made', handler);
          resolve();
        }
      };
      socket4.on('move-made', handler);
      setTimeout(resolve, 5000); // 超时也继续
    });

    // 测试重复落子
    const rejectData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 3000);
      socket4.once('move-rejected', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket4.once('move-made', () => {
        clearTimeout(timer);
        reject(new Error('重复落子被错误接受'));
      });
      socket4.emit('make-move', { row: 7, col: 7 });
    });

    assert(rejectData.reason === 'position_occupied', `重复落子被拒绝: ${rejectData.reason}`);

    // 测试越界落子
    const oobData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 3000);
      socket4.once('move-rejected', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket4.emit('make-move', { row: -1, col: 0 });
    });

    assert(oobData.reason === 'position_out_of_bounds', `越界落子被拒绝: ${oobData.reason}`);
  } catch (err) {
    assert(false, `非法落子测试失败: ${err.message}`);
  }
  socket4.disconnect();

  // ========================================
  // 测试 5: 认输功能
  // ========================================
  console.log('\n[测试 5] 认输功能');
  const socket5 = createSocket();
  try {
    await connectSocket(socket5);

    // 创建游戏
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket5.once('ai-game-created', () => {
        clearTimeout(timer);
        resolve();
      });
      socket5.emit('create-ai-game', { difficulty: 1 });
    });

    // 认输
    const resignData = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket5.once('game-over', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket5.emit('resign');
    });

    assert(resignData.winner === 2, `认输后 AI 获胜 (winner=${resignData.winner})`);
  } catch (err) {
    assert(false, `认输测试失败: ${err.message}`);
  }
  socket5.disconnect();

  // ========================================
  // 测试 6: 完整对局流程
  // ========================================
  console.log('\n[测试 6] 完整对局流程');
  const socket6 = createSocket();
  try {
    await connectSocket(socket6);

    // 创建游戏
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('超时')), 5000);
      socket6.once('ai-game-created', () => {
        clearTimeout(timer);
        resolve();
      });
      socket6.emit('create-ai-game', { difficulty: 1 });
    });

    // 模拟 4 步对局
    const moves = [[6, 6], [8, 8], [6, 8], [8, 6]];
    for (let i = 0; i < moves.length; i++) {
      const [r, c] = moves[i];

      // 玩家落子
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('玩家落子超时')), 3000);
        socket6.once('move-made', (data) => {
          if (data.row === r && data.col === c) {
            clearTimeout(timer);
            resolve();
          }
        });
        socket6.emit('make-move', { row: r, col: c });
      });

      // AI 落子
      await new Promise((resolve) => {
        const handler = (data) => {
          if (data.playerColor === 2) {
            socket6.off('move-made', handler);
            resolve();
          }
        };
        socket6.on('move-made', handler);
        setTimeout(resolve, 5000);
      });
    }

    assert(true, '完整对局流程测试通过 (4步)');
  } catch (err) {
    assert(false, `完整对局测试失败: ${err.message}`);
  }
  socket6.disconnect();

  // ========================================
  // 测试结果汇总
  // ========================================
  console.log('\n========================================');
  console.log(`  测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('测试出错:', err);
  process.exit(1);
});
