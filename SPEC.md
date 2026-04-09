# 智店铺 — 进销存 + 蓝牙打印 App

## 1. Concept & Vision

一款专为小微商户（便利店、文具店、五金店、小超市）设计的离线优先进销存 App。
界面干净利落，操作路径短，打印小票一键完成——即使没有网络也能流畅运行。
整体气质：**专业但不冰冷，简单但不简陋**。

## 2. Design Language

### 色彩
```
--primary:     #0D9488   (teal-600，主色调)
--primary-dark:#0F766E   (teal-700，按压效果)
--accent:      #F59E0B   (amber-500，强调色/警示)
--bg:          #F1F5F9   (slate-100，页面背景)
--surface:     #FFFFFF   (卡片/组件背景)
--text:        #1E293B   (slate-800，主文字)
--text-muted:  #64748B   (slate-500，次要文字)
--border:      #E2E8F0   (slate-200，边框)
--danger:      #EF4444   (red-500，删除/错误)
--success:     #22C55E   (green-500，成功)
```

### 字体
- 标题：`"Noto Sans SC", "PingFang SC", sans-serif`（系统默认雅黑）
- 正文：同上
- 金额/数字：`"JetBrains Mono", "Courier New", monospace`（等宽，对齐整齐）

### 间距
- 基础单位 4px，常规使用 8/12/16/24/32px
- 卡片内边距：16px
- 列表项间距：8px
- 页面左右边距：16px

### 圆角
- 卡片：12px
- 按钮：8px（普通）/ 24px（胶囊）/ 全圆角（图标按钮）
- 输入框：8px

### 动效
- 页面切换：translateX 滑动，200ms ease-out
- 卡片入场：opacity 0→1 + translateY 12px→0，300ms ease-out，依次错开 50ms
- 按钮按压：scale(0.97)，100ms
- 删除/成功：fade + scale

## 3. Layout & Structure

### 整体布局（移动优先，360px–428px 适配）
```
┌─────────────────────────┐
│  顶部标题栏（44px）      │
├─────────────────────────┤
│                         │
│  主内容区（flex:1）     │
│                         │
├─────────────────────────┤
│  底部 Tab 导航（56px）  │
└─────────────────────────┘
```

### 五大 Tab
1. **首页** — 数据概览：今日销售/订单数/库存预警/快捷操作
2. **商品** — 商品列表 + 新增/编辑
3. **客户** — 客户列表 + 新增/编辑
4. **库存** — 库存列表 + 入库/出库
5. **订单** — 订单列表 + 新建订单（含打印小票）

### 顶部操作栏
- 左：返回箭头（子页面显示）
- 中：页面标题
- 右：操作按钮（如"新增"、"打印设置"）

## 4. Features & Interactions

### 4.1 商品管理
- 列表页：搜索框 + 商品列表（名称/条码/单价/库存）
- 新增/编辑弹窗：商品名、条码（支持扫码枪）、规格、单位、单价、库存预警量、备注
- 长按/左滑删除，带确认

### 4.2 客户管理
- 列表页：搜索框 + 客户列表（名称/电话/地址/累计消费）
- 新增/编辑弹窗：客户名、电话、地址、备注
- 客户详情：查看该客户所有订单

### 4.3 库存管理
- 列表页：商品列表（当前库存/预警状态）
- 预警色：库存 ≤ 预警量 → 红色高亮
- 入库：选商品 → 填数量 → 确认
- 出库：选商品 → 填数量（出库类型：销售/损耗/退货）→ 确认
- 入库/出库自动记录流水

### 4.4 订单管理
- 列表页：订单号/时间/客户/金额/状态（已完成/退单）
- 新建订单流程：
  1. 选择客户（可选）
  2. 扫描/搜索添加商品
  3. 填写数量，支持修改单价
  4. 备注
  5. 提交 → 自动打印小票（蓝牙连接时）
- 订单详情：订单明细 + 重新打印

### 4.5 蓝牙打印
- 入口：设置页或订单提交后自动弹出
- 打印设置：搜索蓝牙设备 → 连接 → 保存设备
- 小票格式（ESC/POS 58mm）：
  ```
  ═══════════════════════
       智店铺 · 小票
  ═══════════════════════
  订单号：20260409123456
  时间：2026-04-09 20:30
  客户：张三（可选）
  ───────────────────────
  商品      数量  单价  小计
  可乐       2   3.00  6.00
  薯片       1   5.50  5.50
  ───────────────────────
  合计：11.50 元
  备注：尽快送达
  ═══════════════════════
       谢谢惠顾，欢迎下次光临
  ═══════════════════════
  ```

### 4.6 首页概览
- 今日销售额（元）
- 今日订单数
- 库存预警数量
- 4个快捷入口：新建订单 / 快速入库 / 商品管理 / 蓝牙设置

## 5. Component Inventory

### BottomTab
- 5个图标按钮，当前选中 teal 高亮，未选中 slate 灰色
- 点击切换 Tab，带缩放反馈

### TopBar
- 固定顶部，白色背景，底部细线分隔
- 返回按钮在子页出现

### ProductCard / CustomerCard
- 白色卡片，左侧信息，右侧快捷操作图标
- 滑动显示删除按钮

### Modal / BottomSheet
- 底部弹出，遮罩层
- 表单控件：输入框（下拉/文字/数字）、确认按钮
- 表单验证：必填项为空 → 输入框红色边框 + 提示文字

### OrderItem
- 订单卡片：订单号 + 时间 + 客户 + 金额 + 打印图标
- 点击进入详情

### PrintButton
- 蓝牙图标 + 连接状态文字
- 连接中：旋转动画
- 已连接：绿色
- 未连接：灰色

### AlertToast
- 底部弹出，2秒消失
- 成功（绿）/ 错误（红）/ 警告（黄）

## 6. Technical Approach

### 架构
- **前端：** Vanilla JS + HTML5 + CSS3（零框架依赖，极简打包）
- **数据：** IndexedDB（本地持久化，离线可用）
- **离线：** Service Worker（缓存所有资源，offline 100%）
- **蓝牙：** Web Bluetooth API（Android Chrome 97+）
- **打印协议：** ESC/POS（58mm 热敏小票）
- **打包：** Capacitor（Web → Android APK）

### IndexedDB 数据库设计
```
db: zhidianpu (版本1)

stores:
  products    { id(auto), name, barcode, spec, unit, price, stock, warnQty, remark, createdAt }
  customers   { id(auto), name, phone, address, remark, createdAt }
  inventory_logs { id(auto), productId, type(in/out), qty, note, createdAt }
  orders      { id(auto), orderNo, customerId, items[{productId,name,qty,price}], totalAmount, remark, status, createdAt }
  settings    { key, value }  // 存储蓝牙设备等配置
```

### API 设计（蓝牙）
- `window.bluetooth.requestDevice()` → 连接打印机
- `characteristic.writeValue(Uint8Array)` → 发送 ESC/POS 指令

### 打包命令
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android   # Android Studio 打开构建 APK
```
