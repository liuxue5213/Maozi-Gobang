/**
 * ELO 积分系统
 */

const db = require('./database');
const config = require('../config');

/**
 * 计算 ELO 积分变化
 * @param {number} playerRating - 玩家当前积分
 * @param {number} opponentRating - 对手积分
 * @param {number} result - 1=胜, 0.5=平, 0=负
 * @returns {number} 积分变化值
 */
function calculateRatingChange(playerRating, opponentRating, result) {
  const K = config.rating.kFactor;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(K * (result - expected));
}

/**
 * 更新玩家积分
 * @param {string} userId - 玩家ID
 * @param {string} gameId - 对局ID
 * @param {number} opponentRating - 对手积分
 * @param {number} result - 1=胜, 0.5=平, 0=负
 * @param {number} streak - 当前连胜数
 */
function updatePlayerRating(userId, gameId, opponentRating, result, streak = 0) {
  const user = db.prepare('SELECT rating FROM users WHERE id = ?').get(userId);
  if (!user) return null;

  let change = calculateRatingChange(user.rating, opponentRating, result);

  // 连胜奖励
  if (result === 1 && streak >= 2) {
    change += config.rating.streakBonus * (streak - 1);
  }

  const newRating = Math.max(100, user.rating + change);

  // 更新用户积分和战绩
  const isWin = result === 1;
  const isDraw = result === 0.5;

  db.prepare(
    `UPDATE users SET
      rating = ?,
      games_played = games_played + 1,
      games_won = games_won + ?,
      games_drawn = games_drawn + ?,
      games_lost = games_lost + ?,
      current_streak = ?,
      best_streak = MAX(best_streak, ?)
     WHERE id = ?`
  ).run(
    newRating,
    isWin ? 1 : 0,
    isDraw ? 1 : 0,
    (!isWin && !isDraw) ? 1 : 0,
    isWin ? streak + 1 : 0,
    isWin ? streak + 1 : 0,
    userId
  );

  // 记录积分变动
  db.prepare(
    `INSERT INTO rating_history (user_id, game_id, old_rating, new_rating, change, reason)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, gameId, user.rating, newRating, change, isWin ? '胜利' : isDraw ? '平局' : '失败');

  return { oldRating: user.rating, newRating, change };
}

/**
 * 保存对局记录
 */
function saveGameRecord(gameData) {
  const {
    roomId,
    playerBlack,
    playerWhite,
    winner,
    isAiGame,
    aiDifficulty,
    moves,
    duration,
    ratingChangeBlack,
    ratingChangeWhite,
  } = gameData;

  // 确保没有 undefined 值 (SQLite 不支持)
  db.prepare(
    `INSERT INTO games (id, player_black, player_white, winner, is_ai_game, ai_difficulty,
                        moves, total_moves, duration, rating_change_black, rating_change_white)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    roomId || null,
    playerBlack || null,
    playerWhite || null,
    winner != null ? winner : 0,
    isAiGame ? 1 : 0,
    aiDifficulty || null,
    JSON.stringify(moves || []),
    (moves || []).length,
    duration || 0,
    ratingChangeBlack || 0,
    ratingChangeWhite || 0
  );
}

module.exports = { calculateRatingChange, updatePlayerRating, saveGameRecord };
