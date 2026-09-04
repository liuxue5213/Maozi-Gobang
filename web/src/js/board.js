/**
 * 棋盘渲染模块
 * Canvas 绘制棋盘、棋子、动画
 */

class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 15;
    this.cellSize = 0;
    this.padding = 0;
    this.grid = Array.from({ length: 15 }, () => Array(15).fill(0));
    this.lastMove = null;
    this.winLine = [];
    this.hoverPos = null;
    this.animations = [];
    this.myColor = 1;
    this.canPlay = false;

    this.calculateDimensions();
    this.bindEvents();
    this.draw();
  }

  calculateDimensions() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    this.cellSize = rect.width / (this.size + 1);
    this.padding = this.cellSize;
  }

  bindEvents() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverPos = null;
      this.draw();
    });

    window.addEventListener('resize', () => {
      this.calculateDimensions();
      this.draw();
    });
  }

  getGridPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.round((x - this.padding) / this.cellSize);
    const row = Math.round((y - this.padding) / this.cellSize);

    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      return { row, col };
    }
    return null;
  }

  handleClick(e) {
    if (!this.canPlay || !this.onClick) return;

    const pos = this.getGridPosition(e);
    if (pos && this.grid[pos.row][pos.col] === 0) {
      this.onClick(pos.row, pos.col);
    }
  }

  handleMouseMove(e) {
    const pos = this.getGridPosition(e);
    if (pos && this.canPlay && this.grid[pos.row][pos.col] === 0) {
      if (!this.hoverPos || this.hoverPos.row !== pos.row || this.hoverPos.col !== pos.col) {
        this.hoverPos = pos;
        this.canvas.style.cursor = 'pointer';
        this.draw();
      }
    } else if (this.hoverPos) {
      this.hoverPos = null;
      this.canvas.style.cursor = 'default';
      this.draw();
    }
  }

  updateBoard(grid, lastMove = null) {
    this.grid = grid;
    if (lastMove) {
      this.lastMove = lastMove;
      this.animateStone(lastMove.row, lastMove.col, grid[lastMove.row][lastMove.col]);
    }
    this.draw();
  }

  setWinLine(line) {
    this.winLine = line;
    this.draw();
  }

  animateStone(row, col, player) {
    const x = this.padding + col * this.cellSize;
    const y = this.padding + row * this.cellSize;
    const targetRadius = this.cellSize * 0.42;

    this.animations.push({
      row, col, player,
      radius: 0,
      targetRadius,
      alpha: 0,
      startTime: performance.now(),
      duration: 200,
    });
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制棋盘背景
    this.drawBoardBackground(ctx);

    // 绘制网格线
    this.drawGrid(ctx);

    // 绘制星位
    this.drawStarPoints(ctx);

    // 绘制棋子
    this.drawStones(ctx);

    // 绘制最后一步标记
    this.drawLastMoveMarker(ctx);

    // 绘制胜利连线
    this.drawWinLine(ctx);

    // 绘制悬停预览
    this.drawHoverPreview(ctx);

    // 更新动画
    this.updateAnimations();
  }

  drawBoardBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, '#e8c55a');
    gradient.addColorStop(1, '#d4a831');
    ctx.fillStyle = gradient;

    const size = this.cellSize * (this.size + 1);
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 4);
    ctx.fill();

    // 木纹效果
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + Math.random() * 10 - 5,
                       size * 0.7, y + Math.random() * 10 - 5,
                       size, y);
      ctx.stroke();
    }
  }

  drawGrid(ctx) {
    ctx.strokeStyle = '#5d4e37';
    ctx.lineWidth = 1;

    for (let i = 0; i < this.size; i++) {
      const pos = this.padding + i * this.cellSize;

      // 横线
      ctx.beginPath();
      ctx.moveTo(this.padding, pos);
      ctx.lineTo(this.padding + (this.size - 1) * this.cellSize, pos);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(pos, this.padding);
      ctx.lineTo(pos, this.padding + (this.size - 1) * this.cellSize);
      ctx.stroke();
    }
  }

  drawStarPoints(ctx) {
    const starPoints = [
      [3, 3], [3, 11], [11, 3], [11, 11], [7, 7],
      [3, 7], [7, 3], [7, 11], [11, 7],
    ];

    ctx.fillStyle = '#5d4e37';
    for (const [row, col] of starPoints) {
      const x = this.padding + col * this.cellSize;
      const y = this.padding + row * this.cellSize;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawStones(ctx) {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.grid[row][col] !== 0) {
          this.drawStone(ctx, row, col, this.grid[row][col]);
        }
      }
    }
  }

  drawStone(ctx, row, col, player) {
    const x = this.padding + col * this.cellSize;
    const y = this.padding + row * this.cellSize;
    const radius = this.cellSize * 0.42;

    // 阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // 棋子渐变
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );

    if (player === 1) {
      // 黑棋
      gradient.addColorStop(0, '#555');
      gradient.addColorStop(0.5, '#222');
      gradient.addColorStop(1, '#000');
    } else {
      // 白棋
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.7, '#eee');
      gradient.addColorStop(1, '#ccc');
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 高光
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = player === 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  drawLastMoveMarker(ctx) {
    if (!this.lastMove) return;

    const x = this.padding + this.lastMove.col * this.cellSize;
    const y = this.padding + this.lastMove.row * this.cellSize;
    const radius = this.cellSize * 0.12;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.grid[this.lastMove.row][this.lastMove.col] === 1 ? '#ff4444' : '#ff4444';
    ctx.fill();
  }

  drawWinLine(ctx) {
    if (this.winLine.length < 2) return;

    const first = this.winLine[0];
    const last = this.winLine[this.winLine.length - 1];

    const x1 = this.padding + first.col * this.cellSize;
    const y1 = this.padding + first.row * this.cellSize;
    const x2 = this.padding + last.col * this.cellSize;
    const y2 = this.padding + last.row * this.cellSize;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 发光效果
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();
  }

  drawHoverPreview(ctx) {
    if (!this.hoverPos || !this.canPlay) return;
    if (this.grid[this.hoverPos.row][this.hoverPos.col] !== 0) return;

    const x = this.padding + this.hoverPos.col * this.cellSize;
    const y = this.padding + this.hoverPos.row * this.cellSize;
    const radius = this.cellSize * 0.42;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.myColor === 1
      ? 'rgba(0, 0, 0, 0.2)'
      : 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.strokeStyle = this.myColor === 1
      ? 'rgba(0, 0, 0, 0.3)'
      : 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  updateAnimations() {
    const now = performance.now();
    let hasActiveAnimations = false;

    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      if (progress < 1) {
        hasActiveAnimations = true;
      } else {
        this.animations.splice(i, 1);
      }
    }

    if (hasActiveAnimations) {
      requestAnimationFrame(() => this.draw());
    }
  }

  reset() {
    this.grid = Array.from({ length: 15 }, () => Array(15).fill(0));
    this.lastMove = null;
    this.winLine = [];
    this.hoverPos = null;
    this.animations = [];
    this.canPlay = false;
    this.draw();
  }
}
