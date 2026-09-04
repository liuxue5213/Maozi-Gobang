/**
 * 五子棋核心棋盘逻辑
 * 15x15 棋盘，0=空, 1=黑棋, 2=白棋
 */

const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 四个方向: 水平、垂直、两条对角线
const DIRECTIONS = [
  [0, 1],   // 水平
  [1, 0],   // 垂直
  [1, 1],   // 主对角线
  [1, -1],  // 副对角线
];

class Board {
  constructor() {
    this.size = BOARD_SIZE;
    this.grid = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(EMPTY)
    );
    this.moveHistory = [];
    this.currentPlayer = BLACK;
  }

  /**
   * 落子
   * @param {number} row - 行
   * @param {number} col - 列
   * @param {number} player - 玩家 (1=黑, 2=白)
   * @returns {{valid: boolean, win: boolean, winner: number, line: Array}}
   */
  makeMove(row, col, player = this.currentPlayer) {
    if (!this.isValidPosition(row, col)) {
      return { valid: false, reason: 'position_out_of_bounds' };
    }
    if (this.grid[row][col] !== EMPTY) {
      return { valid: false, reason: 'position_occupied' };
    }

    this.grid[row][col] = player;
    this.moveHistory.push({ row, col, player });

    const winResult = this.checkWin(row, col, player);
    if (!winResult.win) {
      this.currentPlayer = player === BLACK ? WHITE : BLACK;
    }

    return {
      valid: true,
      win: winResult.win,
      winner: winResult.win ? player : null,
      line: winResult.line || [],
      isDraw: this.isFull() && !winResult.win,
    };
  }

  /**
   * 检查最后一步是否产生五连
   */
  checkWin(row, col, player) {
    for (const [dr, dc] of DIRECTIONS) {
      const line = this.getLine(row, col, dr, dc, player);
      if (line.length >= 5) {
        return { win: true, line };
      }
    }
    return { win: false, line: [] };
  }

  /**
   * 获取某方向连续同色棋子
   */
  getLine(row, col, dr, dc, player) {
    const line = [{ row, col }];

    // 正方向
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (this.isValidPosition(r, c) && this.grid[r][c] === player) {
        line.push({ row: r, col: c });
      } else break;
    }

    // 反方向
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (this.isValidPosition(r, c) && this.grid[r][c] === player) {
        line.unshift({ row: r, col: c });
      } else break;
    }

    return line;
  }

  /**
   * 获取所有合法落子位置（已有棋子周围2格内）
   */
  getCandidateMoves(range = 2) {
    const candidates = new Set();
    let hasAnyStone = false;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== EMPTY) {
          hasAnyStone = true;
          for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (this.isValidPosition(nr, nc) && this.grid[nr][nc] === EMPTY) {
                candidates.add(nr * this.size + nc);
              }
            }
          }
        }
      }
    }

    // 空棋盘下返回中心点
    if (!hasAnyStone) {
      const center = Math.floor(this.size / 2);
      return [{ row: center, col: center }];
    }

    return Array.from(candidates).map((v) => ({
      row: Math.floor(v / this.size),
      col: v % this.size,
    }));
  }

  /**
   * 获取某位置的棋子
   */
  get(row, col) {
    if (!this.isValidPosition(row, col)) return null;
    return this.grid[row][col];
  }

  isValidPosition(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  isFull() {
    return this.moveHistory.length >= this.size * this.size;
  }

  /**
   * 序列化为二维数组
   */
  serialize() {
    return {
      grid: this.grid.map((row) => [...row]),
      currentPlayer: this.currentPlayer,
      moveCount: this.moveHistory.length,
      lastMove: this.moveHistory[this.moveHistory.length - 1] || null,
    };
  }

  /**
   * 克隆棋盘（用于AI搜索）
   */
  clone() {
    const newBoard = new Board();
    newBoard.grid = this.grid.map((row) => [...row]);
    newBoard.currentPlayer = this.currentPlayer;
    newBoard.moveHistory = [...this.moveHistory];
    return newBoard;
  }

  /**
   * 从序列化数据恢复
   */
  static deserialize(data) {
    const board = new Board();
    board.grid = data.grid;
    board.currentPlayer = data.currentPlayer;
    board.moveHistory = data.moveHistory || [];
    return board;
  }
}

module.exports = { Board, BOARD_SIZE, EMPTY, BLACK, WHITE };
