/**
 * 服务器配置
 */

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'maozi-gobang-secret-key-change-in-production',
  jwtExpires: '7d',

  // 游戏配置
  game: {
    boardSize: 15,
    turnTimeLimit: 30, // 每步限时(秒)
    defaultDifficulty: 3,
  },

  // 积分配置 (ELO)
  rating: {
    initial: 1000,
    kFactor: 32,
    winBonus: 0,
    streakBonus: 5, // 连胜额外加分
  },

  // 数据库
  db: {
    path: process.env.DB_PATH || './data/gobang.db',
  },
};
