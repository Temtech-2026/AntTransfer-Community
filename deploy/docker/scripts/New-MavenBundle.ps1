# =====================================================================
# AntTransfer CE — 导出本地 Maven 仓库为容器可复用的依赖包
#
# 背景：
#   云服务器上执行 docker compose up -d --build 时，容器内的 Maven 要从零下载
#   全部依赖（Spring Boot 3 + 8 个业务模块），通常十几分钟，且中途任一网络抖动
#   就整段失败。本脚本把开发机已经拉好的 ~/.m2/repository 打包成
#   deploy/docker/m2/m2-repository.tar.gz；根 Dockerfile 在 mvn package 之前
#   先解压到镜像内的 /root/.m2/repository，容器内只需补齐个别缺失构件。
#
# 用法（仓库根目录执行）：
#   pwsh deploy/docker/scripts/New-MavenBundle.ps1            # 默认路径与源仓库
#   pwsh deploy/docker/scripts/New-MavenBundle.ps1 -Force     # 覆盖已存在的包
#   pwsh deploy/docker/scripts/New-MavenBundle.ps1 -MavenRepo 'D:\m2\repository'
#   pwsh deploy/docker/scripts/New-MavenBundle.ps1 -Exclude 'com/other/**','org/legacy/**'
#
# 约定：
#   · 归档根目录 = 仓库内容本身（解压时直接 -C /root/.m2/repository 即可）；
#   · 不带入 Maven 解析状态文件（_remote.repositories / *.lastUpdated /
#     resolver-status.properties）——它们记录「本机是从哪个远端仓库下载的」，
#     原样带进容器会让 Maven 判定与当前远端不匹配而重新下载；不带入后 Maven
#     直接视其为本地已安装构件；
#   · 打包清单先落成临时文件再交给 tar（-T），避免 1.2 万条路径超出命令行长度，
#     同时避开 bsdtar / GNU tar 在 --exclude 通配语义上的差异。
# =====================================================================
[CmdletBinding()]
param(
    # 本地 Maven 仓库（默认 %USERPROFILE%\.m2\repository）
    [string]$MavenRepo = (Join-Path $env:USERPROFILE '.m2\repository'),

    # 输出依赖包路径（默认 deploy/docker/m2/m2-repository.tar.gz）
    [string]$Output,

    # 额外排除的相对路径通配（如 'com/other/**'），可传多个
    [string[]]$Exclude = @(),

    # 覆盖已存在的输出文件
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }

# ---------- 1. 路径与前置校验 ----------
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path

if (-not $Output) {
    $Output = Join-Path $repoRoot 'deploy\docker\m2\m2-repository.tar.gz'
}

if (-not (Test-Path -LiteralPath $MavenRepo -PathType Container)) {
    throw "本地 Maven 仓库不存在：$MavenRepo`n请先在本机执行一次完整构建（./mvnw -DskipTests package），或通过 -MavenRepo 指定实际路径。"
}

$repoFull = (Resolve-Path -LiteralPath $MavenRepo).Path.TrimEnd('\', '/')

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw "未找到 tar 命令。Windows 10 1803+ 自带 bsdtar；若确实缺失，请改用 Linux 环境执行本脚本。"
}

$outFull = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path $repoRoot $Output }
$outDir = Split-Path -Parent $outFull
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

if ((Test-Path -LiteralPath $outFull) -and (-not $Force)) {
    throw "输出文件已存在：$outFull`n确认要覆盖请追加 -Force。"
}

# ---------- 2. 采集打包清单（就地剔除解析状态文件） ----------
Write-Step "扫描本地仓库：$repoFull"

$skipNames = @('_remote.repositories', 'resolver-status.properties')
$skipPatterns = @('*.lastUpdated', '*.part', '*.part.lock', '*.tmp')

$allFiles = Get-ChildItem -LiteralPath $repoFull -Recurse -File -Force -ErrorAction SilentlyContinue
$prefixLen = $repoFull.Length + 1

$entries = New-Object System.Collections.Generic.List[string]
foreach ($f in $allFiles) {
    $name = $f.Name
    if ($skipNames -contains $name) { continue }

    $skip = $false
    foreach ($p in $skipPatterns) { if ($name -like $p) { $skip = $true; break } }
    if ($skip) { continue }

    $rel = $f.FullName.Substring($prefixLen).Replace('\', '/')
    if ($Exclude.Count -gt 0) {
        $excluded = $false
        foreach ($e in $Exclude) { if ($rel -like $e) { $excluded = $true; break } }
        if ($excluded) { continue }
    }

    $entries.Add($rel)
}

$sizes = ($allFiles | Measure-Object -Property Length -Sum).Sum
if ($entries.Count -eq 0) { throw "扫描结果为空，请检查 -MavenRepo 路径：$repoFull" }

Write-Host ("    命中 {0} 个文件（仓库共 {1} 个，剔除解析状态文件 {2} 个），约 {3:N1} MB" -f `
        $entries.Count, $allFiles.Count, ($allFiles.Count - $entries.Count), ($sizes / 1MB))

# ---------- 3. 磁盘余量检查（压缩后一般小于源体积，按源体积放行即可） ----------
$drive = (Split-Path -Qualifier $outFull)
if ($drive) {
    try { $free = (Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction Stop).Free } catch { $free = $null }
    if ($free -and ($free -lt ($sizes * 1.05))) {
        throw ("目标盘剩余空间不足：需要约 {0:N0} MB，当前可用 {1:N0} MB（{2}）" -f ($sizes / 1MB), ($free / 1MB), $drive)
    }
}

# ---------- 4. 打包 ----------
$listPath = Join-Path ([System.IO.Path]::GetTempPath()) ("at-m2-list-{0}.txt" -f ([guid]::NewGuid().ToString('N')))
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($listPath, $entries, $utf8NoBom)

Write-Step "压缩中（gzip，约 800 MB 源数据，通常需 0.5~2 分钟）..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Push-Location -LiteralPath $repoFull
    try {
        & tar -czf $outFull -T $listPath
        if ($LASTEXITCODE -ne 0) { throw "tar 打包失败（退出码 $LASTEXITCODE）" }
    }
    finally { Pop-Location }
}
finally {
    Remove-Item -LiteralPath $listPath -Force -ErrorAction SilentlyContinue
}
$sw.Stop()

if (-not (Test-Path -LiteralPath $outFull)) { throw "打包结束但未找到输出文件：$outFull" }
$outSize = (Get-Item -LiteralPath $outFull).Length

# ---------- 5. 汇总 ----------
$hash = (Get-FileHash -LiteralPath $outFull -Algorithm SHA256).Hash.ToLowerInvariant()
$relOut = $outFull.Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')

Write-Host ""
Write-Host "✅ 依赖包已生成" -ForegroundColor Green
Write-Host ("   路径   : {0}" -f $outFull)
Write-Host ("   体积   : {0:N1} MB（源 {1:N1} MB，压缩率 {2:P0}）" -f ($outSize / 1MB), ($sizes / 1MB), ($outSize / $sizes))
Write-Host ("   条目   : {0} 个文件" -f $entries.Count)
Write-Host ("   耗时   : {0:N0} 秒" -f $sw.Elapsed.TotalSeconds)
Write-Host ("   SHA256 : {0}" -f $hash)
Write-Host ""
Write-Host "下一步：上传到服务器项目目录，与 Dockerfile 同级（该文件被 .gitignore 忽略，不入库）：" -ForegroundColor Yellow
Write-Host ("   scp {0} ubuntu@<server>:/path/to/anttransfer/deploy/docker/m2/" -f $relOut)
Write-Host "   # 服务器上校验： sha256sum deploy/docker/m2/m2-repository.tar.gz"
Write-Host "   # 之后正常执行： docker compose up -d --build"
