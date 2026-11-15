/* ============================================================================
 * dsh-moss-background — Host 半侧
 * ----------------------------------------------------------------------------
 * 双层常驻背景 + 深空玻璃皮肤：
 *   1) 首屏注入 spring 前的关键 CSS 与自举脚本（加皮肤作用域 class、建背景层 DOM）
 *   2) 路由提供皮肤样式（skin.css + override.css 合并）与视频/海报/字库（Range 支持）
 *
 * 皮肤 token 覆盖来自 dsh-startup-moss2 的 lib/skin.css（MIT，真机验证过），
 * 本插件只在它之上追加「MOSS 层 + 地球降级为氛围叠加层」。
 * ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const NS = 'dsh-moss-background'
const ROUTE_BASE = '/dsh-moss-bg'

/* ── 静态文本（带 mtime 缓存，改文件后刷新页面即可看到） ────────────────── */

function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs || cache.size !== st.size) {
        cache = { mtimeMs: st.mtimeMs, size: st.size, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      cache = null
      return ''
    }
  }
}

const readSkinCss = makeReader('skin.css')
const readOverrideCss = makeReader('override.css')

/* ── 资产白名单 ─────────────────────────────────────────────────────────── */

const ASSET_TYPES = {
  'earth/earth-1080.mp4': 'video/mp4',
  'earth/earth-poster.webp': 'image/webp',
  'moss/moss-cinema-1080.mp4': 'video/mp4',
  'moss/moss-cinema-poster.webp': 'image/webp',
  'fonts/jetbrains-mono-400.woff2': 'font/woff2',
  'fonts/jetbrains-mono-500.woff2': 'font/woff2'
}

const ASSET_ROOT = path.join(PACKAGE_ROOT, 'assets')

function resolveAsset(name) {
  if (!Object.prototype.hasOwnProperty.call(ASSET_TYPES, name)) return null
  const file = path.resolve(ASSET_ROOT, name)
  const rel = path.relative(ASSET_ROOT, file)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
  return { file, type: ASSET_TYPES[name] }
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim())
  if (!m) return null
  if (m[1] === '' && m[2] === '') return { invalid: true }
  if (!Number.isFinite(size) || size <= 0) return { invalid: true }
  let start
  let end
  if (m[1] === '') {
    const n = Number(m[2])
    if (!Number.isFinite(n) || n <= 0) return { invalid: true }
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Number(m[2])
    if (end > size - 1) end = size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) {
    return { invalid: true }
  }
  return { start, end }
}

function readAssetSlice(file, start, end) {
  const length = end - start + 1
  const buf = Buffer.alloc(length)
  const fd = fs.openSync(file, 'r')
  try {
    let offset = 0
    while (offset < length) {
      const n = fs.readSync(fd, buf, offset, length - offset, start + offset)
      if (n <= 0) break
      offset += n
    }
    return offset === length ? buf : buf.subarray(0, offset)
  } finally {
    try { fs.closeSync(fd) } catch (err) { /* noop */ }
  }
}

/* ── 首屏关键 CSS（防白闪 / 保证背景层在 #root 之下） ───────────────────── */

const CRITICAL_CSS = [
  '#dsh-moss-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:#04070c}',
  '#root{position:relative;z-index:1}',
  'html.dsh-moss-skin,html.dsh-moss-skin body{background:transparent!important}'
].join('')

/* ── 自举脚本：首帧前落地皮肤 class + 背景层，避免 FOUC ─────────────────── */

const BOOTSTRAP_JS = `(function(){try{
var base='${ROUTE_BASE}';
var html=document.documentElement;
var body=document.body;
var AMB='dsh-moss-ambient';

html.classList.add('dsh-moss-skin');
html.classList.add('dsh-moss-skin--glass');
/* 9 个客户端包用 body[data-ds-dark-theme] 切深色分支（deliverables 的文件变更卡片就是其一：
 * 没有这个属性时卡片头吃 #fafafa 白底，配上被皮肤改成白色的正文 = 白底白字）。
 * 注意 ui-theme 在「跟随系统」模式下会把这个属性摘掉，所以这里要反复钉住。 */
function lockDark(){
  try{
    var b=document.body;
    if(!b) return;
    if(!b.hasAttribute('data-ds-dark-theme')) b.setAttribute('data-ds-dark-theme','');
  }catch(e){}
}
lockDark();
[0,50,200,600,1500,3000].forEach(function(d){ setTimeout(lockDark,d); });
try{
  document.addEventListener('DOMContentLoaded',lockDark);
  window.addEventListener('load',lockDark);
  var darkMo=new MutationObserver(lockDark);
  if(document.body) darkMo.observe(document.body,{attributes:true});
  setTimeout(function(){ try{ if(document.body) darkMo.observe(document.body,{attributes:true}); }catch(e){} },0);
}catch(e){}
html.setAttribute('data-moss-quality','high');
html.setAttribute('data-moss-hud','off');
html.style.setProperty('--moss-veil','60');
html.style.setProperty('--moss-blur','18px');
/* 用户自调：localStorage['dsh-moss-bg'] = {"earthOpacity":0.7,"earthSize":"28vw","mossBrightness":0.62,"hideEarth":false} */
try{
  var userCfg=JSON.parse(localStorage.getItem('dsh-moss-bg')||'{}');
  if(userCfg&&typeof userCfg==='object'){
    if(typeof userCfg.earthOpacity==='number') html.style.setProperty('--mb-earth-opacity',String(userCfg.earthOpacity));
    if(userCfg.earthSize) html.style.setProperty('--mb-earth-size',String(userCfg.earthSize));
    if(typeof userCfg.mossBrightness==='number') html.style.setProperty('--mb-moss-brightness',String(userCfg.mossBrightness));
    if(typeof userCfg.veil==='number') html.style.setProperty('--moss-veil',String(userCfg.veil));
    if(userCfg.hideEarth) html.classList.add('dsh-moss-bg-no-earth');
  }
}catch(e){}
html.classList.add('dsh-moss-enter');
setTimeout(function(){try{html.classList.remove('dsh-moss-enter')}catch(e){}},1400);
try{
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    html.classList.add('dsh-moss-motion-hint');
}catch(e){}

if(body&&!document.getElementById(AMB)){
  var wrap=document.createElement('div');
  wrap.id=AMB; wrap.setAttribute('aria-hidden','true');

  function mkImg(cls,src){
    var i=document.createElement('img');
    i.className=cls; i.alt=''; i.decoding='async';
    i.src=base+'/asset/'+src;
    return i;
  }
  function mkVid(cls,src,poster,rate,pausedAt){
    var v=document.createElement('video');
    v.className=cls;
    v.muted=true; v.defaultMuted=true;
    v.setAttribute('muted',''); v.setAttribute('playsinline','');
    v.setAttribute('preload','auto'); v.setAttribute('disablepictureinpicture','');
    v.setAttribute('aria-hidden','true');
    if(poster) v.setAttribute('poster',base+'/asset/'+poster);
    if(pausedAt===undefined){
      v.loop=true; v.autoplay=true;
    }
    v.src=base+'/asset/'+src;
    try{ if(rate) v.playbackRate=rate; }catch(e){}
    if(pausedAt!==undefined){
      /* 定格在红眼点亮后的那一帧（本地 4.6s）：画面暗、主体是红色主眼，
         比循环播放整段 5s 素材更接近幕 II 的观感，也省一路解码。 */
      var lock=function(){
        try{ v.currentTime=pausedAt; }catch(e){}
        try{ v.pause(); }catch(e){}
      };
      v.addEventListener('loadedmetadata',lock);
      v.addEventListener('seeked',function(){ try{ v.pause(); }catch(e){} });
    }
    return v;
  }

  /* ① MOSS 550W 苏醒（主视觉）：定格在红眼点亮的 4.6s，靠 CSS 缓慢推近制造「活着」的感觉 */
  var mossStill=mkImg('ma-moss-still','moss/moss-cinema-poster.webp');
  var mossVid=mkVid('ma-moss','moss/moss-cinema-1080.mp4','moss/moss-cinema-poster.webp',1,4.6);
  wrap.appendChild(mossStill);
  wrap.appendChild(mossVid);

  /* ② 动态地球（氛围叠加层） */
  var earthStill=mkImg('ma-still','earth/earth-poster.webp');
  var earthVid=mkVid('ma-video','earth/earth-1080.mp4','earth/earth-poster.webp',0.5);
  wrap.appendChild(earthStill);
  wrap.appendChild(earthVid);

  /* ③ 压暗 / 暗角 / 颗粒 / 扫描线 / 底部光晕（moss2 的层） */
  ['ma-veil','ma-vignette','ma-grain','ma-scan','ma-rim'].forEach(function(c){
    var d=document.createElement('div'); d.className=c; wrap.appendChild(d);
  });

  body.appendChild(wrap);

  /* MOSS 层是定格帧：不再循环播放，所以这里只负责地球那一路的行活 */
  var kick=function(){
    try{ var b=earthVid.play(); if(b&&b.catch)b.catch(function(){}); }catch(e){}
  };
  kick();
  setTimeout(kick,600);
  /* 定格失败（编码/解码不支持）时兜底：让它自己播起来，至少有画面 */
  setTimeout(function(){
    try{
      if(mossVid.readyState>=2 && (mossVid.currentTime<1 || mossVid.error)) mossVid.play();
    }catch(e){}
  },1500);

  /* 页面不可见时暂停地球视频，省 GPU（MOSS 是定格帧，无需处理） */
  document.addEventListener('visibilitychange',function(){
    try{
      if(document.hidden){
        earthVid.pause();
        html.classList.add('dsh-moss-skin--paused');
      }else{
        earthVid.play();
        html.classList.remove('dsh-moss-skin--paused');
      }
    }catch(e){}
  });
}

window.__DSH_MOSS_BG__={base:base,loaded:true};
}catch(e){}})()`

/* ── 插件主体 ────────────────────────────────────────────────────────────── */

const name = NS
const inject = ['webServer']

function apply(ctx) {
  const disposers = []
  const warned = new Set()
  const webServer = ctx.webServer

  function warnOnce(key, message) {
    if (warned.has(key)) return
    warned.add(key)
    try { ctx.logger?.warn?.('[' + NS + '] ' + message) } catch (err) { /* noop */ }
  }

  function sendText(res, type, text, code = 200) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(code, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  /* 皮肤样式 = moss2 的令牌覆盖 + 本插件的双层背景扩展（后者覆盖前者） */
  disposers.push(webServer.register({
    kind: 'exact',
    path: ROUTE_BASE + '/skin.css',
    handler: (req, res) => {
      const base = readSkinCss()
      const over = readOverrideCss()
      if (!base) warnOnce('skin-css', 'skin.css 读取失败，只返回扩展样式。')
      if (!over) warnOnce('override-css', 'override.css 读取失败，只有一半皮肤。')
      sendText(res, 'text/css; charset=utf-8', base + '\n\n' + over)
    }
  }))

  /* 资产：视频/海报/字库，支持 Range（<video> 拖进度与 seek 需要） */
  disposers.push(webServer.register({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const method = String(req.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET, HEAD' })
        res.end()
        return
      }
      const prefix = ROUTE_BASE + '/asset/'
      const pathname = String(req.url || '').split('?')[0].split('#')[0]
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404)
        res.end()
        return
      }
      let assetName
      try {
        assetName = decodeURIComponent(pathname.slice(prefix.length))
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }
      const hit = resolveAsset(assetName)
      if (!hit) {
        res.writeHead(404)
        res.end()
        return
      }
      let size
      try {
        const st = fs.statSync(hit.file)
        if (!st.isFile()) throw new Error('not a file')
        size = st.size
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }

      const rangeHeader = req.headers ? (req.headers.range || req.headers.Range) : ''
      const range = rangeHeader ? parseRange(rangeHeader, size) : null
      if (range && range.invalid) {
        res.writeHead(416, {
          'Content-Type': hit.type,
          'Accept-Ranges': 'bytes',
          'Content-Range': 'bytes */' + size,
          'Content-Length': '0'
        })
        res.end()
        return
      }

      const headOnly = method === 'HEAD'
      const headers = {
        'Content-Type': hit.type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      }
      if (!range) {
        headers['Content-Length'] = String(size)
        if (headOnly) {
          res.writeHead(200, headers)
          res.end()
          return
        }
        let bytes
        try {
          bytes = fs.readFileSync(hit.file)
        } catch (err) {
          res.writeHead(404)
          res.end()
          return
        }
        res.writeHead(200, headers)
        res.end(bytes)
        return
      }

      let bytes
      try {
        bytes = headOnly ? null : readAssetSlice(hit.file, range.start, range.end)
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }
      headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + size
      headers['Content-Length'] = String(range.end - range.start + 1)
      res.writeHead(206, headers)
      res.end(bytes === null ? undefined : bytes)
    }
  }))

  /* 首屏注入：样式 + 自举脚本 */
  disposers.push(webServer.tapIndex((html) => {
    if (typeof html !== 'string') return html
    if (html.includes('dsh-moss-bg/skin.css')) return html

    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/skin.css">' +
      '<style id="dsh-moss-bg-critical">' + CRITICAL_CSS + '</style>'
    const body = '<script>' + BOOTSTRAP_JS + '</script>'

    let out = html
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, head + '</head>')
    else out = head + out

    if (/<body[^>]*>/i.test(out)) out = out.replace(/<body[^>]*>/i, (tag) => tag + body)
    else if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

export { apply, inject, name }
