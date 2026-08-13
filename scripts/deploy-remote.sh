#!/usr/bin/env bash
#
# 从本地触发一次生产部署。
#
#   1. 确认工作区干净、已推送 —— 线上跑的必须是某个能追溯的提交
#   2. 优先让服务器自己从 GitHub 拉（可追溯）
#   3. 拉不动就退回 rsync 推送（国内服务器拉 GitHub 经常超时，这是常态不是异常）
#   4. 服务器上构建 + 验活
#
set -euo pipefail

SERVER="${SERVER:-root@111.229.116.6}"
IDENTITY_FILE="${IDENTITY_FILE:-$HOME/.ssh/server.pem}"
REMOTE_DIR="${REMOTE_DIR:-/www/wwwroot/learn-ai}"
BRANCH="${BRANCH:-main}"
SITE="${SITE:-https://xslaoxu.cn/learn-ai/}"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 -i "$IDENTITY_FILE" "$SERVER")

cd "$(dirname "${BASH_SOURCE[0]}")/.."

[[ -f "$IDENTITY_FILE" ]] || { echo "[deploy] 找不到 ssh 私钥：$IDENTITY_FILE" >&2; exit 1; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo '[deploy] 工作区有未提交的改动，先提交再发布' >&2
  git status --short >&2
  exit 1
fi

echo "[deploy] 推送 $BRANCH"
git push -q origin "$BRANCH"
LOCAL_HEAD="$(git rev-parse HEAD)"

echo "[deploy] 让服务器从 GitHub 拉（最多 150s）"
if "${SSH[@]}" "cd $REMOTE_DIR && timeout 150 git fetch -q origin $BRANCH && git reset --hard -q origin/$BRANCH" 2>/dev/null; then
  echo "[deploy] git 拉取成功"
else
  echo "[deploy] git 拉取超时，改用 rsync 推送同一份工作区"
  # --filter=':- .gitignore' 让 rsync 照着 .gitignore 走 —— 素材工作现场（几百 MB 视频、
  # 论文源文件）不进仓库，也就不该推到服务器。2026-08-13 漏了这一条，
  # 967 MB 素材被推上去，服务器还照着它现场重新生成了页面。
  rsync -az --delete --timeout=120 -e "ssh -o BatchMode=yes -i $IDENTITY_FILE" \
    --filter=':- .gitignore' \
    --exclude '.git' --exclude 'dist' --exclude 'node_modules' \
    --exclude '.claude' --exclude '.DS_Store' \
    ./ "$SERVER:$REMOTE_DIR/"
fi

echo "[deploy] 服务器构建"
"${SSH[@]}" "bash -lc 'export PATH=/www/server/nodejs/v18.20.8/bin:\$PATH
  cd $REMOTE_DIR && node src/build.mjs && chown -R www:www dist'"

for _ in {1..10}; do
  if curl -fsS -o /dev/null "$SITE"; then
    echo "[deploy] done · $SITE · $(git log --oneline -1 "$LOCAL_HEAD")"
    exit 0
  fi
  sleep 2
done

echo "[deploy] 健康检查未通过：$SITE" >&2
exit 1
