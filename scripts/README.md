# scripts — 辅助脚本

| 脚本 | 用途 |
| --- | --- |
| `db-init.sh` | 初始化数据库：建库并执行 `sql/V1__schema.sql`、`V2__init_data.sql`（V2 不存在时跳过；适用于未启用 Flyway 的手工环境） |

日常开发建议直接用仓库根 `Makefile`（`make help`），脚本用于 CI 或手工运维补位。

> 平台提示：脚本为 Bash 编写，Windows 用户可用 Git Bash / WSL 运行；
> 等价 PowerShell 命令可参见 `docs/development/README.md`。
