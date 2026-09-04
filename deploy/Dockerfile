# 猫子五子棋 - Docker 镜像
FROM node:20-alpine

# 安装 better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件
COPY server/package*.json ./

# 安装依赖
RUN npm ci --production

# 复制源码
COPY server/src ./src
COPY web ./web

# 创建数据目录
RUN mkdir -p /app/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/gobang.db

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "src/index.js"]
