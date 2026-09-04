/**
 * 五子棋 AI 引擎
 * 基于 Alpha-Beta 剪枝 + 启发式评估函数
 * 5 个难度等级
 */

const { BOARD_SIZE, EMPTY, BLACK, WHITE } = require('../game/board');

// 棋型评分表 (从高到低)
const PATTERNS = {
  FIVE: 1000000,       // 五连
  OPEN_FOUR: 100000,   // 活四
  FOUR: 10000,         // 冲四
  OPEN_THREE: 10000,   // 活三
  THREE: 1000,         // 眠三
  OPEN_TWO: 1000,      // 活二
  TWO: 100,            // 眠二
  ONE: 10,             // 单子
};

// 难度配置 (优化后的参数，确保响应速度合理)
const DIFFICULTY_CONFIG = {
  1: { name: '入门', depth: 2, candidateRange: 1, maxCandidates: 4, mistakeRate: 0.20, usePattern: false },
  2: { name: '简单', depth: 3, candidateRange: 1, maxCandidates: 8, mistakeRate: 0.10, usePattern: true },
  3: { name: '中等', depth: 4, candidateRange: 2, maxCandidates: 12, mistakeRate: 0.0, usePattern: true },
  4: { name: '困难', depth: 5, candidateRange: 2, maxCandidates: 14, mistakeRate: 0.0, usePattern: true },
  5: { name: '大师', depth: 6, candidateRange: 2, maxCandidates: 16, mistakeRate: 0.0, usePattern: true },
};

// AI 思考时间上限 (毫秒)
const THINKING_TIME_LIMIT = 3000;

class GomokuAI {
  constructor(difficulty = 3) {
    this.setDifficulty(difficulty);
    this.transpositionTable = new Map();
    this.nodesSearched = 0;
  }

  setDifficulty(level) {
    this.difficulty = Math.max(1, Math.min(5, level));
    this.config = DIFFICULTY_CONFIG[this.difficulty];
  }

  /**
   * 获取 AI 最佳落子
   * @param {Board} board - 当前棋盘
   * @returns {{row: number, col: number, score: number, thinking: number}}
   */
  getBestMove(board) {
    const startTime = Date.now();
    this.searchStartTime = startTime;
    this.transpositionTable.clear();
    this.nodesSearched = 0;

    const aiPlayer = board.currentPlayer;
    const opponent = aiPlayer === BLACK ? WHITE : BLACK;

    // 第一步下中心
    if (board.moveHistory.length === 0) {
      const center = Math.floor(BOARD_SIZE / 2);
      return { row: center, col: center, score: 0, thinking: Date.now() - startTime };
    }

    // 获取候选点
    let candidates = this._getOrderedCandidates(board, aiPlayer);

    // 低难度随机失误
    if (this.config.mistakeRate > 0 && Math.random() < this.config.mistakeRate) {
      const randomIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
      const move = candidates[randomIdx];
      return { row: move.row, col: move.col, score: 0, thinking: Date.now() - startTime };
    }

    // 检查是否有立即获胜的步
    for (const move of candidates.slice(0, 5)) {
      const testBoard = board.clone();
      const result = testBoard.makeMove(move.row, move.col, aiPlayer);
      if (result.win) {
        return { row: move.row, col: move.col, score: PATTERNS.FIVE, thinking: Date.now() - startTime };
      }
    }

    // 检查是否需要阻止对手获胜
    for (const move of candidates.slice(0, 10)) {
      const testBoard = board.clone();
      testBoard.currentPlayer = opponent;
      const result = testBoard.makeMove(move.row, move.col, opponent);
      if (result.win) {
        return { row: move.row, col: move.col, score: PATTERNS.FIVE - 1, thinking: Date.now() - startTime };
      }
    }

    // Alpha-Beta 搜索
    let bestScore = -Infinity;
    let bestMove = candidates[0];
    let alpha = -Infinity;
    const beta = Infinity;

    // 迭代加深
    for (let depth = 2; depth <= this.config.depth; depth += 2) {
      const searchResult = this._alphaBetaSearch(board, depth, alpha, beta, true, aiPlayer, opponent);
      if (searchResult.move) {
        bestMove = searchResult.move;
        bestScore = searchResult.score;
      }
    }

    const thinking = Date.now() - startTime;
    return { row: bestMove.row, col: bestMove.col, score: bestScore, thinking };
  }

  /**
   * Alpha-Beta 搜索
   */
  _alphaBetaSearch(board, depth, alpha, beta, maximizing, aiPlayer, opponent) {
    this.nodesSearched++;

    // 时间限制检查
    if (this.nodesSearched % 1000 === 0 && Date.now() - this.searchStartTime > THINKING_TIME_LIMIT) {
      return { score: this._evaluateBoard(board, aiPlayer), move: null };
    }

    // 达到搜索深度，返回评估值
    if (depth === 0) {
      return { score: this._evaluateBoard(board, aiPlayer), move: null };
    }

    const currentPlayer = maximizing ? aiPlayer : opponent;
    const candidates = this._getOrderedCandidates(board, currentPlayer);

    if (candidates.length === 0) {
      return { score: this._evaluateBoard(board, aiPlayer), move: null };
    }

    let bestMove = candidates[0];

    if (maximizing) {
      let maxScore = -Infinity;
      for (const move of candidates.slice(0, this.config.maxCandidates)) {
        const newBoard = board.clone();
        const result = newBoard.makeMove(move.row, move.col, currentPlayer);

        let score;
        if (result.win) {
          score = PATTERNS.FIVE + depth; // 越快赢越好
        } else {
          score = this._alphaBetaSearch(newBoard, depth - 1, alpha, beta, false, aiPlayer, opponent).score;
        }

        if (score > maxScore) {
          maxScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Beta 剪枝
      }
      return { score: maxScore, move: bestMove };
    } else {
      let minScore = Infinity;
      for (const move of candidates.slice(0, this.config.maxCandidates)) {
        const newBoard = board.clone();
        const result = newBoard.makeMove(move.row, move.col, currentPlayer);

        let score;
        if (result.win) {
          score = -(PATTERNS.FIVE + depth);
        } else {
          score = this._alphaBetaSearch(newBoard, depth - 1, alpha, beta, true, aiPlayer, opponent).score;
        }

        if (score < minScore) {
          minScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Alpha 剪枝
      }
      return { score: minScore, move: bestMove };
    }
  }

  /**
   * 获取有序候选点（按启发式分数排序）
   */
  _getOrderedCandidates(board, player) {
    const range = this.config.candidateRange;
    const candidates = board.getCandidateMoves(range);

    if (!this.config.usePattern || candidates.length <= 1) {
      return candidates;
    }

    // 按启发式分数排序候选点
    return candidates
      .map((move) => ({
        ...move,
        heuristic: this._evaluatePosition(board, move.row, move.col, player),
      }))
      .sort((a, b) => b.heuristic - a.heuristic);
  }

  /**
   * 评估单个落子点的价值
   */
  _evaluatePosition(board, row, col, player) {
    let score = 0;
    const opponent = player === BLACK ? WHITE : BLACK;

    // 模拟落子后的己方得分
    board.grid[row][col] = player;
    score += this._evaluatePoint(board, row, col, player);
    board.grid[row][col] = EMPTY;

    // 阻止对手在此落子的价值
    board.grid[row][col] = opponent;
    score += this._evaluatePoint(board, row, col, opponent) * 0.9;
    board.grid[row][col] = EMPTY;

    // 中心位置加成
    const center = BOARD_SIZE / 2;
    const distFromCenter = Math.abs(row - center) + Math.abs(col - center);
    score += (BOARD_SIZE - distFromCenter) * 0.5;

    return score;
  }

  /**
   * 评估单个点的棋型
   */
  _evaluatePoint(board, row, col, player) {
    let totalScore = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      totalScore += this._evaluateDirection(board, row, col, dr, dc, player);
    }
    return totalScore;
  }

  /**
   * 评估某方向的棋型
   */
  _evaluateDirection(board, row, col, dr, dc, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let count = 1;
    let openEnds = 0;
    let blocked = 0;

    // 正方向计数
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board.grid[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board.grid[r][c] === EMPTY) {
      openEnds++;
    } else {
      blocked++;
    }

    // 反方向计数
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board.grid[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board.grid[r][c] === EMPTY) {
      openEnds++;
    } else {
      blocked++;
    }

    // 根据连子数和开放端评分
    if (count >= 5) return PATTERNS.FIVE;
    if (blocked === 2) return 0; // 两端被封死

    switch (count) {
      case 4:
        return openEnds === 2 ? PATTERNS.OPEN_FOUR : openEnds === 1 ? PATTERNS.FOUR : 0;
      case 3:
        return openEnds === 2 ? PATTERNS.OPEN_THREE : openEnds === 1 ? PATTERNS.THREE : 0;
      case 2:
        return openEnds === 2 ? PATTERNS.OPEN_TWO : openEnds === 1 ? PATTERNS.TWO : 0;
      case 1:
        return openEnds === 2 ? PATTERNS.ONE : 0;
      default:
        return 0;
    }
  }

  /**
   * 评估整个棋盘（从 player 视角）
   */
  _evaluateBoard(board, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let playerScore = 0;
    let opponentScore = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board.grid[r][c] === player) {
          playerScore += this._evaluatePoint(board, r, c, player);
        } else if (board.grid[r][c] === opponent) {
          opponentScore += this._evaluatePoint(board, r, c, opponent);
        }
      }
    }

    return playerScore - opponentScore * 1.1; // 略偏向防守
  }
}

module.exports = { GomokuAI, DIFFICULTY_CONFIG, PATTERNS };
