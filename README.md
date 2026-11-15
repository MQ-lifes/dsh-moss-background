# dsh-moss-background

DeepSeek Harness 的 **MOSS 550W 双层常驻背景 + 深空玻璃皮肤**插件。

改编自 **[QIFANAI/dsh-startup-moss2](https://github.com/QIFANAI/dsh-startup-moss2)**（MIT）——那个项目做的是 13.9 秒四幕启动电影 + 地球背景皮肤；这个插件把其中的「幕 II MOSS 苏醒」抽出来做成界面常驻背景，并把地球收成右上角的动态舷窗。

| 层 | 内容 |
|---|---|
| **MOSS 主背景** | `moss-cinema` 定格在 4.6s（红眼点亮、准星收敛那一帧），靠 CSS 做 52 秒的缓慢推近漂移 |
| **动态地球** | `earth-1080.mp4` 30 秒循环、0.5 倍速，收成右上角圆形舷窗（`screen` 混合 + 径向遮罩） |
| **玻璃皮肤** | 127 个 `--dsw-alias-*` 令牌覆盖 + `backdrop-filter` 磨砂（侧栏 / 输入卡 / 浮层） |
| **压暗与装饰** | `--moss-veil` 渐变压暗、四角暗角、SVG 颗粒、底部光晕、扫描线 |

DOM 由首屏注入的 bootstrap 创建（`#dsh-moss-ambient`，`aria-hidden` + `pointer-events:none`，位于 `#root` 之下），不改 DSH 的 app root、不改布局尺寸、不动字号行高。

---

## 一、先取素材（视频不随仓库分发）

仓库里只有代码和字库。**视频与海报需要在本机自行拉取**——原因见下面的「改编来源与素材许可」。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\fetch-assets.ps1
```

脚本会从上游做一次 sparse checkout（只下 `lib/assets`，约 9 MB），把 4 个文件放进 `assets/`：

```
assets/earth/earth-1080.mp4           8.16 MB
assets/earth/earth-poster.webp        0.03 MB
assets/moss/moss-cinema-1080.mp4      0.89 MB
assets/moss/moss-cinema-poster.webp   0.02 MB
```

没有素材也能装：背景会退化成纯深空底色，玻璃皮肤正常。

## 二、安装

这个包是**本地作用域**的 DSH bundle（`@local/dsh-moss-background`）。在 DSH 里让 agent 执行：

```
plugin_manager  action = install_bundle  target = <本目录的绝对路径>
```

装完**刷新页面**（Ctrl+R）。装在 `web` profile 下即可，不需要重启 DSH。

卸载：

```
plugin_manager  action = remove_bundle  target = @local/dsh-moss-background
```

## 三、调参（不用改代码）

浏览器控制台里设 `localStorage`，刷新生效：

```js
localStorage['dsh-moss-bg'] = JSON.stringify({
  earthOpacity: 0.7,      // 地球舷窗不透明度 0–1（默认 0.92）
  earthSize: '28vw',      // 舷窗直径（默认 28vw，上限 520px）
  mossBrightness: 0.62,   // MOSS 层亮度（默认 0.62；调高背景更亮）
  veil: 60,               // 压暗强度 0–100（默认 60；调高文字更清楚）
  hideEarth: false        // true = 关掉地球舷窗
});
location.reload();
```

恢复默认：`localStorage.removeItem('dsh-moss-bg')` 后刷新。

改 `override.css` **不需要重装插件**——Host 每次请求按 mtime 重读文件，刷新页面即可。
改 `index.js`（bootstrap）需要重载插件：`plugin_manager` `set_plugin` 关 → 开。

## 四、三个实现上的决定

**1. MOSS 为什么是定格帧**
`moss-cinema` 素材只有 5 秒，整段循环会在「红眼锁定 ← 机械细节」之间硬跳。所以 `currentTime = 4.6` 后暂停，靠 CSS 的 52 秒缩放漂移制造「活着」的感觉，动态交给地球那一路。两层周期不同，不会同步脉动。

**2. 地球为什么是舷窗**
地球素材的圆盘本来就在画面正中，全屏叠上去会和 MOSS 的红眼撞在一起（第一版实测几乎看不见地球）。收成右上角圆形监视窗之后，大气边缘、等离子尾迹、城市灯光浮在深空里，也不挡左侧栏和底部输入区。

**3. 一个上游坑：`body[data-ds-dark-theme]`**
有 9 个客户端包（`deliverables` / `layout` / `plan` / `schedule` / `sidebar` / `sidebar-right` / `settings-account` / `theme`）用 `body[data-ds-dark-theme]` 切深色分支。`ui-theme` 在「跟随系统」模式下只写 `html[data-ds-theme-source=system]`、按媒体查询翻变量，**不加这个属性**。

于是对话里的文件变更卡片停在浅色分支：卡片头吃 `--dsw-static-neutral-50`（`#fafafa`），而皮肤把正文改成了 `#e9f1fa` → **白底白字**。

修复在 `index.js`：`lockDark()` 把属性钉到 `body`，并用 `MutationObserver` 盯着属性变化（`ui-theme` 会摘掉，摘一次补一次）。CDP 实测：

```
before: headerBg rgb(250,250,250) + headerColor rgb(233,241,250)   ← 白底白字
after : headerBg rgb(33,33,35)    + headerColor rgb(233,241,250)   ← 正常
```

---

## 五、改编来源与素材许可

这个插件是**改编作品**，不是从零写的。分清楚：

| 部分 | 来源 | 许可 |
|---|---|---|
| `skin.css`（127 个 `--dsw-alias-*` 令牌覆盖、玻璃表面、压暗层、颗粒/扫描线/光晕） | [dsh-startup-moss2](https://github.com/QIFANAI/dsh-startup-moss2) 的 `lib/skin.css`，仅把资产前缀改成 `/dsh-moss-bg/asset/` | MIT |
| 视觉设计（MOSS 550W 主题、四幕时间轴、红眼定位、地球调色） | 同上，`docs/design-spec*.md` | MIT |
| `index.js`（Host 路由、首屏 bootstrap、深色属性修复）、`override.css`（双层背景、地球舷窗）、`scripts/`、`locale/`、`icon.svg` | 本仓库原创 | MIT |
| JetBrains Mono 字库 | `assets/fonts/`，见 `OFL.txt` | SIL OFL 1.1 |

**视频与海报不在本仓库里，也不在 MIT 授权范围内。** 上游 manifest 原文写着：MOSS / 地球视频源自 Wallpaper Engine 工程、机械臂音效为用户自制，**仅本机自用、不二次分发**。所以：

- 本仓库用 `.gitignore` 排除 `assets/earth/*` 与 `assets/moss/*`；
- 由 `scripts/fetch-assets.ps1` 在你的机器上从上游拉取；
- 请同样不要把这些文件再分发出去。

上游项目地址：<https://github.com/QIFANAI/dsh-startup-moss2>

## 六、目录

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半侧：`/dsh-moss-bg/skin.css`、`/dsh-moss-bg/asset/*`（含 Range）、`tapIndex` 注入样式与 bootstrap |
| `skin.css` | 上游的令牌覆盖（MIT），资产前缀已改为 `/dsh-moss-bg/asset/` |
| `override.css` | 双层背景扩展：MOSS 层、地球舷窗、压暗微调、窄窗适配、`hideEarth` 开关 |
| `assets/fonts/` | JetBrains Mono（OFL） |
| `assets/earth/`、`assets/moss/` | **仓库里是空的**，由 `scripts/fetch-assets.ps1` 填充 |
| `scripts/fetch-assets.ps1` | 从上游 sparse checkout 素材 |
| `locale/`、`icon.svg` | 插件市场的显示元数据 |

## 七、许可

MIT，见 [LICENSE](LICENSE)。上游版权声明（© 2026 QIFANAI）与素材限制都写在 LICENSE 末尾。
