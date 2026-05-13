import * as XLSX from 'xlsx'

export const downloadImportTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Product Name', 'Brand', 'Category', 'Color', 'Storage', 'RAM', 'Condition', 'Qty', 'Cost Price', 'Sell Price', 'Supplier', 'Date Received', 'Notes', 'IMEI (comma-separated)'],
    ['iPhone 15', 'Apple', 'Phones', 'Black', '128GB', '', 'New', 2, 250000, 350000, 'Alaba Market', '2024-05-01', '', '351756012345678,351756012345679'],
    ['iPhone 15', 'Apple', 'Phones', 'Blue', '128GB', '', 'New', 1, 250000, 350000, 'Alaba Market', '2024-05-01', '', '351756012345680'],
    ['iPhone 15', 'Apple', 'Phones', 'Black', '256GB', '', 'New', 2, 310000, 420000, 'Alaba Market', '2024-05-01', '', '351756012345681,351756012345682'],
    ['MacBook Air M2', 'Apple', 'Laptops', '', '', '8GB', 'New', 3, 1200000, 1500000, 'Computer Village', '2024-05-01', '', ''],
    ['USB-C Cable', 'Anker', 'Accessories', '', '', '', 'New', 50, 2000, 3500, 'Alaba Market', '2024-05-01', 'Braided', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Batch Import')
  XLSX.writeFile(wb, 'techmart-import-template.xlsx')
}
