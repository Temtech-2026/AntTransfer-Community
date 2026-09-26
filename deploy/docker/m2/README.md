# 📦 Maven 依赖预热包

## 这个目录放什么

放一个文件：

```
deploy/docker/m2/m2-repository.tar.gz
```

它是从**开发机本地 Maven 仓库**（`~/.m2/repository`）导出的依赖包。根 `Dockerfile`
在 `mvn package` **之前**先把它解压进镜像内的 `/root/.m2/repository`，于是容器内
Maven 只需补齐个别缺失构件，不再全量下载。

## 为什么需要

容器内从零下载全部依赖（Spring Boot 3 + 8 个业务模块）在云服务器上通常要十几分钟，
且中途任一网络抖动就会整段失败。把开发机已经拉好的依赖直接带上去，构建时间可以压到
分钟级。

## 怎么生成

```powershell
# 在仓库根目录执行（默认读取 %USERPROFILE%\.m2\repository）
pwsh deploy/docker/scripts/New-MavenBundle.ps1

# 覆盖已存在的包
pwsh deploy/docker/scripts/New-MavenBundle.ps1 -Force

# 使用自定义本地仓库路径
pwsh deploy/docker/scripts/New-MavenBundle.ps1 -MavenRepo 'D:\m2\repository'
```

脚本会自动剔除 `_remote.repositories`、`*.lastUpdated` 这类**解析状态文件**——它们
记录的是「本机是从哪个远端仓库下载的」，原样带进容器会让 Maven 判定与当前远端不匹配
而重新下载；剔除后 Maven 直接视其为本地已安装构件。

## 怎么上传到服务器

`*.tar.gz` 已被根 `.gitignore` 忽略，不会入库；但它在构建上下文内（**未**被
`.dockerignore` 排除），因此必须放到服务器的项目目录里、和 `Dockerfile` 同级：

```bash
# 本地执行：传到服务器项目目录
scp deploy/docker/m2/m2-repository.tar.gz \
    ubuntu@<server>:/path/to/anttransfer/deploy/docker/m2/

# 服务器上校验完整性（与脚本输出的 SHA256 比对）
sha256sum deploy/docker/m2/m2-repository.tar.gz
```

## 几个事实

| 项 | 说明 |
| --- | --- |
| 体积 | 未压缩整仓约 800 MB（1.2 万文件），压缩后约 400~500 MB |
| 是否入库 | 否，`*.tar.gz` 已在 `.gitignore` 中；本目录仅提交本说明文件 |
| 是否必需 | 否。文件不存在时 Dockerfile 自动跳过预热，退化为在线解析（CI 即走此路径） |
| 何时需要重做 | 本地 `pom.xml` 新增/升级依赖之后。否则容器内会为新增依赖单独下载（仍能成功，只是慢一点） |
| 能否瘦身 | 可以。该仓库是开发机**全量**仓库，含其它项目的构件；用 `-Exclude 'com/other/**'` 可手工裁剪 |
