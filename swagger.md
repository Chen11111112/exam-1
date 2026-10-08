## 三、後端團隊提供的 API

在確認需求後，後端團隊已完成資料庫與 API 開發。
前端工程師不需要負責後端 API 的實作，但必須根據 API 文件，規劃前端如何取得資料、管理狀態，以及處理各種可能發生的情況。

> 各型別的完整定義請見最下方〈附錄、TypeScript 型別定義〉。

### 3.0 共通規範

| 項目 | 說明 |
| --- | --- |
| Base URL | `http://localhost:8080/api`（依考試環境啟動方式而定），已開放跨來源（CORS）存取 |
| 格式 | Request / Response 一律為 JSON；有 body 的請求需帶 `Content-Type: application/json` |
| 身分驗證 | 無。不做使用者身分 / 權限判斷，**購物車與訂單為全站共用** |
| 金額 | 整數，單位新台幣元 |
| 日期時間 | 伺服器當地時間（Asia/Taipei），不含時區，例如 `2026-10-08T13:47:47` |
| 成功 | `200`；`POST /api/cart/items`、`POST /api/orders` 為 `201` |
| 失敗 | 依情境回 `400` / `404` / `409` / `500`，body 為 `ApiErrorBody`（見 3.7） |

**數值型欄位必須送 JSON number**：`{"quantity": 2}` 可以，`{"quantity": "2"}` 會回 `400 VALIDATION_ERROR`。

**`VALIDATION_ERROR` 的 `message` 格式**：`欄位路徑: 錯誤說明`（英文），多個錯誤以 `; ` 串接；Path / Query 參數錯誤時欄位路徑為 `input`。

```json
{
  "code": "VALIDATION_ERROR",
  "message": "orderType: Invalid option: expected one of \"TAKEOUT\"|\"DINE_IN\"; items: Too small: expected array to have >=1 items"
}
```

---

### 3.1 餐廳與菜單

#### 取得分店列表

```http
GET /api/restaurants
```

**Response** `200` — `Restaurant[]`

```json
[
  {
    "id": 1,
    "name": "商智餐飲－板橋店",
    "address": "新北市板橋區文化路一段100號",
    "isOpen": true
  },
  {
    "id": 2,
    "name": "商智餐飲－台北店",
    "address": "台北市中山區南京東路二段100號",
    "isOpen": false
  }
]
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | `number` | 分店 id |
| `name` | `string` | 分店名稱 |
| `address` | `string` | 地址 |
| `isOpen` | `boolean` | 是否營業中 |

---

#### 取得指定分店菜單

```http
GET /api/restaurants/:restaurantId/menu
```

**Path 參數**

| 參數 | 型別 | 說明 |
| --- | --- | --- |
| `restaurantId` | 正整數 | 分店 id |

**Response** `200` — `Menu`

```json
{
  "restaurantId": 1,
  "categories": [
    {
      "id": 101,
      "name": "主餐",
      "items": [
        { "id": 1001, "name": "招牌雞腿飯", "price": 120, "stock": 8, "isAvailable": true },
        { "id": 1002, "name": "香辣牛肉飯", "price": 130, "stock": 0, "isAvailable": false }
      ]
    },
    {
      "id": 102,
      "name": "飲料",
      "items": [
        { "id": 1003, "name": "古早味紅茶", "price": 30, "stock": 50, "isAvailable": true }
      ]
    }
  ]
}
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `categories[].items[].price` | `number` | 基本價格（不含客製化加價） |
| `categories[].items[].stock` | `number` | 目前庫存 |
| `categories[].items[].isAvailable` | `boolean` | 是否可供應 |

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `restaurantId` 不是正整數 |
| 404 | `RESTAURANT_NOT_FOUND` | 分店不存在 |

---

### 3.2 餐點詳細資訊

#### 取得餐點詳細資料

```http
GET /api/products/:productId
```

**Path 參數**

| 參數 | 型別 | 說明 |
| --- | --- | --- |
| `productId` | 正整數 | 餐點 id |

**Response** `200` — `Product`

```json
{
  "id": 1001,
  "name": "招牌雞腿飯",
  "price": 120,
  "description": "招牌烤雞腿搭配白飯",
  "stock": 8,
  "isAvailable": true,
  "options": [
    {
      "id": 1,
      "name": "飯量",
      "required": true,
      "multiple": false,
      "choices": [
        { "id": 11, "name": "正常", "price": 0 },
        { "id": 12, "name": "加大", "price": 20 }
      ]
    },
    {
      "id": 2,
      "name": "加料",
      "required": false,
      "multiple": true,
      "choices": [
        { "id": 21, "name": "荷包蛋", "price": 20 },
        { "id": 22, "name": "起司", "price": 15 }
      ]
    }
  ]
}
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `options[].required` | `boolean` | 是否必選 |
| `options[].multiple` | `boolean` | 是否可複選 |
| `options[].choices[].price` | `number` | 加價金額 |

> 注意：不同餐點可能具有不同的客製化規則。

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `productId` 不是正整數 |
| 404 | `PRODUCT_NOT_FOUND` | 餐點不存在 |

---

### 3.3 購物車

取得 / 新增 / 修改 / 移除皆回傳最新的完整購物車（`Cart`）。

- 同一時間只能放同一分店的餐點。
- 相同餐點與相同選項重複加入會合併數量。

#### 取得目前購物車

```http
GET /api/cart
```

**Response** `200` — `Cart`

```json
{
  "restaurantId": 1,
  "items": [
    {
      "id": 1,
      "productId": 1001,
      "restaurantId": 1,
      "name": "招牌雞腿飯",
      "unitPrice": 175,
      "quantity": 3,
      "lineTotal": 525,
      "stock": 8,
      "isAvailable": true,
      "options": [
        {
          "optionId": 1,
          "optionName": "飯量",
          "choices": [{ "id": 12, "name": "加大", "price": 20 }]
        },
        {
          "optionId": 2,
          "optionName": "加料",
          "choices": [
            { "id": 21, "name": "荷包蛋", "price": 20 },
            { "id": 22, "name": "起司", "price": 15 }
          ]
        }
      ]
    },
    {
      "id": 3,
      "productId": 1003,
      "restaurantId": 1,
      "name": "古早味紅茶",
      "unitPrice": 30,
      "quantity": 1,
      "lineTotal": 30,
      "stock": 50,
      "isAvailable": true,
      "options": [
        {
          "optionId": 4,
          "optionName": "冰量",
          "choices": [{ "id": 42, "name": "少冰", "price": 0 }]
        }
      ]
    }
  ],
  "totalQuantity": 4,
  "subtotal": 555
}
```

**空購物車**

```json
{ "restaurantId": null, "items": [], "totalQuantity": 0, "subtotal": 0 }
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `restaurantId` | `number \| null` | 購物車目前所屬分店；空購物車為 `null` |
| `items[].id` | `number` | 購物車品項 id（修改 / 移除時使用，**不是** `productId`） |
| `items[].unitPrice` | `number` | 含選項加價的單價 |
| `items[].lineTotal` | `number` | `unitPrice × quantity` |
| `items[].stock` / `isAvailable` | `number` / `boolean` | 餐點目前的庫存與是否可供應 |
| `items[].options` | `CartLineOption[]` | 已選擇的選項 |
| `totalQuantity` | `number` | 所有品項數量總和 |
| `subtotal` | `number` | 所有 `lineTotal` 總和（未折扣） |

---

#### 新增餐點至購物車

```http
POST /api/cart/items
```

**Request** — `AddCartItemRequest`

```json
{
  "productId": 1001,
  "quantity": 2,
  "options": [
    { "optionId": 1, "choiceIds": [12] },
    { "optionId": 2, "choiceIds": [21, 22] }
  ]
}
```

| 欄位 | 型別 | 必填 | 限制 |
| --- | --- | --- | --- |
| `productId` | `number` | ✓ | 正整數 |
| `quantity` | `number` | ✓ | 整數 1–99 |
| `options` | `SelectedOption[]` | | 最多 20 個 |
| `options[].optionId` | `number` | ✓ | 正整數 |
| `options[].choiceIds` | `number[]` | ✓ | 正整數陣列 |

**Response** `201` — `Cart`（新增後的完整購物車，格式同 `GET /api/cart`）

**錯誤**

| Status | code | 情境 / message 範例 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | body 不是 JSON：`請求內容必須是有效的 JSON`；欄位格式錯誤：`quantity: Too small: expected number to be >=1` |
| 400 | `INVALID_OPTION` | 客製化選項不合法，例如 `招牌雞腿飯的「飯量」為必選項目` |
| 404 | `PRODUCT_NOT_FOUND` | 餐點不存在：`找不到餐點 (id: 9999)` |
| 409 | `PRODUCT_OUT_OF_STOCK` | `香辣牛肉飯目前已售罄`、`招牌雞腿飯庫存不足，目前僅剩 8 份` |
| 409 | `CART_RESTAURANT_MISMATCH` | `購物車內已有其他分店的餐點，請先清空購物車或完成結帳` |

---

#### 修改購物車品項

```http
PATCH /api/cart/items/:itemId
```

**Path 參數**

| 參數 | 型別 | 說明 |
| --- | --- | --- |
| `itemId` | 正整數 | 購物車品項 id（`Cart.items[].id`） |

**Request** — `UpdateCartItemRequest`

```json
{
  "quantity": 3
}
```

| 欄位 | 型別 | 必填 | 限制 |
| --- | --- | --- | --- |
| `quantity` | `number` | ✓ | 整數 1–99 |

**Response** `200` — `Cart`（修改後的完整購物車）

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `itemId` 或 `quantity` 格式錯誤 |
| 404 | `CART_ITEM_NOT_FOUND` | `購物車中找不到此品項` |
| 409 | `PRODUCT_OUT_OF_STOCK` | `招牌雞腿飯庫存不足，目前僅剩 8 份` |

---

#### 移除購物車品項

```http
DELETE /api/cart/items/:itemId
```

**Path 參數**

| 參數 | 型別 | 說明 |
| --- | --- | --- |
| `itemId` | 正整數 | 購物車品項 id（`Cart.items[].id`） |

**Response** `200` — `Cart`（移除後的完整購物車）

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `itemId` 不是正整數 |
| 404 | `CART_ITEM_NOT_FOUND` | `購物車中找不到此品項` |

---

### 3.4 優惠券

#### 取得可使用的優惠券

```http
GET /api/coupons
```

**Query 參數**

| 參數 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `restaurantId` | 正整數 | | 帶入時只回傳該分店可用的券（含全分店通用券） |

只會回傳啟用中且未過期的優惠券。

**Response** `200` — `Coupon[]`（範例：`GET /api/coupons?restaurantId=1`）

```json
[
  {
    "id": "WELCOME100",
    "name": "新會員優惠",
    "discountType": "FIXED",
    "discount": 100,
    "minimumAmount": 300,
    "expiredAt": "2026-10-31"
  },
  {
    "id": "LUNCH50",
    "name": "午餐折價券",
    "discountType": "FIXED",
    "discount": 50,
    "minimumAmount": 150,
    "expiredAt": "2026-12-31"
  },
  {
    "id": "OFF10",
    "name": "全館 9 折",
    "discountType": "PERCENT",
    "discount": 10,
    "minimumAmount": 100,
    "expiredAt": "2026-12-31"
  }
]
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | `string` | 優惠券代碼 |
| `discountType` | `"FIXED" \| "PERCENT"` | `FIXED` 折固定金額；`PERCENT` 依百分比折扣 |
| `discount` | `number` | `FIXED`：折抵金額；`PERCENT`：折扣百分比（`10` = 9 折） |
| `minimumAmount` | `number` | 最低消費金額 |
| `expiredAt` | `string` | 到期日 `YYYY-MM-DD` |

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `restaurantId` 不是正整數 |

---

#### 驗證優惠券

```http
POST /api/coupons/validate
```

依傳入的品項試算小計並檢查優惠券是否可用。

**Request** — `ValidateCouponRequest`

```json
{
  "code": "WELCOME100",
  "restaurantId": 1,
  "items": [
    {
      "productId": 1001,
      "quantity": 3,
      "options": [{ "optionId": 1, "choiceIds": [11] }]
    }
  ]
}
```

| 欄位 | 型別 | 必填 | 限制 |
| --- | --- | --- | --- |
| `code` | `string` | ✓ | 1–32 字（前後空白會去除） |
| `restaurantId` | `number` | ✓ | 正整數 |
| `items` | `array` | ✓ | 1–50 項 |
| `items[].productId` | `number` | ✓ | 正整數 |
| `items[].quantity` | `number` | ✓ | 整數 1–99 |
| `items[].options` | `SelectedOption[]` | | 最多 20 個 |

**Response** `200` — `CouponValidation`

可以使用：

```json
{
  "valid": true,
  "discount": 100,
  "message": "優惠券可以使用"
}
```

無法使用：

```json
{
  "valid": false,
  "discount": 0,
  "message": "訂單金額未達使用門檻"
}
```

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 欄位格式錯誤，例如 `items: Too small: expected array to have >=1 items` |
| 400 | `INVALID_OPTION` | 客製化選項不合法 |
| 404 | `PRODUCT_NOT_FOUND` | 餐點不存在，或 `招牌雞腿飯不屬於所選分店` |

---

### 3.5 訂單

#### 建立訂單

```http
POST /api/orders
```

建立成功後會清空購物車；庫存於建立訂單時扣除。

**Request** — `CreateOrderRequest`

```json
{
  "restaurantId": 1,
  "orderType": "DINE_IN",
  "items": [
    {
      "productId": 1001,
      "quantity": 2,
      "options": [
        { "optionId": 1, "choiceIds": [12] },
        { "optionId": 2, "choiceIds": [21] }
      ]
    },
    {
      "productId": 1003,
      "quantity": 1,
      "options": [{ "optionId": 4, "choiceIds": [43] }]
    }
  ],
  "couponCode": "OFF10"
}
```

| 欄位 | 型別 | 必填 | 限制 |
| --- | --- | --- | --- |
| `restaurantId` | `number` | ✓ | 正整數 |
| `orderType` | `"TAKEOUT" \| "DINE_IN"` | ✓ | 外帶 / 內用 |
| `items` | `array` | ✓ | 1–50 項 |
| `items[].productId` | `number` | ✓ | 正整數 |
| `items[].quantity` | `number` | ✓ | 整數 1–99 |
| `items[].options` | `SelectedOption[]` | | 最多 20 個 |
| `couponCode` | `string` | | 1–32 字 |

**Response** `201` — `CreatedOrder`

```json
{
  "orderId": "ORD202610080001",
  "status": "PENDING",
  "total": 315,
  "createdAt": "2026-10-08T13:47:47"
}
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `orderId` | `string` | 訂單編號 |
| `status` | `OrderStatus` | 訂單狀態 |
| `total` | `number` | 實付金額 |
| `createdAt` | `string` | 建立時間 |

**錯誤**

| Status | code | 情境 / message 範例 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 欄位格式錯誤，例如 `orderType` 不是 `TAKEOUT` / `DINE_IN` |
| 400 | `INVALID_OPTION` | 客製化選項不合法 |
| 400 | `INVALID_COUPON` | 優惠券無法使用 |
| 404 | `RESTAURANT_NOT_FOUND` | `找不到指定的分店` |
| 404 | `PRODUCT_NOT_FOUND` | 餐點不存在，或 `招牌雞腿飯不屬於所選分店` |
| 409 | `RESTAURANT_CLOSED` | `此分店目前未營業，無法建立訂單` |
| 409 | `PRODUCT_OUT_OF_STOCK` | `招牌雞腿飯目前已售罄` |
| 500 | `ORDER_CREATE_FAILED` | `目前無法建立訂單，請稍後再試` |

---

#### 查詢訂單列表

```http
GET /api/orders
```

**Response** `200` — `OrderSummary[]`

```json
[
  {
    "orderId": "ORD202610080001",
    "restaurantName": "商智餐飲－板橋店",
    "total": 315,
    "status": "PENDING",
    "createdAt": "2026-10-08T13:47:47"
  }
]
```

---

#### 查詢單筆訂單

```http
GET /api/orders/:orderId
```

**Path 參數**

| 參數 | 型別 | 說明 |
| --- | --- | --- |
| `orderId` | `string` | 格式 `ORD` + 12 位數字，例如 `ORD202610080001` |

**Response** `200` — `OrderDetail`

```json
{
  "orderId": "ORD202610080001",
  "restaurantName": "商智餐飲－板橋店",
  "orderType": "DINE_IN",
  "items": [
    {
      "productName": "招牌雞腿飯",
      "quantity": 2,
      "price": 160,
      "options": ["飯量：加大", "加料：荷包蛋"]
    },
    {
      "productName": "古早味紅茶",
      "quantity": 1,
      "price": 30,
      "options": ["冰量：去冰"]
    }
  ],
  "subtotal": 350,
  "discount": 35,
  "total": 315,
  "status": "PENDING",
  "estimatedReadyTime": "14:17"
}
```

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `items[].price` | `number` | 含客製化加價的單價 |
| `items[].options` | `string[]` | 選項文字，格式 `選項名稱：選項值` |
| `subtotal` | `number` | 小計 |
| `discount` | `number` | 折扣金額 |
| `total` | `number` | 實付金額 |
| `estimatedReadyTime` | `string \| null` | 預估完成時間 `HH:mm`；`CANCELLED` 時為 `null` |

**錯誤**

| Status | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `orderId` 格式錯誤 |
| 404 | `ORDER_NOT_FOUND` | `找不到指定的訂單` |

---

### 3.6 訂單狀態

訂單可能依照以下流程變化：

```text
PENDING
   ↓
CONFIRMED
   ↓
PREPARING
   ↓
READY
   ↓
COMPLETED
```

若訂單被取消，則可能進入：

```text
PENDING / CONFIRMED
        ↓
    CANCELLED
```

前端必須根據目前的 `status` 顯示適當的訂單資訊。

例如：

| Status      | 意義           |
| ----------- | ------------ |
| `PENDING`   | 訂單已送出，等待餐廳確認 |
| `CONFIRMED` | 餐廳已確認訂單      |
| `PREPARING` | 餐點製作中        |
| `READY`     | 餐點已完成，可取餐    |
| `COMPLETED` | 訂單已完成        |
| `CANCELLED` | 訂單已取消        |

---

### 3.7 API 錯誤

API 發生錯誤時，後端會回傳 HTTP Status Code 與錯誤訊息，body 格式固定為：

```ts
interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}
```

| Status | code | 說明 | 可能出現的 API |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 參數 / body 格式錯誤，或 body 不是 JSON | 所有帶參數或 body 的 API |
| 400 | `INVALID_OPTION` | 客製化選項不合法 | 新增購物車、驗證優惠券、建立訂單 |
| 400 | `INVALID_COUPON` | 優惠券不可用 | 建立訂單 |
| 404 | `RESTAURANT_NOT_FOUND` | 分店不存在 | 菜單、建立訂單 |
| 404 | `PRODUCT_NOT_FOUND` | 餐點不存在或不屬於所選分店 | 餐點詳細、新增購物車、驗證優惠券、建立訂單 |
| 404 | `CART_ITEM_NOT_FOUND` | 購物車品項不存在 | 修改 / 移除購物車品項 |
| 404 | `ORDER_NOT_FOUND` | 訂單不存在 | 查詢單筆訂單 |
| 409 | `RESTAURANT_CLOSED` | 分店未營業 | 建立訂單 |
| 409 | `PRODUCT_OUT_OF_STOCK` | 已售罄或庫存不足 | 新增 / 修改購物車、建立訂單 |
| 409 | `CART_RESTAURANT_MISMATCH` | 購物車已有其他分店的餐點 | 新增購物車 |
| 500 | `ORDER_CREATE_FAILED` | 建立訂單時發生非預期錯誤 | 建立訂單 |
| 500 | `INTERNAL_ERROR` | 其他非預期伺服器錯誤，message 為 `伺服器發生錯誤，請稍後再試` | 所有 API |

例如：

**餐點已售罄**

```http
409 Conflict
```

```json
{
  "code": "PRODUCT_OUT_OF_STOCK",
  "message": "香辣牛肉飯目前已售罄"
}
```

**優惠券無法使用**

```http
400 Bad Request
```

```json
{
  "code": "INVALID_COUPON",
  "message": "訂單金額未達使用門檻"
}
```

**訂單建立失敗**

```http
500 Internal Server Error
```

```json
{
  "code": "ORDER_CREATE_FAILED",
  "message": "目前無法建立訂單，請稍後再試"
}
```

---

### 3.8 前端工程師注意事項

後端團隊只負責提供 API，**不會告訴你前端應該如何設計**。

你需要自行思考：

1. 哪些 API 應該在哪個頁面呼叫？
2. 哪些資料應該由前端保存？
3. 哪些資料需要共享於不同頁面？
4. 使用者重新整理頁面後，購物車與訂單狀態是否仍然需要存在？
5. 餐點在瀏覽時有庫存，但加入購物車時已售罄，應該如何處理？
6. 使用者快速連續點擊「加入購物車」會發生什麼問題？
7. API Loading 時畫面應該呈現什麼狀態？
8. API 發生錯誤時，使用者是否知道下一步該做什麼？
9. 優惠券驗證失敗時，是否仍允許使用者送出訂單？
10. 訂單狀態改變時，前端應該如何取得最新狀態？

**本次考試不要求完全按照特定的頁面結構實作。**

只要你的設計能合理解決需求，並能說明你的技術與架構決策，即可獲得評分。

---

## 附錄、TypeScript 型別定義

以下為 API 資料格式的 TypeScript 表示。

### 共用型別

```ts
type DiscountType = 'FIXED' | 'PERCENT';

type OrderType = 'TAKEOUT' | 'DINE_IN';

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESTAURANT_NOT_FOUND'
  | 'RESTAURANT_CLOSED'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_OUT_OF_STOCK'
  | 'INVALID_OPTION'
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_RESTAURANT_MISMATCH'
  | 'INVALID_COUPON'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_CREATE_FAILED'
  | 'INTERNAL_ERROR';

interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

/** 選擇的客製化選項（Request 使用） */
interface SelectedOption {
  optionId: number;
  choiceIds: number[];
}
```

### Request 型別

```ts
/** POST /api/cart/items */
interface AddCartItemRequest {
  productId: number;
  quantity: number; // 1–99
  options?: SelectedOption[];
}

/** PATCH /api/cart/items/:itemId */
interface UpdateCartItemRequest {
  quantity: number; // 1–99
}

/** POST /api/coupons/validate */
interface ValidateCouponRequest {
  code: string;
  restaurantId: number;
  items: {
    productId: number;
    quantity: number;
    options?: SelectedOption[];
  }[];
}

/** POST /api/orders */
interface CreateOrderRequest {
  restaurantId: number;
  orderType: OrderType;
  items: {
    productId: number;
    quantity: number;
    options?: SelectedOption[];
  }[];
  couponCode?: string;
}
```

### Response 型別

```ts
/** GET /api/restaurants → Restaurant[] */
interface Restaurant {
  id: number;
  name: string;
  address: string;
  isOpen: boolean;
}

/** GET /api/restaurants/:restaurantId/menu → Menu */
interface Menu {
  restaurantId: number;
  categories: MenuCategory[];
}

interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

interface MenuItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

/** GET /api/products/:productId → Product */
interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  stock: number;
  isAvailable: boolean;
  options: ProductOption[];
}

interface ProductOption {
  id: number;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: ProductChoice[];
}

interface ProductChoice {
  id: number;
  name: string;
  price: number;
}

/** GET / POST / PATCH / DELETE 購物車 → Cart */
interface Cart {
  restaurantId: number | null;
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
}

interface CartItem {
  id: number;
  productId: number;
  restaurantId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  isAvailable: boolean;
  options: CartLineOption[];
}

interface CartLineOption {
  optionId: number;
  optionName: string;
  choices: ProductChoice[];
}

/** GET /api/coupons → Coupon[] */
interface Coupon {
  id: string;
  name: string;
  discountType: DiscountType;
  discount: number;
  minimumAmount: number;
  expiredAt: string;
}

/** POST /api/coupons/validate → CouponValidation */
interface CouponValidation {
  valid: boolean;
  discount: number;
  message: string;
}

/** POST /api/orders → CreatedOrder */
interface CreatedOrder {
  orderId: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
}

/** GET /api/orders → OrderSummary[] */
interface OrderSummary {
  orderId: string;
  restaurantName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

/** GET /api/orders/:orderId → OrderDetail */
interface OrderDetail {
  orderId: string;
  restaurantName: string;
  orderType: OrderType;
  items: OrderDetailItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  estimatedReadyTime: string | null;
}

interface OrderDetailItem {
  productName: string;
  quantity: number;
  price: number;
  options: string[];
}
```
