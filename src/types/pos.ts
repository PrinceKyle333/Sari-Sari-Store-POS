export const DEFAULT_CATEGORIES = [
  'Snacks',
  'Drinks',
  'Canned Goods',
  'Noodles',
  'Condiments',
  'Toiletries',
  'Rice',
  'Cigarettes',
  'Mobile Load',
  'Others',
] as const;

export const PRODUCT_UNITS = [
  'piece',
  'pack',
  'box',
  'sachet',
  'bottle',
  'kilo',
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  photoDataUrl?: string;
  unit: ProductUnit;
  costPrice: number;
  sellingPrice: number;
  piecePrice?: number;
  piecesPerPack?: number;
  stock: number;
  lowStockThreshold: number;
  supplierName?: string;
  expirationDate?: string; // YYYY-MM-DD
  updatedAt: string;
}

export type StockMovementType = 'sale' | 'restock' | 'adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  unitCost?: number;
  reason?: string;
  createdAt: string;
}

export type SaleUnit = 'unit' | 'piece' | 'pack';

export interface CartItem {
  productId: string;
  name: string;
  unit: SaleUnit;
  unitLabel: string;
  unitPrice: number;
  unitCost: number;
  stockMultiplier: number;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  unit: SaleUnit;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  stockMultiplier: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'credit';

export interface Sale {
  id: string;
  receiptNumber: string;
  createdAt: string;
  items: SaleItem[];
  total: number;
  totalCost: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  customerName?: string;
  staffId?: string;
  staffName?: string;
  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
}

export interface CreditPayment {
  id: string;
  customerName: string;
  amount: number;
  createdAt: string;
  note?: string;
  staffName?: string;
}

export interface ScannerSettings {
  beepEnabled: boolean;
  vibrationEnabled: boolean;
  preferredCamera: 'environment' | 'user';
}

export interface StoreSettings {
  storeName: string;
  defaultLowStockThreshold: number;
  scanner: ScannerSettings;
}

// --- Shared Staff, Permissions, Store Shift, Audit & Offline Sync ---

export type StaffRole = 'owner' | 'manager' | 'cashier';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pin: string; // 4-digit PIN
  active: boolean;
  createdAt: string;
}

export interface StoreShift {
  isOpen: boolean;
  openedAt?: string;
  openedByStaffId?: string;
  openedByStaffName?: string;
  closedAt?: string;
  closedByStaffName?: string;
}

export type AuditModule = 'store' | 'pos' | 'ewallet' | 'auth' | 'sync';

export interface AuditLogEntry {
  id: string;
  module: AuditModule;
  action: string;
  details: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  createdAt: string;
}

export type SyncStatus = 'pending' | 'synced' | 'conflict';

export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  entityType: 'pos_sale' | 'ewallet_tx' | 'ewallet_session' | 'store_shift' | 'staff';
  entityId: string;
  operation: 'create' | 'update';
  revision: number;
  payloadSummary: string;
  status: SyncStatus;
  createdAt: string;
  syncedAt?: string;
  conflictReason?: string;
}

// --- E-Wallet Management Module ---

export const EWALLET_PROVIDERS = [
  'GCash',
  'Maya',
  'MariBank',
  'ShopeePay',
  'GoTyme',
  'PalawanPay',
  'Other',
] as const;

export type EWalletProvider = (typeof EWALLET_PROVIDERS)[number];

export const EWALLET_TX_TYPES = [
  'cash_in',
  'cash_out',
  'money_transfer',
  'bills_payment',
  'eload',
  'other',
] as const;

export type EWalletTxType = (typeof EWALLET_TX_TYPES)[number];

export type EWalletTxStatus =
  | 'pending'
  | 'completed'
  | 'claimed'
  | 'cancelled'
  | 'flagged';

export type VerificationMethod =
  | 'none'
  | 'manual_staff'
  | 'authorized_provider';

export interface EWalletTransaction {
  id: string; // Unique internal ID e.g. EW-20261117-0001
  idempotencyKey: string;
  revision: number;
  provider: EWalletProvider;
  customProviderName?: string;
  type: EWalletTxType;
  amount: number;
  serviceFee: number;
  customerName?: string;
  customerMobile?: string;
  referenceNumber: string;
  notes?: string;
  status: EWalletTxStatus;
  verified: boolean;
  verificationMethod: VerificationMethod;
  verifiedAt?: string;
  verifiedByStaffId?: string;
  verifiedByStaffName?: string;
  verificationNote?: string;
  claimedAt?: string;
  claimedByStaffId?: string;
  claimedByStaffName?: string;
  flagReason?: string;
  cancelReason?: string;
  sessionId?: string;
  createdByStaffId: string;
  createdByStaffName: string;
  createdAt: string;
  updatedAt: string;
}

export interface EWalletBalances {
  cashOnHand: number;
  GCash: number;
  Maya: number;
  MariBank: number;
  Other: number;
}

export interface EWalletReconciliationReport {
  expectedBalances: EWalletBalances;
  actualBalances: EWalletBalances;
  discrepancies: EWalletBalances;
  totalCashIn: number;
  totalCashOut: number;
  totalTransfersAndBills: number;
  totalServiceFees: number;
  transactionCount: number;
  pendingCount: number;
  flaggedCount: number;
}

export interface EWalletSession {
  id: string;
  status: 'open' | 'closed';
  openedAt: string;
  openedByStaffId: string;
  openedByStaffName: string;
  startingBalances: EWalletBalances;
  closedAt?: string;
  closedByStaffId?: string;
  closedByStaffName?: string;
  reconciliation?: EWalletReconciliationReport;
  notes?: string;
}

export interface POSState {
  products: Product[];
  stockMovements: StockMovement[];
  sales: Sale[];
  creditPayments: CreditPayment[];
  categories: string[];
  settings: StoreSettings;
  // Shared Auth, Store Operations & E-Wallet state
  staff: StaffMember[];
  activeStaffId: string;
  storeShift: StoreShift;
  ewalletTransactions: EWalletTransaction[];
  ewalletSessions: EWalletSession[];
  auditLogs: AuditLogEntry[];
  syncQueue: SyncQueueItem[];
  lastSyncedAt?: string;
}

export type ProductSortOption = 'name' | 'stock' | 'expiry';
export type ReportDateRange = 'today' | 'week' | 'month' | 'custom';
