/* SnackFlow SPA script
   - 3 tabs: dashboard, report, finance
   - visual POS grid with temporary cart
   - localStorage-backed orders, capital, and inventory
   - Chart.js reports
*/

const DEFAULT_BASE_CAPITAL = 15000000;
const DEFAULT_SALES_CHANNEL = 'Tại chỗ';
const DEFAULT_PAYMENT_METHOD = 'Tiền mặt';
const SALES_CHANNELS = ['Tại chỗ', 'Mang đi', 'GrabFood', 'ShopeeFood'];
const PAYMENT_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Ví điện tử'];

const STORAGE_KEYS = {
  orders: 'snackflow.orders',
  initialCapital: 'snackflow.initialCapital',
  ingredients: 'snackflow.ingredients',
};

const defaultIngredients = {
  'Cá viên': 120,
  'Bánh tráng': 30,
  'Trà sữa': 60,
  'Khoai tây': 45,
  'Phô mai': 35,
  'Xoài': 40,
  'Nem chua': 70,
  'Chân gà': 50,
  'Tokbokki': 55,
  'Bắp': 45,
  'Trà tắc': 80,
  'Gà': 35,
};

const menuItems = [
  { name: 'Cá viên chiên', price: 22000, cost: 13000, recipe: { 'Cá viên': 6 } },
  { name: 'Bánh tráng trộn', price: 18000, cost: 9000, recipe: { 'Bánh tráng': 1 } },
  { name: 'Trà sữa', price: 29000, cost: 15000, recipe: { 'Trà sữa': 1 } },
  { name: 'Khoai lắc phô mai', price: 24000, cost: 12500, recipe: { 'Khoai tây': 1, 'Phô mai': 1 } },
  { name: 'Xoài lắc', price: 20000, cost: 8500, recipe: { 'Xoài': 1 } },
  { name: 'Nem chua rán', price: 26000, cost: 15000, recipe: { 'Nem chua': 5 } },
  { name: 'Chân gà sả tắc', price: 39000, cost: 24000, recipe: { 'Chân gà': 5 } },
  { name: 'Tokbokki', price: 32000, cost: 17500, recipe: { 'Tokbokki': 1 } },
  { name: 'Bắp xào', price: 17000, cost: 7500, recipe: { 'Bắp': 1 } },
  { name: 'Trà tắc', price: 15000, cost: 5500, recipe: { 'Trà tắc': 1 } },
  { name: 'Gà lắc phô mai', price: 35000, cost: 21000, recipe: { 'Gà': 1, 'Phô mai': 1 } },
];

const menuMap = new Map(menuItems.map((m) => [m.name, m]));

function readStorage(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Unable to read ${key} from localStorage`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Unable to write ${key} to localStorage`, error);
  }
}

function parseCapital(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BASE_CAPITAL;
}

function loadInitialCapital() {
  return parseCapital(readStorage(STORAGE_KEYS.initialCapital, DEFAULT_BASE_CAPITAL));
}

function loadIngredients() {
  const raw = readStorage(STORAGE_KEYS.ingredients, null);
  if (!raw) return { ...defaultIngredients };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...defaultIngredients };
    return { ...defaultIngredients, ...parsed };
  } catch (error) {
    console.warn('Unable to parse saved ingredients from localStorage', error);
    return { ...defaultIngredients };
  }
}

function saveIngredients() {
  writeStorage(STORAGE_KEYS.ingredients, JSON.stringify(ingredients));
}

function parseOrderDateValue(order) {
  const raw = order.timestamp || order.date;
  if (!raw) return null;

  const parsed = raw.includes('T') ? new Date(raw) : new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function enrichOrder(order, id) {
  const dateValue = parseOrderDateValue(order) || new Date();
  const timestamp = dateValue.toISOString();
  const revenue = Math.round(order.quantity * order.price);
  const expenses = Math.round(order.quantity * order.cost);
  const profit = Math.round(order.quantity * (order.price - order.cost));

  return {
    ...order,
    id,
    timestamp,
    date: toDateKey(dateValue),
    salesChannel: order.salesChannel || DEFAULT_SALES_CHANNEL,
    paymentMethod: order.paymentMethod || DEFAULT_PAYMENT_METHOD,
    orderCode: order.orderCode || `SF-${Date.now()}`,
    revenue,
    expenses,
    profit,
    dateValue,
  };
}

function serializeOrder(order) {
  const { dateValue, revenue, expenses, profit, ...rest } = order;
  return rest;
}

function loadOrders() {
  const raw = readStorage(STORAGE_KEYS.orders, '[]');
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((order, index) => {
        const menu = menuMap.get(order.item) || {};
        const quantity = Number(order.quantity);
        const price = Number(order.price ?? menu.price);
        const cost = Number(order.cost ?? menu.cost);

        if (!order.item || !quantity || quantity <= 0 || !Number.isFinite(price) || !Number.isFinite(cost)) {
          return null;
        }

        return enrichOrder(
          {
            date: order.date,
            timestamp: order.timestamp,
            item: order.item,
            quantity,
            price,
            cost,
            salesChannel: order.salesChannel,
            paymentMethod: order.paymentMethod,
            orderCode: order.orderCode,
          },
          order.id ?? index + 1,
        );
      })
      .filter(Boolean);
  } catch (error) {
    console.warn('Unable to parse saved orders from localStorage', error);
    return [];
  }
}

function saveOrders() {
  writeStorage(STORAGE_KEYS.orders, JSON.stringify(orders.map(serializeOrder)));
}

function saveInitialCapital() {
  writeStorage(STORAGE_KEYS.initialCapital, String(baseCapital));
}

const ingredients = loadIngredients();
const orders = loadOrders();
let baseCapital = loadInitialCapital();

const state = {
  range: 'today',
  activeTab: 'dashboard',
  cart: [],
};

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFormatter.format(value);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(date) {
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function createOrderTimestamp(dateKey) {
  const now = new Date();
  const selectedDate = dateKey || toDateKey(now);
  return new Date(
    `${selectedDate}T${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}:${`${now.getSeconds()}`.padStart(2, '0')}`,
  );
}

function getPeriodBounds(range, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === 'week') {
    const day = now.getDay();
    const mondayOffset = (day === 0 ? -6 : 1) - day;
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return { start, end };
}

function getFilteredOrders(range) {
  const { start, end } = getPeriodBounds(range);
  return orders.filter((o) => o.dateValue >= start && o.dateValue <= end);
}

function aggregateOrders(list) {
  return list.reduce(
    (result, order) => {
      result.revenue += order.revenue;
      result.expenses += order.expenses;
      result.profit += order.profit;
      result.orders += 1;
      return result;
    },
    { revenue: 0, expenses: 0, profit: 0, orders: 0 },
  );
}

function buildBestSellers(list) {
  const map = new Map();
  list.forEach((order) => {
    const existing = map.get(order.item);
    if (existing) {
      existing.quantity += order.quantity;
      existing.revenue += order.revenue;
      existing.profit += order.profit;
    } else {
      map.set(order.item, {
        item: order.item,
        quantity: order.quantity,
        revenue: order.revenue,
        profit: order.profit,
      });
    }
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function buildDateSeries(range, now = new Date()) {
  const { start, end } = getPeriodBounds(range, now);
  const labels = [];
  const keys = [];
  if (range === 'year') {
    for (let i = 0; i < 12; i += 1) {
      labels.push(`T${i + 1}`);
      keys.push(i);
    }
    return { labels, keys, type: 'month' };
  }
  const cur = new Date(start);
  while (cur <= end) {
    labels.push(`${cur.getDate()}/${cur.getMonth() + 1}`);
    keys.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return { labels, keys, type: 'day' };
}

function buildTrendData(list, range) {
  const { labels, keys, type } = buildDateSeries(range);
  const revenue = new Array(keys.length).fill(0);
  const profit = new Array(keys.length).fill(0);
  list.forEach((order) => {
    if (type === 'month') {
      const idx = order.dateValue.getMonth();
      revenue[idx] += order.revenue;
      profit[idx] += order.profit;
      return;
    }
    const key = toDateKey(order.dateValue);
    const idx = keys.indexOf(key);
    if (idx >= 0) {
      revenue[idx] += order.revenue;
      profit[idx] += order.profit;
    }
  });
  return { labels, revenue, profit };
}

function buildBreakdownData(list, field, fallback) {
  const map = new Map();
  list.forEach((order) => {
    const key = order[field] || fallback;
    map.set(key, (map.get(key) || 0) + order.revenue);
  });
  return {
    labels: [...map.keys()],
    values: [...map.values()],
  };
}

function buildHourlyData(list) {
  const counts = new Array(24).fill(0);
  list.forEach((order) => {
    counts[order.dateValue.getHours()] += 1;
  });
  return {
    labels: counts.map((_, hour) => `${`${hour}`.padStart(2, '0')}:00-${`${hour + 1}`.padStart(2, '0')}:00`),
    counts,
  };
}

function getCartQuantity(itemName) {
  const line = state.cart.find((item) => item.name === itemName);
  return line ? line.quantity : 0;
}

function getAvailableQuantity(menu) {
  if (!menu.recipe) return Infinity;
  return Object.entries(menu.recipe).reduce((available, [ingredient, amount]) => {
    const stock = Number(ingredients[ingredient] ?? 0);
    return Math.min(available, Math.floor(stock / amount));
  }, Infinity);
}

function getCartRequiredIngredients() {
  return state.cart.reduce((required, line) => {
    const menu = menuMap.get(line.name);
    if (!menu?.recipe) return required;

    Object.entries(menu.recipe).forEach(([ingredient, amount]) => {
      required[ingredient] = (required[ingredient] || 0) + amount * line.quantity;
    });
    return required;
  }, {});
}

function canFulfillCart() {
  const required = getCartRequiredIngredients();
  return Object.entries(required).every(([ingredient, amount]) => Number(ingredients[ingredient] ?? 0) >= amount);
}

function getLowStockText(menu) {
  if (!menu.recipe) return '';
  const missing = Object.entries(menu.recipe)
    .filter(([ingredient, amount]) => Number(ingredients[ingredient] ?? 0) < amount)
    .map(([ingredient]) => ingredient);
  return missing.length ? `Hết: ${missing.join(', ')}` : '';
}

function deductIngredients(cart) {
  cart.forEach((line) => {
    const menu = menuMap.get(line.name);
    if (!menu?.recipe) return;

    Object.entries(menu.recipe).forEach(([ingredient, amount]) => {
      ingredients[ingredient] = Number(ingredients[ingredient] ?? 0) - amount * line.quantity;
    });
  });
  saveIngredients();
}

// DOM elements
const elements = {
  orderForm: document.getElementById('orderForm'),
  menuGrid: document.getElementById('menuGrid'),
  cartItems: document.getElementById('cartItems'),
  cartEmpty: document.getElementById('cartEmpty'),
  salesChannel: document.getElementById('salesChannel'),
  paymentMethod: document.getElementById('paymentMethod'),
  orderDate: document.getElementById('orderDate'),
  previewTotal: document.getElementById('previewTotal'),
  dailyOrdersTable: document.getElementById('dailyOrdersTable'),
  formHint: document.getElementById('formHint'),
  receiptTemplate: document.getElementById('receiptTemplate'),
  reportBestSellerTable: document.getElementById('reportBestSellerTable'),
  bestSellerChartEl: document.getElementById('bestSellerChart'),
  trendChartEl: document.getElementById('trendChart'),
  channelChartEl: document.getElementById('channelChart'),
  paymentChartEl: document.getElementById('paymentChart'),
  peakHourChartEl: document.getElementById('peakHourChart'),
  initialCapital: document.getElementById('initialCapital'),
  financeRevenue: document.getElementById('financeRevenue'),
  financeExpenses: document.getElementById('financeExpenses'),
  financeProfit: document.getElementById('financeProfit'),
  financeConclusion: document.getElementById('financeConclusion'),
  navItems: document.querySelectorAll('.nav-item'),
  reportFilters: document.querySelectorAll('.report-filters .filter-btn'),
  financeFilters: document.querySelectorAll('.finance-filters .filter-btn'),
};

let bestSellerChart = null;
let trendChart = null;
let channelChart = null;
let paymentChart = null;
let peakHourChart = null;

function createDoughnutChart(canvas, label) {
  return new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        backgroundColor: ['#ff8f3d', '#34c3ff', '#10b981', '#f97373'],
        borderColor: '#fffdf9',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  });
}

function initCharts() {
  if (elements.bestSellerChartEl) {
    bestSellerChart = new Chart(elements.bestSellerChartEl.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Số lượng', data: [], backgroundColor: 'rgba(255,154,60,0.85)', borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  if (elements.trendChartEl) {
    trendChart = new Chart(elements.trendChartEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Doanh thu', data: [], borderColor: '#ff8f3d', backgroundColor: 'rgba(255,143,61,0.18)', fill: true, tension: 0.3 },
          { label: 'Lợi nhuận', data: [], borderColor: '#16a34a', backgroundColor: 'rgba(16,163,74,0.12)', fill: true, tension: 0.3 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
    });
  }

  if (elements.channelChartEl) channelChart = createDoughnutChart(elements.channelChartEl, 'Kênh bán');
  if (elements.paymentChartEl) paymentChart = createDoughnutChart(elements.paymentChartEl, 'Thanh toán');

  if (elements.peakHourChartEl) {
    peakHourChart = new Chart(elements.peakHourChartEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ label: 'Số đơn', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.35 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }
}

function updateCharts(list, range) {
  const sellers = buildBestSellers(list);
  if (bestSellerChart) {
    bestSellerChart.data.labels = sellers.map((s) => s.item);
    bestSellerChart.data.datasets[0].data = sellers.map((s) => s.quantity);
    bestSellerChart.update();
  }

  if (trendChart) {
    const trend = buildTrendData(list, range);
    trendChart.data.labels = trend.labels;
    trendChart.data.datasets[0].data = trend.revenue;
    trendChart.data.datasets[1].data = trend.profit;
    trendChart.update();
  }

  if (channelChart) {
    const channel = buildBreakdownData(list, 'salesChannel', DEFAULT_SALES_CHANNEL);
    channelChart.data.labels = channel.labels.length ? channel.labels : ['Chưa có dữ liệu'];
    channelChart.data.datasets[0].data = channel.values.length ? channel.values : [1];
    channelChart.update();
  }

  if (paymentChart) {
    const payment = buildBreakdownData(list, 'paymentMethod', DEFAULT_PAYMENT_METHOD);
    paymentChart.data.labels = payment.labels.length ? payment.labels : ['Chưa có dữ liệu'];
    paymentChart.data.datasets[0].data = payment.values.length ? payment.values : [1];
    paymentChart.update();
  }

  if (peakHourChart) {
    const hourly = buildHourlyData(list);
    peakHourChart.data.labels = hourly.labels;
    peakHourChart.data.datasets[0].data = hourly.counts;
    peakHourChart.update();
  }
}

function setFormHint(message, isError = false) {
  if (!elements.formHint) return;
  elements.formHint.textContent = message;
  elements.formHint.style.color = isError ? '#c43333' : '';
}

function addToCart(itemName) {
  const menu = menuMap.get(itemName);
  if (!menu) return;

  const available = getAvailableQuantity(menu);
  const currentQty = getCartQuantity(itemName);
  if (available <= currentQty) {
    setFormHint('Không đủ tồn kho để thêm món này.', true);
    return;
  }

  const existing = state.cart.find((item) => item.name === itemName);
  if (existing) existing.quantity += 1;
  else state.cart.push({ name: itemName, quantity: 1 });

  renderCart();
  renderMenuGrid();
}

function updateCartQuantity(itemName, quantity) {
  const menu = menuMap.get(itemName);
  if (!menu) return;

  const nextQty = Number(quantity);
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    state.cart = state.cart.filter((line) => line.name !== itemName);
  } else {
    const line = state.cart.find((item) => item.name === itemName);
    if (line) line.quantity = Math.min(nextQty, getAvailableQuantity(menu));
  }

  renderCart();
  renderMenuGrid();
}

function renderMenuGrid() {
  if (!elements.menuGrid) return;

  elements.menuGrid.innerHTML = menuItems.map((menu) => {
    const available = getAvailableQuantity(menu);
    const cartQty = getCartQuantity(menu.name);
    const disabled = available <= 0 || available <= cartQty;
    const lowStock = available > 0 && available <= 3;
    const warning = disabled ? getLowStockText(menu) || 'Đã đạt tồn kho còn lại' : lowStock ? `Còn ${available} phần` : '';

    return `
      <button class="menu-card${disabled ? ' is-disabled' : ''}${lowStock ? ' is-low' : ''}" type="button" data-item="${menu.name}" ${disabled ? 'disabled' : ''}>
        <span class="menu-card-name">${menu.name}</span>
        <strong>${formatMoney(menu.price)}</strong>
        <small>${warning || 'Sẵn sàng bán'}</small>
        ${cartQty ? `<em>Trong giỏ: ${cartQty}</em>` : ''}
      </button>
    `;
  }).join('');
}

function renderCart() {
  if (!elements.cartItems || !elements.previewTotal || !elements.cartEmpty) return;

  const total = state.cart.reduce((sum, line) => {
    const menu = menuMap.get(line.name);
    return sum + (menu ? menu.price * line.quantity : 0);
  }, 0);

  elements.previewTotal.textContent = formatMoney(total);
  elements.cartEmpty.style.display = state.cart.length ? 'none' : 'block';
  elements.cartItems.innerHTML = state.cart.map((line) => {
    const menu = menuMap.get(line.name);
    if (!menu) return '';
    return `
      <div class="cart-line">
        <div>
          <strong>${line.name}</strong>
          <span>${formatMoney(menu.price)} x ${line.quantity}</span>
        </div>
        <div class="qty-control">
          <button type="button" data-cart-action="decrease" data-item="${line.name}" aria-label="Giảm ${line.name}">-</button>
          <input type="number" min="1" max="${getAvailableQuantity(menu)}" value="${line.quantity}" data-cart-qty="${line.name}" aria-label="Số lượng ${line.name}" />
          <button type="button" data-cart-action="increase" data-item="${line.name}" aria-label="Tăng ${line.name}">+</button>
          <button class="remove-line" type="button" data-cart-action="remove" data-item="${line.name}" aria-label="Xóa ${line.name}">x</button>
        </div>
      </div>
    `;
  }).join('');
}

function initForm() {
  const today = new Date();
  if (elements.orderDate) elements.orderDate.value = toDateKey(today);
  if (elements.salesChannel) {
    elements.salesChannel.innerHTML = SALES_CHANNELS.map((channel) => `<option value="${channel}">${channel}</option>`).join('');
  }
  if (elements.paymentMethod) {
    elements.paymentMethod.innerHTML = PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('');
  }
  renderMenuGrid();
  renderCart();
}

function renderDashboard() {
  if (!elements.dailyOrdersTable) return;
  const selected = elements.orderDate?.value || toDateKey(new Date());
  const rows = orders
    .filter((order) => toDateKey(order.dateValue) === selected)
    .map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${toDateKey(order.dateValue)} ${formatTime(order.dateValue)}</td>
        <td>${order.item}</td>
        <td>${order.quantity}</td>
        <td>${order.salesChannel}</td>
        <td>${order.paymentMethod}</td>
        <td>${formatMoney(order.revenue)}</td>
        <td class="${order.profit >= 0 ? 'money-good' : 'money-bad'}">${formatMoney(order.profit)}</td>
      </tr>
    `).join('');

  elements.dailyOrdersTable.innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Chưa có đơn cho ngày này.</td></tr>';
}

function renderReport() {
  const filtered = getFilteredOrders(state.range);
  const sellers = buildBestSellers(filtered);
  if (elements.reportBestSellerTable) {
    elements.reportBestSellerTable.innerHTML = sellers.map((seller) => `
      <tr>
        <td>${seller.item}</td>
        <td>${seller.quantity}</td>
        <td>${formatMoney(seller.revenue)}</td>
        <td class="${seller.profit >= 0 ? 'money-good' : 'money-bad'}">${formatMoney(seller.profit)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Không có dữ liệu.</td></tr>';
  }
  updateCharts(filtered, state.range);
}

function renderFinance() {
  const filtered = getFilteredOrders(state.range);
  const agg = aggregateOrders(filtered);
  const depreciation = Math.round(baseCapital * 0.03);
  const expensesWithDep = agg.expenses + depreciation;
  const profit = agg.revenue - expensesWithDep;

  if (elements.initialCapital && document.activeElement !== elements.initialCapital) elements.initialCapital.value = baseCapital;
  if (elements.financeRevenue) elements.financeRevenue.textContent = formatMoney(agg.revenue);
  if (elements.financeExpenses) elements.financeExpenses.textContent = formatMoney(expensesWithDep);
  if (elements.financeProfit) elements.financeProfit.textContent = formatMoney(profit);
  if (elements.financeConclusion) {
    const positive = profit >= 0;
    elements.financeConclusion.textContent = positive ? `Hệ thống đang LỜI ${formatMoney(profit)}` : `Hệ thống đang LỖ ${formatMoney(Math.abs(profit))}`;
    elements.financeConclusion.classList.toggle('profit', positive);
    elements.financeConclusion.classList.toggle('loss', !positive);
  }
}

function switchTo(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-page').forEach((page) => {
    page.style.display = 'none';
  });
  const el = document.getElementById(`tab-${tab}`);
  if (el) el.style.display = 'block';

  if (tab === 'dashboard') renderDashboard();
  if (tab === 'report') renderReport();
  if (tab === 'finance') renderFinance();
}

function populateReceipt(orderLines, meta) {
  if (!elements.receiptTemplate) return;

  const total = orderLines.reduce((sum, order) => sum + order.revenue, 0);
  const rows = orderLines.map((order) => `
    <div class="receipt-row">
      <span>${order.item} x ${order.quantity}</span>
      <strong>${formatMoney(order.revenue)}</strong>
    </div>
  `).join('');

  elements.receiptTemplate.innerHTML = `
    <div class="receipt-paper">
      <div class="receipt-center">
        <h2>SnackFlow</h2>
        <p>Phiếu bán hàng</p>
      </div>
      <div class="receipt-meta">
        <span>Mã đơn</span><strong>${meta.orderCode}</strong>
        <span>Thời gian</span><strong>${toDateKey(meta.dateValue)} ${formatTime(meta.dateValue)}</strong>
        <span>Kênh bán</span><strong>${meta.salesChannel}</strong>
        <span>Thanh toán</span><strong>${meta.paymentMethod}</strong>
      </div>
      <div class="receipt-lines">${rows}</div>
      <div class="receipt-total">
        <span>Tổng cộng</span>
        <strong>${formatMoney(total)}</strong>
      </div>
      <p class="receipt-thanks">Cảm ơn quý khách!</p>
    </div>
  `;
}

function submitOrder() {
  if (!state.cart.length) {
    setFormHint('Chọn ít nhất một món trong menu.', true);
    return;
  }
  if (!canFulfillCart()) {
    setFormHint('Tồn kho không đủ cho giỏ hiện tại. Vui lòng giảm số lượng.', true);
    renderMenuGrid();
    return;
  }

  const dateValue = createOrderTimestamp(elements.orderDate?.value);
  const orderCode = `SF-${dateValue.getTime()}`;
  const salesChannel = elements.salesChannel?.value || DEFAULT_SALES_CHANNEL;
  const paymentMethod = elements.paymentMethod?.value || DEFAULT_PAYMENT_METHOD;
  const startId = orders.reduce((max, order) => Math.max(max, Number(order.id) || 0), 0) + 1;

  const newOrders = state.cart.map((line, index) => {
    const menu = menuMap.get(line.name);
    return enrichOrder(
      {
        timestamp: dateValue.toISOString(),
        item: line.name,
        quantity: line.quantity,
        price: menu.price,
        cost: menu.cost,
        salesChannel,
        paymentMethod,
        orderCode,
      },
      startId + index,
    );
  });

  orders.push(...newOrders);
  deductIngredients(state.cart);
  saveOrders();
  populateReceipt(newOrders, { orderCode, dateValue, salesChannel, paymentMethod });
  state.cart = [];
  setFormHint('Đã ghi nhận đơn hàng mới và tạo phiếu in.');
  renderCart();
  renderMenuGrid();
  renderDashboard();
  if (state.activeTab === 'report') renderReport();
  if (state.activeTab === 'finance') renderFinance();
  window.print();
}

function initHandlers() {
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.navItems.forEach((nav) => nav.classList.toggle('active', nav === btn));
      switchTo(btn.dataset.tab);
    });
  });

  elements.reportFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.range = btn.dataset.range;
      elements.reportFilters.forEach((filter) => filter.classList.toggle('active', filter === btn));
      renderReport();
      renderFinance();
    });
  });

  elements.financeFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.range = btn.dataset.range;
      elements.financeFilters.forEach((filter) => filter.classList.toggle('active', filter === btn));
      renderReport();
      renderFinance();
    });
  });

  if (elements.menuGrid) {
    elements.menuGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.menu-card');
      if (!card || card.disabled) return;
      addToCart(card.dataset.item);
    });
  }

  if (elements.cartItems) {
    elements.cartItems.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-action]');
      if (!button) return;
      const itemName = button.dataset.item;
      const current = getCartQuantity(itemName);
      if (button.dataset.cartAction === 'increase') updateCartQuantity(itemName, current + 1);
      if (button.dataset.cartAction === 'decrease') updateCartQuantity(itemName, current - 1);
      if (button.dataset.cartAction === 'remove') updateCartQuantity(itemName, 0);
    });

    elements.cartItems.addEventListener('input', (event) => {
      if (!event.target.matches('[data-cart-qty]')) return;
      updateCartQuantity(event.target.dataset.cartQty, event.target.value);
    });
  }

  if (elements.orderDate) {
    elements.orderDate.addEventListener('change', renderDashboard);
  }

  if (elements.initialCapital) {
    elements.initialCapital.addEventListener('input', () => {
      baseCapital = parseCapital(elements.initialCapital.value);
      saveInitialCapital();
      renderFinance();
    });
  }

  if (elements.orderForm) {
    elements.orderForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitOrder();
    });
  }
}

initForm();
initCharts();
initHandlers();
switchTo('dashboard');

window._sf = {
  orders,
  menuItems,
  ingredients,
  renderDashboard,
  renderReport,
  renderFinance,
  switchTo,
};
