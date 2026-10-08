# 商智餐飲 API v1 — 考試用後端

本資料夾提供考試用的後端 API，每位考生在自己的電腦上啟動一份，資料互不影響。

## 需求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（不需安裝 Node.js 或 MySQL）

## 啟動

若拿到的是映像檔壓縮檔（`shangzhi-exam-images-*.tar`），先載入一次：

```bash
docker load -i shangzhi-exam-images-amd64.tar   # Windows / Intel Mac
docker load -i shangzhi-exam-images-arm64.tar   # Apple Silicon（M 系列）Mac
```

在本資料夾執行：

```bash
docker compose up -d --wait
```

| 項目 | 網址 |
| --- | --- |
| API 文件 | <http://localhost:8080> |
| API Base URL | `http://localhost:8080/api` |

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `docker compose up -d --wait` | 啟動 |
| `docker compose down` | 停止（保留資料） |
| `docker compose down -v && docker compose up -d --wait` | 將資料重置為初始狀態 |
| `docker compose logs -f api` | 查看 API 日誌 |

若 `8080` 已被佔用，可改用其他 port：

```bash
API_PORT=9090 docker compose up -d --wait
```
