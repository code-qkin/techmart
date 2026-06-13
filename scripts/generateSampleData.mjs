import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Helpers
const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const imei = () => String(rand(100000000000000, 999999999999999))
const imeis = n => Array.from({ length: n }, imei).join(',')
const date = (daysAgo) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

const suppliers = ['Alaba Market', 'Computer Village', 'Slot Ikeja', 'Pointek', 'Fouani Nigeria', 'Samsung Nigeria', 'Apple Nigeria']
const conditions = ['New', 'New', 'New', 'Open Box', 'Pre-owned']

// ── 30 PHONES ───────────────────────────────────────────────────────────────
const phoneModels = [
  { name: 'iPhone 15 Pro Max', brand: 'Apple', cost: 650000, sell: 850000 },
  { name: 'iPhone 15 Pro', brand: 'Apple', cost: 530000, sell: 700000 },
  { name: 'iPhone 15', brand: 'Apple', cost: 420000, sell: 560000 },
  { name: 'iPhone 14', brand: 'Apple', cost: 320000, sell: 430000 },
  { name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', cost: 600000, sell: 780000 },
  { name: 'Samsung Galaxy S24+', brand: 'Samsung', cost: 480000, sell: 620000 },
  { name: 'Samsung Galaxy S24', brand: 'Samsung', cost: 360000, sell: 470000 },
  { name: 'Samsung Galaxy A55', brand: 'Samsung', cost: 180000, sell: 240000 },
  { name: 'Samsung Galaxy A35', brand: 'Samsung', cost: 130000, sell: 175000 },
  { name: 'Tecno Phantom V Fold', brand: 'Tecno', cost: 280000, sell: 380000 },
  { name: 'Infinix Note 40 Pro', brand: 'Infinix', cost: 95000, sell: 130000 },
  { name: 'Tecno Camon 30', brand: 'Tecno', cost: 80000, sell: 110000 },
  { name: 'Xiaomi 14 Ultra', brand: 'Xiaomi', cost: 420000, sell: 560000 },
  { name: 'Google Pixel 8 Pro', brand: 'Google', cost: 480000, sell: 630000 },
  { name: 'OnePlus 12', brand: 'OnePlus', cost: 350000, sell: 460000 },
]
const phoneStorages = ['128GB', '256GB', '512GB', '1TB']
const phoneColors = ['Black', 'White', 'Blue', 'Gold', 'Purple', 'Green', 'Silver']

const phoneRows = []
const phoneModelPool = [...phoneModels]
for (let i = 0; i < 30; i++) {
  const m = phoneModelPool[i % phoneModelPool.length]
  const storage = pick(phoneStorages)
  const color = pick(phoneColors)
  const condition = pick(conditions)
  const qty = rand(1, 8)
  const costAdj = storage === '256GB' ? 50000 : storage === '512GB' ? 100000 : storage === '1TB' ? 180000 : 0
  phoneRows.push([
    m.name, m.brand, 'Phones',
    color, storage, '',
    condition,
    qty,
    m.cost + costAdj,
    m.sell + Math.round(costAdj * 1.3),
    pick(suppliers),
    date(rand(1, 60)),
    '',
    imeis(qty),
  ])
}

// ── 30 LAPTOPS ──────────────────────────────────────────────────────────────
const laptopModels = [
  { name: 'MacBook Pro 14" M3 Pro', brand: 'Apple', cost: 1800000, sell: 2200000 },
  { name: 'MacBook Air M2', brand: 'Apple', cost: 1100000, sell: 1400000 },
  { name: 'MacBook Air M3', brand: 'Apple', cost: 1300000, sell: 1650000 },
  { name: 'Dell XPS 15', brand: 'Dell', cost: 950000, sell: 1200000 },
  { name: 'Dell Inspiron 15', brand: 'Dell', cost: 380000, sell: 500000 },
  { name: 'HP Spectre x360', brand: 'HP', cost: 850000, sell: 1100000 },
  { name: 'HP EliteBook 840', brand: 'HP', cost: 620000, sell: 800000 },
  { name: 'Lenovo ThinkPad X1 Carbon', brand: 'Lenovo', cost: 900000, sell: 1150000 },
  { name: 'Lenovo IdeaPad 5', brand: 'Lenovo', cost: 320000, sell: 420000 },
  { name: 'Asus ROG Zephyrus G14', brand: 'Asus', cost: 1100000, sell: 1400000 },
  { name: 'Asus VivoBook 15', brand: 'Asus', cost: 270000, sell: 360000 },
  { name: 'Microsoft Surface Laptop 5', brand: 'Microsoft', cost: 780000, sell: 1000000 },
  { name: 'Acer Swift X', brand: 'Acer', cost: 480000, sell: 630000 },
  { name: 'MSI Stealth 15', brand: 'MSI', cost: 750000, sell: 980000 },
  { name: 'Huawei MateBook D15', brand: 'Huawei', cost: 310000, sell: 410000 },
]
const laptopRAMs = ['8GB', '16GB', '32GB', '64GB']
const laptopStorages = ['256GB SSD', '512GB SSD', '1TB SSD']
const laptopColors = ['Silver', 'Space Grey', 'Black', 'Gold', 'Midnight Blue']

const laptopRows = []
for (let i = 0; i < 30; i++) {
  const m = laptopModels[i % laptopModels.length]
  const ram = pick(laptopRAMs)
  const storage = pick(laptopStorages)
  const color = pick(laptopColors)
  const condition = pick(conditions)
  const qty = rand(1, 5)
  const ramAdj = ram === '16GB' ? 80000 : ram === '32GB' ? 180000 : ram === '64GB' ? 350000 : 0
  laptopRows.push([
    m.name, m.brand, 'Laptops',
    color, storage, ram,
    condition,
    qty,
    m.cost + ramAdj,
    m.sell + Math.round(ramAdj * 1.25),
    pick(suppliers),
    date(rand(1, 60)),
    '',
    '',
  ])
}

// ── 30 ACCESSORIES ──────────────────────────────────────────────────────────
const accessories = [
  { name: 'AirPods Pro 2nd Gen', brand: 'Apple', cost: 120000, sell: 160000 },
  { name: 'AirPods 3rd Gen', brand: 'Apple', cost: 75000, sell: 100000 },
  { name: 'Samsung Galaxy Buds2 Pro', brand: 'Samsung', cost: 60000, sell: 82000 },
  { name: 'Sony WH-1000XM5', brand: 'Sony', cost: 150000, sell: 200000 },
  { name: 'JBL Tune 510BT', brand: 'JBL', cost: 25000, sell: 38000 },
  { name: 'Anker USB-C Cable 6ft', brand: 'Anker', cost: 3500, sell: 6500 },
  { name: 'Anker 65W GaN Charger', brand: 'Anker', cost: 18000, sell: 28000 },
  { name: 'Belkin MagSafe Charger', brand: 'Belkin', cost: 22000, sell: 35000 },
  { name: 'Apple MagSafe Case iPhone 15', brand: 'Apple', cost: 15000, sell: 25000 },
  { name: 'Spigen Rugged Armor Case', brand: 'Spigen', cost: 8000, sell: 14000 },
  { name: 'Samsung 45W Super Fast Charger', brand: 'Samsung', cost: 14000, sell: 22000 },
  { name: 'Logitech MX Keys Keyboard', brand: 'Logitech', cost: 55000, sell: 75000 },
  { name: 'Logitech MX Master 3S Mouse', brand: 'Logitech', cost: 45000, sell: 62000 },
  { name: 'Apple Watch Series 9', brand: 'Apple', cost: 280000, sell: 370000 },
  { name: 'Samsung Galaxy Watch 6', brand: 'Samsung', cost: 140000, sell: 185000 },
  { name: 'Baseus Power Bank 20000mAh', brand: 'Baseus', cost: 20000, sell: 32000 },
  { name: 'Oraimo Wireless Earbuds', brand: 'Oraimo', cost: 12000, sell: 20000 },
  { name: 'Ugreen USB Hub 7-in-1', brand: 'Ugreen', cost: 25000, sell: 38000 },
  { name: 'Amazon Echo Dot 5th Gen', brand: 'Amazon', cost: 35000, sell: 52000 },
  { name: 'TP-Link Wi-Fi 6 Router', brand: 'TP-Link', cost: 42000, sell: 60000 },
]

const accRows = []
for (let i = 0; i < 30; i++) {
  const m = accessories[i % accessories.length]
  const condition = pick(['New', 'New', 'New', 'Open Box'])
  const qty = rand(2, 20)
  accRows.push([
    m.name, m.brand, 'Accessories',
    '', '', '',
    condition,
    qty,
    m.cost,
    m.sell,
    pick(suppliers),
    date(rand(1, 60)),
    '',
    imeis(qty),
  ])
}

// ── 10 TABLETS ──────────────────────────────────────────────────────────────
const tabletModels = [
  { name: 'iPad Pro 12.9" M2', brand: 'Apple', cost: 680000, sell: 880000 },
  { name: 'iPad Air M2', brand: 'Apple', cost: 430000, sell: 560000 },
  { name: 'iPad 10th Gen', brand: 'Apple', cost: 290000, sell: 380000 },
  { name: 'Samsung Galaxy Tab S9 Ultra', brand: 'Samsung', cost: 580000, sell: 760000 },
  { name: 'Samsung Galaxy Tab S9+', brand: 'Samsung', cost: 430000, sell: 570000 },
  { name: 'Lenovo Tab P12 Pro', brand: 'Lenovo', cost: 220000, sell: 300000 },
]
const tabletStorages = ['128GB', '256GB', '512GB']
const tabletColors = ['Space Grey', 'Silver', 'Gold', 'Graphite', 'Starlight']

const tabletRows = []
for (let i = 0; i < 10; i++) {
  const m = tabletModels[i % tabletModels.length]
  const storage = pick(tabletStorages)
  const color = pick(tabletColors)
  const condition = pick(conditions)
  const qty = rand(1, 4)
  const storageAdj = storage === '256GB' ? 60000 : storage === '512GB' ? 130000 : 0
  tabletRows.push([
    m.name, m.brand, 'Tablets',
    color, storage, '',
    condition,
    qty,
    m.cost + storageAdj,
    m.sell + Math.round(storageAdj * 1.2),
    pick(suppliers),
    date(rand(1, 60)),
    '',
    '',
  ])
}

// ── BUILD WORKBOOK ───────────────────────────────────────────────────────────
const header = [
  'Product Name', 'Brand', 'Category', 'Color', 'Storage', 'RAM',
  'Condition', 'Qty', 'Cost Price', 'Sell Price',
  'Supplier', 'Date Received', 'Notes', 'IMEI (comma-separated)',
]

const allRows = [header, ...phoneRows, ...laptopRows, ...accRows, ...tabletRows]

const ws = XLSX.utils.aoa_to_sheet(allRows)

// Column widths
ws['!cols'] = [
  { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 6 },
  { wch: 10 }, { wch: 5 }, { wch: 12 }, { wch: 12 },
  { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 40 },
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Batch Import')

const outPath = path.join(__dirname, '..', 'techmart-sample-100.xlsx')
XLSX.writeFile(wb, outPath)

const total = phoneRows.length + laptopRows.length + accRows.length + tabletRows.length
console.log(`✓ Generated ${total} rows → techmart-sample-100.xlsx`)
console.log(`  ${phoneRows.length} phones · ${laptopRows.length} laptops · ${accRows.length} accessories · ${tabletRows.length} tablets`)
