#!/usr/bin/env bash
# ==============================================================================
# Builds CLXY Linux Core and TUN service into dist/
# Outputs:
#   dist/clxy-core-linux-amd64.tar.gz
#   dist/clxy-core-linux-arm64.tar.gz
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${APP_VERSION:-1.0.0}"

echo "Building CLXY Linux Core v$VERSION..."
mkdir -p "$ROOT/dist"

for arch in amd64 arm64; do
  name="clxy-core-linux-$arch"
  stage="$(mktemp -d)"
  mkdir -p "$stage/$name"

  echo "Compiling clxy-core ($arch)..."
  (cd "$ROOT/core" && CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -trimpath \
    -ldflags "-s -w -X github.com/armanlife/arman-vpn-client/core/internal/version.Current=$VERSION" \
    -o "$stage/$name/clxy-core" ./cmd/clxy-core)

  echo "Compiling clxy-tun ($arch)..."
  (cd "$ROOT/core" && CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -tags with_gvisor -trimpath \
    -ldflags "-s -w -X github.com/armanlife/arman-vpn-client/core/internal/version.Current=$VERSION" \
    -o "$stage/$name/clxy-tun" ./cmd/clxy-tun)

  install -m 0755 "$ROOT/core/scripts/install-systemd.sh" "$stage/$name/install-systemd.sh"
  install -m 0644 "$ROOT/LICENSE" "$stage/$name/LICENSE"
  install -m 0644 "$ROOT/THIRD_PARTY_NOTICES.md" "$stage/$name/THIRD_PARTY_NOTICES.md"

  tar -czf "$ROOT/dist/$name.tar.gz" -C "$stage" "$name"
  rm -rf "$stage"
  echo "✓ Built dist/$name.tar.gz"
done
