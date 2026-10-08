# 商智餐飲 點餐系統 API

115 BIRC 前端工程師測驗用的後端。以 Next.js Route Handler 實作分店、菜單、購物車、優惠券與訂單 API，資料存放於 MySQL。

- 不做使用者身分 / 權限判斷，購物車與訂單為**全站共用**。
- 首頁 `/` 會渲染 [`swagger.md`](./swagger.md) 作為線上 API 文件。

## 技術棧

| 項目 | 使用 |
| --- | --- |
| 框架 | Next.js 16（App Router、Route Handler） |
| 語言 | TypeScript |
| 資料庫 | MySQL 8.4（`mysql2` 連線池，原生 SQL） |
| 輸入驗證 | Zod |
| 本機環境 | Docker Compose |

## 快速開始

需求：**Node.js 20+**、**Docker**（不需在本機安裝 MySQL）

```bash
cp .env.example .env
npm install
npm run db:up      # 啟動 MySQL，首次啟動自動執行 sql/init.sql 建表與範例資料
npm run dev
```

- API 文件：<http://localhost:3000>
- 測試 API：<http://localhost:3000/api/restaurants>

### 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` / `npm start` | 正式環境建置 / 啟動 |
| `npm run lint` | ESLint |
| `npm run db:up` | 啟動 MySQL 容器並等待就緒 |
| `npm run db:down` | 停止 MySQL（保留資料） |
| `npm run db:reset` | 清空資料並重新執行 `sql/init.sql` |

### 環境變數

| 變數 | 說明 | 範例 |
| --- | --- | --- |
| `MYSQL_PORT` | Docker MySQL 對外 port（預設 `3307`，避開本機既有 MySQL 的 `3306`） | `3307` |
| `DATABASE_URL` | MySQL 連線字串（必填，缺少時啟動即報錯） | `mysql://root:root@localhost:3307/nextjs_db` |

> 若 `3307` 也被佔用，修改 `.env` 的 `MYSQL_PORT` 並同步修改 `DATABASE_URL` 的 port。

## 專案結構

```text
.
├── app/
│   ├── api/                  # Route Handler：只負責解析請求、驗證輸入、回應
│   │   ├── restaurants/
│   │   ├── products/
│   │   ├── cart/
│   │   ├── coupons/
│   │   └── orders/
│   ├── layout.tsx
│   └── page.tsx              # 渲染 swagger.md 的 API 文件頁
├── components/
│   └── markdown-doc.tsx
├── service/                  # 商業邏輯與 SQL 查詢
│   ├── restaurant.ts         # 分店、菜單
│   ├── product.ts            # 餐點詳細與客製化選項
│   ├── cart.ts               # 購物車
│   ├── coupon.ts             # 優惠券查詢與試算
│   ├── order.ts              # 建立 / 查詢訂單
│   └── pricing.ts            # 選項驗證與計價（購物車、優惠券、訂單共用）
├── lib/
│   ├── env.ts                # 讀取環境變數
│   ├── mysql.ts              # 連線池、withTransaction
│   ├── schemas.ts            # Zod 請求驗證 schema
│   └── type.ts               # API 回應型別
├── util/
│   ├── respond.ts            # 統一成功 / 錯誤回應格式
│   ├── readJson.ts           # 解析 JSON body
│   └── errors.ts             # ApiError 與錯誤碼
├── sql/init.sql              # 建表 + 範例資料
├── docker-compose.yml
└── swagger.md                # API 規格
```

### 請求處理流程

```text
Request
  → app/api/**/route.ts      readJson() 解析 body、Zod schema.parse() 驗證
  → service/*.ts             商業邏輯、SQL（需要時包在 transaction 內）
  → util/respond.ts          成功 → JSON；ApiError → 對應 status；ZodError → 400；其他 → 500
Response
```

範例：

```ts
export async function POST(request: Request) {
  return respond(
    async () => createOrder(createOrderSchema.parse(await readJson(request))),
    { status: 201 }
  );
}
```

## API 一覽

完整 Request / Response 請見 [`swagger.md`](./swagger.md)。

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/restaurants` | 分店列表 |
| GET | `/api/restaurants/:restaurantId/menu` | 分店菜單 |
| GET | `/api/products/:productId` | 餐點詳細與客製化選項 |
| GET | `/api/cart` | 取得購物車 |
| POST | `/api/cart/items` | 加入購物車（201） |
| PATCH | `/api/cart/items/:itemId` | 修改數量 |
| DELETE | `/api/cart/items/:itemId` | 移除品項 |
| GET | `/api/coupons?restaurantId=` | 可用優惠券 |
| POST | `/api/coupons/validate` | 優惠券試算 |
| POST | `/api/orders` | 建立訂單（201） |
| GET | `/api/orders` | 訂單列表 |
| GET | `/api/orders/:orderId` | 訂單詳細 |

### 錯誤格式

```json
{ "code": "PRODUCT_OUT_OF_STOCK", "message": "招牌雞腿飯目前已售罄" }
```

| Status | code |
| --- | --- |
| 400 | `VALIDATION_ERROR`、`INVALID_OPTION`、`INVALID_COUPON` |
| 404 | `RESTAURANT_NOT_FOUND`、`PRODUCT_NOT_FOUND`、`CART_ITEM_NOT_FOUND`、`ORDER_NOT_FOUND` |
| 409 | `RESTAURANT_CLOSED`、`PRODUCT_OUT_OF_STOCK`、`CART_RESTAURANT_MISMATCH` |
| 500 | `ORDER_CREATE_FAILED`、`INTERNAL_ERROR` |

## 商業規則

**購物車**
- 同一時間只能放同一分店的餐點，否則回 `409 CART_RESTAURANT_MISMATCH`。
- 相同餐點 + 相同選項重複加入會合併數量（以 `options_signature` 判斷）。
- 加入時會鎖定該餐點列（`SELECT ... FOR UPDATE`）檢查庫存，避免連續點擊造成超量。

**客製化選項**
- 每個餐點有各自的選項；`required` 選項必選，`multiple = false` 只能選一個。
- 單價 = 餐點價格 + 所選選項加價，一律由後端計算，不信任前端傳入的價格。

**優惠券**
- `FIXED` 折固定金額、`PERCENT` 打折（`discount: 10` 代表 9 折）。
- 需符合：啟用中、未過期、達最低消費、分店相符（`restaurant_id = NULL` 為全分店適用）。

**訂單**
- 整個建立流程在單一 transaction 內：驗證分店營業 → 計價 → 扣庫存 → 套用優惠券 → 寫入訂單 → 清空購物車；任何一步失敗全部 rollback。
- 扣庫存使用條件式 `UPDATE ... WHERE stock >= ?` 防止超賣，並依餐點 id 排序避免 deadlock。
- 訂單編號格式 `ORD` + `yyyymmdd` + 4 碼流水號（例：`ORD202610080001`），由 `order_counters` 表每日遞增。
- 預估完成時間 = 15 分鐘 + 每份 5 分鐘，最多 60 分鐘。
- 訂單品項保存當下的名稱、單價與選項快照，之後菜單改價不影響歷史訂單。

## 資料庫

`sql/init.sql` 可重複執行（會先 `DROP TABLE`）。

| 資料表 | 說明 |
| --- | --- |
| `restaurants` | 分店 |
| `categories` | 菜單分類 |
| `products` | 餐點、價格、庫存 |
| `product_options` / `option_choices` | 客製化選項與選項值 |
| `coupons` | 優惠券 |
| `cart_items` / `cart_item_choices` | 購物車品項與所選選項 |
| `orders` / `order_items` | 訂單與品項快照 |
| `order_counters` | 每日訂單流水號 |

### 範例資料

| 分店 | 狀態 | 餐點 |
| --- | --- | --- |
| 1 板橋店 | 營業中 | 1001 招牌雞腿飯（庫存 8）、1002 香辣牛肉飯（售罄）、1003 古早味紅茶 |
| 2 台北店 | 未營業 | 2001 招牌雞腿飯 |

| 優惠券 | 內容 |
| --- | --- |
| `WELCOME100` | 滿 300 折 100，全分店，2026-10-31 到期 |
| `LUNCH50` | 滿 150 折 50，限板橋店 |
| `OFF10` | 滿 100 打 9 折，全分店 |
| `EXPIRED2025` | 已過期（測試用） |

## 已知限制

- 無使用者 / 登入機制，所有人共用同一台購物車與訂單列表。
- 尚無變更訂單狀態的 API，新訂單會停在 `PENDING`，需直接修改資料庫測試其他狀態。
