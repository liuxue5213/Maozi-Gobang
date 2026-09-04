/**
 * 猫子五子棋 - 主应用逻辑
 * Socket.IO 连接、UI 交互、游戏状态管理
 */

class GobangApp {
  constructor() {
    this.socket = null;
    this.renderer = null;
    this.currentUser = null;
    this.currentRoom = null;
    this.myColor = 1;
    this.isMyTurn = false;
    this.gameActive = false;
    this.selectedDifficulty = 3;

    this.init();
  }

  async init() {
    // 恢复登录状态
    this.loadUserFromStorage();

    // 初始化棋盘渲染
    this.renderer = new BoardRenderer(document.getElementById('gameBoard'));
    this.renderer.onClick = (row, col) => this.handleBoardClick(row, col);

    // 连接 WebSocket
    this.connectSocket();

    // 绑定 UI 事件
    this.bindEvents();

    // 加载初始数据
    this.loadLeaderboard();
    this.updateOnlineCount();
    setInterval(() => this.updateOnlineCount(), 10000);
  }

  // ==================== Socket 连接 ====================
  connectSocket() {
    const token = localStorage.getItem('token');
    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('已连接到服务器');
    });

    this.socket.on('disconnect', () => {
      console.log('与服务器断开连接');
    });

    this.socket.on('error', (data) => {
      this.showNotification(data.message, 'error');
    });

    // 匹配相关事件
    this.socket.on('match-status', (data) => {
      if (data.status === 'searching') {
        this.showMatchStatus();
      }
    });

    this.socket.on('match-found', (data) => {
      this.handleMatchFound(data);
    });

    // 人机对战
    this.socket.on('ai-game-created', (data) => {
      this.handleAiGameCreated(data);
    });

    // 落子
    this.socket.on('move-made', (data) => {
      this.handleMoveMade(data);
    });

    this.socket.on('move-rejected', (data) => {
      this.showNotification('落子无效: ' + data.reason, 'error');
    });

    // 游戏结束
    this.socket.on('game-over', (data) => {
      this.handleGameOver(data);
    });

    this.socket.on('game-draw', () => {
      this.handleGameDraw();
    });

    this.socket.on('game-resigned', (data) => {
      this.handleGameResign(data);
    });

    // 求和
    this.socket.on('draw-offered', (data) => {
      this.showDrawOffer(data);
    });

    // 超时
    this.socket.on('timeout', (data) => {
      this.handleTimeout(data);
    });

    // 聊天
    this.socket.on('chat-message', (data) => {
      this.addChatMessage(data);
    });
  }

  // ==================== UI 事件绑定 ====================
  bindEvents() {
    // 导航
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
    });

    // 模式选择
    document.getElementById('btnAiGame').addEventListener('click', () => {
      document.getElementById('difficultySelect').style.display = 'block';
    });

    document.getElementById('btnPvpGame').addEventListener('click', () => {
      this.startPvPMatch();
    });

    // 难度选择
    document.querySelectorAll('.btn-diff').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-diff').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = parseInt(btn.dataset.level);
      });
    });

    document.getElementById('btnStartAi').addEventListener('click', () => {
      this.startAiGame();
    });

    document.getElementById('btnCancelMatch').addEventListener('click', () => {
      this.socket.emit('cancel-match');
      this.hideOverlay();
    });

    // 游戏操作
    document.getElementById('btnResign').addEventListener('click', () => {
      this.socket.emit('resign');
    });

    document.getElementById('btnDraw').addEventListener('click', () => {
      this.socket.emit('offer-draw');
      this.showNotification('已发送求和请求', 'info');
    });

    document.getElementById('btnNewGame').addEventListener('click', () => {
      this.newGame();
    });

    // 登录/注册
    document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
    document.getElementById('loginBtn2').addEventListener('click', () => this.showLoginModal());
    document.getElementById('closeModal').addEventListener('click', () => this.hideLoginModal());
    document.getElementById('btnLogout').addEventListener('click', () => this.logout());

    // 登录/注册表单切换
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.tab === 'login';
        document.getElementById('loginForm').style.display = isLogin ? 'flex' : 'none';
        document.getElementById('registerForm').style.display = isLogin ? 'none' : 'flex';
      });
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin(new FormData(e.target));
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister(new FormData(e.target));
    });

    // 聊天
    document.getElementById('btnSendChat').addEventListener('click', () => this.sendChat());
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChat();
    });
  }

  // ==================== 游戏逻辑 ====================
  startAiGame() {
    this.socket.emit('create-ai-game', { difficulty: this.selectedDifficulty });
  }

  handleAiGameCreated(data) {
    this.hideOverlay();
    this.currentRoom = { id: data.roomId, isAiGame: true };
    this.myColor = data.yourColor;
    this.gameActive = true;
    this.isMyTurn = this.myColor === 1; // 黑棋先手

    this.renderer.reset();
    this.renderer.myColor = this.myColor;
    this.renderer.canPlay = this.isMyTurn;
    this.renderer.updateBoard(data.gameState.board.grid);

    document.getElementById('playerBlack').querySelector('.player-name').textContent =
      this.currentUser?.username || '你';
    document.getElementById('playerWhite').querySelector('.player-name').textContent =
      `AI (${this.getDifficultyName(data.difficulty)})`;

    this.updateGameStatus(this.isMyTurn ? '轮到你落子' + ' ●' : 'AI 思考中...');
    this.setActionButtons(true);
    this.socket.emit('join-room', data.roomId);
  }

  startPvPMatch() {
    if (!this.currentUser) {
      this.showNotification('请先登录', 'error');
      this.showLoginModal();
      return;
    }
    this.socket.emit('find-match');
  }

  handleMatchFound(data) {
    this.currentRoom = { id: data.roomId, isAiGame: false };
    this.myColor = data.yourColor;
    this.gameActive = true;
    this.isMyTurn = this.myColor === 1;

    this.renderer.reset();
    this.renderer.myColor = this.myColor;
    this.renderer.canPlay = this.isMyTurn;
    this.renderer.updateBoard(data.gameState.board.grid);

    const myName = this.currentUser?.username || '你';
    const opponentName = data.opponent || '对手';

    document.getElementById('playerBlack').querySelector('.player-name').textContent =
      this.myColor === 1 ? myName : opponentName;
    document.getElementById('playerWhite').querySelector('.player-name').textContent =
      this.myColor === 1 ? opponentName : myName;

    this.updateGameStatus(this.isMyTurn ? '你的回合 ●' : '对手回合 ○');
    this.setActionButtons(true);
    this.socket.emit('join-room', data.roomId);
    this.showNotification('匹配成功！对手: ' + opponentName, 'success');
  }

  handleBoardClick(row, col) {
    if (!this.gameActive || !this.isMyTurn) return;
    this.socket.emit('make-move', { row, col });
    this.renderer.canPlay = false;
  }

  handleMoveMade(data) {
    const grid = data.board.grid;
    this.renderer.updateBoard(grid, { row: data.row, col: data.col });

    // 更新回合状态
    const nextPlayer = data.board.currentPlayer;
    this.isMyTurn = nextPlayer === this.myColor;
    this.renderer.canPlay = this.isMyTurn;

    if (data.thinking) {
      this.updateGameStatus(`AI 思考了 ${data.thinking}ms`);
    } else {
      this.updateGameStatus(this.isMyTurn ? '轮到你落子' : '对手思考中...');
    }
  }

  handleGameOver(data) {
    this.gameActive = false;
    this.renderer.canPlay = false;

    if (data.gameState?.winLine) {
      this.renderer.setWinLine(data.gameState.winLine);
    }

    let message;
    if (data.winner === 0) {
      message = '平局！';
    } else if (data.winner === this.myColor) {
      message = '🎉 你赢了！';
    } else {
      message = '😢 你输了';
    }

    // 显示积分变化
    if (data.ratingChanges && this.currentUser) {
      const myChange = data.ratingChanges[this.currentUser.id];
      if (myChange) {
        const sign = myChange.change >= 0 ? '+' : '';
        message += ` (${sign}${myChange.change} 分)`;
      }
    }

    this.updateGameStatus(message);
    this.setActionButtons(false);
    this.showNotification(message, data.winner === this.myColor ? 'success' : 'info');

    // 刷新用户信息
    if (this.currentUser) {
      this.loadUserProfile();
      this.loadLeaderboard();
    }
  }

  handleGameDraw() {
    this.gameActive = false;
    this.renderer.canPlay = false;
    this.updateGameStatus('平局！');
    this.setActionButtons(false);
    this.loadLeaderboard();
  }

  handleGameResign(data) {
    this.gameActive = false;
    this.renderer.canPlay = false;
    const iWon = data.winner === this.myColor;
    this.updateGameStatus(iWon ? '对手认输，你赢了！' : data.resigner + ' 认输了');
    this.setActionButtons(false);
    this.loadLeaderboard();
  }

  handleTimeout(data) {
    this.gameActive = false;
    this.renderer.canPlay = false;
    this.updateGameStatus('超时判负！');
    this.setActionButtons(false);
  }

  showDrawOffer(data) {
    if (confirm(`${data.from} 请求和棋，是否接受？`)) {
      this.socket.emit('accept-draw');
    }
  }

  newGame() {
    this.gameActive = false;
    this.renderer.reset();
    this.currentRoom = null;
    this.setActionButtons(false);
    this.updateGameStatus('选择模式开始游戏');
    // 重置遮罩面板状态
    document.getElementById('difficultySelect').style.display = 'none';
    document.getElementById('matchStatus').style.display = 'none';
    this.showOverlay();
  }

  // ==================== 认证 ====================
  async handleLogin(formData) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.setUser(data);
      this.hideLoginModal();
      this.showNotification('登录成功！', 'success');
    } catch (err) {
      this.showNotification(err.message, 'error');
    }
  }

  async handleRegister(formData) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
          nickname: formData.get('nickname'),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.setUser(data);
      this.hideLoginModal();
      this.showNotification('注册成功！', 'success');
    } catch (err) {
      this.showNotification(err.message, 'error');
    }
  }

  setUser(data) {
    this.currentUser = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    this.updateUserUI();
  }

  loadUserFromStorage() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      this.currentUser = JSON.parse(user);
      this.updateUserUI();
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser = null;
    this.updateUserUI();
    this.showNotification('已退出登录', 'info');
    this.connectSocket(); // 重新连接匿名 socket
  }

  // ==================== 数据加载 ====================
  async loadLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard?limit=50');
      const data = await res.json();
      this.renderLeaderboard(data.leaderboard);
    } catch (err) {
      console.error('加载排行榜失败:', err);
    }
  }

  async updateOnlineCount() {
    try {
      const res = await fetch('/api/online-count');
      const data = await res.json();
      document.getElementById('onlineCount').textContent = data.count;
    } catch (err) {
      // ignore
    }
  }

  async loadUserProfile() {
    if (!this.currentUser) return;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('获取用户信息失败');

      const user = await res.json();
      document.getElementById('profileNickname').textContent = user.nickname || user.username;
      document.getElementById('profileRating').textContent = user.rating;
      document.getElementById('profileRank').textContent = user.rank;
      document.getElementById('statPlayed').textContent = user.games_played;
      document.getElementById('statWon').textContent = user.games_won;
      document.getElementById('statWinRate').textContent =
        user.games_played > 0
          ? Math.round((user.games_won / user.games_played) * 100) + '%'
          : '0%';
      document.getElementById('statStreak').textContent = user.best_streak;

      document.getElementById('myRating').textContent = user.rating;

      this.loadRatingHistory();
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  }

  async loadRatingHistory() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/user/rating-history?limit=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      this.renderRatingChart(data.history);
    } catch (err) {
      console.error('加载积分历史失败:', err);
    }
  }

  // ==================== UI 更新 ====================
  switchPage(page) {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach((p) => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    if (page === 'profile' && this.currentUser) {
      this.loadUserProfile();
      document.getElementById('profileNotLoggedIn').style.display = 'none';
      document.getElementById('profileLoggedIn').style.display = 'block';
    } else if (page === 'profile') {
      document.getElementById('profileNotLoggedIn').style.display = 'block';
      document.getElementById('profileLoggedIn').style.display = 'none';
    }
  }

  updateUserUI() {
    const userInfo = document.getElementById('userInfo');
    if (this.currentUser) {
      userInfo.innerHTML = `
        <span class="user-name">${this.currentUser.nickname || this.currentUser.username}</span>
        <span class="user-rating">${this.currentUser.rating}分</span>
      `;
      document.getElementById('myRating').textContent = this.currentUser.rating;
    } else {
      userInfo.innerHTML = '<button class="btn btn-primary" id="loginBtn">登录</button>';
      document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
    }
  }

  updateGameStatus(text) {
    document.getElementById('gameStatus').textContent = text;
    document.getElementById('playerBlack').classList.toggle('active',
      this.gameActive && this.renderer?.grid && this.isBlackTurn());
    document.getElementById('playerWhite').classList.toggle('active',
      this.gameActive && this.renderer?.grid && !this.isBlackTurn());
  }

  isBlackTurn() {
    // 通过棋盘上空手数量判断（黑棋先手，所以黑棋下的时候 moveHistory 长度为偶数）
    return this.renderer?.grid?.flat().filter((c) => c !== 0).length % 2 === 0;
  }

  setActionButtons(active) {
    document.getElementById('btnResign').disabled = !active;
    document.getElementById('btnDraw').disabled = !active;
    document.getElementById('btnUndo').disabled = true; // TODO: 实现悔棋
  }

  showOverlay() {
    document.getElementById('boardOverlay').classList.remove('hidden');
  }

  hideOverlay() {
    document.getElementById('boardOverlay').classList.add('hidden');
  }

  showMatchStatus() {
    document.getElementById('difficultySelect').style.display = 'none';
    document.getElementById('matchStatus').style.display = 'block';
    this.showOverlay();
  }

  showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
  }

  hideLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
  }

  renderLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboardBody');
    if (!leaderboard || leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = leaderboard.map((user, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : '';
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : user.rank;
      const winRate = user.games_played > 0
        ? Math.round((user.games_won / user.games_played) * 100) + '%'
        : '0%';

      return `
        <tr>
          <td class="${rankClass}">${rankEmoji}</td>
          <td>${user.nickname || user.username}</td>
          <td><strong>${user.rating}</strong></td>
          <td>${user.games_won}/${user.games_lost || 0}/${user.games_played - user.games_won - (user.games_lost || 0)}</td>
          <td>${winRate}</td>
        </tr>
      `;
    }).join('');
  }

  renderRatingChart(history) {
    const canvas = document.getElementById('ratingChart');
    if (!canvas || !history || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    ctx.clearRect(0, 0, width, height);

    if (history.length < 2) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('数据不足，继续游戏以查看积分变化', width / 2, height / 2);
      return;
    }

    const data = history.slice().reverse();
    const ratings = data.map((h) => h.new_rating);
    const minRating = Math.min(...ratings) - 50;
    const maxRating = Math.max(...ratings) + 50;

    const xStep = (width - padding * 2) / (data.length - 1);
    const yScale = (height - padding * 2) / (maxRating - minRating);

    // 绘制网格线
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // 绘制折线
    ctx.beginPath();
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 2;

    data.forEach((h, i) => {
      const x = padding + i * xStep;
      const y = height - padding - (h.new_rating - minRating) * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制数据点
    data.forEach((h, i) => {
      const x = padding + i * xStep;
      const y = height - padding - (h.new_rating - minRating) * yScale;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#4a90d9';
      ctx.fill();
    });

    // Y轴标签
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const rating = minRating + ((maxRating - minRating) / 4) * (4 - i);
      const y = padding + ((height - padding * 2) / 4) * i;
      ctx.fillText(Math.round(rating).toString(), padding - 5, y + 4);
    }
  }

  sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    if (this.currentRoom) {
      this.socket.emit('chat', { message });
    }
    input.value = '';
  }

  addChatMessage(data) {
    const container = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `<span class="from">${data.from}:</span> ${data.message}`;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
  }

  getDifficultyName(level) {
    const names = {
      1: '入门',
      2: '简单',
      3: '中等',
      4: '困难',
      5: '大师',
    };
    return names[level] || '中等';
  }

  showNotification(message, type = 'info') {
    // 简单的通知实现
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideDown 0.3s ease;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#4a90d9'};
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GobangApp();
});

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(style);
