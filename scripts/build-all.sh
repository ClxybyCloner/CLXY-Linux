#!/usr/bin/env bash
# ==============================================================================
# Complete Build Pipeline for CLXY Linux
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export APP_VERSION="${1:-1.0.0}"

echo "Starting CLXY Linux build pipeline (v$APP_VERSION)..."

bash "$ROOT/scripts/build-linux-core.sh"
bash "$ROOT/scripts/build-linux-desktop.sh"

echo "Generating SHA256 checksums..."
(cd "$ROOT/dist" && sha256sum *.tar.gz > SHA256SUMS.txt)

echo "=============================================="
echo "Build pipeline finished successfully!"
cat "$ROOT/dist/SHA256SUMS.txt"
echo "=============================================="
