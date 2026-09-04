/**
 * API 路由 (排行榜、用户信息、对局记录)
 */

const express = require('express');
const db = require('../utils/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 排行榜 - Top N
router.get('/leaderboard', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const users = db
      .prepare(
        `SELECT id, username, nickname, rating, games_played, games_won,
                ROW_NUMBER() OVER (ORDER BY rating DESC) as rank
         FROM users
         ORDER BY rating DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    res.json({
      leaderboard: users,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('获取排行榜错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户信息
router.get('/user/profile', authMiddleware, (req, res) => {
  try {
    const user = db
      .prepare(
        `SELECT id, username, nickname, avatar, rating, games_played, games_won,
                games_lost, games_drawn, current_streak, best_streak, created_at
         FROM users WHERE id = ?`
      )
      .get(req.userId);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 计算排名
    const rank = db
      .prepare('SELECT COUNT(*) + 1 as rank FROM users WHERE rating > ?')
      .get(user.rating).rank;

    res.json({ ...user, rank });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取对局记录
router.get('/user/games', authMiddleware, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    const games = db
      .prepare(
        `SELECT g.*,
                b.username as black_name,
                w.username as white_name
         FROM games g
         LEFT JOIN users b ON g.player_black = b.id
         LEFT JOIN users w ON g.player_white = w.id
         WHERE g.player_black = ? OR g.player_white = ?
         ORDER BY g.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(req.userId, req.userId, limit, offset);

    res.json({ games, limit, offset });
  } catch (err) {
    console.error('获取对局记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取积分变动历史
router.get('/user/rating-history', authMiddleware, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);

    const history = db
      .prepare(
        `SELECT old_rating, new_rating, change, reason, created_at
         FROM rating_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(req.userId, limit);

    res.json({ history });
  } catch (err) {
    console.error('获取积分历史错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取在线人数
router.get('/online-count', (req, res) => {
  const count = req.app.get('roomManager')?.getOnlineCount() || 0;
  res.json({ count });
});

module.exports = router;
