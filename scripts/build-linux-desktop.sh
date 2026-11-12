#!/usr/bin/env bash
# ==============================================================================
# Builds CLXY Desktop Package for Linux (amd64 / arm64)
# Outputs:
#   dist/CLXY-Linux-amd64.tar.gz
#   dist/CLXY-Linux-arm64.tar.gz
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${APP_VERSION:-1.0.1}"

echo "Packaging CLXY Desktop v$VERSION for Linux..."
mkdir -p "$ROOT/dist"

case "$(uname -m)" in
  x86_64 | amd64) ARCH=amd64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) ARCH=amd64 ;;
esac

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
app="$stage/clxy"
mkdir -p "$app/core" "$app/assets"

# Copy binaries
if [ -f "$ROOT/dist/clxy-core-linux-$ARCH.tar.gz" ]; then
  tar -xzf "$ROOT/dist/clxy-core-linux-$ARCH.tar.gz" -C "$stage"
  cp "$stage/clxy-core-linux-$ARCH/clxy-core" "$app/core/clxy-core"
  cp "$stage/clxy-core-linux-$ARCH/clxy-tun" "$app/core/clxy-tun"
else
  (cd "$ROOT/core" && CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -trimpath -o "$app/core/clxy-core" ./cmd/clxy-core)
  (cd "$ROOT/core" && CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -tags with_gvisor -trimpath -o "$app/core/clxy-tun" ./cmd/clxy-tun)
fi

# Copy Desktop Shell & UI
cp -r "$ROOT/desktop"/* "$app/"
cp "$ROOT/desktop/assets/logo.png" "$app/assets/logo.png"
cp "$ROOT/LICENSE" "$app/LICENSE"
cp "$ROOT/THIRD_PARTY_NOTICES.md" "$app/THIRD_PARTY_NOTICES.md"

# Wrapper executable
cat << 'EOF' > "$app/clxy"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$DIR/core:$PATH"
if command -v electron >/dev/null 2>&1; then
  exec electron "$DIR/main.js" "$@"
elif [ -f "$DIR/clxy-electron" ]; then
  exec "$DIR/clxy-electron" "$@"
else
  # Fallback to browser UI mode
  "$DIR/core/clxy-core" -tray &
  CORE_PID=$!
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:10820/app/"
  fi
  wait $CORE_PID
fi
EOF
chmod +x "$app/clxy"

out="$ROOT/dist/CLXY-Linux-$ARCH.tar.gz"
tar -czf "$out" -C "$stage" clxy
echo "✓ Built $out"
