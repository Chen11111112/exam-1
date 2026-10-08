-- 商智餐飲 點餐系統 — MySQL 8.x 初始化腳本（可重複執行）
-- 執行：mysql -u root -p --default-character-set=utf8mb4 < sql/init.sql

CREATE DATABASE IF NOT EXISTS nextjs_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nextjs_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_counters;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_item_choices;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS option_choices;
DROP TABLE IF EXISTS product_options;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS restaurants;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------
-- 餐廳 / 菜單
-- ---------------------------------------------------------------
CREATE TABLE restaurants (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  address    VARCHAR(255) NOT NULL,
  is_open    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE = InnoDB;

CREATE TABLE categories (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id INT UNSIGNED NOT NULL,
  name          VARCHAR(50)  NOT NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_categories_restaurant (restaurant_id, sort_order),
  CONSTRAINT fk_categories_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE products (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(500) NOT NULL DEFAULT '',
  price        INT UNSIGNED NOT NULL,
  stock        INT UNSIGNED NOT NULL DEFAULT 0,
  is_available TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_products_category (category_id, sort_order),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1001;

-- 客製化選項（每個餐點各自擁有）
CREATE TABLE product_options (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  required   TINYINT(1)   NOT NULL DEFAULT 0,
  multiple   TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_options_product (product_id, sort_order),
  CONSTRAINT fk_options_product
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE option_choices (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_id  INT UNSIGNED NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  price      INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_choices_option (option_id, sort_order),
  CONSTRAINT fk_choices_option
    FOREIGN KEY (option_id) REFERENCES product_options (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- 優惠券
-- ---------------------------------------------------------------
CREATE TABLE coupons (
  id             VARCHAR(32)  NOT NULL,                       -- 優惠券代碼
  name           VARCHAR(100) NOT NULL,
  discount_type  ENUM('FIXED', 'PERCENT') NOT NULL,
  discount       INT UNSIGNED NOT NULL,                       -- FIXED: 折抵金額 / PERCENT: 折扣百分比
  minimum_amount INT UNSIGNED NOT NULL DEFAULT 0,
  expired_at     DATE         NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  restaurant_id  INT UNSIGNED NULL,                           -- NULL = 全分店適用
  PRIMARY KEY (id),
  KEY idx_coupons_expired (is_active, expired_at),
  CONSTRAINT fk_coupons_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- 購物車（不區分使用者，全站共用一台購物車）
-- ---------------------------------------------------------------
CREATE TABLE cart_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id        INT UNSIGNED    NOT NULL,
  quantity          INT UNSIGNED    NOT NULL,
  options_signature VARCHAR(64)     NOT NULL DEFAULT '',      -- 相同餐點 + 相同選項會合併
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_item (product_id, options_signature),
  CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE cart_item_choices (
  cart_item_id BIGINT UNSIGNED NOT NULL,
  option_id    INT UNSIGNED    NOT NULL,
  choice_id    INT UNSIGNED    NOT NULL,
  PRIMARY KEY (cart_item_id, choice_id),
  CONSTRAINT fk_cart_choices_item
    FOREIGN KEY (cart_item_id) REFERENCES cart_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_choices_option
    FOREIGN KEY (option_id) REFERENCES product_options (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_choices_choice
    FOREIGN KEY (choice_id) REFERENCES option_choices (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- 訂單
-- ---------------------------------------------------------------
CREATE TABLE order_counters (
  order_date DATE         NOT NULL,
  last_seq   INT UNSIGNED NOT NULL,
  PRIMARY KEY (order_date)
) ENGINE = InnoDB;

CREATE TABLE orders (
  id                 VARCHAR(20)  NOT NULL,                   -- ORD + yyyymmdd + 4 碼流水號
  restaurant_id      INT UNSIGNED NOT NULL,
  order_type         ENUM('TAKEOUT', 'DINE_IN') NOT NULL DEFAULT 'TAKEOUT',
  status             ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')
                     NOT NULL DEFAULT 'PENDING',
  subtotal           INT UNSIGNED NOT NULL,
  discount           INT UNSIGNED NOT NULL DEFAULT 0,
  total              INT UNSIGNED NOT NULL,
  coupon_code        VARCHAR(32)  NULL,
  estimated_ready_at DATETIME     NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE = InnoDB;

CREATE TABLE order_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         VARCHAR(20)     NOT NULL,
  product_id       INT UNSIGNED    NOT NULL,
  product_name     VARCHAR(100)    NOT NULL,
  quantity         INT UNSIGNED    NOT NULL,
  unit_price       INT UNSIGNED    NOT NULL,                  -- 含客製化加價的單價
  options_snapshot JSON            NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------
-- 範例資料
-- ---------------------------------------------------------------
INSERT INTO restaurants (id, name, address, is_open) VALUES
  (1, '商智餐飲－板橋店', '新北市板橋區文化路一段100號', 1),
  (2, '商智餐飲－台北店', '台北市中山區南京東路二段100號', 0);

INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES
  (101, 1, '主餐', 1),
  (102, 1, '飲料', 2),
  (201, 2, '主餐', 1);

INSERT INTO products (id, category_id, name, description, price, stock, is_available, sort_order) VALUES
  (1001, 101, '招牌雞腿飯', '招牌烤雞腿搭配白飯',   120,  8, 1, 1),
  (1002, 101, '香辣牛肉飯', '香辣牛肉片搭配白飯',   130,  0, 0, 2),
  (1003, 102, '古早味紅茶', '古早味紅茶，可選冰量', 30, 50, 1, 1),
  (2001, 201, '招牌雞腿飯', '招牌烤雞腿搭配白飯',   120, 20, 1, 1);

INSERT INTO product_options (id, product_id, name, required, multiple, sort_order) VALUES
  (1, 1001, '飯量', 1, 0, 1),
  (2, 1001, '加料', 0, 1, 2),
  (3, 1002, '飯量', 1, 0, 1),
  (4, 1003, '冰量', 1, 0, 1),
  (5, 2001, '飯量', 1, 0, 1),
  (6, 2001, '加料', 0, 1, 2);

INSERT INTO option_choices (id, option_id, name, price, sort_order) VALUES
  (11, 1, '正常',   0, 1),
  (12, 1, '加大',  20, 2),
  (21, 2, '荷包蛋', 20, 1),
  (22, 2, '起司',  15, 2),
  (31, 3, '正常',   0, 1),
  (32, 3, '加大',  20, 2),
  (41, 4, '正常冰', 0, 1),
  (42, 4, '少冰',   0, 2),
  (43, 4, '去冰',   0, 3),
  (51, 5, '正常',   0, 1),
  (52, 5, '加大',  20, 2),
  (61, 6, '荷包蛋', 20, 1),
  (62, 6, '起司',  15, 2);

INSERT INTO coupons (id, name, discount_type, discount, minimum_amount, expired_at, is_active, restaurant_id) VALUES
  ('WELCOME100', '新會員優惠',   'FIXED',   100, 300, '2026-10-31', 1, NULL),
  ('LUNCH50',    '午餐折價券',   'FIXED',    50, 150, '2026-12-31', 1, 1),
  ('OFF10',      '全館 9 折',    'PERCENT',  10, 100, '2026-12-31', 1, NULL),
  ('EXPIRED2025','已過期優惠券', 'FIXED',    30,   0, '2025-12-31', 1, NULL);
