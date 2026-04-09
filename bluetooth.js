// ================================================
// 智店铺 · Web Bluetooth 打印模块
// ================================================

const BT = (function () {
  let device = null;
  let server = null;
  let characteristic = null;
  const PRINTER_SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';  // 通用 SPP-like service
  const PRINTER_CHAR    = '0000ff01-0000-1000-8000-00805f9b34fb';  // 写入 characteristic

  const stateListeners = [];

  function onStateChange(state) {
    stateListeners.forEach(fn => fn(state));
  }

  function getState() {
    if (!device) return 'disconnected';
    if (!server) return 'connecting';
    return 'connected';
  }

  async function requestDevice() {
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [PRINTER_SERVICE] }],
        optionalServices: [PRINTER_SERVICE, '0000ffe0-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb']
      });
      device.addEventListener('gattserverdisconnected', onDisconnected);
      return device;
    } catch (err) {
      onStateChange('disconnected');
      throw err;
    }
  }

  async function connect(dev) {
    if (!dev && !device) {
      dev = await requestDevice();
    }
    onStateChange('connecting');
    try {
      server = await dev.gatt.connect();
      // Try to find writable characteristic
      const services = await server.getPrimaryServices();
      for (const svc of services) {
        try {
          const chars = await svc.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              characteristic = c;
              onStateChange('connected');
              // Save device info
              await DB.setSetting('bt_device_name', dev.name || '蓝牙打印机');
              await DB.setSetting('bt_device_id', dev.id);
              return characteristic;
            }
          }
        } catch (_) { continue; }
      }
      throw new Error('未找到可写的蓝牙特征');
    } catch (err) {
      onStateChange('disconnected');
      throw err;
    }
  }

  async function autoConnect() {
    try {
      const savedName = await DB.getSetting('bt_device_name');
      if (!savedName) return false;
      // Try to get known devices
      const devices = await navigator.bluetooth.getDevices ? await navigator.bluetooth.getDevices() : [];
      // Fallback: just try the last device
      onStateChange('disconnected');
      return false;
    } catch (_) {
      return false;
    }
  }

  async function disconnect() {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    device = null;
    server = null;
    characteristic = null;
    onStateChange('disconnected');
    await DB.setSetting('bt_device_name', null);
    await DB.setSetting('bt_device_id', null);
  }

  function onDisconnected() {
    server = null;
    characteristic = null;
    onStateChange('disconnected');
  }

  async function write(data) {
    if (!characteristic) throw new Error('打印机未连接');
    const buf = typeof data === 'string' ? str2ab(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    if (characteristic.properties.write) {
      await characteristic.writeValue(buf);
    } else if (characteristic.properties.writeWithoutResponse) {
      characteristic.writeValueWithoutResponse(buf);
    } else {
      throw new Error('打印机不支持写入');
    }
  }

  function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
    return buf;
  }

  async function writeBytes(bytes) {
    await write(new Uint8Array(bytes));
  }

  function addStateListener(fn) {
    stateListeners.push(fn);
  }

  function isSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  return { requestDevice, connect, disconnect, write, writeBytes, addStateListener, getState, isSupported, autoConnect };
})();
