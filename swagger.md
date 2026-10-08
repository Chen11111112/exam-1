## 三、後端團隊提供的 API

在確認需求後，後端團隊已完成資料庫與 API 開發。
前端工程師不需要負責後端 API 的實作，但必須根據 API 文件，規劃前端如何取得資料、管理狀態，以及處理各種可能發生的情況。

### 3.1 餐廳與菜單

#### 取得分店列表

```http
GET /api/restaurants
```

**Response**

```json
[
  {
    "id": 1,
    "name": "商智餐飲－板橋店",
    "address": "新北市板橋區...",
    "isOpen": true
  },
  {
    "id": 2,
    "name": "商智餐飲－台北店",
    "address": "台北市中山區...",
    "isOpen": false
  }
]
```

---

#### 取得指定分店菜單

```http
GET /api/restaurants/:restaurantId/menu
```

**Response**

```json
{
  "restaurantId": 1,
  "categories": [
    {
      "id": 101,
      "name": "主餐",
      "items": [
        {
          "id": 1001,
          "name": "招牌雞腿飯",
          "price": 120,
          "stock": 8,
          "isAvailable": true
        },
        {
          "id": 1002,
          "name": "香辣牛肉飯",
          "price": 130,
          "stock": 0,
          "isAvailable": false
        }
      ]
    }
  ]
}
```

---

### 3.2 餐點詳細資訊

#### 取得餐點詳細資料

```http
GET /api/products/:productId
```

**Response**

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

> 注意：不同餐點可能具有不同的客製化規則，前端不可假設所有餐點都有相同的選項。

---

### 3.3 購物車

#### 取得目前購物車

```http
GET /api/cart
```

---

#### 新增餐點至購物車

```http
POST /api/cart/items
```

**Request**

```json
{
  "productId": 1001,
  "quantity": 2,
  "options": [
    {
      "optionId": 1,
      "choiceIds": [11]
    },
    {
      "optionId": 2,
      "choiceIds": [21]
    }
  ]
}
```

---

#### 修改購物車品項

```http
PATCH /api/cart/items/:itemId
```

**Request**

```json
{
  "quantity": 3
}
```

---

#### 移除購物車品項

```http
DELETE /api/cart/items/:itemId
```

---

### 3.4 優惠券

#### 取得可使用的優惠券

```http
GET /api/coupons
```

**Response**

```json
[
  {
    "id": "WELCOME100",
    "name": "新會員優惠",
    "discountType": "FIXED",
    "discount": 100,
    "minimumAmount": 300,
    "expiredAt": "2026-10-31"
  }
]
```

---

#### 驗證優惠券

```http
POST /api/coupons/validate
```

**Request**

```json
{
  "code": "WELCOME100",
  "restaurantId": 1,
  "items": [
    {
      "productId": 1001,
      "quantity": 2
    }
  ]
}
```

**成功 Response**

```json
{
  "valid": true,
  "discount": 100,
  "message": "優惠券可以使用"
}
```

**失敗 Response**

```json
{
  "valid": false,
  "discount": 0,
  "message": "訂單金額未達使用門檻"
}
```

---

### 3.5 訂單

#### 建立訂單

```http
POST /api/orders
```

**Request**

```json
{
  "restaurantId": 1,
  "orderType": "TAKEOUT",
  "items": [
    {
      "productId": 1001,
      "quantity": 2,
      "options": [
        {
          "optionId": 1,
          "choiceIds": [11]
        }
      ]
    }
  ],
  "couponCode": "WELCOME100"
}
```

**成功 Response**

```json
{
  "orderId": "ORD202610070001",
  "status": "PENDING",
  "total": 140,
  "createdAt": "2026-10-07T18:30:00"
}
```

---

#### 查詢訂單列表

```http
GET /api/orders
```

**Response**

```json
[
  {
    "orderId": "ORD202610070001",
    "restaurantName": "商智餐飲－板橋店",
    "total": 140,
    "status": "PREPARING",
    "createdAt": "2026-10-07T18:30:00"
  }
]
```

---

#### 查詢單筆訂單

```http
GET /api/orders/:orderId
```

**Response**

```json
{
  "orderId": "ORD202610070001",
  "restaurantName": "商智餐飲－板橋店",
  "orderType": "TAKEOUT",
  "items": [
    {
      "productName": "招牌雞腿飯",
      "quantity": 2,
      "price": 140
    }
  ],
  "total": 140,
  "status": "PREPARING",
  "estimatedReadyTime": "19:00"
}
```

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

API 發生錯誤時，後端會回傳 HTTP Status Code 與錯誤訊息。

例如：

**餐點已售罄**

```http
409 Conflict
```

```json
{
  "code": "PRODUCT_OUT_OF_STOCK",
  "message": "招牌雞腿飯目前已售罄"
}
```

**優惠券無法使用**

```http
400 Bad Request
```

```json
{
  "code": "INVALID_COUPON",
  "message": "此優惠券不符合目前訂單條件"
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

## 附錄、補充規格

所有 API 皆為同網域的 Next.js Route Handler（`/api/...`），Request / Response 一律為 JSON（`Content-Type: application/json`）。

- 成功：HTTP `200`（`POST /api/cart/items`、`POST /api/orders` 為 `201`），body 為上述各 API 的 Response。
- 失敗：HTTP status 依 3.7 節，body 為 `{ "code": "...", "message": "..." }`。
- 本後端不做使用者身分 / 權限判斷，購物車與訂單為全站共用。

| 項目 | 說明 |
| --- | --- |
| `GET /api/coupons` | 可加 `?restaurantId=1`，只回傳該分店可用（含全分店通用）的優惠券 |
| `PATCH /api/cart/items/:itemId` | 修改後回傳最新購物車 |
| `DELETE /api/cart/items/:itemId` | 移除後回傳最新購物車 |

### 購物車 Response（取得 / 新增 / 修改 / 移除皆回傳最新購物車）

```json
{
  "restaurantId": 1,
  "items": [
    {
      "id": 1,
      "productId": 1001,
      "restaurantId": 1,
      "name": "招牌雞腿飯",
      "unitPrice": 140,
      "quantity": 2,
      "lineTotal": 280,
      "stock": 8,
      "isAvailable": true,
      "options": [
        {
          "optionId": 1,
          "optionName": "飯量",
          "choices": [{ "id": 12, "name": "加大", "price": 20 }]
        }
      ]
    }
  ],
  "totalQuantity": 2,
  "subtotal": 280
}
```

### 其他補充

| 項目 | 說明 |
| --- | --- |
| `orderType` | `TAKEOUT` / `DINE_IN` |
| 訂單品項 `price` | 含客製化加價的單價；另有 `options` 字串陣列、訂單 `subtotal` / `discount` |
| 購物車限制 | 同一時間只能有同一分店的餐點，否則 `409 CART_RESTAURANT_MISMATCH` |
| 相同餐點與選項 | 重複加入會合併數量 |
| 錯誤碼 | `VALIDATION_ERROR`、`RESTAURANT_NOT_FOUND`、`RESTAURANT_CLOSED`、`PRODUCT_NOT_FOUND`、`PRODUCT_OUT_OF_STOCK`、`INVALID_OPTION`、`CART_ITEM_NOT_FOUND`、`CART_RESTAURANT_MISMATCH`、`INVALID_COUPON`、`ORDER_NOT_FOUND`、`ORDER_CREATE_FAILED` |
| 建立訂單 | 成功後會清空該使用者的購物車；庫存於建立訂單時扣除 |
