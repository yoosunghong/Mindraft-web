#!/bin/sh
# evidence.html / compare.html -> PDF (Edge headless)
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --print-to-pdf="$(cygpath -w "$PWD/Mindraft_서비스기술증빙.pdf")" "file:///$(cygpath -m "$PWD/evidence.html")" >/dev/null 2>&1
"$EDGE" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --print-to-pdf="$(cygpath -w "$PWD/Mindraft_유사서비스비교.pdf")" "file:///$(cygpath -m "$PWD/compare.html")" >/dev/null 2>&1
