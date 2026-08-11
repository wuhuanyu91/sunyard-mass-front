# MAAS 平台自动化部署（CICD）

参考 `salesstores/cicd` 架构（paramiko + deploy.properties），为 MAAS 前端定制。

## 部署形态与隔离约定（重要）

| 项 | MAAS（本项目） | 存量服务（勿动） |
|---|---|---|
| 访问地址 | **http://221.229.92.112:19095/maas-web/** | 19095 `/`（findata-web）/ 19096（java）/ 19097（python） |
| 端口 | 与 findata 共用 **19095**，路径前缀隔离 | — |
| 部署目录 | `/mnt/bobo/service_ningbo/maas-web` | `/mnt/bobo/service_ningbo/vue`、`/java` |
| nginx | 19095 server 块内 `location /maas-web/`（已写入 `salesstores/cicd/nginx.conf.d/findata-web.conf` 源文件，防 findata 重发冲掉） | `proxy.conf` |

前端统一路径前缀：vite `base: '/maas-web/'` + Router `basename="/maas-web"`，修改前缀时两处需同步。

## 1. 准备工作

- Python 3.x（Windows 下命令用 `py`）
- 安装依赖：`py -m pip install -r requirements.txt`
- 本地已安装 Node.js（npm）

## 2. 使用方法

在 `MAAS-xingjian` 根目录下执行（配置内相对路径以项目根为基准）：

```bash
# 预演（只打印计划，不编译/上传/执行）
py cicd/deploy.py --env sit --plan

# 完整部署（前端打包 + 上传 + nginx 配置下发 + reload）
py cicd/deploy.py --env sit

# 仅重新打包上传前端（不动 nginx 配置）
py cicd/deploy.py --env sit --project maas-web

# 仅更新 nginx 站点配置
py cicd/deploy.py --env sit --project maas-nginx-config

# 跳过本地编译（dist 已存在时）
py cicd/deploy.py --env sit --skip-compile
```

## 3. 部署流程说明

1. **maas-web**：`npm install && npm run build`（cwd=./maas，产物带 /maas-web/ 前缀）→ dist 打 zip →
   上传前 `mkdir -p /mnt/bobo/service_ningbo/maas-web`（target.init）→ SFTP 上传 → 解压 → `nginx -s reload`。
2. **maas-nginx-config**：上传 `salesstores/cicd/nginx.conf.d/findata-web.conf`（含 findata 原配置 + MAAS 的
   `location /maas-web/`）到 `/etc/nginx/conf.d/findata-web.conf` → `nginx -t && nginx -s reload`。
3. **maas-nginx-cleanup**：移除旧 19098 独立站点配置（幂等，已迁移到 19095 路径前缀方案）。

安全特性（沿用参考实现）：远端命令白名单校验（禁止 rm -rf 等危险命令）、
文件 MD5 一致跳过上传、上传失败重试 3 次、连接重试 3 次。

## 4. 部署后验证

服务器本机：`curl http://127.0.0.1:19095/maas-web/` 返回 index.html；存量 `http://127.0.0.1:19095/` 不受影响。

外网访问：`http://221.229.92.112:19095/maas-web/`
（子路由直达：`/maas-web/control` `/maas-web/routing?tab=traffic` `/maas-web/metering?tab=quota` `/maas-web/assets?tab=release` `/maas-web/security?tab=guardrail`）

本地开发：`npm run dev` 后访问 `http://localhost:5173/maas-web/`（dev 也带前缀，与生产一致）。
