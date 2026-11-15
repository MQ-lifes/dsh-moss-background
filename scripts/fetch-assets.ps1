<#
  从上游 dsh-startup-moss2 拉取视频与海报素材。

  这些素材不随本仓库分发：上游 manifest 明确写着视频源自 Wallpaper Engine 工程、
  仅作者本机自用、不二次分发。所以推仓库时排除它们，由使用者在本机自行拉取。

  用法：
    powershell -ExecutionPolicy Bypass -File scripts\fetch-assets.ps1
    powershell -ExecutionPolicy Bypass -File scripts\fetch-assets.ps1 -Force   # 覆盖已有
#>
[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path $PSScriptRoot -Parent
$assets      = Join-Path $packageRoot 'assets'
$upstream    = 'https://github.com/QIFANAI/dsh-startup-moss2.git'

$need = @(
    'earth\earth-1080.mp4',
    'earth\earth-poster.webp',
    'moss\moss-cinema-1080.mp4',
    'moss\moss-cinema-poster.webp'
)

$missing = @($need | Where-Object { -not (Test-Path -LiteralPath (Join-Path $assets $_)) })
if ($missing.Count -eq 0 -and -not $Force) {
    Write-Host '素材已就位，无需拉取：' -ForegroundColor Green
    foreach ($rel in $need) { Write-Host ('  ' + $rel) }
    Write-Host '想覆盖就加 -Force。'
    return
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw '需要 git 才能拉取上游素材。'
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('moss2-assets-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
Write-Host '正在从上游 sparse checkout 素材（只下 lib/assets）…' -ForegroundColor Cyan

try {
    git clone --depth 1 --filter=blob:none --no-checkout $upstream $tmp 2>&1 | Out-Null
    '/lib/assets/**' | Set-Content -LiteralPath (Join-Path $tmp '.git\info\sparse-checkout') -Encoding ASCII
    git -C $tmp checkout 2>&1 | Out-Null

    New-Item -ItemType Directory -Force -Path (Join-Path $assets 'earth'), (Join-Path $assets 'moss') | Out-Null

    foreach ($rel in $need) {
        $src = Join-Path (Join-Path $tmp 'lib\assets') $rel
        $dst = Join-Path $assets $rel
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination $dst -Force
            Write-Host ('  ok  {0}  {1:N2} MB' -f $rel, ((Get-Item -LiteralPath $dst).Length / 1MB))
        } else {
            Write-Warning ('上游缺文件：' + $rel)
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tmp) {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host '完成。刷新 DSH 页面即可看到背景。' -ForegroundColor Green
