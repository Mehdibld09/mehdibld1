#!/bin/sh
echo "=== ROOT DIR ==="
ls -la
echo "=== build/ ==="
ls build/ 2>/dev/null || echo "build/ NOT FOUND"
echo "=== artifacts/steamshare/dist ==="
ls artifacts/steamshare/dist/ 2>/dev/null || echo "artifacts/steamshare/dist NOT FOUND"
