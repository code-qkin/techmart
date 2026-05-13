import React, { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Download, Upload, FileSpreadsheet, CheckCircle2,
  AlertCircle, ArrowRight, Loader2, Package, Pencil, Trash2, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { formatNaira, cn } from '../lib/utils'
import type { Product, ProductVariant } from '../types'

// ── helpers ────────────────────────────────────────────────────────────────

const makeVariantKey = (v: { color?: string; storage?: string; ram?: string; condition?: string }) =>
  [v.color, v.storage, v.ram, v.condition].filter(Boolean).join('|').toLowerCase()

const parseCategory = (s: string): Product['category'] => {
  const l = s.toLowerCase()
  if (l.includes('phone') || l.includes('mobile')) return 'Phones'
  if (l.includes('laptop') || l.includes('computer')) return 'Laptops'
  if (l.includes('tablet') || l.includes('ipad')) return 'Tablets'
  return 'Accessories'
}


const parseCondition = (s: string): 'New' | 'Open Box' | 'Pre-owned' => {
  const l = s?.toLowerCase() || ''
  if (l.includes('open')) return 'Open Box'
  if (l.includes('pre') || l.includes('used') || l.includes('refurb')) return 'Pre-owned'
  return 'New'
}

const parseDate = (val: unknown): string => {
  const today = new Date().toISOString().split('T')[0]
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0]
  if (typeof val === 'number' && val > 1000) {
    const d = new Date((val - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? today : d.toISOString().split('T')[0]
  }
  const str = String(val || '').trim()
  if (!str) return today
  const d = new Date(str)
  return isNaN(d.getTime()) ? today : d.toISOString().split('T')[0]
}

// ── types ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  productName: string
  brand: string
  category: Product['category']
  color?: string
  storage?: string
  ram?: string
  condition: 'New' | 'Open Box' | 'Pre-owned'
  quantity: number
  costPrice: number
  sellPrice?: number
  supplier?: string
  dateReceived: string
  notes?: string
  variantKey: string
  imeis: string[]
}

interface ProductGroup {
  productName: string
  brand: string
  category: Product['category']
  isNew: boolean
  existingProduct?: Product
  isVariantProduct: boolean
  variantKeys: string[]
  newVariantKeys: string[]
  rows: ParsedRow[]
}

interface ExcelImportProps {
  products: Product[]
  onClose: () => void
}

// ── component ──────────────────────────────────────────────────────────────

export const ExcelImport: React.FC<ExcelImportProps> = ({ products, onClose }) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProductGroup[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [editingRow, setEditingRow] = useState<{ gi: number; ri: number } | null>(null)
  const [editRowData, setEditRowData] = useState<{ quantity?: number; costPrice?: number; sellPrice?: number }>({})
  const [importedImeis, setImportedImeis] = useState(0)

  const deletePreviewRow = (gi: number, ri: number) => {
    setPreview(prev =>
      prev
        ?.map((g, i) => i !== gi ? g : { ...g, rows: g.rows.filter((_, j) => j !== ri) })
        .filter(g => g.rows.length > 0) ?? null
    )
  }

  const saveEditRow = (gi: number, ri: number) => {
    setPreview(prev =>
      prev?.map((g, i) => i !== gi ? g : {
        ...g,
        rows: g.rows.map((r, j) => j !== ri ? r : {
          ...r,
          quantity: editRowData.quantity ?? r.quantity,
          costPrice: editRowData.costPrice ?? r.costPrice,
          sellPrice: editRowData.sellPrice ?? r.sellPrice,
        }),
      }) ?? null
    )
    setEditingRow(null)
    setEditRowData({})
  }

  // ── template download ────────────────────────────────────────────────────

  const downloadTemplate = () => {
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

  // ── parse ────────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

        if (rawRows.length < 2) {
          setParseErrors(['File appears to be empty or has no data rows.'])
          return
        }

        const headers = (rawRows[0] as unknown[]).map(h => String(h).toLowerCase().trim())

        const col = (row: unknown[], ...names: string[]): string => {
          for (const name of names) {
            const idx = headers.indexOf(name)
            if (idx >= 0 && row[idx] !== '') return String(row[idx] || '').trim()
          }
          return ''
        }

        const colRaw = (row: unknown[], ...names: string[]): unknown => {
          for (const name of names) {
            const idx = headers.indexOf(name)
            if (idx >= 0 && row[idx] !== '') return row[idx]
          }
          return ''
        }

        const errors: string[] = []
        const parsed: ParsedRow[] = []

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i] as unknown[]
          const productName = col(row, 'product name')
          if (!productName) continue

          const qty = Number(col(row, 'qty', 'quantity')) || 0
          if (qty <= 0) {
            errors.push(`Row ${i + 1} (${productName}): Qty is 0 or missing — skipped`)
            continue
          }

          const color = col(row, 'color') || undefined
          const storage = col(row, 'storage') || undefined
          const ram = col(row, 'ram') || undefined
          const condition = parseCondition(col(row, 'condition'))

          // Flexible IMEI column: matches any header containing 'imei' or 'serial'
          const imeiColIdx = headers.findIndex(h => h.includes('imei') || h.includes('serial'))
          const rawImei = imeiColIdx >= 0 && row[imeiColIdx] !== '' ? String(row[imeiColIdx] || '').trim() : ''
          const imeis = rawImei
            ? rawImei.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
            : []

          const notes = col(row, 'notes', 'note') || undefined

          // Fallback: if no dedicated IMEI column, extract 15-digit IMEI numbers from notes
          if (imeis.length === 0 && notes) {
            const fromNotes = notes.match(/\b\d{14,16}\b/g) || []
            imeis.push(...fromNotes)
          }

          parsed.push({
            productName,
            brand: col(row, 'brand'),
            category: parseCategory(col(row, 'category')),
            color,
            storage,
            ram,
            condition,
            quantity: qty,
            costPrice: Number(col(row, 'cost price', 'cost')) || 0,
            sellPrice: Number(col(row, 'sell price', 'sell price', 'price', 'sell')) || undefined,
            supplier: col(row, 'supplier') || undefined,
            dateReceived: parseDate(colRaw(row, 'date received', 'date')),
            notes,
            variantKey: [color, storage, ram, condition].filter(Boolean).join('|').toLowerCase(),
            imeis,
          })
        }

        setParseErrors(errors)

        if (parsed.length === 0) {
          setParseErrors(prev => [...prev, 'No valid rows found. Make sure Qty column is filled.'])
          return
        }

        // Build preview groups
        const groupMap = new Map<string, ParsedRow[]>()
        for (const row of parsed) {
          const key = row.productName.toLowerCase()
          if (!groupMap.has(key)) groupMap.set(key, [])
          groupMap.get(key)!.push(row)
        }

        const groups: ProductGroup[] = []
        for (const [, rows] of groupMap) {
          const productName = rows[0].productName
          const existing = products.find(p => p.name.toLowerCase() === productName.toLowerCase())
          const isVariantProduct = rows.some(r => r.color || r.storage || r.ram)
          const variantKeys = [...new Set(rows.map(r => r.variantKey))]

          let newVariantKeys: string[] = []
          if (existing && isVariantProduct) {
            const existingKeys = new Set((existing.variants || []).map(v => makeVariantKey(v)))
            newVariantKeys = variantKeys.filter(k => k && !existingKeys.has(k))
          } else if (isVariantProduct) {
            newVariantKeys = variantKeys.filter(Boolean)
          }

          groups.push({
            productName,
            brand: rows[0].brand,
            category: rows[0].category,
            isNew: !existing,
            existingProduct: existing,
            isVariantProduct,
            variantKeys,
            newVariantKeys,
            rows,
          })
        }

        setPreview(groups)
      } catch (err) {
        setParseErrors([`Could not read file: ${err instanceof Error ? err.message : 'Unknown error'}`])
      }
    }
    reader.readAsArrayBuffer(file)
  }, [products])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  // ── import ───────────────────────────────────────────────────────────────

  const runImport = async () => {
    if (!preview) return
    setImporting(true)
    setImportProgress(0)
    setImportedImeis(0)

    const deliveryId = crypto.randomUUID()
    let totalImeiCount = 0

    try {
      for (let gi = 0; gi < preview.length; gi++) {
        const group = preview[gi]
        let productId: string
        let finalVariants: ProductVariant[] = []

        if (group.isNew) {
          if (group.isVariantProduct) {
            const seen = new Set<string>()
            for (const row of group.rows) {
              if (!row.variantKey || seen.has(row.variantKey)) continue
              seen.add(row.variantKey)
              finalVariants.push({
                id: crypto.randomUUID(),
                color: row.color,
                storage: row.storage,
                ram: row.ram,
                condition: row.condition,
                stock: 0,
                price: row.sellPrice,
                costPrice: row.costPrice,
              })
            }
          }

          const maxSell = Math.max(...group.rows.map(r => r.sellPrice || 0), 0)
          const { data, error } = await supabase.from('products').insert({
            name: group.productName,
            brand: group.brand || 'Unknown',
            category: group.category,
            emoji: '📦',
            price: maxSell,
            cost_price: group.rows[0]?.costPrice || null,
            stock: 0,
            low_stock_threshold: 5,
            variants: finalVariants,
            supplier: group.rows[0]?.supplier || null,
          }).select().single()

          if (error) throw new Error(`"${group.productName}": ${error.message}`)
          productId = (data as Record<string, unknown>).id as string

        } else {
          productId = group.existingProduct!.id
          finalVariants = [...(group.existingProduct!.variants || [])]

          if (group.isVariantProduct && group.newVariantKeys.length > 0) {
            const seen = new Set(finalVariants.map(v => makeVariantKey(v)))
            for (const row of group.rows) {
              if (!row.variantKey || seen.has(row.variantKey)) continue
              seen.add(row.variantKey)
              finalVariants.push({
                id: crypto.randomUUID(),
                color: row.color,
                storage: row.storage,
                ram: row.ram,
                condition: row.condition,
                stock: 0,
                price: row.sellPrice,
                costPrice: row.costPrice,
              })
            }
            const { error } = await supabase.from('products').update({ variants: finalVariants }).eq('id', productId)
            if (error) throw new Error(`"${group.productName}" variant update: ${error.message}`)
          }
        }

        // variantKey → variantId map
        const variantIdMap = new Map<string, string>()
        for (const v of finalVariants) variantIdMap.set(makeVariantKey(v), v.id)

        // Batch inserts
        const batchInserts = group.rows
          .filter(r => r.quantity > 0)
          .map(r => ({
            product_id: productId,
            variant_id: group.isVariantProduct ? (variantIdMap.get(r.variantKey) ?? null) : null,
            supplier: r.supplier || null,
            quantity_received: r.quantity,
            quantity_remaining: r.quantity,
            cost_price: r.costPrice,
            sell_price: r.sellPrice ?? null,
            received_at: new Date(r.dateReceived).toISOString(),
            notes: r.notes || null,
            delivery_id: deliveryId,
          }))

        if (batchInserts.length > 0) {
          const { error } = await supabase.from('batches').insert(batchInserts)
          if (error) throw new Error(`"${group.productName}" batch insert: ${error.message}`)
        }

        // Stock + units update — work from finalVariants in memory (no re-fetch)
        if (group.isVariantProduct) {
          const stockAdds = new Map<string, number>()
          const unitsToAdd = new Map<string, { imei: string; supplier?: string }[]>()

          for (const r of group.rows.filter(r => r.quantity > 0)) {
            const vid = variantIdMap.get(r.variantKey)
            if (!vid) continue
            stockAdds.set(vid, (stockAdds.get(vid) || 0) + r.quantity)
            if (r.imeis.length > 0) {
              unitsToAdd.set(vid, [
                ...(unitsToAdd.get(vid) || []),
                ...r.imeis.map(imei => ({ imei, supplier: r.supplier || undefined })),
              ])
            }
          }

          const updatedVariants = finalVariants.map(v => {
            const stockAdd = stockAdds.get(v.id) || 0
            const newUnits = unitsToAdd.get(v.id) || []
            if (stockAdd === 0 && newUnits.length === 0) return v
            return {
              ...v,
              stock: (v.stock || 0) + stockAdd,
              units: [...(v.units || []), ...newUnits],
            }
          })

          const imeiCountForProduct = updatedVariants.reduce((s, v) => s + (v.units?.filter(u => u.imei).length || 0), 0)
          totalImeiCount += imeiCountForProduct


          const total = updatedVariants.reduce((s, v) => s + v.stock, 0)
          const { error: stockErr } = await supabase.from('products').update({
            variants: updatedVariants,
            stock: total,
            stock_updated_at: new Date().toISOString(),
          }).eq('id', productId)
          if (stockErr) throw new Error(`"${group.productName}" stock update: ${stockErr.message}`)
        } else {
          const totalQty = group.rows.filter(r => r.quantity > 0).reduce((s, r) => s + r.quantity, 0)
          const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single()
          if (prod) {
            const { error: stockErr } = await supabase.from('products').update({
              stock: (prod as Record<string, unknown>).stock as number + totalQty,
              stock_updated_at: new Date().toISOString(),
            }).eq('id', productId)
            if (stockErr) throw new Error(`"${group.productName}" stock update: ${stockErr.message}`)
          }
        }

        setImportProgress(gi + 1)
      }

      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setImportedImeis(totalImeiCount)
      setDone(true)

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── derived ──────────────────────────────────────────────────────────────

  const totalBatchRows = preview?.reduce((s, g) => s + g.rows.length, 0) ?? 0
  const totalUnits = preview?.reduce((s, g) => s + g.rows.reduce((rs, r) => rs + r.quantity, 0), 0) ?? 0
  const newProducts = preview?.filter(g => g.isNew).length ?? 0
  const updatedProducts = preview?.filter(g => !g.isNew).length ?? 0

  // ── row renderer (used in preview) ───────────────────────────────────────

  const renderPreviewRow = (group: ProductGroup, gi: number, row: ParsedRow, ri: number, tiered: boolean) => {
    const isNewVariant = group.newVariantKeys.includes(row.variantKey)
    const isEditing = editingRow?.gi === gi && editingRow?.ri === ri

    // In tiered mode, storage/RAM is shown in the section header — omit from label
    const variantLabel = [
      row.color,
      !tiered && row.storage,
      !tiered && row.ram,
      row.condition !== 'New' ? row.condition : '',
    ].filter(Boolean).join(' · ') || (group.isVariantProduct ? 'Default' : 'Simple')

    return (
      <div key={ri} className={cn(
        'grid grid-cols-[1fr_52px_82px_82px_52px] gap-2 px-4 py-2 items-center text-[12px]',
        isNewVariant ? 'bg-emerald-50/40' : 'bg-white'
      )}>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="font-semibold text-navy truncate">{variantLabel}</span>
          {isNewVariant && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase shrink-0">New</span>
          )}
          {row.imeis.length > 0 && (
            <span className="text-[9px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full shrink-0">
              {row.imeis.length} IMEI{row.imeis.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isEditing ? (
          <>
            <input
              type="number" min={1} autoFocus
              defaultValue={row.quantity}
              onChange={e => setEditRowData(d => ({ ...d, quantity: Number(e.target.value) || 1 }))}
              className="w-full h-7 px-1.5 border border-primary rounded-md text-[11px] font-bold text-center outline-none"
            />
            <input
              type="number" min={0}
              defaultValue={row.costPrice}
              onChange={e => setEditRowData(d => ({ ...d, costPrice: Number(e.target.value) }))}
              className="w-full h-7 px-1.5 border border-primary rounded-md text-[11px] font-bold text-orange-600 outline-none"
            />
            <input
              type="number" min={0}
              defaultValue={row.sellPrice ?? ''}
              onChange={e => setEditRowData(d => ({ ...d, sellPrice: Number(e.target.value) || undefined }))}
              className="w-full h-7 px-1.5 border border-primary rounded-md text-[11px] font-bold text-primary outline-none"
            />
            <div className="flex items-center gap-0.5">
              <button onClick={() => saveEditRow(gi, ri)} className="w-6 h-6 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 transition-colors">
                <Check size={12} />
              </button>
              <button onClick={() => setEditingRow(null)} className="w-6 h-6 flex items-center justify-center rounded text-gray hover:bg-gray-100 transition-colors">
                <X size={12} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="font-bold text-navy">{row.quantity}</span>
            <span className="font-bold text-orange-600">{row.costPrice > 0 ? formatNaira(row.costPrice) : '—'}</span>
            <span className="font-bold text-primary">{row.sellPrice ? formatNaira(row.sellPrice) : '—'}</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { setEditingRow({ gi, ri }); setEditRowData({}) }}
                className="w-6 h-6 flex items-center justify-center rounded text-gray/40 hover:text-primary hover:bg-primary/5 transition-colors"
                title="Edit row"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => deletePreviewRow(gi, ri)}
                className="w-6 h-6 flex items-center justify-center rounded text-gray/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove row"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="h-1 w-full bg-primary shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-[17px] font-bold text-navy">Import from Excel</h3>
            <p className="text-[12px] text-gray mt-0.5">
              {done ? 'Import complete' : preview ? 'Review what will be created' : 'Upload your filled template'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── DONE ── */}
        {done && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-[18px] font-bold text-navy">Import complete</p>
              <p className="text-[13px] text-gray mt-1">
                {newProducts > 0 && `${newProducts} new product${newProducts !== 1 ? 's' : ''} created`}
                {newProducts > 0 && updatedProducts > 0 && ' · '}
                {updatedProducts > 0 && `${updatedProducts} existing product${updatedProducts !== 1 ? 's' : ''} updated`}
                {' · '}
                {totalBatchRows} batch record{totalBatchRows !== 1 ? 's' : ''} · {totalUnits} units
              </p>
              {importedImeis > 0 ? (
                <p className="text-[12px] text-violet-600 font-bold mt-1">{importedImeis} IMEI{importedImeis !== 1 ? 's' : ''} recorded in inventory</p>
              ) : (
                <p className="text-[11px] text-gray/50 mt-1">No IMEIs found — fill the "IMEI (comma-separated)" column to track them</p>
              )}
            </div>
            <button onClick={onClose} className="mt-2 h-11 px-8 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors">
              Done
            </button>
          </div>
        )}

        {/* ── IMPORTING ── */}
        {importing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
            <Loader2 size={32} className="text-primary animate-spin" />
            <div>
              <p className="text-[16px] font-bold text-navy">Importing…</p>
              <p className="text-[13px] text-gray mt-1">{importProgress} of {preview!.length} products</p>
            </div>
            <div className="w-full max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(importProgress / preview!.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {!done && !importing && preview && (
          <>
            {/* Summary bar */}
            <div className="px-6 py-3 bg-primary/5 border-b border-border shrink-0 flex items-center gap-5 flex-wrap">
              {newProducts > 0 && (
                <span className="text-[12px] font-bold text-emerald-600">
                  {newProducts} new product{newProducts !== 1 ? 's' : ''}
                </span>
              )}
              {updatedProducts > 0 && (
                <span className="text-[12px] font-bold text-amber-600">
                  {updatedProducts} existing (adding variants/batches)
                </span>
              )}
              <span className="text-[12px] text-gray/60">{totalBatchRows} batch rows · {totalUnits} total units</span>
            </div>

            {/* Group cards */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
              {parseErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={12} /> Skipped rows
                  </p>
                  {parseErrors.map((e, i) => <p key={i} className="text-[11px] text-amber-600">{e}</p>)}
                </div>
              )}

              {preview.map((group, gi) => {
                // Determine tier dimension (storage > ram > none)
                const dim = group.isVariantProduct && group.rows.some(r => r.storage)
                  ? 'storage'
                  : group.isVariantProduct && group.rows.some(r => r.ram)
                    ? 'ram'
                    : null
                const getDimVal = (r: ParsedRow) => dim === 'storage' ? r.storage : dim === 'ram' ? r.ram : undefined
                const tiers = dim ? [...new Set(group.rows.map(getDimVal).filter(Boolean))] as string[] : null

                return (
                  <div key={group.productName} className="bg-gray-50 border border-border rounded-xl overflow-hidden">
                    {/* Product header */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-white">
                      <Package size={15} className="text-gray/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-bold text-navy">{group.productName}</span>
                        <span className="text-[11px] text-gray/50 ml-2">{group.brand} · {group.category}</span>
                      </div>
                      {group.isNew ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">New product</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Exists — updating</span>
                      )}
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-gray-100">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_52px_82px_82px_52px] gap-2 px-4 py-1.5 bg-gray-100/60 text-[9px] font-bold text-gray/50 uppercase tracking-widest">
                        <span>{group.isVariantProduct ? 'Variant' : 'Product'}</span>
                        <span>Qty</span>
                        <span>Cost</span>
                        <span>Sell</span>
                        <span />
                      </div>

                      {tiers
                        ? tiers.map(tier => {
                            const tierRows = group.rows.filter(r => getDimVal(r) === tier)
                            return (
                              <React.Fragment key={tier}>
                                {/* Storage / RAM tier header */}
                                <div className="px-4 py-1 bg-gray-100/80 text-[10px] font-bold text-gray/60 uppercase tracking-widest flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-gray/20 inline-block" />
                                  {tier}
                                </div>
                                {tierRows.map(row => renderPreviewRow(group, gi, row, group.rows.indexOf(row), true))}
                              </React.Fragment>
                            )
                          })
                        : group.rows.map((row, ri) => renderPreviewRow(group, gi, row, ri, false))
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0">
              <button
                onClick={() => { setPreview(null); setFileName(null); setParseErrors([]) }}
                className="h-11 px-5 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={runImport}
                className="ml-auto h-11 px-6 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                Import {preview.length} product{preview.length !== 1 ? 's' : ''} <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}

        {/* ── UPLOAD ── */}
        {!done && !importing && !preview && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {/* Template download */}
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-bold text-navy">Step 1 — Download the template</p>
                  <p className="text-[11px] text-gray mt-0.5">Fill in your products, variants and quantities. Same product name across rows = same product.</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 h-9 px-4 bg-primary text-white rounded-lg font-bold text-[12px] hover:bg-primary-dark transition-colors shrink-0"
                >
                  <Download size={13} /> Template
                </button>
              </div>

              {/* Column guide */}
              <div className="bg-gray-50 border border-border rounded-xl p-4 space-y-2">
                <p className="text-[11px] font-bold text-navy uppercase tracking-wider">Column guide</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                  {[
                    ['Product Name', 'Required. Same name = same product'],
                    ['Brand', 'e.g. Apple, Samsung'],
                    ['Category', 'Phones / Laptops / Tablets / Accessories'],
                    ['Color', 'Optional — creates a variant'],
                    ['Storage', 'Optional — creates a variant'],
                    ['RAM', 'Optional — creates a variant'],
                    ['Condition', 'New / Open Box / Pre-owned'],
                    ['Qty', 'Required. Units received'],
                    ['Cost Price', 'What you paid per unit'],
                    ['Sell Price', 'Selling price per unit'],
                    ['Supplier', 'Supplier name'],
                    ['Date Received', 'YYYY-MM-DD or DD/MM/YYYY'],
                    ['IMEI (comma-separated)', 'Optional. One IMEI per unit, comma-separated'],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex gap-2">
                      <span className="font-bold text-navy shrink-0">{col}</span>
                      <span className="text-gray/60">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div>
                <p className="text-[11px] font-bold text-navy uppercase tracking-wider mb-2">Step 2 — Upload your filled file</p>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all',
                    dragging ? 'border-primary bg-primary/5' : fileName ? 'border-emerald-400 bg-emerald-50/40' : 'border-border hover:border-primary/40 hover:bg-gray-50'
                  )}
                >
                  {fileName ? (
                    <>
                      <FileSpreadsheet size={28} className="text-emerald-500" />
                      <p className="text-[13px] font-bold text-navy">{fileName}</p>
                      <p className="text-[11px] text-gray/50">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <Upload size={28} className={cn('transition-colors', dragging ? 'text-primary' : 'text-gray/30')} />
                      <p className="text-[13px] font-bold text-navy">Drop your .xlsx file here</p>
                      <p className="text-[11px] text-gray/50">or click to browse</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              </div>

              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                  {parseErrors.map((e, i) => (
                    <p key={i} className="text-[12px] text-red-600 flex items-start gap-1.5">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" /> {e}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
              <button onClick={onClose} className="h-11 px-5 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
