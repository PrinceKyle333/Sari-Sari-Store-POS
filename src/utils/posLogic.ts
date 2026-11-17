import {
  DEFAULT_CATEGORIES,
  type CartItem,
  type CreditPayment,
  type POSState,
  type Product,
  type ProductSortOption,
  type ReportDateRange,
  type Sale,
  type SaleUnit,
  type StockMovement,
} from '../types/pos';
import { toLocalDateKey } from './format';

import { DEFAULT_STAFF } from './ewalletLogic';

export const DEFAULT_POS_STATE: POSState = {
  products: [],
  stockMovements: [],
  sales: [],
  creditPayments: [],
  categories: [...DEFAULT_CATEGORIES],
  settings: {
    storeName: 'My Sari-Sari Store',
    defaultLowStockThreshold: 5,
    scanner: {
      beepEnabled: true,
      vibrationEnabled: true,
      preferredCamera: 'environment',
    },
  },
  staff: DEFAULT_STAFF,
  activeStaffId: DEFAULT_STAFF[0].id,
  storeShift: {
    isOpen: false,
  },
  ewalletTransactions: [],
  ewalletSessions: [],
  auditLogs: [],
  syncQueue: [],
};

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateInternalBarcode(products: Product[]): string {
  const existing = new Set(products.map((p) => (p.barcode ?? '').trim()));
  for (let i = 0; i < 20; i++) {
    const suffix = String(Math.floor(100000 + Math.random() * 900000));
    const code = `INT-${suffix}`;
    if (!existing.has(code)) return code;
  }
  return `INT-${Date.now().toString().slice(-6)}`;
}

export function calculateProfitAndMarkup(
  costPrice: number,
  sellingPrice: number
): { profit: number; markupPercent: number; isLoss: boolean } {
  const cost = Number.isFinite(costPrice) ? costPrice : 0;
  const sell = Number.isFinite(sellingPrice) ? sellingPrice : 0;
  const profit = Number((sell - cost).toFixed(2));
  const markupPercent =
    cost > 0 ? Number((((sell - cost) / cost) * 100).toFixed(1)) : sell > 0 ? 100 : 0;
  return {
    profit,
    markupPercent,
    isLoss: sell < cost,
  };
}

export type ExpiryStatus = 'none' | 'ok' | 'expiring_soon' | 'expired';

export function getExpiryStatus(
  expirationDate?: string,
  now = new Date()
): { status: ExpiryStatus; daysLeft?: number } {
  if (!expirationDate || !expirationDate.trim()) {
    return { status: 'none' };
  }
  const todayStr = toLocalDateKey(now);
  const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
  const expMs = new Date(`${expirationDate}T00:00:00`).getTime();
  if (Number.isNaN(expMs)) return { status: 'none' };

  const daysLeft = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= 30) return { status: 'expiring_soon', daysLeft };
  return { status: 'ok', daysLeft };
}

export function getCartItemKey(productId: string, unit: SaleUnit): string {
  return `${productId}::${unit}`;
}

export function getProductStockInCart(cart: CartItem[], productId: string): number {
  return cart
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity * item.stockMultiplier, 0);
}

export function getUnitPricing(
  product: Product,
  unit: SaleUnit
): { unitPrice: number; unitCost: number; stockMultiplier: number; unitLabel: string } {
  if (unit === 'piece' && product.piecePrice !== undefined && product.piecePrice > 0) {
    const ppp = product.piecesPerPack && product.piecesPerPack > 0 ? product.piecesPerPack : 10;
    return {
      unitPrice: product.piecePrice,
      unitCost: Number((product.costPrice / ppp).toFixed(2)),
      stockMultiplier: 1,
      unitLabel: 'Per piece',
    };
  }
  if (unit === 'pack' && product.piecePrice !== undefined && product.piecePrice > 0) {
    const ppp = product.piecesPerPack && product.piecesPerPack > 0 ? product.piecesPerPack : 10;
    return {
      unitPrice: product.sellingPrice,
      unitCost: product.costPrice,
      stockMultiplier: ppp,
      unitLabel: `${product.unit === 'box' ? 'Box' : 'Pack'} (${ppp} pcs)`,
    };
  }
  return {
    unitPrice: product.sellingPrice,
    unitCost: product.costPrice,
    stockMultiplier: 1,
    unitLabel: product.unit,
  };
}

export function addProductToCart(
  cart: CartItem[],
  product: Product,
  requestedUnit?: SaleUnit
): { cart: CartItem[]; error?: string } {
  const hasPieceOption = product.piecePrice !== undefined && product.piecePrice > 0;
  const unit: SaleUnit = requestedUnit ?? (hasPieceOption ? 'piece' : 'unit');

  const { unitPrice, unitCost, stockMultiplier, unitLabel } = getUnitPricing(product, unit);
  const currentlyUsedStock = getProductStockInCart(cart, product.id);

  if (currentlyUsedStock + stockMultiplier > product.stock) {
    return {
      cart,
      error:
        product.stock <= 0
          ? `${product.name} is out of stock`
          : `Not enough stock for ${product.name} (${product.stock} left)`,
    };
  }

  const existingIdx = cart.findIndex(
    (item) => item.productId === product.id && item.unit === unit
  );
  if (existingIdx >= 0) {
    const next = cart.map((item, idx) =>
      idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
    );
    return { cart: next };
  }

  const newItem: CartItem = {
    productId: product.id,
    name: product.name,
    unit,
    unitLabel,
    unitPrice,
    unitCost,
    stockMultiplier,
    quantity: 1,
  };

  return { cart: [...cart, newItem] };
}

export function updateCartItemQuantity(
  cart: CartItem[],
  productId: string,
  unit: SaleUnit,
  delta: number,
  products: Product[]
): { cart: CartItem[]; error?: string } {
  const target = cart.find((c) => c.productId === productId && c.unit === unit);
  if (!target) return { cart };

  const nextQty = target.quantity + delta;
  if (nextQty <= 0) {
    return {
      cart: cart.filter((c) => !(c.productId === productId && c.unit === unit)),
    };
  }

  if (delta > 0) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      const otherUnitsUsed = cart
        .filter((c) => c.productId === productId && c.unit !== unit)
        .reduce((sum, c) => sum + c.quantity * c.stockMultiplier, 0);
      if (otherUnitsUsed + nextQty * target.stockMultiplier > product.stock) {
        return {
          cart,
          error: `Only ${product.stock} left in stock for ${product.name}`,
        };
      }
    }
  }

  return {
    cart: cart.map((c) =>
      c.productId === productId && c.unit === unit ? { ...c, quantity: nextQty } : c
    ),
  };
}

export function calculateCartTotal(cart: CartItem[]): number {
  return Number(
    cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
  );
}

export function calculateCartCost(cart: CartItem[]): number {
  return Number(
    cart.reduce((sum, item) => sum + item.unitCost * item.quantity, 0).toFixed(2)
  );
}

export function calculateChange(total: number, cashReceived: number): number {
  return Number((cashReceived - total).toFixed(2));
}

export function generateReceiptNumber(sales: Sale[]): string {
  const nextNum = 1001 + sales.length;
  return `OR-${nextNum}`;
}

export function completeCheckout(
  state: POSState,
  cart: CartItem[],
  options: {
    paymentMethod: 'cash' | 'credit';
    cashReceived?: number;
    customerName?: string;
    nowIso?: string;
  }
): { nextState: POSState; sale?: Sale; error?: string } {
  if (cart.length === 0) {
    return { nextState: state, error: 'Cart is empty' };
  }

  const total = calculateCartTotal(cart);
  const totalCost = calculateCartCost(cart);

  for (const product of state.products) {
    const needed = getProductStockInCart(cart, product.id);
    if (needed > product.stock) {
      return {
        nextState: state,
        error: `Insufficient stock for ${product.name}`,
      };
    }
  }

  if (options.paymentMethod === 'cash') {
    const cash = options.cashReceived ?? 0;
    if (cash < total) {
      return {
        nextState: state,
        error: 'Cash received is less than total',
      };
    }
  } else {
    const customer = (options.customerName ?? '').trim();
    if (!customer) {
      return {
        nextState: state,
        error: 'Customer name is required for credit sales',
      };
    }
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const receiptNumber = generateReceiptNumber(state.sales);

  const sale: Sale = {
    id: createId('sale'),
    receiptNumber,
    createdAt: nowIso,
    items: cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      stockMultiplier: item.stockMultiplier,
      subtotal: Number((item.unitPrice * item.quantity).toFixed(2)),
    })),
    total,
    totalCost,
    paymentMethod: options.paymentMethod,
    ...(options.paymentMethod === 'cash'
      ? {
          cashReceived: options.cashReceived ?? total,
          change: calculateChange(total, options.cashReceived ?? total),
        }
      : {
          customerName: options.customerName!.trim(),
        }),
  };

  const stockDeductions = new Map<string, number>();
  for (const item of cart) {
    stockDeductions.set(
      item.productId,
      (stockDeductions.get(item.productId) ?? 0) + item.quantity * item.stockMultiplier
    );
  }

  const newMovements: StockMovement[] = [];
  const nextProducts = state.products.map((product) => {
    const deduct = stockDeductions.get(product.id);
    if (!deduct) return product;
    const prevStock = product.stock;
    const nextStock = Math.max(0, prevStock - deduct);
    newMovements.push({
      id: createId('mov'),
      productId: product.id,
      type: 'sale',
      quantityChange: -deduct,
      previousStock: prevStock,
      newStock: nextStock,
      reason: `Sale ${receiptNumber}`,
      createdAt: nowIso,
    });
    return {
      ...product,
      stock: nextStock,
      updatedAt: nowIso,
    };
  });

  return {
    nextState: {
      ...state,
      products: nextProducts,
      stockMovements: [...newMovements, ...state.stockMovements],
      sales: [sale, ...state.sales],
    },
    sale,
  };
}

export function applyStockRestock(
  state: POSState,
  productId: string,
  addQty: number,
  options?: { newCostPrice?: number; note?: string; nowIso?: string }
): { nextState: POSState; error?: string } {
  if (!Number.isFinite(addQty) || addQty <= 0) {
    return { nextState: state, error: 'Restock quantity must be greater than 0' };
  }
  const product = state.products.find((p) => p.id === productId);
  if (!product) {
    return { nextState: state, error: 'Product not found' };
  }

  const nowIso = options?.nowIso ?? new Date().toISOString();
  const prevStock = product.stock;
  const nextStock = prevStock + Math.round(addQty);
  const updatedCost =
    options?.newCostPrice !== undefined &&
    Number.isFinite(options.newCostPrice) &&
    options.newCostPrice >= 0
      ? Number(options.newCostPrice.toFixed(2))
      : product.costPrice;

  const movement: StockMovement = {
    id: createId('mov'),
    productId: product.id,
    type: 'restock',
    quantityChange: Math.round(addQty),
    previousStock: prevStock,
    newStock: nextStock,
    unitCost: updatedCost,
    reason: options?.note?.trim() || 'Restock received',
    createdAt: nowIso,
  };

  return {
    nextState: {
      ...state,
      products: state.products.map((p) =>
        p.id === productId
          ? { ...p, stock: nextStock, costPrice: updatedCost, updatedAt: nowIso }
          : p
      ),
      stockMovements: [movement, ...state.stockMovements],
    },
  };
}

export function applyStockAdjustment(
  state: POSState,
  productId: string,
  deltaQty: number,
  reason: string,
  nowIso = new Date().toISOString()
): { nextState: POSState; error?: string } {
  if (!Number.isFinite(deltaQty) || deltaQty === 0) {
    return { nextState: state, error: 'Adjustment quantity cannot be 0' };
  }
  const cleanedReason = reason.trim();
  if (!cleanedReason) {
    return { nextState: state, error: 'Please select or enter a reason' };
  }
  const product = state.products.find((p) => p.id === productId);
  if (!product) {
    return { nextState: state, error: 'Product not found' };
  }

  const prevStock = product.stock;
  const nextStock = Math.max(0, prevStock + Math.round(deltaQty));
  const actualChange = nextStock - prevStock;

  const movement: StockMovement = {
    id: createId('mov'),
    productId: product.id,
    type: 'adjustment',
    quantityChange: actualChange,
    previousStock: prevStock,
    newStock: nextStock,
    reason: cleanedReason,
    createdAt: nowIso,
  };

  return {
    nextState: {
      ...state,
      products: state.products.map((p) =>
        p.id === productId ? { ...p, stock: nextStock, updatedAt: nowIso } : p
      ),
      stockMovements: [movement, ...state.stockMovements],
    },
  };
}

export function voidSaleTransaction(
  state: POSState,
  saleId: string,
  nowIso = new Date().toISOString()
): POSState {
  const target = state.sales.find((s) => s.id === saleId);
  if (!target || target.voided) return state;

  const restorations = new Map<string, number>();
  for (const item of target.items) {
    restorations.set(
      item.productId,
      (restorations.get(item.productId) ?? 0) + item.quantity * item.stockMultiplier
    );
  }

  const restoreMovements: StockMovement[] = [];
  const nextProducts = state.products.map((p) => {
    const restore = restorations.get(p.id);
    if (!restore) return p;
    const prevStock = p.stock;
    const nextStock = prevStock + restore;
    restoreMovements.push({
      id: createId('mov'),
      productId: p.id,
      type: 'adjustment',
      quantityChange: restore,
      previousStock: prevStock,
      newStock: nextStock,
      reason: `Void ${target.receiptNumber}`,
      createdAt: nowIso,
    });
    return {
      ...p,
      stock: nextStock,
      updatedAt: nowIso,
    };
  });

  const nextSales = state.sales.map((s) =>
    s.id === saleId ? { ...s, voided: true, voidedAt: nowIso } : s
  );

  return {
    ...state,
    products: nextProducts,
    stockMovements: [...restoreMovements, ...state.stockMovements],
    sales: nextSales,
  };
}

export interface CustomerCreditSummary {
  customerName: string;
  totalCredit: number;
  totalPaid: number;
  balance: number;
  creditSales: Sale[];
  payments: CreditPayment[];
  lastActivityAt: string;
}

export function getCustomerCreditSummaries(
  sales: Sale[],
  payments: CreditPayment[]
): CustomerCreditSummary[] {
  const map = new Map<string, CustomerCreditSummary>();

  const getOrCreate = (rawName: string): CustomerCreditSummary => {
    const normalized = rawName.trim();
    const key = normalized.toLowerCase();
    const existing = map.get(key);
    if (existing) return existing;
    const entry: CustomerCreditSummary = {
      customerName: normalized,
      totalCredit: 0,
      totalPaid: 0,
      balance: 0,
      creditSales: [],
      payments: [],
      lastActivityAt: '',
    };
    map.set(key, entry);
    return entry;
  };

  for (const sale of sales) {
    if (sale.voided || sale.paymentMethod !== 'credit' || !sale.customerName) {
      continue;
    }
    const entry = getOrCreate(sale.customerName);
    entry.totalCredit = Number((entry.totalCredit + sale.total).toFixed(2));
    entry.creditSales.push(sale);
    if (!entry.lastActivityAt || sale.createdAt > entry.lastActivityAt) {
      entry.lastActivityAt = sale.createdAt;
    }
  }

  for (const payment of payments) {
    const entry = getOrCreate(payment.customerName);
    entry.totalPaid = Number((entry.totalPaid + payment.amount).toFixed(2));
    entry.payments.push(payment);
    if (!entry.lastActivityAt || payment.createdAt > entry.lastActivityAt) {
      entry.lastActivityAt = payment.createdAt;
    }
  }

  const result = Array.from(map.values()).map((entry) => ({
    ...entry,
    balance: Math.max(0, Number((entry.totalCredit - entry.totalPaid).toFixed(2))),
    creditSales: [...entry.creditSales].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    payments: [...entry.payments].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
  }));

  return result.sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));
}

export function recordCustomerPayment(
  state: POSState,
  customerName: string,
  amount: number,
  note?: string,
  nowIso = new Date().toISOString()
): { nextState: POSState; error?: string } {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return { nextState: state, error: 'Customer name is required' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { nextState: state, error: 'Payment amount must be greater than 0' };
  }

  const summaries = getCustomerCreditSummaries(state.sales, state.creditPayments);
  const customer = summaries.find(
    (c) => c.customerName.toLowerCase() === trimmed.toLowerCase()
  );
  if (!customer || customer.balance <= 0) {
    return { nextState: state, error: 'Customer has no outstanding balance' };
  }

  const clampedAmount = Math.min(amount, customer.balance);
  const payment: CreditPayment = {
    id: createId('pay'),
    customerName: customer.customerName,
    amount: Number(clampedAmount.toFixed(2)),
    createdAt: nowIso,
    note: note?.trim() || undefined,
  };

  return {
    nextState: {
      ...state,
      creditPayments: [payment, ...state.creditPayments],
    },
  };
}

export function filterAndSortProducts(
  products: Product[],
  options: {
    search?: string;
    category?: string;
    sortBy?: ProductSortOption;
  }
): Product[] {
  const q = (options.search ?? '').trim().toLowerCase();
  const category = options.category ?? 'All';
  const sortBy = options.sortBy ?? 'name';

  const filtered = products.filter((p) => {
    const matchesCategory = category === 'All' || p.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode ? p.barcode.toLowerCase().includes(q) : false)
    );
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'stock') {
      return a.stock - b.stock || a.name.localeCompare(b.name);
    }
    if (sortBy === 'expiry') {
      const aExp = a.expirationDate || '9999-12-31';
      const bExp = b.expirationDate || '9999-12-31';
      return aExp.localeCompare(bExp) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

export function findProductByBarcode(
  products: Product[],
  rawBarcode: string
): Product | undefined {
  const code = rawBarcode.trim();
  if (!code) return undefined;
  return products.find((p) => (p.barcode ?? '').trim() === code);
}

export function isBarcodeDuplicate(
  products: Product[],
  rawBarcode: string,
  excludeProductId?: string
): Product | undefined {
  const code = rawBarcode.trim();
  if (!code) return undefined;
  return products.find(
    (p) => p.id !== excludeProductId && (p.barcode ?? '').trim() === code
  );
}

export function getInventoryValuation(products: Product[]): {
  costValue: number;
  sellingValue: number;
  lowStockProducts: Product[];
} {
  let costValue = 0;
  let sellingValue = 0;

  for (const p of products) {
    if (p.stock <= 0) continue;
    if (p.piecePrice !== undefined && p.piecePrice > 0) {
      const ppp = p.piecesPerPack && p.piecesPerPack > 0 ? p.piecesPerPack : 10;
      costValue += p.stock * (p.costPrice / ppp);
      sellingValue += p.stock * p.piecePrice;
    } else {
      costValue += p.stock * p.costPrice;
      sellingValue += p.stock * p.sellingPrice;
    }
  }

  const lowStockProducts = products
    .filter((p) => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));

  return {
    costValue: Number(costValue.toFixed(2)),
    sellingValue: Number(sellingValue.toFixed(2)),
    lowStockProducts,
  };
}

export interface ProductReportPerf {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

export interface ReportSummary {
  totalSales: number;
  transactionCount: number;
  cashSales: number;
  creditSales: number;
  grossProfit: number;
  topSellingProducts: ProductReportPerf[];
  topProfitableProducts: ProductReportPerf[];
  last7Days: Array<{
    dateKey: string;
    label: string;
    total: number;
  }>;
  filteredSales: Sale[];
}

export function getReportSummary(
  sales: Sale[],
  range: ReportDateRange,
  options?: {
    customStart?: string;
    customEnd?: string;
    now?: Date;
  }
): ReportSummary {
  const now = options?.now ?? new Date();
  const todayKey = toLocalDateKey(now);

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  const weekStartKey = toLocalDateKey(startOfWeek);

  const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const filteredSales = sales.filter((sale) => {
    const key = toLocalDateKey(sale.createdAt);
    if (range === 'today') return key === todayKey;
    if (range === 'week') return key >= weekStartKey && key <= todayKey;
    if (range === 'month') return key >= monthStartKey && key <= todayKey;
    const start = options?.customStart || todayKey;
    const end = options?.customEnd || todayKey;
    return key >= start && key <= end;
  });

  const activeSales = filteredSales.filter((s) => !s.voided);

  let totalSales = 0;
  let cashSales = 0;
  let creditSales = 0;
  let totalCost = 0;

  const productPerf = new Map<string, ProductReportPerf>();

  for (const sale of activeSales) {
    totalSales += sale.total;
    totalCost += sale.totalCost;
    if (sale.paymentMethod === 'cash') {
      cashSales += sale.total;
    } else {
      creditSales += sale.total;
    }

    for (const item of sale.items) {
      const itemProfit = Number(
        (item.subtotal - item.unitCost * item.quantity).toFixed(2)
      );
      const existing = productPerf.get(item.productId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue = Number((existing.revenue + item.subtotal).toFixed(2));
        existing.profit = Number((existing.profit + itemProfit).toFixed(2));
      } else {
        productPerf.set(item.productId, {
          productId: item.productId,
          name: item.name,
          quantitySold: item.quantity,
          revenue: item.subtotal,
          profit: itemProfit,
        });
      }
    }
  }

  const allPerf = Array.from(productPerf.values());
  const topSellingProducts = [...allPerf]
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
    .slice(0, 5);
  const topProfitableProducts = [...allPerf]
    .sort((a, b) => b.profit - a.profit || b.revenue - a.revenue)
    .slice(0, 5);

  const last7Days: Array<{ dateKey: string; label: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toLocalDateKey(d);
    const label = d.toLocaleDateString('en-PH', { weekday: 'short' });
    const dayTotal = sales
      .filter((s) => !s.voided && toLocalDateKey(s.createdAt) === key)
      .reduce((sum, s) => sum + s.total, 0);
    last7Days.push({
      dateKey: key,
      label,
      total: Number(dayTotal.toFixed(2)),
    });
  }

  return {
    totalSales: Number(totalSales.toFixed(2)),
    transactionCount: activeSales.length,
    cashSales: Number(cashSales.toFixed(2)),
    creditSales: Number(creditSales.toFixed(2)),
    grossProfit: Number((totalSales - totalCost).toFixed(2)),
    topSellingProducts,
    topProfitableProducts,
    last7Days,
    filteredSales: [...filteredSales].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
  };
}

export function shouldAcceptScan(
  lastScan: { code: string; timestamp: number } | null,
  newCode: string,
  nowMs: number,
  cooldownMs = 1500
): boolean {
  const cleaned = newCode.trim();
  if (!cleaned) return false;
  if (!lastScan) return true;
  if (lastScan.code === cleaned && nowMs - lastScan.timestamp < cooldownMs) {
    return false;
  }
  return true;
}

export function validateBackupPayload(raw: unknown): POSState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<POSState>;
  if (
    !Array.isArray(obj.products) ||
    !Array.isArray(obj.sales) ||
    !Array.isArray(obj.creditPayments)
  ) {
    return null;
  }

  const storeName =
    typeof obj.settings?.storeName === 'string' && obj.settings.storeName.trim()
      ? obj.settings.storeName.trim()
      : DEFAULT_POS_STATE.settings.storeName;

  const defaultThreshold =
    typeof obj.settings?.defaultLowStockThreshold === 'number' &&
    obj.settings.defaultLowStockThreshold >= 0
      ? obj.settings.defaultLowStockThreshold
      : 5;

  const categories =
    Array.isArray(obj.categories) && obj.categories.length > 0
      ? Array.from(new Set([...DEFAULT_CATEGORIES, ...obj.categories]))
      : [...DEFAULT_CATEGORIES];

  const staff =
    Array.isArray(obj.staff) && obj.staff.length > 0 ? obj.staff : DEFAULT_STAFF;
  const activeStaffId =
    typeof obj.activeStaffId === 'string' &&
    staff.some((s) => s.id === obj.activeStaffId && s.active)
      ? obj.activeStaffId
      : staff[0].id;

  return {
    products: obj.products.map((p) => ({
      ...p,
      unit: p.unit ?? 'piece',
    })),
    stockMovements: Array.isArray(obj.stockMovements) ? obj.stockMovements : [],
    sales: obj.sales,
    creditPayments: obj.creditPayments,
    categories,
    settings: {
      storeName,
      defaultLowStockThreshold: defaultThreshold,
      scanner: {
        beepEnabled: obj.settings?.scanner?.beepEnabled ?? true,
        vibrationEnabled: obj.settings?.scanner?.vibrationEnabled ?? true,
        preferredCamera:
          obj.settings?.scanner?.preferredCamera === 'user' ? 'user' : 'environment',
      },
    },
    staff,
    activeStaffId,
    storeShift:
      obj.storeShift && typeof obj.storeShift === 'object'
        ? obj.storeShift
        : { isOpen: false },
    ewalletTransactions: Array.isArray(obj.ewalletTransactions)
      ? obj.ewalletTransactions
      : [],
    ewalletSessions: Array.isArray(obj.ewalletSessions) ? obj.ewalletSessions : [],
    auditLogs: Array.isArray(obj.auditLogs) ? obj.auditLogs : [],
    syncQueue: Array.isArray(obj.syncQueue) ? obj.syncQueue : [],
    lastSyncedAt: typeof obj.lastSyncedAt === 'string' ? obj.lastSyncedAt : undefined,
  };
}
