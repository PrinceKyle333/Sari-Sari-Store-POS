import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_CATEGORIES,
  type AuditLogEntry,
  type CreditPayment,
  type EWalletSession,
  type EWalletTransaction,
  type POSState,
  type Product,
  type Sale,
  type StaffMember,
  type StockMovement,
  type StoreSettings,
  type StoreShift,
  type SyncQueueItem,
} from '../types/pos';
import { DEFAULT_STAFF } from '../utils/ewalletLogic';
import { DEFAULT_POS_STATE } from '../utils/posLogic';

interface SettingsRecord {
  id: 'store';
  settings: StoreSettings;
  categories: string[];
  activeStaffId?: string;
  storeShift?: StoreShift;
  lastSyncedAt?: string;
}

class TindahanPOSDatabase extends Dexie {
  products!: Table<Product, string>;
  stockMovements!: Table<StockMovement, string>;
  sales!: Table<Sale, string>;
  creditPayments!: Table<CreditPayment, string>;
  meta!: Table<SettingsRecord, string>;
  staff!: Table<StaffMember, string>;
  ewalletTransactions!: Table<EWalletTransaction, string>;
  ewalletSessions!: Table<EWalletSession, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('tindahan_pos_db');
    this.version(1).stores({
      products: 'id, barcode, category, name, expirationDate',
      stockMovements: 'id, productId, type, createdAt',
      sales: 'id, receiptNumber, createdAt, paymentMethod, customerName',
      creditPayments: 'id, customerName, createdAt',
      meta: 'id',
    });
    this.version(2).stores({
      products: 'id, barcode, category, name, expirationDate',
      stockMovements: 'id, productId, type, createdAt',
      sales: 'id, receiptNumber, createdAt, paymentMethod, customerName',
      creditPayments: 'id, customerName, createdAt',
      meta: 'id',
      staff: 'id, role, active',
      ewalletTransactions:
        'id, provider, type, status, referenceNumber, customerMobile, sessionId, createdAt',
      ewalletSessions: 'id, status, openedAt, closedAt',
      auditLogs: 'id, module, staffId, createdAt',
      syncQueue: 'id, idempotencyKey, status, createdAt',
    });
  }
}

export const posDb = new TindahanPOSDatabase();

export async function loadPOSStateFromDB(): Promise<POSState> {
  try {
    const [
      products,
      stockMovements,
      sales,
      creditPayments,
      meta,
      staffRows,
      ewalletTransactions,
      ewalletSessions,
      auditLogs,
      syncQueue,
    ] = await Promise.all([
      posDb.products.toArray(),
      posDb.stockMovements.orderBy('createdAt').reverse().toArray(),
      posDb.sales.orderBy('createdAt').reverse().toArray(),
      posDb.creditPayments.orderBy('createdAt').reverse().toArray(),
      posDb.meta.get('store'),
      posDb.staff.toArray(),
      posDb.ewalletTransactions.orderBy('createdAt').reverse().toArray(),
      posDb.ewalletSessions.orderBy('openedAt').reverse().toArray(),
      posDb.auditLogs.orderBy('createdAt').reverse().toArray(),
      posDb.syncQueue.orderBy('createdAt').reverse().toArray(),
    ]);

    const categories =
      meta?.categories && meta.categories.length > 0
        ? Array.from(new Set([...DEFAULT_CATEGORIES, ...meta.categories]))
        : [...DEFAULT_CATEGORIES];

    const settings: StoreSettings = meta?.settings
      ? {
          storeName: meta.settings.storeName || DEFAULT_POS_STATE.settings.storeName,
          defaultLowStockThreshold:
            meta.settings.defaultLowStockThreshold ??
            DEFAULT_POS_STATE.settings.defaultLowStockThreshold,
          scanner: {
            beepEnabled: meta.settings.scanner?.beepEnabled ?? true,
            vibrationEnabled: meta.settings.scanner?.vibrationEnabled ?? true,
            preferredCamera:
              meta.settings.scanner?.preferredCamera === 'user'
                ? 'user'
                : 'environment',
          },
        }
      : DEFAULT_POS_STATE.settings;

    const ownerStaff =
      staffRows.find((s) => s.role === 'owner') ?? DEFAULT_STAFF[0];
    const staff = [ownerStaff];
    const activeStaffId = ownerStaff.id;

    return {
      products,
      stockMovements,
      sales,
      creditPayments,
      categories,
      settings,
      staff,
      activeStaffId,
      storeShift: meta?.storeShift ?? { isOpen: false },
      ewalletTransactions,
      ewalletSessions,
      auditLogs,
      syncQueue,
      lastSyncedAt: meta?.lastSyncedAt,
    };
  } catch {
    return DEFAULT_POS_STATE;
  }
}

export async function savePOSStateToDB(state: POSState): Promise<void> {
  try {
    await posDb.transaction(
      'rw',
      [
        posDb.products,
        posDb.stockMovements,
        posDb.sales,
        posDb.creditPayments,
        posDb.meta,
        posDb.staff,
        posDb.ewalletTransactions,
        posDb.ewalletSessions,
        posDb.auditLogs,
        posDb.syncQueue,
      ],
      async () => {
        await Promise.all([
          posDb.products.clear(),
          posDb.stockMovements.clear(),
          posDb.sales.clear(),
          posDb.creditPayments.clear(),
          posDb.staff.clear(),
          posDb.ewalletTransactions.clear(),
          posDb.ewalletSessions.clear(),
          posDb.auditLogs.clear(),
          posDb.syncQueue.clear(),
        ]);
        if (state.products.length > 0) {
          await posDb.products.bulkPut(state.products);
        }
        if (state.stockMovements.length > 0) {
          await posDb.stockMovements.bulkPut(state.stockMovements);
        }
        if (state.sales.length > 0) {
          await posDb.sales.bulkPut(state.sales);
        }
        if (state.creditPayments.length > 0) {
          await posDb.creditPayments.bulkPut(state.creditPayments);
        }
        if (state.staff.length > 0) {
          await posDb.staff.bulkPut(state.staff);
        }
        if (state.ewalletTransactions.length > 0) {
          await posDb.ewalletTransactions.bulkPut(state.ewalletTransactions);
        }
        if (state.ewalletSessions.length > 0) {
          await posDb.ewalletSessions.bulkPut(state.ewalletSessions);
        }
        if (state.auditLogs.length > 0) {
          await posDb.auditLogs.bulkPut(state.auditLogs);
        }
        if (state.syncQueue.length > 0) {
          await posDb.syncQueue.bulkPut(state.syncQueue);
        }
        await posDb.meta.put({
          id: 'store',
          settings: state.settings,
          categories: state.categories,
          activeStaffId: state.activeStaffId,
          storeShift: state.storeShift,
          lastSyncedAt: state.lastSyncedAt,
        });
      }
    );
  } catch {
    // Handle storage error gracefully
  }
}
