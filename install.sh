#!/usr/bin/env bash
# ==============================================================================
# CLXY — CLONER X-RAY Linux Universal Installer
# Installs or updates CLXY on Linux:
#   curl -fsSL https://raw.githubusercontent.com/ClxybyCloner/CLXY-Linux/main/install.sh | bash
# ==============================================================================
set -euo pipefail

REPO="ClxybyCloner/CLXY-Linux"
VERSION="${VERSION:-latest}"
if [ "$VERSION" = "latest" ]; then
  BASE_URL="${BASE_URL:-https://github.com/$REPO/releases/latest/download}"
else
  BASE_URL="${BASE_URL:-https://github.com/$REPO/releases/download/$VERSION}"
fi

COMMAND="/usr/local/bin/clxy"
INSTALL_DIR="/opt/clxy"
DATA_DIR="${INSTALL_DIR}/user-data"
SERVICE_NAME="clxy"
TUN_SERVICE="clxy-tun"

# Colors
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD='\e[1m' DIM='\e[2m' OFF='\e[0m'
  CYAN='\e[36m' GREEN='\e[32m' YELLOW='\e[33m' RED='\e[31m'
else
  BOLD="" DIM="" OFF="" CYAN="" GREEN="" YELLOW="" RED=""
fi

echo -e "${CYAN}${BOLD}"
echo "   ____ _     __  ____   __"
echo "  / ___| |    \ \/ /\ \ / /"
echo " | |   | |     \  /  \ V / "
echo " | |___| |___  /  \   | |  "
echo "  \____|_____|/_/\_\  |_|  "
echo -e "${OFF}"
echo -e "${BOLD}CLXY — CLONER X-RAY Linux Client${OFF}"
echo "=============================================="

# Check architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64)
    GOARCH="amd64"
    ;;
  aarch64 | arm64)
    GOARCH="arm64"
    ;;
  *)
    echo -e "${RED}Unsupported processor architecture: $ARCH${OFF}" >&2
    exit 1
    ;;
esac

echo -e "Detected architecture: ${CYAN}${GOARCH}${OFF}"

# Determine mode: desktop or server
HAS_DISPLAY=0
if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
  HAS_DISPLAY=1
fi

MODE="${1:-}"
if [ -z "$MODE" ]; then
  if [ "$HAS_DISPLAY" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
    MODE="desktop"
  else
    MODE="server"
  fi
fi

echo -e "Target mode: ${CYAN}${MODE}${OFF}"

# Temporary stage
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ "$MODE" = "server" ]; then
  echo -e "\n${BOLD}Installing CLXY Linux Core Service...${OFF}"
  
  CORE_TAR="clxy-core-linux-${GOARCH}.tar.gz"
  DOWNLOAD_URL="${BASE_URL}/${CORE_TAR}"
  
  echo "Downloading $DOWNLOAD_URL..."
  if ! curl -fsSL "$DOWNLOAD_URL" -o "$STAGE/$CORE_TAR"; then
    echo -e "${YELLOW}Release package not found on CDN. Building or falling back to local bundle...${OFF}"
    if [ -f "dist/$CORE_TAR" ]; then
      cp "dist/$CORE_TAR" "$STAGE/$CORE_TAR"
    else
      echo -e "${RED}Failed to download $CORE_TAR${OFF}" >&2
      exit 1
    fi
  fi
  
  tar -xzf "$STAGE/$CORE_TAR" -C "$STAGE"
  
  # Run systemd installer as root
  if [ "$(id -u)" -ne 0 ]; then
    echo "Administrative privileges required for system service installation."
    sudo bash "$STAGE/clxy-core-linux-${GOARCH}/install-systemd.sh" install "$STAGE/clxy-core-linux-${GOARCH}/clxy-core"
  else
    bash "$STAGE/clxy-core-linux-${GOARCH}/install-systemd.sh" install "$STAGE/clxy-core-linux-${GOARCH}/clxy-core"
  fi

  echo -e "\n${GREEN}✓ CLXY Linux Core service installed successfully!${OFF}"
  echo -e "Web Dashboard: ${CYAN}http://127.0.0.1:10820/app/${OFF}"
  echo -e "SOCKS5 Proxy:  ${CYAN}127.0.0.1:10810${OFF}"
  echo -e "Status:        ${CYAN}sudo clxy status${OFF}"

else
  echo -e "\n${BOLD}Installing CLXY Desktop Application...${OFF}"
  
  APP_TAR="CLXY-Linux-${GOARCH}.tar.gz"
  DOWNLOAD_URL="${BASE_URL}/${APP_TAR}"
  
  echo "Downloading $DOWNLOAD_URL..."
  if ! curl -fsSL "$DOWNLOAD_URL" -o "$STAGE/$APP_TAR"; then
    echo -e "${YELLOW}Release package not found on CDN. Falling back to local dist...${OFF}"
    if [ -f "dist/$APP_TAR" ]; then
      cp "dist/$APP_TAR" "$STAGE/$APP_TAR"
    else
      echo -e "${RED}Failed to download $APP_TAR${OFF}" >&2
      exit 1
    fi
  fi

  USER_OPT="$HOME/.local/opt/clxy"
  mkdir -p "$USER_OPT"
  tar -xzf "$STAGE/$APP_TAR" -C "$USER_OPT" --strip-components=1

  # Create desktop launcher
  DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
  mkdir -p "$DATA_HOME/applications"
  cat <<EOF > "$DATA_HOME/applications/clxy.desktop"
[Desktop Entry]
Name=CLXY
GenericName=VPN Client
Comment=CLXY — CLONER X-RAY Fastly VPN Client
Exec=$USER_OPT/clxy %U
Icon=$USER_OPT/assets/logo.png
Terminal=false
Type=Application
Categories=Network;Security;
StartupWMClass=CLXY
EOF

  # Symlink to bin
  mkdir -p "$HOME/.local/bin"
  ln -sf "$USER_OPT/clxy" "$HOME/.local/bin/clxy"

  echo -e "\n${GREEN}✓ CLXY Desktop application installed successfully!${OFF}"
  echo -e "Run from your application menu or type: ${CYAN}clxy${OFF}"
fi
