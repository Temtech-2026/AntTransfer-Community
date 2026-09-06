# ☸️ Kubernetes 部署

## 📂 文件

- `anttransfer-server.yaml` — Deployment（2 副本）+ Service 样例，含 Secret 引用与资源配额。

## ⚡ 快速使用

```bash
# 1️⃣ 准备数据库凭据 Secret（生产请用云厂商托管 Secret，勿硬编码）
kubectl create secret generic at-db-secret \
  --from-literal=username=root \
  --from-literal=password=<你的密码>

# 2️⃣ 替换镜像地址为你实际推送的 GHCR/私有仓库镜像
#    （vim anttransfer-server.yaml 修改 ghcr.io/<your-org>/anttransfer/server）

# 3️⃣ 应用清单
kubectl apply -f anttransfer-server.yaml
```

## 🧩 依赖说明

样例假设集群内存在以下 Service（否则请修改 `DB_URL` / `REDIS_HOST`）：

| Service | 端口 | 说明 |
| --- | --- | --- |
| `at-mysql` | 3306 | MySQL，库 `anttransfer` |
| `at-redis` | 6379 | Redis |

MySQL 若在集群外，将 `DB_URL` 指向公网/内网地址即可；凭据统一走 Secret。

## 🗺️ 后续规划

- 🌐 Ingress / TLS 样例
- 📈 HPA（按 CPU 扩缩容）
- ⏳ InitContainer 等待 MySQL 就绪

> 📚 完整生产化清单见 `docs/deployment/README.md`。
