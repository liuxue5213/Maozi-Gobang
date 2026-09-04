# 帽子五子棋 (Maozi Gobang)

跨平台五子棋游戏，支持高智能 AI、在线实时对战、积分排行榜系统。

## 功能特性

- 🤖 **人机对战** - 5 个难度等级 AI（入门 → 大师）
- ⚔️ **在线对战** - WebSocket 实时匹配对战
- 🏆 **积分系统** - ELO 积分算法 + 实时排行榜
- 💬 **实时聊天** - 游戏内聊天功能
- 📱 **跨平台** - Web + Android (APK)

## 技术栈

| 模块 | 技术 |
|------|------|
| 后端 | Node.js + Express + Socket.IO |
| 前端 | 原生 JavaScript + Canvas |
| 数据库 | SQLite (可切换 PostgreSQL) |
| AI | Alpha-Beta 剪枝 + 启发式评估 |
| 部署 | Docker / PM2 |
| 移动端 | Flutter WebView |

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件设置配置
```

### 3. 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. 访问

打开浏览器访问 `http://localhost:3000`

## 部署

### 方式一：直接部署

```bash
# 赋予执行权限
chmod +x deploy/deploy.sh

# 执行部署
./deploy/deploy.sh
```

### 方式二：Docker 部署

```bash
cd deploy
docker-compose up -d
```

### 方式三：PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start deploy/ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs maozi-gobang
```

## GitHub Actions

### 自动构建 APK

推送到 `main` 分支或创建 `v*` 标签时自动构建 Android APK。

构建产物可在 Actions 页面的 Artifacts 下载。

### 自动部署

推送到 `main` 分支时自动部署到服务器。

需要在 GitHub Secrets 中配置：
- `SERVER_HOST` - 服务器 IP
- `SERVER_USER` - 服务器用户名
- `SERVER_PASSWORD` - 服务器密码
- `SERVER_PORT` - SSH 端口 (默认 22)
- `GH_TOKEN` - GitHub 个人访问令牌

## API 文档

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/leaderboard | 获取排行榜 |
| GET | /api/user/profile | 获取用户信息 (需登录) |
| GET | /api/user/games | 获取对局记录 (需登录) |
| GET | /api/user/rating-history | 获取积分历史 (需登录) |
| GET | /api/online-count | 获取在线人数 |
| GET | /health | 健康检查 |

### WebSocket 事件

**客户端 → 服务器：**
- `find-match` - 开始匹配
- `cancel-match` - 取消匹配
- `create-ai-game` - 创建人机对战
- `make-move` - 落子
- `resign` - 认输
- `offer-draw` - 求和
- `accept-draw` - 接受求和
- `chat` - 发送聊天消息

**服务器 → 客户端：**
- `match-found` - 匹配成功
- `ai-game-created` - 人机对战已创建
- `move-made` - 已落子
- `game-over` - 游戏结束
- `game-draw` - 平局
- `game-resigned` - 有玩家认输
- `draw-offered` - 收到求和请求
- `chat-message` - 聊天消息

## AI 难度说明

| 等级 | 名称 | 搜索深度 | 特点 |
|------|------|---------|------|
| ⭐ | 入门 | 2 | 会随机失误 20% |
| ⭐⭐ | 简单 | 3 | 基础棋型判断，偶尔失误 |
| ⭐⭐⭐ | 中等 | 4 | 完整棋型评估 |
| ⭐⭐⭐⭐ | 困难 | 6 | 深度搜索 + 精确评估 |
| ⭐⭐⭐⭐⭐ | 大师 | 8+ | 最强 AI，接近完美 |

## 目录结构

```
maozi-gobang/
├── server/                  # 后端服务
│   ├── src/
│   │   ├── ai/             # AI 引擎
│   │   ├── game/           # 游戏逻辑
│   │   ├── routes/         # API 路由
│   │   ├── middleware/     # 中间件
│   │   ├── utils/          # 工具函数
│   │   ├── config/         # 配置
│   │   └── index.js        # 入口
│   └── package.json
├── web/                    # Web 前端
│   ├── index.html
│   └── src/
│       ├── css/
│       └── js/
├── mobile/                 # Flutter 移动端
├── deploy/                 # 部署相关
│   ├── deploy.sh           # 部署脚本
│   ├── Dockerfile          # Docker 镜像
│   ├── docker-compose.yml  # Docker Compose
│   └── ecosystem.config.js # PM2 配置
└── .github/workflows/      # GitHub Actions
    ├── build-apk.yml       # APK 构建
    └── deploy-server.yml   # 服务器部署
```

## License

MIT
