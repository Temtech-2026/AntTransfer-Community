# Helm

Helm Chart 为**预留目录**，尚未生成。

规划：

```text
deploy/helm/anttransfer/
├── Chart.yaml
├── values.yaml          # 镜像 tag / 副本数 / 资源 / 数据库配置
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl
└── README.md
```

落地前请先通过 [kubernetes 样例](../kubernetes/anttransfer-server.yaml) 验证部署参数。

> 发布首个稳定版本（1.0.0）时随包提供，届时使用 `helm install anttransfer ./anttransfer` 即可。
