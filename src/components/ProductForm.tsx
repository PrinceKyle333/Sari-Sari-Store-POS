import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Plus,
  ScanBarcode,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  PRODUCT_UNITS,
  type Product,
  type ProductUnit,
  type ScannerSettings,
} from '../types/pos';
import { formatPHP } from '../utils/format';
import { compressProductPhoto } from '../utils/imageCompress';
import {
  calculateProfitAndMarkup,
  generateInternalBarcode,
  isBarcodeDuplicate,
} from '../utils/posLogic';
import { BarcodeScanner } from './BarcodeScanner';

interface ProductFormProps {
  open: boolean;
  editingProduct: Product | null;
  initialBarcode?: string;
  allProducts: Product[];
  categories: string[];
  defaultLowStockThreshold: number;
  scannerSettings: ScannerSettings;
  onAddCategory: (category: string) => void;
  onSave: (data: Omit<Product, 'id' | 'updatedAt'>, existingId?: string) => void;
  onClose: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  open,
  editingProduct,
  initialBarcode = '',
  allProducts,
  categories,
  defaultLowStockThreshold,
  scannerSettings,
  onAddCategory,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<string>(categories[0] ?? 'Snacks');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [unit, setUnit] = useState<ProductUnit>('piece');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [piecePrice, setPiecePrice] = useState('');
  const [piecesPerPack, setPiecesPerPack] = useState('10');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(defaultLowStockThreshold)
  );
  const [supplierName, setSupplierName] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingProduct) {
      setName(editingProduct.name);
      setBarcode(editingProduct.barcode ?? '');
      setCategory(editingProduct.category);
      setPhotoDataUrl(editingProduct.photoDataUrl);
      setUnit(editingProduct.unit ?? 'piece');
      setCostPrice(String(editingProduct.costPrice));
      setSellingPrice(String(editingProduct.sellingPrice));
      setPiecePrice(
        editingProduct.piecePrice !== undefined
          ? String(editingProduct.piecePrice)
          : ''
      );
      setPiecesPerPack(
        editingProduct.piecesPerPack !== undefined
          ? String(editingProduct.piecesPerPack)
          : '10'
      );
      setStock(String(editingProduct.stock));
      setLowStockThreshold(String(editingProduct.lowStockThreshold));
      setSupplierName(editingProduct.supplierName ?? '');
      setExpirationDate(editingProduct.expirationDate ?? '');
    } else {
      setName('');
      setBarcode(initialBarcode);
      setCategory(categories[0] ?? 'Snacks');
      setPhotoDataUrl(undefined);
      setUnit('piece');
      setCostPrice('');
      setSellingPrice('');
      setPiecePrice('');
      setPiecesPerPack('10');
      setStock('0');
      setLowStockThreshold(String(defaultLowStockThreshold));
      setSupplierName('');
      setExpirationDate('');
    }
    setShowNewCategory(false);
    setNewCategoryInput('');
    setError(null);
    setScannerOpen(false);
  }, [open, editingProduct, initialBarcode, categories, defaultLowStockThreshold]);

  if (!open) return null;

  const duplicateProduct = isBarcodeDuplicate(
    allProducts,
    barcode,
    editingProduct?.id
  );

  const parsedCost = parseFloat(costPrice);
  const parsedSell = parseFloat(sellingPrice);
  const costNum = Number.isFinite(parsedCost) ? parsedCost : 0;
  const sellNum = Number.isFinite(parsedSell) ? parsedSell : 0;
  const profitInfo = calculateProfitAndMarkup(costNum, sellNum);

  const hasPiecePrice = piecePrice.trim() !== '' && Number(piecePrice) > 0;
  const parsedPpp = Math.max(1, parseInt(piecesPerPack || '10', 10) || 10);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCompressingPhoto(true);
    try {
      const compressed = await compressProductPhoto(file, 320, 0.72);
      setPhotoDataUrl(compressed);
    } catch {
      setError('Could not process photo. Try another image.');
    } finally {
      setCompressingPhoto(false);
    }
  };

  const handleAddCategorySubmit = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    setCategory(trimmed);
    setNewCategoryInput('');
    setShowNewCategory(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }
    if (duplicateProduct) {
      setError(
        `Barcode already belongs to "${duplicateProduct.name}". Barcodes must be unique.`
      );
      return;
    }
    if (!Number.isFinite(parsedSell) || parsedSell <= 0) {
      setError('Selling price must be greater than 0.');
      return;
    }

    const finalCost =
      Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0;
    const stockVal = Math.max(0, parseInt(stock || '0', 10) || 0);
    const thresholdVal = Math.max(
      0,
      parseInt(lowStockThreshold || String(defaultLowStockThreshold), 10) || 0
    );
    const pieceVal = parseFloat(piecePrice);

    onSave(
      {
        name: trimmedName,
        barcode: barcode.trim() || undefined,
        category,
        photoDataUrl,
        unit,
        costPrice: Number(finalCost.toFixed(2)),
        sellingPrice: Number(parsedSell.toFixed(2)),
        piecePrice:
          piecePrice.trim() !== '' && Number.isFinite(pieceVal) && pieceVal > 0
            ? Number(pieceVal.toFixed(2))
            : undefined,
        piecesPerPack:
          piecePrice.trim() !== '' && Number.isFinite(pieceVal) && pieceVal > 0
            ? parsedPpp
            : undefined,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        supplierName: supplierName.trim() || undefined,
        expirationDate: expirationDate.trim() || undefined,
      },
      editingProduct?.id
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label={editingProduct ? 'Edit Product' : 'Add Product'}
      >
        <div className="w-full max-w-[420px] rounded-t-3xl bg-white p-4 shadow-xl max-h-[92vh] overflow-y-auto pb-safe">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h2 className="text-lg font-bold text-stone-900">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product form"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Barcode with Rescan & Generate Code */}
            <div>
              <label
                htmlFor="prod-barcode"
                className="block text-sm font-semibold text-stone-700"
              >
                Barcode
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="prod-barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or generate code"
                  className={`min-h-[48px] min-w-0 flex-1 rounded-xl border px-3 font-mono-num text-sm text-stone-900 focus:outline-none ${
                    duplicateProduct
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-stone-300 focus:border-emerald-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex min-h-[48px] items-center gap-1 rounded-xl border border-stone-300 bg-stone-50 px-3 text-xs font-bold text-stone-900 hover:bg-stone-100 shrink-0"
                >
                  <ScanBarcode className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>{barcode ? 'Rescan' : 'Scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBarcode(generateInternalBarcode(allProducts))}
                  aria-label="Generate internal barcode"
                  className="flex min-h-[48px] items-center gap-1 rounded-xl border border-stone-300 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shrink-0"
                >
                  <Wand2 className="h-4 w-4 text-stone-600" aria-hidden="true" />
                  <span>Auto</span>
                </button>
              </div>
              {duplicateProduct && (
                <p
                  role="alert"
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Barcode already used by &ldquo;{duplicateProduct.name}&rdquo;.
                  </span>
                </p>
              )}
            </div>

            {/* Product Name */}
            <div>
              <label
                htmlFor="prod-name"
                className="block text-sm font-semibold text-stone-700"
              >
                Product Name *
              </label>
              <input
                id="prod-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lucky Me! Pancit Canton"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3.5 text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            {/* Category + Add Category */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="prod-category"
                  className="block text-sm font-semibold text-stone-700"
                >
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCategory((v) => !v)}
                  className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>New category</span>
                </button>
              </div>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 bg-white px-3.5 text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {showNewCategory && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    aria-label="New category name"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="e.g. Frozen Goods"
                    className="min-h-[44px] flex-1 rounded-xl border border-stone-300 px-3 text-sm text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategorySubmit}
                    className="min-h-[44px] rounded-xl bg-stone-900 px-4 text-xs font-bold text-white"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Product Photo + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-sm font-semibold text-stone-700">
                  Photo (Optional)
                </span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handlePhotoChange(e)}
                  className="hidden"
                />
                {photoDataUrl ? (
                  <div className="mt-1 flex items-center gap-2">
                    <img
                      src={photoDataUrl}
                      alt={name || 'Product preview'}
                      className="h-12 w-12 rounded-xl border border-stone-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl(undefined)}
                      aria-label="Remove product photo"
                      className="flex h-12 min-w-[44px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={compressingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                  >
                    <Camera className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <span>{compressingPhoto ? 'Saving...' : 'Take Photo'}</span>
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="prod-unit"
                  className="block text-sm font-semibold text-stone-700"
                >
                  Unit
                </label>
                <select
                  id="prod-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as ProductUnit)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 capitalize focus:border-emerald-700 focus:outline-none"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cost & Selling Price + Live Profit & Markup */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prod-cost-price"
                    className="block text-sm font-semibold text-stone-700"
                  >
                    Cost Price (₱)
                  </label>
                  <input
                    id="prod-cost-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prod-selling-price"
                    className="block text-sm font-semibold text-stone-700"
                  >
                    Selling Price (₱) *
                  </label>
                  <input
                    id="prod-selling-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className={`mt-1 min-h-[48px] w-full rounded-xl border px-3 font-mono-num text-base font-bold focus:outline-none ${
                      profitInfo.isLoss && sellingPrice !== ''
                        ? 'border-red-500 text-red-700 focus:border-red-600'
                        : 'border-stone-300 text-stone-900 focus:border-emerald-700'
                    }`}
                  />
                </div>
              </div>

              {(costPrice !== '' || sellingPrice !== '') && (
                <div
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
                    profitInfo.isLoss
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  <span>
                    {profitInfo.isLoss
                      ? 'Selling below cost!'
                      : 'Profit per unit'}
                  </span>
                  <span className="font-mono-num">
                    {formatPHP(profitInfo.profit)} ({profitInfo.markupPercent}% markup)
                  </span>
                </div>
              )}
            </div>

            {/* Optional Retail Price Per Piece + Pieces per Pack */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="prod-piece-price"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Per-Piece Price (Opt ₱)
                  </label>
                  <input
                    id="prod-piece-price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={piecePrice}
                    onChange={(e) => setPiecePrice(e.target.value)}
                    placeholder="e.g. 10.00"
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 bg-white px-3 font-mono-num text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prod-pieces-per-pack"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Pieces per Pack
                  </label>
                  <input
                    id="prod-pieces-per-pack"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    disabled={!hasPiecePrice}
                    value={piecesPerPack}
                    onChange={(e) => setPiecesPerPack(e.target.value)}
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 bg-white px-3 font-mono-num text-base text-stone-900 focus:border-emerald-700 focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
                  />
                </div>
              </div>
              <p className="text-[11px] leading-snug text-stone-600">
                {hasPiecePrice
                  ? `Stock is tracked in pieces. Selling 1 ${unit} deducts ${parsedPpp} pcs.`
                  : 'For packs/boxes sold loose per piece (cigarettes, sachets).'}
              </p>
            </div>

            {/* Stock & Low-Stock Alert Level */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="prod-stock"
                  className="block text-sm font-semibold text-stone-700"
                >
                  {hasPiecePrice ? 'Stock (Pieces)' : 'Stock Quantity'}
                </label>
                <input
                  id="prod-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="prod-low-stock"
                  className="block text-sm font-semibold text-stone-700"
                >
                  Low-Stock Alert
                </label>
                <input
                  id="prod-low-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Supplier & Expiration Date (Optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="prod-supplier"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Supplier (Optional)
                </label>
                <input
                  id="prod-supplier"
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Puregold"
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="prod-expiry"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Expiration (Optional)
                </label>
                <input
                  id="prod-expiry"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-2.5 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!!duplicateProduct}
              className="min-h-[54px] w-full rounded-xl bg-emerald-700 px-4 text-base font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {editingProduct ? 'Save Changes' : 'Save Product'}
            </button>
          </form>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        title="Scan Product Barcode"
        scannerSettings={scannerSettings}
        onDetected={(code) => setBarcode(code)}
        onClose={() => setScannerOpen(false)}
      />
    </>
  );
};
