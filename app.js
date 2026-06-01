/* SnackFlow SPA script
   - 3 tabs: dashboard, report, finance
   - empty initial orders array
   - menuItems catalog
   - Chart.js integration
*/

const baseCapital = 15000000;

const menuItems = [
  { name: "Cá viên chiên", price: 22000, cost: 13000 },
  { name: "Bánh tráng trộn", price: 18000, cost: 9000 },
  { name: "Trà sữa", price: 29000, cost: 15000 },
  { name: "Khoai lắc phô mai", price: 24000, cost: 12500 },
  { name: "Xoài lắc", price: 20000, cost: 8500 },
  { name: "Nem chua rán", price: 26000, cost: 15000 },
  { name: "Chân gà sả tắc", price: 39000, cost: 24000 },
  { name: "Tokbokki", price: 32000, cost: 17500 },
  { name: "Bắp xào", price: 17000, cost: 7500 },
  { name: "Trà tắc", price: 15000, cost: 5500 },
  { name: "Gà lắc phô mai", price: 35000, cost: 21000 },
];

const menuMap = new Map(menuItems.map((m) => [m.name, m]));

function enrichOrder(order, id) {
  const revenue = Math.round(order.quantity * order.price);
  const expenses = Math.round(order.quantity * order.cost);
  const profit = Math.round(order.quantity * (order.price - order.cost));
  return { ...order, id, revenue, expenses, profit, dateValue: new Date(`${order.date}T00:00:00`) };
}

// start empty
const orders = [];

const state = { range: 'today', activeTab: 'dashboard' };

const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
function formatMoney(v){ return currencyFormatter.format(v); }

function toDateKey(date){ const y=date.getFullYear(); const m=`${date.getMonth()+1}`.padStart(2,'0'); const d=`${date.getDate()}`.padStart(2,'0'); return `${y}-${m}-${d}`; }

function getPeriodBounds(range, now=new Date()){
  const start=new Date(now); const end=new Date(now);
  if(range==='today'){ start.setHours(0,0,0,0); end.setHours(23,59,59,999); return {start,end}; }
  if(range==='week'){ const day=now.getDay(); const mondayOffset=(day===0?-6:1)-day; start.setDate(now.getDate()+mondayOffset); start.setHours(0,0,0,0); end.setHours(23,59,59,999); return {start,end}; }
  if(range==='month'){ start.setDate(1); start.setHours(0,0,0,0); end.setMonth(now.getMonth()+1,0); end.setHours(23,59,59,999); return {start,end}; }
  if(range==='year'){ start.setMonth(0,1); start.setHours(0,0,0,0); end.setMonth(11,31); end.setHours(23,59,59,999); return {start,end}; }
  return {start,end};
}

function getFilteredOrders(range){ const {start,end}=getPeriodBounds(range); return orders.filter(o=>o.dateValue>=start && o.dateValue<=end); }

function aggregateOrders(list){ return list.reduce((r,o)=>{ r.revenue+=o.revenue; r.expenses+=o.expenses; r.profit+=o.profit; r.orders+=1; return r }, {revenue:0, expenses:0, profit:0, orders:0}); }

function buildBestSellers(list){ const map=new Map(); list.forEach(o=>{ const ex=map.get(o.item); if(ex){ ex.quantity+=o.quantity; ex.revenue+=o.revenue; ex.profit+=o.profit } else { map.set(o.item,{ item:o.item, quantity:o.quantity, revenue:o.revenue, profit:o.profit }) } }); return [...map.values()].sort((a,b)=>b.quantity-a.quantity); }

function buildDateSeries(range, now=new Date()){
  const {start,end}=getPeriodBounds(range, now);
  const labels=[]; const keys=[];
  if(range==='year'){ for(let i=0;i<12;i++){ labels.push(`T${i+1}`); keys.push(i); } return {labels,keys,type:'month'} }
  const cur=new Date(start);
  while(cur<=end){ labels.push(`${cur.getDate()}/${cur.getMonth()+1}`); keys.push(toDateKey(cur)); cur.setDate(cur.getDate()+1); }
  return {labels,keys,type:'day'};
}

function buildTrendData(list, range){ const {labels,keys,type}=buildDateSeries(range); const revenue=new Array(keys.length).fill(0); const profit=new Array(keys.length).fill(0); list.forEach(o=>{ if(type==='month'){ const idx=o.dateValue.getMonth(); revenue[idx]+=o.revenue; profit[idx]+=o.profit; return } const key=toDateKey(o.dateValue); const idx=keys.indexOf(key); if(idx>=0){ revenue[idx]+=o.revenue; profit[idx]+=o.profit } }); return {labels,revenue,profit}; }

// DOM elements
const elements = {
  // dashboard
  orderForm: document.getElementById('orderForm'),
  orderItem: document.getElementById('orderItem'),
  orderQuantity: document.getElementById('orderQuantity'),
  orderDate: document.getElementById('orderDate'),
  previewTotal: document.getElementById('previewTotal'),
  dailyOrdersTable: document.getElementById('dailyOrdersTable'),
  formHint: document.getElementById('formHint'),
  // report
  reportBestSellerTable: document.getElementById('reportBestSellerTable'),
  bestSellerChartEl: document.getElementById('bestSellerChart'),
  trendChartEl: document.getElementById('trendChart'),
  // finance
  initialCapital: document.getElementById('initialCapital'),
  financeRevenue: document.getElementById('financeRevenue'),
  financeExpenses: document.getElementById('financeExpenses'),
  financeProfit: document.getElementById('financeProfit'),
  financeConclusion: document.getElementById('financeConclusion'),
  // nav & filters
  navItems: document.querySelectorAll('.nav-item'),
  reportFilters: document.querySelectorAll('.report-filters .filter-btn'),
  financeFilters: document.querySelectorAll('.finance-filters .filter-btn'),
};

let bestSellerChart=null; let trendChart=null;

function initCharts(){ if(elements.bestSellerChartEl){ const ctx=elements.bestSellerChartEl.getContext('2d'); bestSellerChart=new Chart(ctx,{ type:'bar', data:{ labels:[], datasets:[{ label:'Số lượng', data:[], backgroundColor:'rgba(255,154,60,0.85)', borderRadius:8 }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } }); }
  if(elements.trendChartEl){ const ctx2=elements.trendChartEl.getContext('2d'); trendChart=new Chart(ctx2,{ type:'line', data:{ labels:[], datasets:[ { label:'Doanh thu', data:[], borderColor:'#ff8f3d', backgroundColor:'rgba(255,143,61,0.18)', fill:true, tension:0.3 }, { label:'Lợi nhuận', data:[], borderColor:'#16a34a', backgroundColor:'rgba(16,163,74,0.12)', fill:true, tension:0.3 } ] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } } } }); }
}

function updateCharts(list, range){ if(!bestSellerChart || !trendChart) return; const sellers=buildBestSellers(list); bestSellerChart.data.labels=sellers.map(s=>s.item); bestSellerChart.data.datasets[0].data=sellers.map(s=>s.quantity); bestSellerChart.update(); const trend=buildTrendData(list, range); trendChart.data.labels=trend.labels; trendChart.data.datasets[0].data=trend.revenue; trendChart.data.datasets[1].data=trend.profit; trendChart.update(); }

function setFormHint(msg, isError=false){ if(elements.formHint) { elements.formHint.textContent=msg; elements.formHint.style.color = isError? '#c43333' : ''; } }

function initForm(){ if(!elements.orderItem) return; elements.orderItem.innerHTML = menuItems.map(m=>`<option value="${m.name}">${m.name}</option>`).join(''); const t=new Date(); const y=t.getFullYear(); const mo=`${t.getMonth()+1}`.padStart(2,'0'); const d=`${t.getDate()}`.padStart(2,'0'); elements.orderDate.value=`${y}-${mo}-${d}`; updatePreviewTotal(); }
function updatePreviewTotal(){ const name=elements.orderItem.value; const qty=Number(elements.orderQuantity.value)||0; const menu=menuMap.get(name); const total=menu? menu.price*qty:0; if(elements.previewTotal) elements.previewTotal.textContent = formatMoney(total); }

// render dashboard: show orders of selected date
function renderDashboard(){ const selected = elements.orderDate.value || toDateKey(new Date()); const rows = orders.filter(o=> toDateKey(o.dateValue)===selected ).map((o,idx)=>`<tr><td>${idx+1}</td><td>${toDateKey(o.dateValue)}</td><td>${o.item}</td><td>${o.quantity}</td><td>${formatMoney(o.revenue)}</td><td class="${o.profit>=0?'money-good':'money-bad'}">${formatMoney(o.profit)}</td></tr>`).join(''); elements.dailyOrdersTable.innerHTML = rows || `<tr><td colspan="6" style="text-align:center;color:var(--muted)">Chưa có đơn cho ngày này.</td></tr>`; }

function renderReport(){ const filtered = getFilteredOrders(state.range); // table
  const sellers = buildBestSellers(filtered); elements.reportBestSellerTable.innerHTML = sellers.map(s=>`<tr><td>${s.item}</td><td>${s.quantity}</td><td>${formatMoney(s.revenue)}</td><td class="${s.profit>=0?'money-good':'money-bad'}">${formatMoney(s.profit)}</td></tr>`).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--muted)">Không có dữ liệu.</td></tr>`; updateCharts(filtered, state.range);
}

function renderFinance(){ const filtered = getFilteredOrders(state.range); const agg = aggregateOrders(filtered); const expensesWithDep = agg.expenses + Math.round(baseCapital * 0.03); const profit = agg.revenue - expensesWithDep; if(elements.initialCapital) elements.initialCapital.textContent = formatMoney(baseCapital); if(elements.financeRevenue) elements.financeRevenue.textContent = formatMoney(agg.revenue); if(elements.financeExpenses) elements.financeExpenses.textContent = formatMoney(expensesWithDep); if(elements.financeProfit) elements.financeProfit.textContent = formatMoney(profit); if(elements.financeConclusion){ const positive = profit>=0; elements.financeConclusion.textContent = positive? `Hệ thống đang LỜI ${formatMoney(profit)}`: `Hệ thống đang LỖ ${formatMoney(Math.abs(profit))}`; elements.financeConclusion.classList.toggle('profit', positive); elements.financeConclusion.classList.toggle('loss', !positive); } }

// switch tab
function switchTo(tab){ state.activeTab = tab; document.querySelectorAll('.tab-page').forEach(p=>p.style.display='none'); const el = document.getElementById('tab-'+tab); if(el) el.style.display='block'; // refresh
  if(tab==='dashboard') renderDashboard(); if(tab==='report'){ renderReport(); } if(tab==='finance'){ renderFinance(); } }

// init handlers
function initHandlers(){ // nav
  elements.navItems.forEach(btn=> btn.addEventListener('click', ()=>{ elements.navItems.forEach(n=> n.classList.toggle('active', n===btn)); switchTo(btn.dataset.tab); }));
  // filters
  elements.reportFilters.forEach(b=> b.addEventListener('click', ()=>{ state.range=b.dataset.range; elements.reportFilters.forEach(x=> x.classList.toggle('active', x===b)); renderReport(); renderFinance(); }));
  elements.financeFilters.forEach(b=> b.addEventListener('click', ()=>{ state.range=b.dataset.range; elements.financeFilters.forEach(x=> x.classList.toggle('active', x===b)); renderReport(); renderFinance(); }));
  // form
  if(elements.orderItem) elements.orderItem.addEventListener('change', updatePreviewTotal);
  if(elements.orderQuantity) elements.orderQuantity.addEventListener('input', updatePreviewTotal);
  if(elements.orderForm) elements.orderForm.addEventListener('submit', (e)=>{ e.preventDefault(); const name = elements.orderItem.value; const qty = Number(elements.orderQuantity.value); const date = elements.orderDate.value; const menu = menuMap.get(name); if(!menu || !date || !qty || qty<=0){ setFormHint('Vui lòng nhập thông tin hợp lệ.', true); return; } const newO = enrichOrder({ date, item:name, quantity:qty, price:menu.price, cost:menu.cost }, orders.length+1); orders.push(newO); setFormHint('Đã ghi nhận đơn hàng mới.'); // update views
    renderDashboard(); if(state.activeTab==='report') renderReport(); if(state.activeTab==='finance') renderFinance(); elements.orderQuantity.value='1'; updatePreviewTotal(); });
}

// startup
initForm(); initCharts(); initHandlers(); switchTo('dashboard');

// expose for dev console (optional)
window._sf = { orders, menuItems, renderDashboard, renderReport, renderFinance, switchTo };
