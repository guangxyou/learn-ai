#!/usr/bin/env bash
#
# 在服务器上执行：拉代码 → 构建 → 健康检查。
# 静态站，没有常驻进程，所以不需要 PM2；构建失败时 dist/ 还是旧的，线上不受影响。
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN_DIR="${NODE_BIN_DIR:-/www/server/nodejs/v18.20.8/bin}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://xslaoxu.cn/learn-ai/}"
export PATH="$NODE_BIN_DIR:$PATH"

cd "$APP_DIR"
git fetch origin main -q
git reset --hard origin/main -q
echo "[deploy] $(git log --oneline -1)"

node src/build.mjs

chown -R www:www dist
find dist -type d -exec chmod 755 {} +
find dist -type f -exec chmod 644 {} +

if curl -fsS -o /dev/null "$HEALTHCHECK_URL"; then
  echo "[deploy] done · $HEALTHCHECK_URL"
else
  echo "[deploy] 健康检查未通过，检查 nginx 配置" >&2
  exit 1
fi
