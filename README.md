# Wazzap?

**English** · [Türkçe](README.tr.md)

A lightweight Windows and Linux desktop client for WhatsApp Web. Wazzap? opens the official WhatsApp Web in its
own window and adds themes, a phone-sized and a mini window, scheduled messages and a media
collector on top. It does not touch messaging itself: the session, encryption and connection are
WhatsApp Web's own. Built with Tauri and the system webview (WebView2 on Windows, WebKitGTK on
Linux) instead of Electron.

> **Disclaimer:** Wazzap? is an independent project. It is not affiliated with, endorsed by or
> sponsored by WhatsApp LLC or Meta Platforms. "WhatsApp" is a trademark of Meta. Scheduled
> messages are sent by driving the WhatsApp Web interface on your behalf, and WhatsApp's terms
> restrict automated messaging. Wazzap? is meant for personal, occasional use; do not use it for
> bulk messaging. Use at your own risk.

## Install

### Windows

Download `Wazzap_*_x64-setup.exe` from [Releases](../../releases/latest) and run it. Scan the QR
code with your phone once; the session is kept. The app checks for new versions itself and installs
them in one click.

The installer is not code-signed, so Windows may show "Windows protected your PC" the first time:
choose **More info → Run anyway**.

The interface is in English and Turkish. It follows the system language; change it under
Settings → Desktop.

### Arch Linux

Install the build dependencies and run from this checkout:

```sh
sudo pacman -S --needed base-devel rust webkit2gtk-4.1 libappindicator librsvg pkgconf
cargo run --locked
```

To build an installable Arch package, use [`arch/PKGBUILD`](arch/PKGBUILD) with `makepkg -si` from
the `arch` directory after these changes are available in the Git repository. The package installs
the binary, desktop entry and icons. The recipe follows the latest Git commit, so update it with
`makepkg -si` or an AUR helper. It is not published to the AUR yet.

Linux uses WebKitGTK. A desktop environment with a system tray or AppIndicator support is needed
for the tray menu; “Close to tray” starts disabled on Linux and can be enabled in Settings. On
Wayland, the global show/hide shortcut and window positioning may depend on the compositor.

### Build from source on Windows

Double-click `derle.bat`. On first run it installs **Rust** and the **Visual Studio C++ build
tools** with winget if they are missing (one time, a few GB, asks for admin rights), builds the app,
installs it to `%LOCALAPPDATA%\Programs\Wazzap` and adds shortcuts. A copy installed this way takes
updates from the project folder instead of GitHub, which is handy for development.

## Features

- **Themes.** Five presets (Black, Chrome, Y2K, Navy, Light), every colour editable, live preview,
  save / import / export as `.wptema` files. The theme engine remaps WhatsApp's colour variables by
  lightness rather than by name, so it mostly survives WhatsApp redesigns. Works best with
  WhatsApp's own dark theme.
- **Phone mode** (Ctrl+1): a 390 × 844 single-panel layout that snaps to the right edge of the
  screen. **Compact** (Ctrl+3) and **normal** (Ctrl+2) modes too.
- **Mini window** (Ctrl+4): 360 × 560, bottom-right corner, stays on top.
- **Custom title bar** in every mode: mini window, pin (always on top), minimise, maximise, close.
  Drag to move, double-click to maximise, Windows Snap and edge resizing work.
- **Scheduled messages** (clock button or Ctrl+Shift+Enter): shown as a faded outgoing bubble in the
  chat and in a "Scheduled" section above the chat list; send now, edit or cancel from there.
  Wazzap? must be running (the tray is enough) and the computer awake. Messages more than 10 minutes
  late are not sent automatically.
- **Media collector** (Ctrl+Shift+M): images, videos and documents of the open chat in tabs; save
  selected or all to `Downloads\Wazzap\<chat>` at full resolution.
- **Desktop integration:** unread tray indicator, notifications, tray, global show / hide shortcut
  (Ctrl+Shift+Space), start at login, zoom. Windows also has a taskbar badge and notifications that
  open the chat when clicked.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + Shift + Space | Show / hide from anywhere |
| Ctrl + 1 / 2 / 3 / 4 | Phone / normal / compact / mini window |
| Ctrl + T | Always on top |
| Ctrl + , | Settings and theme editor |
| Ctrl + + / − / 0 | Zoom |
| Esc | Back to the chat list in phone mode |
| Ctrl + Shift + Enter | Schedule the message in the compose box |
| Ctrl + Shift + M | Media collector |
| Ctrl + Shift + I | Developer tools |

Closing the window keeps Wazzap? running in the tray; quit from the tray menu.

## Privacy

Wazzap? adds no servers, analytics or accounts. Everything it stores stays on your computer in
`%APPDATA%\com.kvbilai.wazzap` on Windows or the XDG config/data directories on Linux: settings
(`ayarlar.json`), scheduled messages (`zamanli.json`) and,
only when you ask for one, diagnostic files (`tanilama/`) that contain colour variables and page
structure but no messages, names or numbers. The only network request Wazzap? itself makes is the
update check against this repository's GitHub Releases on Windows. Linux packages are updated
through the package manager.

## Development

| Path | What |
| --- | --- |
| `src/main.rs` | Window, modes, tray, shortcuts, notifications, scheduler, updates |
| `src/settings.rs` | Settings and the default theme |
| `src/schedule.rs` | Scheduled message store and the timing decision (unit tested) |
| `src/update.rs` | Update check from the project folder (development installs) |
| `src/badge.rs` | Windows taskbar badge and tray dot |
| `inject/bridge.js` | The layer injected into WhatsApp Web: theme engine, layouts, title bar, scheduler UI, media collector |
| `inject/*.css` | Styles for that layer, drawn only with WhatsApp's own colour variables |
| `ui/index.html` | Settings window |
| `capabilities/` | Permissions: the WhatsApp page can call only four bridge commands |
| `tests/` | Bridge test against a mock WhatsApp page (Playwright) |

```
cargo test
WAP_DUMP=tests/.init.js cargo test dump        # writes the injected script for the browser test
CHROMIUM=/path/to/chrome python3 tests/bridge_test.py . /tmp/shots
```

### Releasing

Bump the version in `Cargo.toml` and `tauri.conf.json`, then push to the `release` branch
(`git push origin main:release`); the `v` tag is created automatically. GitHub Actions builds the installer and publishes it to
Releases together with `latest.json` for the in-app updater. The repository needs two Actions secrets,
`TAURI_SIGNING_PRIVATE_KEY` (the update signing key) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the
matching public key is in `tauri.conf.json`.

## License

[MIT](LICENSE)
