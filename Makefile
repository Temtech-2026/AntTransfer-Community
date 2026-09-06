# =====================================================================
# AntTransfer CE — 常用开发/运维命令
# 用法：make help 查看全部目标
# 说明：后端命令基于 Maven Wrapper（./mvnw），Windows 可用 mvnw.cmd 等价替代
# =====================================================================

.PHONY: help build package test check run \
        docker-build docker-up docker-down \
        dev-up dev-down \
        web-install web-dev

MVNW       := ./mvnw
COMPOSE    := docker compose
COMPOSE_DEV := docker compose -f docker-compose.dev.yml

help: ## 显示所有可用目标
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---------------- 后端 ----------------

build: ## 编译打包后端（跳过测试）
	$(MVNW) -q -DskipTests package

package: build ## 同 build：打包可执行 jar

test: ## 运行后端全部测试
	$(MVNW) test

check: ## Spotless 许可证头/格式校验（verify 阶段也会自动执行）
	$(MVNW) -q spotless:check

run: ## 本地启动后端 at-bootstrap（dev profile，端口 8080）
	$(MVNW) -pl server/at-bootstrap -am spring-boot:run

# ---------------- Docker 编排 ----------------

docker-build: ## 构建后端镜像 anttransfer/server（根 Dockerfile）
	docker build -t anttransfer/server:latest .

docker-up: ## 一键启动完整环境（MySQL + Redis + server，前台日志）
	$(COMPOSE) up --build

docker-down: ## 停止完整环境
	$(COMPOSE) down

dev-up: ## 仅启动本地开发依赖（MySQL + Redis，供本地 mvnw/IDE 运行后端）
	$(COMPOSE_DEV) up -d

dev-down: ## 停止开发依赖
	$(COMPOSE_DEV) down

# ---------------- 前端 ----------------

web-install: ## 安装 web/ 前端依赖
	cd web && npm install

web-dev: ## 本地开发前端（需先启动后端或配置代理）
	cd web && npm run dev

web-build: ## 构建前端产物
	cd web && npm run build
