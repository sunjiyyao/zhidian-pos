// ================================================
// 智店铺 · IndexedDB 数据库层
// ================================================

const DB = (function () {
  const DB_NAME = 'zhidianpu';
  const DB_VERSION = 1;
  let db = null;

  const STORES = {
    products: { keyPath: 'id', autoIncrement: true, indexes: [
      { name: 'name', keyPath: 'name' },
      { name: 'barcode', keyPath: 'barcode' }
    ]},
    customers: { keyPath: 'id', autoIncrement: true, indexes: [
      { name: 'name', keyPath: 'name' }
    ]},
    inventory_logs: { keyPath: 'id', autoIncrement: true, indexes: [
      { name: 'productId', keyPath: 'productId' },
      { name: 'createdAt', keyPath: 'createdAt' }
    ]},
    orders: { keyPath: 'id', autoIncrement: true, indexes: [
      { name: 'orderNo', keyPath: 'orderNo' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'customerId', keyPath: 'customerId' }
    ]},
    settings: { keyPath: 'key' }
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        Object.entries(STORES).forEach(([name, cfg]) => {
          if (!database.objectStoreNames.contains(name)) {
            const store = database.createObjectStore(name, { keyPath: cfg.keyPath, autoIncrement: cfg.autoIncrement });
            (cfg.indexes || []).forEach(idx => store.createIndex(idx.name, idx.keyPath, { unique: false }));
          }
        });
      };
    });
  }

  function tx(storeName, mode = 'readonly') {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  // ---- Products ----
  async function getAllProducts() {
    await open();
    return promisify(tx('products').getAll());
  }

  async function getProduct(id) {
    await open();
    return promisify(tx('products').get(id));
  }

  async function addProduct(data) {
    await open();
    const record = { ...data, createdAt: Date.now() };
    const id = await promisify(tx('products', 'readwrite').add(record));
    return { ...record, id };
  }

  async function updateProduct(id, data) {
    await open();
    return new Promise((res, rej) => {
      const store = tx('products', 'readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = async () => {
        const existing = getReq.result;
        if (!existing) { rej(new Error('Product not found')); return; }
        const updated = { ...existing, ...data, id };
        await promisify(store.put(updated));
        res(updated);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  }

  async function deleteProduct(id) {
    await open();
    return promisify(tx('products', 'readwrite').delete(id));
  }

  async function updateProductStock(id, delta) {
    await open();
    return new Promise((res, rej) => {
      const store = tx('products', 'readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) { rej(new Error('Product not found')); return; }
        const updated = { ...getReq.result, stock: Math.max(0, (getReq.result.stock || 0) + delta) };
        store.put(updated);
        res(updated);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  }

  // ---- Customers ----
  async function getAllCustomers() {
    await open();
    return promisify(tx('customers').getAll());
  }

  async function getCustomer(id) {
    await open();
    return promisify(tx('customers').get(id));
  }

  async function addCustomer(data) {
    await open();
    const record = { ...data, createdAt: Date.now() };
    const id = await promisify(tx('customers', 'readwrite').add(record));
    return { ...record, id };
  }

  async function updateCustomer(id, data) {
    await open();
    return new Promise((res, rej) => {
      const store = tx('customers', 'readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) { rej(new Error('Customer not found')); return; }
        const updated = { ...getReq.result, ...data, id };
        store.put(updated);
        res(updated);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  }

  async function deleteCustomer(id) {
    await open();
    return promisify(tx('customers', 'readwrite').delete(id));
  }

  // ---- Inventory Logs ----
  async function addInventoryLog(data) {
    await open();
    const record = { ...data, createdAt: Date.now() };
    const id = await promisify(tx('inventory_logs', 'readwrite').add(record));
    return { ...record, id };
  }

  async function getInventoryLogsByProduct(productId) {
    await open();
    const index = tx('inventory_logs').index('productId');
    return promisify(index.getAll(productId));
  }

  async function getRecentInventoryLogs(limit = 20) {
    await open();
    const store = tx('inventory_logs');
    const index = store.index('createdAt');
    const logs = await promisify(index.getAll());
    return logs.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  // ---- Orders ----
  async function getAllOrders() {
    await open();
    const orders = await promisify(tx('orders').getAll());
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getOrder(id) {
    await open();
    return promisify(tx('orders').get(id));
  }

  async function addOrder(data) {
    await open();
    const now = Date.now();
    const orderNo = generateOrderNo(now);
    const record = { ...data, orderNo, createdAt: now };
    const id = await promisify(tx('orders', 'readwrite').add(record));
    return { ...record, id };
  }

  async function updateOrder(id, data) {
    await open();
    return new Promise((res, rej) => {
      const store = tx('orders', 'readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) { rej(new Error('Order not found')); return; }
        const updated = { ...getReq.result, ...data, id };
        store.put(updated);
        res(updated);
      };
      getReq.onerror = () => rej(getReq.error);
    });
  }

  async function deleteOrder(id) {
    await open();
    return promisify(tx('orders', 'readwrite').delete(id));
  }

  async function getOrdersByCustomer(customerId) {
    await open();
    const index = tx('orders').index('customerId');
    return promisify(index.getAll(customerId));
  }

  // ---- Stats ----
  async function getStats() {
    await open();
    const [products, orders, logs] = await Promise.all([
      promisify(tx('products').getAll()),
      promisify(tx('orders').getAll()),
      promisify(tx('inventory_logs').getAll())
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const todayOrders = orders.filter(o => o.createdAt >= todayTs);
    const todaySales = todayOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalSales = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const warnProducts = products.filter(p => (p.stock || 0) <= (p.warnQty || 0));

    return {
      todaySales,
      todayOrders: todayOrders.length,
      totalSales,
      totalOrders,
      totalProducts: products.length,
      totalCustomers: await countRecords('customers'),
      warnCount: warnProducts.length,
      warnProducts
    };
  }

  function countRecords(storeName) {
    return new Promise((res) => {
      tx(storeName).count().onsuccess = () => res(tx(storeName).count().result);
    });
  }

  // ---- Settings ----
  async function getSetting(key) {
    await open();
    const rec = await promisify(tx('settings').get(key));
    return rec ? rec.value : null;
  }

  async function setSetting(key, value) {
    await open();
    await promisify(tx('settings', 'readwrite').put({ key, value }));
  }

  // ---- Utils ----
  function generateOrderNo(ts) {
    const d = new Date(ts);
    const pad = (n, w) => String(n).padStart(w, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}${pad(d.getHours(),2)}${pad(d.getMinutes(),2)}${pad(d.getSeconds(),2)}`;
  }

  // ---- Init ----
  async function init() {
    await open();
  }

  return {
    init, open,
    getAllProducts, getProduct, addProduct, updateProduct, deleteProduct, updateProductStock,
    getAllCustomers, getCustomer, addCustomer, updateCustomer, deleteCustomer,
    addInventoryLog, getInventoryLogsByProduct, getRecentInventoryLogs,
    getAllOrders, getOrder, addOrder, updateOrder, deleteOrder, getOrdersByCustomer,
    getStats,
    getSetting, setSetting,
    generateOrderNo
  };
})();
