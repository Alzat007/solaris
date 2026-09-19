#!/bin/zsh
cd "${0:A:h}"
SOLARIS_NODE="$(command -v node)"
if [[ -z "$SOLARIS_NODE" ]]; then
  SOLARIS_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$SOLARIS_NODE" ]]; then
  print '请先安装 Node.js 20.19 或更新版本，再运行 npm install 和 npm run dev。'
  read '?按回车退出…'
  exit 1
fi
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  print '请在当前目录运行 npm install 后再次打开。'
  read '?按回车退出…'
  exit 1
fi
print 'SOLARIS 即将启动。请打开下方 Local 地址；Ctrl+C 停止。'
exec "$SOLARIS_NODE" node_modules/vite/bin/vite.js --host 0.0.0.0
