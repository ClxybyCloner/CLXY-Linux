<div align="center">

# CLXY — CLONER X-RAY (Linux)

### Next-Generation Cosmic Neon VPN Powered by Fastly & Mozilla Infrastructure

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20(amd64%20%7C%20arm64)-00E5FF.svg)](https://github.com/ClxybyCloner/CLXY-Linux/releases)
[![Build Status](https://img.shields.io/badge/Build-Passing-10B981.svg)](https://github.com/ClxybyCloner/CLXY-Linux/actions)

</div>

---

## ⚡ What is CLXY?

**CLXY (CLONER X-RAY)** is a high-speed, secure, and resilient Linux VPN client. It carries your internet traffic through Mozilla's global server network on **Fastly's edge infrastructure** over encrypted **HTTP/1.1, HTTP/2, and HTTP/3** tunnels.

Each Firefox Account receives **50 GB/month** of high-speed data. With CLXY's intelligent **Multi-Account Quota Failover**, multiple accounts can be configured in priority order so that when your active quota reaches 95%, the client switches to the next account seamlessly without dropping open connections.

CLXY for Linux combines the **battle-tested Linux Core** with the official **CLXY Cosmic Neon UI**.

---

## 🚀 Key Capabilities

- **Cosmic Neon User Interface:** High-fidelity Glassmorphic dark UI with animated route tunnels, real-time download/upload speed gauges, and glowing connection controls.
- **Three Operation Modes:**
  - **TUN Mode:** Full-system IP packet routing through virtual `tun` interface via sing-tun and Google gVisor network stack.
  - **System Setting Mode:** Automatically configures GNOME / system-wide proxy settings.
  - **Proxy Mode:** Serves high-speed local SOCKS5 and HTTP proxy endpoints on `127.0.0.1:10810`.
- **Mozilla / Firefox Account Authentication:** Multi-step authentication supporting email verification codes, 2FA TOTP, unblock codes, and bot challenge/CAPTCHA validation.
- **Smart Quota & Failover:** Visual 50 GB quota progress bar, renewal dates, and automatic background rotation.
- **Server Discovery & Ping:** Global edge locations with real-time HTTP/2 latency measurement ("Test Real Delay") and Fastest server selection.
- **Encrypted DNS:** DNS-over-HTTPS (DoH) and DNS-over-TLS (DoT) with built-in Cloudflare, Quad9, and Google resolvers, plus filtering diagnostic checks.
- **Anti-Censorship & Bypass:**
  - ClientHello TLS fragmentation (`hello_split`) to defeat SNI-based filtering.
  - Upstream SOCKS5 proxy chaining.
  - Personal Cloudflare Worker / API relay (`network.api_relay`) with live health diagnostics.
- **Split Tunneling (Routing Rules):** Bypass regional domestic websites (Iran, China, Russia, Turkey, Brazil) directly and block intrusive advertisements (`geosite:category-ads-all`).
- **Live Diagnostics & Logging:** 4-stage connection test (Tunnel, Handshake, Response, Public IP) and real-time Server-Sent Events (SSE) log terminal.

---

## 📥 Installation on Linux

### Quick Install (One-Liner)
Run the automated installer in your Linux terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/ClxybyCloner/CLXY-Linux/main/install.sh | bash
```

The script automatically detects your architecture (`amd64` or `arm64`) and session type:
- **Desktop Environments (GNOME, KDE, XFCE):** Installs the graphical desktop application, creates application menu shortcuts, and configures the system tray.
- **Server / Headless Environments:** Installs `clxy-core` as a `systemd` daemon, accessible via the web dashboard at `http://127.0.0.1:10820/app/`.

---

## 🛠️ Manual Installation & Releases

Download precompiled binaries from the [Releases](https://github.com/ClxybyCloner/CLXY-Linux/releases) page:

| Package | Architecture | Description |
|---|---|---|
| `CLXY-Linux-amd64.tar.gz` | x86_64 / amd64 | Standalone Linux Desktop Application Bundle |
| `CLXY-Linux-arm64.tar.gz` | aarch64 / arm64 | ARM64 Linux Desktop Application Bundle |
| `clxy-core-linux-amd64.tar.gz` | x86_64 / amd64 | Linux Core daemon + CLI + Embedded Web Dashboard |
| `clxy-core-linux-arm64.tar.gz` | aarch64 / arm64 | ARM64 Core daemon + CLI + Embedded Web Dashboard |

### Extracting and Running the Core

```bash
tar -xzf clxy-core-linux-amd64.tar.gz
cd clxy-core-linux-amd64

# Run interactively (opens Web UI at http://127.0.0.1:10820/app/)
./clxy-core

# Install as systemd service
sudo ./install-systemd.sh install ./clxy-core
```

---

## 🖥️ Building From Source

### Prerequisites
- Go 1.27.x or later
- Node.js 20+ (for desktop packaging)
- Linux build tools: `clang`, `cmake`, `ninja-build`, `pkg-config`, `libgtk-3-dev` (if building native TUN test)

### Build Steps

```bash
git clone https://github.com/ClxybyCloner/CLXY-Linux.git
cd CLXY-Linux

# Build Linux Core binaries
bash scripts/build-linux-core.sh

# Build Linux Desktop bundle
bash scripts/build-linux-desktop.sh

# Run complete build and produce checksums
bash scripts/build-all.sh
```

Compiled binaries and archives are written to `dist/`.

---

## ⚙️ Service Control

When installed as a systemd service:

```bash
# Check service status
sudo systemctl status clxy

# Start / Stop / Restart
sudo systemctl start clxy
sudo systemctl stop clxy
sudo systemctl restart clxy

# Check logs
journalctl -u clxy -f
```

---

## 📄 License & Attribution

- **License:** GNU General Public License v3.0 ([LICENSE](LICENSE)).
- **Core Engine Attribution:** Unofficial client integrating the Linux Core from [arman-vpn-client](https://github.com/armanlife/arman-vpn-client).
- **Brand & Visuals:** CLXY — CLONER X-RAY.
- Third-party notices and component licenses are detailed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
