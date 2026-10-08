# 商智餐飲 點餐系統 API

115 BIRC 前端工程師測驗用的後端（Next.js Route Handler + MySQL）。

依用途選一種方式使用：

- [練習考試](#練習考試)：只需要 Docker，下載 `exam-kit` 就能啟動後端
- [研究後端架構](#研究後端架構)：複製完整專案，在本機開發

---

## 練習考試

需求：[Docker Desktop](https://www.docker.com/products/docker-desktop/)

**1. 只下載 `exam-kit` 資料夾**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Chen11111112/exam-1.git
cd exam-1
git sparse-checkout set exam-kit
cd exam-kit
```

**2. 下載映像檔**

到 [Releases](https://github.com/Chen11111112/exam-1/releases) 下載對應電腦的檔案，放進 `exam-kit` 資料夾：

| 電腦 | 檔案 |
| --- | --- |
| Windows、Intel Mac | `shangzhi-exam-images-amd64.tar` |
| Apple Silicon（M 系列）Mac | `shangzhi-exam-images-arm64.tar` |

**3. 載入並啟動**

```bash
docker load -i shangzhi-exam-images-amd64.tar   # 依電腦換成 arm64
docker compose up -d --wait
```

- API 文件：<http://localhost:8080>
- API Base URL：`http://localhost:8080/api`

其他指令（停止、重置資料、更換 port）見 [`exam-kit/README.md`](./exam-kit/README.md)。

---

## 研究後端架構

需求：Node.js 20+、Docker

```bash
git clone https://github.com/Chen11111112/exam-1.git
cd exam-1
cp .env.example .env
npm install
npm run db:up
npm run dev
```

- API 文件：<http://localhost:3000>
- API Base URL：`http://localhost:3000/api`

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run db:up` | 啟動 MySQL（首次啟動自動執行 `sql/init.sql`） |
| `npm run db:down` | 停止 MySQL |
| `npm run db:reset` | 重置資料庫為初始資料 |

### 專案結構

```text
app/api/      Route Handler（解析請求、Zod 驗證、回應）
service/      商業邏輯與 SQL
lib/          資料庫連線、環境變數、Zod schema、型別
util/         統一回應格式、錯誤類別
sql/init.sql  建表與範例資料
proxy.ts      CORS
swagger.md    API 文件（首頁顯示）
exam-kit/     考生用的 docker-compose
```

### 重新建置考試映像檔

修改程式碼、`swagger.md` 或 `sql/init.sql` 後，重新建置並上傳到 Releases（`ARCH` 為 `amd64` 或 `arm64`）：

```bash
ARCH=amd64
docker buildx build --platform linux/$ARCH -f docker/db/Dockerfile -t shangzhi-exam-db --load .
docker buildx build --platform linux/$ARCH -f Dockerfile -t shangzhi-exam-api --load .
docker save shangzhi-exam-db shangzhi-exam-api -o exam-kit/shangzhi-exam-images-$ARCH.tar
```
