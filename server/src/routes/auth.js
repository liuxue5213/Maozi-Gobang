/**
 * 用户认证路由 (注册/登录)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/database');
const { generateToken } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

// 注册
router.post('/register', (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度应为3-20个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

    // 检查用户名是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const userId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare(
      `INSERT INTO users (id, username, password, nickname, rating) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, username, hashedPassword, nickname || username, config.rating.initial);

    const token = generateToken(userId);
    res.json({
      token,
      user: {
        id: userId,
        username,
        nickname: nickname || username,
        rating: config.rating.initial,
      },
    });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        rating: user.rating,
        gamesPlayed: user.games_played,
        gamesWon: user.games_won,
      },
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
