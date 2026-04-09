// ================================================
// 智店铺 · ESC/POS 小票打印模块
// ================================================

// ESC/POS 常用指令
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const CMD = {
  INIT:       [ESC, 0x40],                          // 初始化打印机
  ALIGN_L:    [ESC, 0x61, 0x00],                    // 左对齐
  ALIGN_C:    [ESC, 0x61, 0x01],                   // 居中
  ALIGN_R:    [ESC, 0x61, 0x02],                   // 右对齐
  BOLD_ON:    [ESC, 0x45, 0x01],                    // 加粗开
  BOLD_OFF:   [ESC, 0x45, 0x00],                   // 加粗关
  DOUBLE_H:   [GS,  0x21, 0x10],                    // 倍高
  DOUBLE_W:   [GS,  0x21, 0x20],                    // 倍宽
  DOUBLE_HW:  [GS,  0x21, 0x30],                    // 倍高+倍宽
  NORMAL:     [GS,  0x21, 0x00],                    // 正常大小
  UNDERLINE:  [ESC, 0x2D, 0x01],                    // 下划线开
  UNDERLINE_OFF: [ESC, 0x2D, 0x00],                 // 下划线关
  FEED:       [ESC, 0x64, 0x03],                    // 进纸3行
  CUT:        [GS,  0x56, 0x00],                    // 全切
  CUT_PART:   [GS,  0x56, 0x01],                    // 半切
  LF:         [LF],                                 // 换行
};

const WIDTH = 32;  // 58mm 纸，每行最多 32 个英文字符（约16个中文）

function cmd(...args) {
  return new Uint8Array(args.flat());
}

function text(str) {
  // GBK 编码支持中文
  return str2gbk(str);
}

function str2gbk(str) {
  // 使用 encodeURI 模拟 GBK（实际打印机驱动处理）
  // 这里转成 UTF-8，让蓝牙打印机处理
  const encoder = new TextEncoder('utf-8');
  return encoder.encode(str);
}

function padRight(str, len) {
  const s = String(str);
  return s + ' '.repeat(Math.max(0, len - charsLen(s)));
}

function padCenter(str, len) {
  const s = String(str);
  const slen = charsLen(s);
  const pad = Math.max(0, len - slen);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + s + ' '.repeat(pad - left);
}

function padLeft(str, len) {
  const s = String(str);
  return ' '.repeat(Math.max(0, len - charsLen(s))) + s;
}

function charsLen(s) {
  // 粗略计算：中文=2，英文=1
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0xFF ? 2 : 1;
  return n;
}

function line(char = '─', len = WIDTH) {
  return char.repeat(len);
}

function doubleLine(len = WIDTH) {
  return '═'.repeat(len);
}

async function printReceipt(order, customer, products) {
  const state = BT.getState();
  if (state !== 'connected') {
    throw new Error('打印机未连接，请先在"蓝牙设置"中连接打印机');
  }

  const now = new Date(order.createdAt || Date.now());
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1,2)}-${pad(now.getDate(),2)} ${pad(now.getHours(),2)}:${pad(now.getMinutes(),2)}:${pad(now.getSeconds(),2)}`;

  const lines = [];

  // 初始化
  lines.push(...CMD.INIT);
  lines.push(...CMD.ALIGN_C);
  lines.push(...CMD.DOUBLE_HW);
  lines.push(...CMD.BOLD_ON);
  lines.push(text('智店铺 · 小票\n'));
  lines.push(...CMD.NORMAL);
  lines.push(...CMD.BOLD_OFF);
  lines.push(text(doubleLine() + '\n'));

  // 订单号 & 时间
  lines.push(...CMD.ALIGN_L);
  lines.push(...CMD.BOLD_ON);
  lines.push(text(`单号：${order.orderNo}\n`));
  lines.push(text(`时间：${dateStr}\n`));
  lines.push(...CMD.BOLD_OFF);

  // 客户
  if (customer) {
    lines.push(text(`客户：${customer.name}\n`));
    if (customer.phone) lines.push(text(`电话：${customer.phone}\n`));
  }

  lines.push(text(line() + '\n'));

  // 表头
  lines.push(...CMD.BOLD_ON);
  lines.push(text(padRight('商品', 14) + padRight('数量', 4) + padRight('单价', 8) + padLeft('小计', 6) + '\n'));
  lines.push(...CMD.BOLD_OFF);
  lines.push(text(line() + '\n'));

  // 商品明细
  const items = order.items || [];
  for (const item of items) {
    const name = item.name || '商品';
    const nameDisplay = charsLen(name) > 12 ? name.slice(0, 5) + '..' : padRight(name, 12);
    const qty = String(item.qty || 0);
    const price = yuan(item.price || 0);
    const subtotal = yuan(item.qty * item.price);
    const row = padRight(nameDisplay, 14) + padRight(qty, 4) + padRight(price, 8) + padLeft(subtotal, 6);
    lines.push(text(row + '\n'));
  }

  lines.push(text(line() + '\n'));

  // 合计
  lines.push(...CMD.ALIGN_R);
  lines.push(...CMD.BOLD_ON);
  lines.push(text(`合计：${yuan(order.totalAmount || 0)} 元\n`));
  lines.push(...CMD.BOLD_OFF);
  lines.push(...CMD.ALIGN_L);

  // 备注
  if (order.remark && order.remark.trim()) {
    lines.push(text(`备注：${order.remark.trim()}\n`));
  }

  lines.push(text(line() + '\n'));

  // 底部
  lines.push(...CMD.ALIGN_C);
  lines.push(...CMD.UNDERLINE);
  lines.push(text('谢谢惠顾，欢迎下次光临\n'));
  lines.push(...CMD.UNDERLINE_OFF);
  lines.push(text(doubleLine() + '\n'));

  // 进纸并切纸
  lines.push(...CMD.FEED);
  lines.push(...CMD.CUT);

  // 合并发送
  const total = new Uint8Array(lines.flat());
  await BT.writeBytes(total);
}

function yuan(n) {
  return '¥' + (Number(n) || 0).toFixed(2);
}

function pad(n, w) {
  return String(n).padStart(w, '0');
}

// ---- 打印设置页内容 ----
function renderPrintSettingsHTML(onConnect, onDisconnect) {
  const state = BT.getState();
  const stateClass = state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : '';
  const stateText = state === 'connected' ? '已连接' : state === 'connecting' ? '连接中...' : '未连接';
  const btnText = state === 'connected' ? '断开连接' : '搜索并连接打印机';

  return `
    <div class="form-group">
      <div class="form-label">蓝牙打印机状态</div>
      <div class="bluetooth-status ${stateClass}" id="btStatusDisplay">
        <span class="dot"></span>
        <span id="btStatusText">${stateText}</span>
      </div>
    </div>
    <div class="form-group">
      <button class="btn ${state === 'connected' ? 'btn-danger' : 'btn-primary'} btn-block" id="btConnectBtn" onclick="${onConnect}">
        ${btnText}
      </button>
      <p class="form-hint" style="margin-top:8px;text-align:center;">
        ${BT.isSupported() ? '支持蓝牙 4.0+ 热敏打印机（Android Chrome 97+）' : '当前浏览器不支持 Web Bluetooth，请在 Android Chrome 中打开本页面'}
      </p>
    </div>
    <div class="form-group" style="margin-top:16px;">
      <div class="section-title">小票预览</div>
      <div style="background:#f8f8f8;border:1px solid #e2e8f0;border-radius:12px;padding:16px 12px;font-family:'Courier New',monospace;font-size:12px;line-height:1.8;color:#333;max-width:240px;margin:0 auto;">
        <div style="text-align:center;font-weight:bold;">════════════════</div>
        <div style="text-align:center;font-weight:bold;">智店铺 · 小票</div>
        <div style="text-align:center;">════════════════</div>
        <div>单号：20260409123456</div>
        <div>时间：${new Date().toLocaleString('zh-CN')}</div>
        <div>────────────────</div>
        <div>商品&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;数量&nbsp;单价&nbsp;&nbsp;小计</div>
        <div>可乐&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;3.00&nbsp;&nbsp;6.00</div>
        <div>────────────────</div>
        <div style="text-align:right;">合计：¥6.00 元</div>
        <div>────────────────</div>
        <div style="text-align:center;text-decoration:underline;">谢谢惠顾，欢迎下次光临</div>
        <div style="text-align:center;">════════════════</div>
      </div>
    </div>
  `;
}
