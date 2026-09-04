#!/bin/bash
# ============================================
# 猫子五子棋 - 服务器部署脚本
# 目标服务器: 120.48.13.152
# ============================================

set -e

# 配置
SERVER_HOST="120.48.13.152"
SERVER_USER="root"
SERVER_PORT="22"
APP_DIR="/opt/maozi-gobang"
NODE_VERSION="20"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  猫子五子棋 - 部署到 ${SERVER_HOST}${NC}"
echo -e "${GREEN}============================================${NC}"

# 1. 检查本地依赖
echo -e "\n${YELLOW}[1/6] 检查本地环境...${NC}"
if ! command -v npm &> /dev/null; then
  echo -e "${RED}错误: 未安装 npm${NC}"
  exit 1
fi

# 2. 安装依赖并构建
echo -e "\n${YELLOW}[2/6] 安装依赖...${NC}"
cd "$(dirname "$0")/../server"
npm ci --production

# 3. 打包项目
echo -e "\n${YELLOW}[3/6] 打包项目...${NC}"
cd "$(dirname "$0")/.."
tar -czf /tmp/maozi-gobang.tar.gz \
  server/src \
  server/package.json \
  server/package-lock.json \
  web/ \
  deploy/

# 4. 上传到服务器
echo -e "\n${YELLOW}[4/6] 上传到服务器...${NC}"
scp -P ${SERVER_PORT} /tmp/maozi-gobang.tar.gz ${SERVER_USER}@${SERVER_HOST}:/tmp/

# 5. 在服务器上部署
echo -e "\n${YELLOW}[5/6] 在服务器上部署...${NC}"
ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << 'REMOTE_SCRIPT'
  set -e

  # 创建应用目录
  mkdir -p /opt/maozi-gobang
  cd /opt/maozi-gobang

  # 解压
  tar -xzf /tmp/maozi-gobang.tar.gz
  mv server/* . 2>/dev/null || true
  mv web/ . 2>/dev/null || true

  # 安装 Node.js (如果未安装)
  if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  # 安装生产依赖
  cd /opt/maozi-gobang
  npm ci --production

  # 安装 PM2 (如果未安装)
  if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
  fi

  # 使用 PM2 启动/重启
  # 注意: 游戏房间状态在内存中，必须用 fork 单实例模式
  # (cluster 模式会导致在线匹配跨进程失效、polling 升级间歇失败)
  pm2 describe maozi-gobang > /dev/null 2>&1 && pm2 stop maozi-gobang || true
  pm2 start src/index.js --name maozi-gobang \
    --max-memory-restart 512M \
    --env production \
    -f
  pm2 save

  # 设置开机自启
  pm2 startup systemd -u root --hp /root 2>/dev/null || true

  echo "部署完成！"
REMOTE_SCRIPT

# 6. 验证部署
echo -e "\n${YELLOW}[6/6] 验证部署...${NC}"
sleep 3
HEALTH=$(curl -s --max-time 5 http://${SERVER_HOST}:3000/health 2>/dev/null || echo "failed")

if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}  部署成功！服务器运行正常${NC}"
  echo -e "${GREEN}  地址: http://${SERVER_HOST}:3000${NC}"
  echo -e "${GREEN}============================================${NC}"
else
  echo -e "${RED}部署可能有问题，请检查服务器日志${NC}"
  echo -e "运行: ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs maozi-gobang'"
fi

# 清理
rm -f /tmp/maozi-gobang.tar.gz
