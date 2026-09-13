#!/usr/bin/env bash
# =====================================================================
# db-init.sh — 初始化 AntTransfer 数据库（建库 + 执行 sql/V1__schema.sql、V2__init_data.sql）
#
# 适用：未使用 Flyway / docker mysql initdb 的场景（例如本机手工安装的 MySQL）。
#   注意：本脚本面向「本机自装 MySQL」，故默认端口 3306 与 DB 主配置默认的 3307
#   （= dev 容器库宿主端口）不同；若要对 dev 容器库执行，请显式 DB_PORT=3307。
#   常规开发无需本脚本——建表与初始化数据由后端启动时的 Flyway 承担。
# 用法：
#   ./scripts/db-init.sh
# 可用环境变量：DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_NAME
# =====================================================================
set -euo pipefail

DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USERNAME:-root}
DB_PASS=${DB_PASSWORD:-123456}
DB_NAME=${DB_NAME:-anttransfer}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_SQL="${SCRIPT_DIR}/../sql/V1__schema.sql"

if ! command -v mysql >/dev/null 2>&1; then
  echo "错误：未找到 mysql 客户端，请先安装 MySQL 客户端。" >&2
  exit 1
fi

if [[ ! -f "${SCHEMA_SQL}" ]]; then
  echo "错误：找不到 ${SCHEMA_SQL}" >&2
  exit 1
fi

export MYSQL_PWD="${DB_PASS}"

echo "==> 创建数据库 ${DB_NAME}（如不存在）"
mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "==> 执行 ${SCHEMA_SQL}"
mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" "${DB_NAME}" < "${SCHEMA_SQL}"

# 数据初始化脚本（V2 为可选内容数据：不存在时跳过，不视为失败）
DATA_SQL="${SCRIPT_DIR}/../sql/V2__init_data.sql"
if [[ -f "${DATA_SQL}" ]]; then
  echo "==> 执行 ${DATA_SQL}"
  mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" "${DB_NAME}" < "${DATA_SQL}"
else
  echo "==> 跳过：未找到 ${DATA_SQL}（V2 数据初始化未执行）"
fi

echo "完成：数据库 ${DB_NAME} 初始化成功。"
