# AT-CE CI 安全扫描接入

> **版本**：v1.1 · **日期**：2026-10-03 · **配套**：[安全自查表](./安全自查表.md)
> **目标**：让「引入高危依赖」「提交密钥」在 CI 阶段就失败，而不是等上线后被外部发现。
> **本次实跑状态（2026-10-03）**：三项扫描在本机**均未取得「通过」结论**——Dependency-Check 跑了 3 次都没跑完，
> npm audit / gitleaks 受本机环境限制；详见 §8.1 与 §9。**不要**把「配置已就绪」读成「已扫过且无问题」。

## 1. 三项扫描与卡点语义

| 扫描 | 覆盖 | 卡点语义 | 配置位置 |
| --- | --- | --- | --- |
| OWASP Dependency-Check | 后端 Maven 依赖 CVE | **CVSS ≥ 7（High / Critical）即失败** | `pom.xml` 的 `security-scan` profile |
| npm audit | 前端**生产**依赖 | `high` 及以上即失败（dev 依赖不卡） | `web/package.json` 的 `audit` 脚本 |
| gitleaks | Git 历史中的密钥 | 检出即失败 | `.gitleaks.toml` |

**为什么 npm audit 只卡生产依赖**：`devDependencies` 不进产物、不构成运行时风险；
若一并卡 `high`，构建工具链一升级就会红，属噪声——**噪声化的门禁最终一定被绕过**。

**为什么 Dependency-Check 用 profile 而不是绑生命周期**：首次运行需联网下载 NVD 全量库
（数百 MB、数分钟），离线必挂。若绑进 `verify`，等于每次本地构建都变慢甚至失败，
结果必然是被注释掉。故默认不激活，只在 CI 的安全 job 里显式调用。

## 2. 卡点命令

```bash
# 1) 后端依赖 CVE（CVSS ≥ 7 失败）
./mvnw -B -ntp -Psecurity-scan dependency-check:check -DfailBuildOnCVSS=7

# 2) 前端生产依赖（high 失败）
cd web && npm audit --omit=dev --audit-level=high

# 3) 密钥扫描（历史全量，检出即失败）
gitleaks detect --config .gitleaks.toml --redact --exit-code 1
```

`dependency-check:check` 会在 CVSS ≥ 阈值时让 Maven 构建失败（`failBuildOnCVSS` 已同时写在
profile 与命令行，命令行优先，便于临时调档）；`npm audit --audit-level=high` 自带非零退出码；
gitleaks 的 `--exit-code 1` 保证「有检出即有非零退出码」。

## 3. Maven 侧配置片段（`pom.xml`）

```xml
<properties>
    <dependency-check.version>12.1.0</dependency-check.version>
</properties>

<profiles>
    <profile>
        <id>security-scan</id>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.owasp</groupId>
                    <artifactId>dependency-check-maven</artifactId>
                    <version>${dependency-check.version}</version>
                    <configuration>
                        <failBuildOnCVSS>7</failBuildOnCVSS>
                        <formats><format>HTML</format><format>JSON</format></formats>
                        <nvdApiKey>${env.NVD_API_KEY}</nvdApiKey>
                    </configuration>
                </plugin>
            </plugins>
        </build>
    </profile>
</profiles>
```

⚠️ `${dependency-check.version}` 需按 Maven Central 实际情况核对后固定（本次仅验证
`mvnw -Psecurity-scan validate` 可解析；**本机实跑尝试未完成**，原因与日志见 §9）。

## 4. CI job 片段（`.github/workflows/ci.yml`）

```yaml
  security:
    name: Security (SCA + Secrets)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # 浅克隆只能看到最后一次提交，历史密钥永远扫不出来

      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '21', cache: maven }

      - run: chmod +x mvnw

      - name: OWASP Dependency-Check (fail on CVSS >= 7)
        run: ./mvnw -B -ntp -Psecurity-scan dependency-check:check -DfailBuildOnCVSS=7
        env:
          NVD_API_KEY: ${{ secrets.NVD_API_KEY }}

      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm, cache-dependency-path: web/package-lock.json }

      - name: npm audit (production deps, fail on high)
        working-directory: web
        run: npm audit --omit=dev --audit-level=high

      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_CONFIG: .gitleaks.toml
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**为什么独立成 job**：这类扫描失败的原因（新披露 CVE、误报、历史密钥）与本次代码改动无关，
混进 `backend` / `frontend` 会让「测试全绿但 CI 红」的原因难以定位。

## 5. gitleaks 配置取向（`.gitleaks.toml`）

**默认全量规则 + 极窄豁免**。不用自建规则集——密钥泄漏的高发形态（云厂商 AK/SK、私钥、JWT、
数据库 URL）都在默认规则集里，自建集一定更窄，等于主动放弃检出能力。

豁免只到路径级最小粒度（`src/test/**`、前端测试文件、占位值正则），
**刻意不豁免 `docs/`、`.github/`、配置模板**——真实密钥最常被误提交的地方恰是这些位置，
一旦豁免就等于给了「把密钥塞进文档即可绕过」的后门。

## 6. 必须知道的两个前提

1. 🔴 **覆盖范围缺口**：本 CI 只在 **GitHub 镜像仓库**生效；主仓库为 **Gitee**，且仓库内
   不存在任何 Gitee 侧流水线配置（`.gitee/`、`.workflow`、`Jenkinsfile`、`.gitlab-ci.yml` 均无）。
   **推送主仓库不会触发任何扫描**——即使把 job 配成 required status check，也只对镜像仓库生效。
   需在 Gitee 侧另建等价流水线，或把开发流程切到镜像仓库。
2. **NVD 配额**：不配 `NVD_API_KEY` 时用匿名配额，可能被限流导致扫描变慢或失败。
   建议在仓库 Secrets 中配置（免费申请）。

## 7. 误报处理政策（避免门禁腐化）

1. **禁止**通过调高 `failBuildOnCVSS` 让构建变绿——那是关掉门禁，不是处理漏洞。
2. 确认误报（如 CPE 匹配错误）时，用 suppression 文件登记 **CVE 编号 + 判断理由 + 复核截止日期**。
3. **禁止无限期豁免**：每条豁免必须带到期时间，到期后自动重新触发失败。
4. 不可修复的漏洞（上游未发版）应记录在整改清单并按风险接受流程签字，而不是静默豁免。

## 8. 本地前置（可选，降低 CI 往返）

```bash
# 提交前自查（需本地安装 gitleaks）
gitleaks protect --staged --config .gitleaks.toml --redact

# 前端依赖自查
cd web && npm run audit
```

### 8.1 本机实跑时踩到的 3 个坑（2026-10-03 记录，避免重复浪费）

1. **本机 npm 源是 `npmmirror`，它不实现 audit 端点**：直接 `npm audit` 会报错退出
   （`This command does not support the current registry`），**不代表有漏洞**。
   实跑时须显式指定官方源：`npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`。
2. **本机无 `gitleaks` 二进制**，用官方镜像等价替代：
   `docker run --rm -v "%CD%:/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest detect --source=/repo --config=/repo/.gitleaks.toml --redact --exit-code 1`
   （镜像也可用 `zricethezav/gitleaks:latest`）。
3. **Dependency-Check 的 NVD 库首次同步约 15 分钟**（无 `NVD_API_KEY` 时走匿名配额），
   且**中断后锁文件残留**会导致后续运行永久卡在 `Existing update in progress; waiting for update to complete`。
   复跑前须确认 `%USERPROFILE%\.m2\repository\org\owasp\dependency-check-data\<ver>\odc.update.lock`
   所属进程已退出，否则手工删除该锁文件再重跑。

## 9. 本次未验证声明

**方案 C 实跑尝试（2026-10-03）后，三项扫描在本机仍未取得「通过」结论**，原始日志与阻塞原因如下：

| 扫描 | 本机结果 | 证据 |
| --- | --- | --- |
| Dependency-Check | ❌ **未完成，无报告产出** | `%TEMP%\at-dc-scan.log` 下载 NVD 库至 **250,000/400,976（62%）** 中断；`%TEMP%\dc-scan.log` 因残留 `odc.update.lock` 卡在 `Existing update in progress` 并 `EXIT=1`；`%TEMP%\dc-final.log` 清锁重跑至 **220,000/400,976（55%）** 再中断 |
| npm audit | 🟡 环境受限 | 本机 registry 为 `npmmirror`，不提供 audit 端点（`This command does not support the current registry`） |
| gitleaks | 🟡 环境受限 | 本机无 `gitleaks` 二进制（替代方案见 §8.1-2） |

- 唯一通过的检查是 `mvnw.cmd -B -ntp -Psecurity-scan validate`（`BUILD SUCCESS`）——
  它只证明 **profile 装配可解析，不证明扫描通过**。
- **根因**：无 `NVD_API_KEY` 时走 NVD 匿名配额，`dependency-check:12.1.0` 需拉取 **400,976 条** CVE 记录
  （本地 `odc.mv.db` 峰值 > 640 MB），耗时 **约 30 分钟以上**；中断后残留的 `odc.update.lock`
  会让后续运行**永久阻塞**在 `Existing update in progress; waiting for update to complete`。
- **闭环条件**：在配好 `NVD_API_KEY` 的环境（CI 或本机）跑完首轮并留存 `dependency-check-report.html`，
  再回写本节与《安全自查表》§6.1；在此之前 **R-11 不得标记为已闭环**。
- gitleaks 首次运行可能因测试夹具中的假密钥而失败，需按 §5 的豁免粒度逐步收敛
  （**不要**为了让它变绿而直接豁免 `docs/` 或整个仓库）。
