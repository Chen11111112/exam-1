# 商智餐飲 API v1 — 考試用後端

本資料夾提供考試用的後端 API，每位考生在自己的電腦上啟動一份，資料互不影響。

## 需求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（不需安裝 Node.js 或 MySQL）

## 開始考試

1. 先安裝並打開 Docker Desktop。
2. 進入 exam-kit 資料夾。
3. 載入映像檔（從 [Releases](https://github.com/Chen11111112/exam-1/releases) 下載並放進本資料夾）：
```bash
docker load -i shangzhi-exam-images-amd64.tar   # Windows、Intel Mac
docker load -i shangzhi-exam-images-arm64.tar   # Apple Silicon（M 系列）Mac
```
4. 啟動後端：
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
## 說明
所有 API 皆位於 `http://localhost:8080/api/...`（已開放 CORS），Request / Response 一律為 JSON（Content-Type: application/json）。

成功：HTTP 200（POST /api/cart/items、POST /api/orders 為 201）

失敗：HTTP status body 為 { "code": "...", "message": "..." }。

本後端不做使用者身分 / 權限判斷，購物車與訂單為全站共用。

## 後端範例
https://115-exam.hychen.space