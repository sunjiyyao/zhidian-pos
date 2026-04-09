// ================================================
// 智店铺 · 主应用 App.js  (v2 clean)
// ================================================

const App = (function () {
  let currentTab = 'home';
  let pageStack = [];

  async function init() {
    try {
      await DB.init();
      BT.addStateListener(_updateBTIndicator);
      switchTab('home');
    } catch (err) {
      console.error('Init failed:', err);
      showToast('数据初始化失败：' + err.message, 'danger');
    }
  }

  // ---- Tab Switch ----
  function switchTab(tab) {
    currentTab = tab;
    pageStack = [];
    document.querySelectorAll('.tab-item').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tab)
    );
    $('backBtn').classList.add('hidden');
    $('topbarRight').innerHTML = '';
    const titles = { home: '智店铺', products: '商品管理', customers: '客户管理', inventory: '库存管理', orders: '订单管理' };
    $('topbarTitle').textContent = titles[tab] || '智店铺';
    renderPage(tab);
  }

  function goBack() {
    if (pageStack.length > 0) {
      const prev = pageStack.pop();
      $('topbarTitle').textContent = prev.title;
      if (pageStack.length === 0) {
        $('backBtn').classList.add('hidden');
        switchTab(currentTab);
      } else {
        $('mainContent').innerHTML = prev.html;
      }
    }
  }

  function pushPage(title, html) {
    pageStack.push({ title: $('topbarTitle').textContent, html: $('mainContent').innerHTML });
    $('topbarTitle').textContent = title;
    $('backBtn').classList.remove('hidden');
    $('mainContent').innerHTML = html;
    $('mainContent').scrollTop = 0;
  }

  async function renderPage(page) {
    const main = $('mainContent');
    main.innerHTML = '';
    main.scrollTop = 0;
    switch (page) {
      case 'home':      await renderHome(main); break;
      case 'products':  await renderProducts(main); break;
      case 'customers': await renderCustomers(main); break;
      case 'inventory': await renderInventory(main); break;
      case 'orders':    await renderOrders(main); break;
    }
  }

  // ================================================
  // PAGE: HOME
  // ================================================
  async function renderHome(main) {
    const stats = await DB.getStats();
    main.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div class="stat-card card-enter">
          <div class="stat-card-label">今日销售</div>
          <div class="stat-card-value primary">¥${yuan(stats.todaySales)}</div>
        </div>
        <div class="stat-card card-enter">
          <div class="stat-card-label">今日订单</div>
          <div class="stat-card-value">${stats.todayOrders}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div class="stat-card card-enter">
          <div class="stat-card-label">商品总数</div>
          <div class="stat-card-value">${stats.totalProducts}</div>
        </div>
        <div class="stat-card card-enter" onclick="App.switchTab('inventory')" style="cursor:pointer;">
          <div class="stat-card-label">库存预警</div>
          <div class="stat-card-value ${stats.warnCount > 0 ? 'danger' : ''}">${stats.warnCount} 个</div>
        </div>
      </div>
      <div class="section-title">快捷操作</div>
      <div class="quick-actions">
        <div class="qa-item card-enter" onclick="App.newOrder()">
          <div class="qa-icon bg-primary">📝</div><div class="qa-label">新建订单</div>
        </div>
        <div class="qa-item card-enter" onclick="App.quickStockIn()">
          <div class="qa-icon bg-success">📥</div><div class="qa-label">快速入库</div>
        </div>
        <div class="qa-item card-enter" onclick="App.switchTab('products')">
          <div class="qa-icon bg-accent">📦</div><div class="qa-label">商品管理</div>
        </div>
        <div class="qa-item card-enter" onclick="App.openSettings()">
          <div class="qa-icon bg-purple">🖨️</div><div class="qa-label">蓝牙设置</div>
        </div>
      </div>
      <div class="section-title mt-16">最近订单</div>
      <div id="home-orders-list"></div>
    `;
    const orders = await DB.getAllOrders();
    const recent = orders.slice(0, 5);
    $('home-orders-list').innerHTML = recent.length === 0
      ? emptyState('暂无订单', '新建第一个订单吧')
      : recent.map(o => `
        <div class="order-item card-enter" onclick="App.viewOrder(${o.id})">
          <div class="order-meta">
            <div class="order-no">${o.orderNo}</div>
            <div class="order-info"><span>${fmtDate(o.createdAt)}</span>${o.items ? `<span>${o.items.length}件商品</span>` : ''}</div>
          </div>
          <div class="order-amount">¥${yuan(o.totalAmount)}</div>
        </div>`).join('');
  }

  // ================================================
  // PAGE: PRODUCTS
  // ================================================
  async function renderProducts(main) {
    const products = await DB.getAllProducts();
    main.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">商品列表</div><div class="page-subtitle">共 ${products.length} 个商品</div></div>
        <button class="btn btn-primary btn-sm" onclick="App.showProductForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新增
        </button>
      </div>
      <div class="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="搜索商品名称或条码…" id="productSearch" oninput="App.filterProducts(this.value)">
      </div>
      <div id="products-list"></div>
    `;
    renderProductsList(products);
  }

  function renderProductsList(products) {
    const list = $('products-list');
    if (!list) return;
    list.innerHTML = products.length === 0
      ? emptyState('暂无商品', '点击右上角添加第一个商品')
      : products.map((p, i) => `
        <div class="list-item card-enter" onclick="App.showProductForm(${p.id})" style="animation-delay:${i * 40}ms">
          <div class="list-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <div class="list-item-body">
            <div class="list-item-title">${esc(p.name)}</div>
            <div class="list-item-sub">条码：${p.barcode || '—'}&nbsp;&nbsp;规格：${p.spec || '—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="font-mono fw-700" style="font-size:16px;">¥${yuan(p.price)}</div>
            <div class="text-muted" style="font-size:12px;">库存 ${p.stock || 0} ${p.unit || '件'}</div>
          </div>
        </div>`).join('');
  }

  async function filterProducts(query) {
    const all = await DB.getAllProducts();
    const q = query.trim().toLowerCase();
    renderProductsList(q
      ? all.filter(p => (p.name||'').toLowerCase().includes(q) || (p.barcode||'').toLowerCase().includes(q))
      : all);
  }

  // ================================================
  // PAGE: CUSTOMERS
  // ================================================
  async function renderCustomers(main) {
    const customers = await DB.getAllCustomers();
    main.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">客户列表</div><div class="page-subtitle">共 ${customers.length} 位客户</div></div>
        <button class="btn btn-primary btn-sm" onclick="App.showCustomerForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新增
        </button>
      </div>
      <div class="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="搜索客户名称或电话…" id="customerSearch" oninput="App.filterCustomers(this.value)">
      </div>
      <div id="customers-list"></div>
    `;
    renderCustomersList(customers);
  }

  function renderCustomersList(customers) {
    const list = $('customers-list');
    if (!list) return;
    list.innerHTML = customers.length === 0
      ? emptyState('暂无客户', '点击右上角添加客户信息')
      : customers.map((c, i) => `
        <div class="list-item card-enter" onclick="App.showCustomerForm(${c.id})" style="animation-delay:${i * 40}ms">
          <div class="list-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="list-item-body">
            <div class="list-item-title">${esc(c.name)}</div>
            <div class="list-item-sub">${c.phone || '—'}&nbsp;&nbsp;${c.address ? esc(c.address) : ''}</div>
          </div>
        </div>`).join('');
  }

  async function filterCustomers(query) {
    const all = await DB.getAllCustomers();
    const q = query.trim().toLowerCase();
    renderCustomersList(q
      ? all.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q))
      : all);
  }

  // ================================================
  // PAGE: INVENTORY
  // ================================================
  async function renderInventory(main) {
    const products = await DB.getAllProducts();
    main.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">库存管理</div><div class="page-subtitle">共 ${products.length} 个商品</div></div>
      </div>
      <div class="stock-actions mb-16">
        <button class="stock-action-btn in" onclick="App.stockInOut('in')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          入库
        </button>
        <button class="stock-action-btn out" onclick="App.stockInOut('out')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="7 16 12 21 17 16"/><line x1="12" y1="21" x2="12" y2="9"/></svg>
          出库
        </button>
      </div>
      <div id="inv-list"></div>
    `;
    renderInventoryList(products);
  }

  function renderInventoryList(products) {
    const list = $('inv-list');
    if (!list) return;
    list.innerHTML = products.length === 0
      ? emptyState('暂无商品', '先去"商品"页面添加商品')
      : products.map((p, i) => {
        const isWarn = (p.warnQty || 0) > 0 && (p.stock || 0) <= p.warnQty;
        return `
        <div class="inv-item card-enter ${isWarn ? 'warn' : ''}" style="animation-delay:${i * 40}ms" onclick="App.stockDetail(${p.id})">
          <div class="list-item-icon" style="background:${isWarn ? 'var(--danger-light)' : 'var(--primary-light)'};color:${isWarn ? 'var(--danger)' : 'var(--primary)'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <div class="list-item-body">
            <div class="list-item-title">${esc(p.name)}</div>
            <div class="list-item-sub">预警：≤${p.warnQty || 0} ${p.unit || '件'}&nbsp;&nbsp;规格：${p.spec || '—'}</div>
          </div>
          <div class="inv-stock ${isWarn ? 'warn' : 'ok'}">${p.stock || 0}</div>
        </div>`;}).join('');
  }

  // ================================================
  // PAGE: ORDERS
  // ================================================
  async function renderOrders(main) {
    const orders = await DB.getAllOrders();
    main.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">订单列表</div><div class="page-subtitle">共 ${orders.length} 个订单</div></div>
        <button class="btn btn-primary btn-sm" onclick="App.newOrder()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建订单
        </button>
      </div>
      <div id="orders-list"></div>
    `;
    renderOrdersList(orders);
  }

  function renderOrdersList(orders) {
    const list = $('orders-list');
    if (!list) return;
    list.innerHTML = orders.length === 0
      ? emptyState('暂无订单', '点击右上角新建订单')
      : orders.map((o, i) => `
        <div class="order-item card-enter" style="animation-delay:${i * 40}ms">
          <div class="order-meta" onclick="App.viewOrder(${o.id})">
            <div class="order-no">${o.orderNo}</div>
            <div class="order-info">
              <span>${fmtDate(o.createdAt)}</span>
              ${o.items ? `<span>${o.items.length}件</span>` : ''}
              ${o.status === 'cancelled' ? '<span class="badge badge-danger">已退单</span>' : ''}
            </div>
          </div>
          <div class="order-amount">¥${yuan(o.totalAmount)}</div>
          <button class="order-print-btn" onclick="App.rePrintOrder(${o.id})" title="重新打印">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
        </div>`).join('');
  }

  // ================================================
  // PRODUCT FORM
  // ================================================
  async function showProductForm(id) {
    const p = id ? await DB.getProduct(id) : null;
    const title = p ? '编辑商品' : '新增商品';
    openModal(title, `
      <form id="productForm" onsubmit="App.saveProduct(event, ${id ? id : 'null'})">
        <div class="form-group">
          <label class="form-label">商品名称 <span class="required">*</span></label>
          <input class="form-input" type="text" name="name" value="${p ? esc(p.name||'') : ''}" placeholder="例如：可口可乐 500ml" required>
        </div>
        <div class="form-group">
          <label class="form-label">条码</label>
          <input class="form-input" type="text" name="barcode" value="${p ? esc(p.barcode||'') : ''}" placeholder="支持扫码枪输入">
        </div>
        <div style="display:flex;gap:10px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">规格</label>
            <input class="form-input" type="text" name="spec" value="${p ? esc(p.spec||'') : ''}" placeholder="如：500ml/瓶">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">单位</label>
            <input class="form-input" type="text" name="unit" value="${p ? esc(p.unit||'件') : '件'}" placeholder="件/瓶/箱">
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">单价（元）<span class="required">*</span></label>
            <input class="form-input" type="number" name="price" step="0.01" min="0" value="${p ? p.price : ''}" placeholder="0.00" required>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">当前库存</label>
            <input class="form-input" type="number" name="stock" step="1" min="0" value="${p ? p.stock : '0'}" placeholder="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">库存预警量</label>
          <input class="form-input" type="number" name="warnQty" step="1" min="0" value="${p ? p.warnQty : '0'}" placeholder="低于此数量时预警">
          <div class="form-hint">设为 0 则不启用预警</div>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input" name="remark" placeholder="可选">${p ? esc(p.remark||'') : ''}</textarea>
        </div>
        ${p ? `<button type="button" class="btn btn-danger btn-block mt-12" onclick="App.deleteProduct(${p.id})">删除商品</button>` : ''}
      </form>
    `, [
      { label: '取消', cls: 'btn-ghost', on: 'App.closeModal()' },
      { label: '保存', cls: 'btn-primary', on: `(function(e){e.preventDefault();App.saveProductRaw(${id || 'null'},'productForm')})(event)` }
    ]);
  }

  async function saveProduct(event, id) {
    event.preventDefault();
    await saveProductRaw(id, 'productForm');
  }

  async function saveProductRaw(id, formId) {
    const form = $(formId);
    const data = {
      name: form.name.value.trim(), barcode: form.barcode.value.trim(),
      spec: form.spec.value.trim(), unit: form.unit.value.trim() || '件',
      price: parseFloat(form.price.value) || 0, stock: parseInt(form.stock.value) || 0,
      warnQty: parseInt(form.warnQty.value) || 0, remark: form.remark.value.trim()
    };
    if (!data.name) { showToast('请填写商品名称', 'warning'); return; }
    try {
      if (id) { await DB.updateProduct(id, data); showToast('商品已更新', 'success'); }
      else    { await DB.addProduct(data);         showToast('商品已添加', 'success'); }
      closeModal(); renderPage(currentTab);
    } catch (err) { showToast('保存失败：' + err.message, 'danger'); }
  }

  async function deleteProduct(id) {
    if (!confirm('确定删除此商品？')) return;
    try { await DB.deleteProduct(id); showToast('已删除', 'success'); closeModal(); renderPage(currentTab); }
    catch (err) { showToast('删除失败', 'danger'); }
  }

  // ================================================
  // CUSTOMER FORM
  // ================================================
  async function showCustomerForm(id) {
    const c = id ? await DB.getCustomer(id) : null;
    const title = c ? '编辑客户' : '新增客户';
    openModal(title, `
      <form id="customerForm" onsubmit="App.saveCustomer(event, ${id ? id : 'null'})">
        <div class="form-group">
          <label class="form-label">客户名称 <span class="required">*</span></label>
          <input class="form-input" type="text" name="name" value="${c ? esc(c.name||'') : ''}" placeholder="例如：张三" required>
        </div>
        <div class="form-group">
          <label class="form-label">联系电话</label>
          <input class="form-input" type="tel" name="phone" value="${c ? esc(c.phone||'') : ''}" placeholder="手机或座机">
        </div>
        <div class="form-group">
          <label class="form-label">地址</label>
          <textarea class="form-input" name="address" placeholder="详细地址">${c ? esc(c.address||'') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input" name="remark" placeholder="可选">${c ? esc(c.remark||'') : ''}</textarea>
        </div>
        ${c ? `<button type="button" class="btn btn-danger btn-block mt-12" onclick="App.deleteCustomer(${c.id})">删除客户</button>` : ''}
      </form>
    `, [
      { label: '取消', cls: 'btn-ghost', on: 'App.closeModal()' },
      { label: '保存', cls: 'btn-primary', on: `(function(e){e.preventDefault();App.saveCustomerRaw(${id || 'null'},'customerForm')})(event)` }
    ]);
  }

  async function saveCustomer(event, id) {
    event.preventDefault();
    await saveCustomerRaw(id, 'customerForm');
  }

  async function saveCustomerRaw(id, formId) {
    const form = $(formId);
    const data = {
      name: form.name.value.trim(), phone: form.phone.value.trim(),
      address: form.address.value.trim(), remark: form.remark.value.trim()
    };
    if (!data.name) { showToast('请填写客户名称', 'warning'); return; }
    try {
      if (id) { await DB.updateCustomer(id, data); showToast('客户已更新', 'success'); }
      else    { await DB.addCustomer(data);         showToast('客户已添加', 'success'); }
      closeModal(); renderPage(currentTab);
    } catch (err) { showToast('保存失败：' + err.message, 'danger'); }
  }

  async function deleteCustomer(id) {
    if (!confirm('确定删除此客户？')) return;
    try { await DB.deleteCustomer(id); showToast('已删除', 'success'); closeModal(); renderPage(currentTab); }
    catch (err) { showToast('删除失败', 'danger'); }
  }

  // ================================================
  // STOCK IN / OUT
  // ================================================
  async function stockInOut(type) {
    const products = await DB.getAllProducts();
    if (!products.length) { showToast('请先添加商品', 'warning'); return; }
    const opts = products.map(p => `<option value="${p.id}" data-stock="${p.stock||0}">${esc(p.name)}（库存：${p.stock||0}）</option>`).join('');
    openModal(type === 'in' ? '商品入库' : '商品出库', `
      <form id="stockForm">
        <div class="form-group">
          <label class="form-label">选择商品 <span class="required">*</span></label>
          <select class="form-input" name="productId" required onchange="App.onStockProductChange(this)">
            <option value="">请选择商品</option>${opts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${type === 'in' ? '入库' : '出库'}数量 <span class="required">*</span></label>
          <input class="form-input" type="number" name="qty" step="1" min="1" value="1" required>
          <div class="form-hint" id="stockCurrentHint"></div>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input" name="note" placeholder="可选"></textarea>
        </div>
      </form>
    `, [
      { label: '取消', cls: 'btn-ghost', on: 'App.closeModal()' },
      { label: '确认', cls: type === 'in' ? 'btn-primary' : 'btn-danger',
        on: `(function(e){e.preventDefault();App.saveStock(${type === 'in' ? '1' : '-1'},'stockForm')})(event)` }
    ]);
  }

  function onStockProductChange(select) {
    const opt = select.selectedOptions[0];
    const hint = $('stockCurrentHint');
    if (hint) hint.textContent = `当前库存：${opt ? opt.dataset.stock : 0} 件`;
  }

  async function saveStock(delta, formId) {
    const form = $(formId);
    const productId = parseInt(form.productId.value);
    const qty = parseInt(form.qty.value);
    const note = form.note.value.trim();
    if (!productId) { showToast('请选择商品', 'warning'); return; }
    if (!qty || qty <= 0) { showToast('数量必须大于0', 'warning'); return; }
    const product = await DB.getProduct(productId);
    if (delta < 0 && (product.stock || 0) < qty) {
      showToast(`库存不足，当前 ${product.stock || 0} 件`, 'warning'); return;
    }
    try {
      await DB.updateProductStock(productId, delta * qty);
      await DB.addInventoryLog({ productId, type: delta > 0 ? 'in' : 'out', qty, note });
      showToast(delta > 0 ? '入库成功' : '出库成功', 'success');
      closeModal(); renderPage(currentTab);
    } catch (err) { showToast('操作失败', 'danger'); }
  }

  // ================================================
  // STOCK DETAIL
  // ================================================
  async function stockDetail(productId) {
    const product = await DB.getProduct(productId);
    if (!product) return;
    const logs = (await DB.getInventoryLogsByProduct(productId)).sort((a,b) => b.createdAt - a.createdAt).slice(0, 20);
    const logsHtml = logs.length === 0
      ? '<div class="text-muted text-center" style="padding:16px;">暂无记录</div>'
      : logs.map(log => `
        <div class="detail-row">
          <div class="detail-label">${log.type === 'in' ? '入库' : '出库'}</div>
          <div class="detail-value ${log.type === 'in' ? 'text-success' : 'text-danger'}">${log.type === 'in' ? '+' : '-'}${log.qty}</div>
          <div class="detail-label" style="flex:1;text-align:right;">${fmtDate(log.createdAt)}</div>
        </div>
        ${log.note ? `<div class="text-muted" style="font-size:12px;padding:0 0 6px 70px;">${esc(log.note)}</div>` : ''}`).join('');
    const isWarn = (product.warnQty || 0) > 0 && (product.stock || 0) <= product.warnQty;
    pushPage('库存详情', `
      <div class="card mb-12">
        <div style="font-size:18px;font-weight:800;margin-bottom:8px;">${esc(product.name)}</div>
        <div style="display:flex;gap:16px;">
          <div>
            <div class="text-muted" style="font-size:12px;">当前库存</div>
            <div class="font-mono fw-800" style="font-size:28px;color:${isWarn ? 'var(--danger)' : 'var(--success)'};">${product.stock || 0}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size:12px;">单价</div>
            <div class="font-mono fw-700" style="font-size:18px;">¥${yuan(product.price)}</div>
          </div>
        </div>
      </div>
      <div class="section-title">库存流水</div>
      <div class="card" style="padding:0;">${logsHtml}</div>
      <div class="stock-actions mt-16">
        <button class="stock-action-btn in" onclick="App.quickStockOne(${productId},'in')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          入库
        </button>
        <button class="stock-action-btn out" onclick="App.quickStockOne(${productId},'out')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="7 16 12 21 17 16"/><line x1="12" y1="21" x2="12" y2="9"/></svg>
          出库
        </button>
      </div>
    `);
  }

  async function quickStockOne(productId, type) {
    const product = await DB.getProduct(productId);
    if (!product) return;
    openModal(`${type === 'in' ? '入库' : '出库'} — ${product.name}`, `
      <form id="qsForm">
        <div style="text-align:center;margin-bottom:16px;">
          <div class="text-muted" style="font-size:14px;">${esc(product.name)}</div>
          <div class="font-mono fw-800" style="font-size:40px;color:${type === 'in' ? 'var(--success)' : 'var(--danger)'};">${type === 'in' ? '+' : '-'}<span id="qsDisplay">1</span></div>
          <div class="text-muted" style="font-size:13px;">当前库存：${product.stock || 0}</div>
        </div>
        <div class="form-group">
          <label class="form-label">数量</label>
          <input class="form-input" type="number" name="qty" step="1" min="1" value="1" required oninput="$('qsDisplay').textContent=this.value">
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input" name="note" placeholder="可选"></textarea>
        </div>
      </form>
    `, [
      { label: '取消', cls: 'btn-ghost', on: 'App.closeModal()' },
      { label: '确认', cls: type === 'in' ? 'btn-primary' : 'btn-danger',
        on: `(function(e){e.preventDefault();App.saveQuickStock(${productId},${type === 'in' ? '1' : '-1'},'qsForm')})(event)` }
    ]);
  }

  async function saveQuickStock(productId, delta, formId) {
    const form = $(formId);
    const qty = parseInt(form.qty.value);
    const note = form.note.value.trim();
    if (!qty || qty <= 0) { showToast('数量必须大于0', 'warning'); return; }
    const product = await DB.getProduct(productId);
    if (delta < 0 && (product.stock || 0) < qty) { showToast(`库存不足，当前 ${product.stock||0} 件`, 'warning'); return; }
    try {
      await DB.updateProductStock(productId, delta * qty);
      await DB.addInventoryLog({ productId, type: delta > 0 ? 'in' : 'out', qty, note });
      showToast(delta > 0 ? '入库成功' : '出库成功', 'success');
      closeModal();
      if (currentTab === 'inventory') renderPage('inventory');
    } catch (err) { showToast('操作失败', 'danger'); }
  }

  // ================================================
  // NEW ORDER
  // ================================================
  window._orderDraft = { items: [], customerId: null };

  async function newOrder() {
    const [products, customers] = await Promise.all([DB.getAllProducts(), DB.getAllCustomers()]);
    if (!products.length) { showToast('请先添加商品', 'warning'); return; }
    window._orderDraft = { items: [], customerId: null };
    const cOpts = customers.map(c => `<option value="${c.id}">${esc(c.name)}${c.phone ? ' · '+c.phone : ''}</option>`).join('');
    const pOpts = products.map(p => `<option value="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">${esc(p.name)}（¥${yuan(p.price)}，库存${p.stock||0}）</option>`).join('');
    pushPage('新建订单', `
      <div style="padding-bottom:90px;">
        <div class="form-group">
          <label class="form-label">客户（可选）</label>
          <select class="form-input" id="ocCustomer">
            <option value="">无客户（散客）</option>${cOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">添加商品</label>
          <div style="display:flex;gap:8px;">
            <select class="form-input" id="ocAddProduct" style="flex:1;">
              <option value="">选择商品</option>${pOpts}
            </select>
            <button type="button" class="btn btn-primary btn-sm" onclick="App.addOrderItem()">加</button>
          </div>
        </div>
        <div id="ocCart"></div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input" id="ocRemark" placeholder="可选，如：加辣、尽快…" rows="2"></textarea>
        </div>
      </div>
      <div class="amount-bar">
        <div>
          <div class="amount-label">合计</div>
          <div class="amount-value" id="ocTotal">¥0.00</div>
        </div>
        <button type="button" class="btn btn-primary" onclick="App.submitOrder()">提交订单</button>
      </div>
    `);
    renderCart();
  }

  function addOrderItem() {
    const sel = $('ocAddProduct');
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) { showToast('请选择商品', 'warning'); return; }
    const pid = parseInt(opt.value);
    const name = opt.dataset.name, price = parseFloat(opt.dataset.price);
    const exist = window._orderDraft.items.find(i => i.productId === pid);
    if (exist) exist.qty++;
    else window._orderDraft.items.push({ productId: pid, name, price, qty: 1 });
    renderCart(); sel.value = '';
  }

  function changeQty(idx, delta) {
    const item = window._orderDraft.items[idx];
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    renderCart();
  }

  function removeItem(idx) {
    window._orderDraft.items.splice(idx, 1);
    renderCart();
  }

  function renderCart() {
    const cart = $('ocCart');
    if (!cart) return;
    const items = window._orderDraft.items;
    if (!items.length) {
      cart.innerHTML = `<div class="empty-state" style="padding:24px 0;"><div class="empty-icon">🛒</div><div class="empty-desc">从上方添加商品</div></div>`;
    } else {
      cart.innerHTML = items.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-price">¥${yuan(item.price)}</div>
          <div class="cart-qty-ctrl">
            <button class="qty-btn" onclick="App.changeQty(${i},-1)">−</button>
            <div class="qty-value">${item.qty}</div>
            <button class="qty-btn" onclick="App.changeQty(${i},1)">+</button>
          </div>
          <button class="icon-btn" onclick="App.removeItem(${i})" style="color:var(--danger);width:28px;height:28px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
    }
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    const el = $('ocTotal');
    if (el) el.textContent = `¥${yuan(total)}`;
  }

  async function submitOrder() {
    const items = window._orderDraft.items;
    if (!items.length) { showToast('请添加商品', 'warning'); return; }
    const customerId = $('ocCustomer')?.value ? parseInt($('ocCustomer').value) : null;
    const remark = $('ocRemark')?.value?.trim() || '';
    const totalAmount = items.reduce((s, i) => s + i.qty * i.price, 0);
    try {
      for (const item of items) {
        await DB.updateProductStock(item.productId, -item.qty);
        await DB.addInventoryLog({ productId: item.productId, type: 'out', qty: item.qty, note: '销售出库' });
      }
      const order = await DB.addOrder({ customerId, items, totalAmount, remark, status: 'completed' });
      showToast('订单已提交！', 'success');
      goBack();
      renderPage('orders');
      setTimeout(() => tryAutoPrint(order), 300);
    } catch (err) { showToast('提交失败：' + err.message, 'danger'); }
  }

  // ================================================
  // ORDER DETAIL
  // ================================================
  async function viewOrder(id) {
    const order = await DB.getOrder(id);
    if (!order) { showToast('订单不存在', 'danger'); return; }
    const customer = order.customerId ? await DB.getCustomer(order.customerId) : null;
    const itemsHtml = (order.items || []).map(item => `
      <div class="detail-row">
        <div class="detail-label flex-1 fw-600">${esc(item.name)}</div>
        <div class="detail-label">×${item.qty}</div>
        <div class="detail-value" style="min-width:60px;text-align:right;">¥${yuan(item.price)}</div>
        <div class="detail-value" style="min-width:70px;text-align:right;">¥${yuan(item.qty * item.price)}</div>
      </div>`).join('');
    pushPage('订单详情', `
      <div class="card mb-12">
        <div class="detail-row"><div class="detail-label">订单号</div><div class="detail-value font-mono">${order.orderNo}</div></div>
        <div class="detail-row"><div class="detail-label">时间</div><div class="detail-value">${fmtDateTime(order.createdAt)}</div></div>
        ${customer ? `<div class="detail-row"><div class="detail-label">客户</div><div class="detail-value">${esc(customer.name)}</div></div>` : ''}
        ${order.remark ? `<div class="detail-row"><div class="detail-label">备注</div><div class="detail-value">${esc(order.remark)}</div></div>` : ''}
        <div class="detail-row">
          <div class="detail-label">状态</div>
          <div><span class="badge ${order.status === 'cancelled' ? 'badge-danger' : 'badge-success'}">${order.status === 'cancelled' ? '已退单' : '已完成'}</span></div>
        </div>
      </div>
      <div class="section-title">商品明细</div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="display:flex;padding:10px 14px;background:var(--bg);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-muted);font-weight:600;">
          <div class="flex-1">商品</div><div style="width:36px;text-align:center;">数量</div>
          <div style="width:60px;text-align:right;">单价</div><div style="width:70px;text-align:right;">小计</div>
        </div>
        ${itemsHtml}
        <div style="padding:12px 14px;display:flex;justify-content:space-between;border-top:2px solid var(--border);">
          <span class="fw-700" style="font-size:15px;">合计</span>
          <span class="fw-800" style="font-size:20px;color:var(--primary);font-family:'JetBrains Mono',monospace;">¥${yuan(order.totalAmount)}</span>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button class="btn btn-outline btn-block" onclick="App.rePrintOrder(${order.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          重新打印小票
        </button>
      </div>
      ${order.status !== 'cancelled' ? `<button class="btn btn-danger btn-block mt-12" onclick="App.refundOrder(${order.id})">退单</button>` : ''}
    `);
  }

  async function refundOrder(id) {
    if (!confirm('确定退单？将恢复库存。')) return;
    const order = await DB.getOrder(id);
    if (!order) return;
    try {
      for (const item of order.items || []) {
        await DB.updateProductStock(item.productId, item.qty);
        await DB.addInventoryLog({ productId: item.productId, type: 'in', qty: item.qty, note: '退单入库' });
      }
      await DB.updateOrder(id, { status: 'cancelled' });
      showToast('已退单，库存已恢复', 'success');
      goBack(); renderPage('orders');
    } catch (err) { showToast('退单失败', 'danger'); }
  }

  // ================================================
  // PRINT
  // ================================================
  async function tryAutoPrint(order) {
    if (BT.getState() === 'connected') {
      try {
        const customer = order.customerId ? await DB.getCustomer(order.customerId) : null;
        await printReceipt(order, customer);
        showToast('小票打印完成！', 'success');
      } catch (err) { showToast('打印失败：' + err.message, 'warning'); }
    } else {
      showToast('订单已保存，请先在设置中连接蓝牙打印机', 'warning', 4000);
    }
  }

  async function rePrintOrder(id) {
    const order = await DB.getOrder(id);
    if (!order) return;
    if (BT.getState() !== 'connected') { showToast('请先连接蓝牙打印机', 'warning'); openSettings(); return; }
    try {
      const customer = order.customerId ? await DB.getCustomer(order.customerId) : null;
      await printReceipt(order, customer);
      showToast('小票打印完成！', 'success');
    } catch (err) { showToast('打印失败：' + err.message, 'danger'); }
  }

  // ================================================
  // SETTINGS
  // ================================================
  async function openSettings() {
    const btState = BT.getState();
    openModal('蓝牙与设置', `
      <div class="bluetooth-status mb-16 ${btState === 'connected' ? 'connected' : ''}" id="btStatusGlobal">
        <span class="dot"></span>
        <span id="btStatusGlobalText">${btState === 'connected' ? '已连接' : btState === 'connecting' ? '连接中...' : '未连接'}</span>
      </div>
      <div class="form-group">
        <button class="btn ${btState === 'connected' ? 'btn-danger' : 'btn-primary'} btn-block" onclick="App.toggleBluetooth()">
          ${btState === 'connected' ? '断开蓝牙' : '搜索并连接打印机'}
        </button>
        <p class="form-hint" style="margin-top:8px;text-align:center;">
          ${BT.isSupported()
            ? '支持蓝牙 4.0+ 热敏打印机（Android Chrome 97+）'
            : '⚠️ 当前浏览器不支持 Web Bluetooth，请在 Android Chrome 中打开'}
        </p>
      </div>
      <div class="section-title mt-16">小票预览（58mm 热敏）</div>
      <div style="background:#f8f8f8;border:1px solid var(--border);border-radius:12px;padding:16px 12px;font-family:'Courier New',monospace;font-size:12px;line-height:1.8;color:#333;max-width:260px;margin:0 auto 16px;">
        <div style="text-align:center;">════════════════</div>
        <div style="text-align:center;font-weight:bold;">智店铺 · 小票</div>
        <div style="text-align:center;">════════════════</div>
        <div>单号：${DB.generateOrderNo(Date.now())}</div>
        <div>时间：${fmtDateTime(Date.now())}</div>
        <div>────────────────</div>
        <div>商品&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;数量&nbsp;单价&nbsp;&nbsp;小计</div>
        <div>可口可乐&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;3.00&nbsp;&nbsp;6.00</div>
        <div>────────────────</div>
        <div style="text-align:right;">合计：¥6.00 元</div>
        <div>────────────────</div>
        <div style="text-align:center;text-decoration:underline;">谢谢惠顾，欢迎下次光临</div>
        <div style="text-align:center;">════════════════</div>
      </div>
      <div class="section-title mt-16">数据管理</div>
      <button class="btn btn-outline btn-block" onclick="App.exportData()">导出数据（JSON）</button>
      <p class="form-hint" style="margin-top:6px;text-align:center;">定期备份数据，防止意外丢失</p>
    `, [{ label: '关闭', cls: 'btn-ghost', on: 'App.closeModal()' }]);
    _updateBTIndicator(btState);
  }

  async function toggleBluetooth() {
    if (BT.getState() === 'connected') {
      await BT.disconnect();
      showToast('已断开', 'success');
    } else {
      try {
        showToast('正在搜索附近打印机…', 'warning', 3000);
        const device = await BT.requestDevice();
        showToast(`找到设备：${device.name || '蓝牙设备'}，连接中…`, 'warning');
        await BT.connect(device);
        showToast('蓝牙打印机已连接！', 'success');
      } catch (err) {
        if (err.name !== 'NotFoundError' && err.name !== 'CancelError') {
          showToast('连接失败：' + err.message, 'danger');
        }
      }
    }
    _updateBTIndicator(BT.getState());
  }

  function _updateBTIndicator(state) {
    ['btStatusGlobal', 'btStatusDisplay'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.className = 'bluetooth-status ' + (state === 'connected' ? 'connected' : '');
    });
    ['btStatusGlobalText', 'btStatusText'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = state === 'connected' ? '已连接' : state === 'connecting' ? '连接中...' : '未连接';
    });
    const btn = $('btConnectBtn');
    if (btn) {
      btn.className = `btn ${state === 'connected' ? 'btn-danger' : 'btn-primary'} btn-block`;
      btn.textContent = state === 'connected' ? '断开蓝牙' : '搜索并连接打印机';
    }
  }

  // ================================================
  // EXPORT DATA
  // ================================================
  async function exportData() {
    try {
      const [products, customers, orders, logs] = await Promise.all([
        DB.getAllProducts(), DB.getAllCustomers(),
        DB.getAllOrders(), DB.getRecentInventoryLogs(9999)
      ]);
      const data = { products, customers, orders, logs, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `zhidianpu-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      showToast('数据已导出', 'success');
    } catch (err) { showToast('导出失败', 'danger'); }
  }

  // ================================================
  // SHORTCUTS
  // ================================================
  function quickStockIn() { switchTab('inventory'); setTimeout(() => stockInOut('in'), 100); }

  // ================================================
  // MODAL / TOAST
  // ================================================
  function openModal(title, bodyHtml, buttons) {
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = bodyHtml;
    $('sheetFooter').innerHTML = '';
    (buttons || []).forEach(btn => {
      const b = document.createElement('button');
      b.className = `btn ${btn.cls || ''}`;
      b.textContent = btn.label;
      if (btn.on) b.setAttribute('onclick', btn.on);
      $('sheetFooter').appendChild(b);
    });
    $('modalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function showToast(msg, type, duration) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + (type || '');
    toast.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration || 2500);
  }

  // ================================================
  // UTILS
  // ================================================
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function yuan(n) { return (Number(n) || 0).toFixed(2); }
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function emptyState(title, desc) {
    return `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">${title}</div><div class="empty-desc">${desc}</div></div>`;
  }
  function $(id) { return document.getElementById(id); }

  // ================================================
  // PUBLIC API
  // ================================================
  return {
    init, switchTab, goBack,
    // Products
    filterProducts, showProductForm, saveProduct, deleteProduct,
    // Customers
    filterCustomers, showCustomerForm, saveCustomer, deleteCustomer,
    // Inventory
    stockInOut, onStockProductChange, saveStock, stockDetail, quickStockOne, saveQuickStock,
    // Orders
    newOrder, addOrderItem, changeQty, removeItem, renderCart, submitOrder, viewOrder, refundOrder,
    // Print
    rePrintOrder,
    // Settings
    openSettings, toggleBluetooth, exportData,
    // Shortcuts
    quickStockIn,
    // Helpers
    closeModal, showToast
  };
})();

// Init
App.init();
