import type {
  AuditLogEntry,
  AuditModule,
  EWalletBalances,
  EWalletProvider,
  EWalletReconciliationReport,
  EWalletSession,
  EWalletTransaction,
  EWalletTxStatus,
  EWalletTxType,
  POSState,
  StaffMember,
  StaffRole,
  SyncQueueItem,
  VerificationMethod,
} from '../types/pos';
import { toLocalDateKey } from './format';

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'staff-owner',
    name: 'Store Owner',
    role: 'owner',
    pin: '0000',
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
  },
];

export type StorePermission =
  | 'pos_sell'
  | 'pos_restock'
  | 'pos_edit_product'
  | 'pos_delete_product'
  | 'pos_void_sale'
  | 'ewallet_create'
  | 'ewallet_verify'
  | 'ewallet_claim'
  | 'ewallet_flag'
  | 'ewallet_cancel'
  | 'ewallet_session_manage'
  | 'store_shift_manage'
  | 'staff_manage'
  | 'settings_reset';

const ROLE_PERMISSIONS: Record<StaffRole, Set<StorePermission>> = {
  owner: new Set<StorePermission>([
    'pos_sell',
    'pos_restock',
    'pos_edit_product',
    'pos_delete_product',
    'pos_void_sale',
    'ewallet_create',
    'ewallet_verify',
    'ewallet_claim',
    'ewallet_flag',
    'ewallet_cancel',
    'ewallet_session_manage',
    'store_shift_manage',
    'staff_manage',
    'settings_reset',
  ]),
  manager: new Set<StorePermission>([
    'pos_sell',
    'pos_restock',
    'pos_edit_product',
    'pos_void_sale',
    'ewallet_create',
    'ewallet_verify',
    'ewallet_claim',
    'ewallet_flag',
    'ewallet_cancel',
    'ewallet_session_manage',
    'store_shift_manage',
  ]),
  cashier: new Set<StorePermission>([
    'pos_sell',
    'pos_restock',
    'ewallet_create',
    'ewallet_verify',
    'ewallet_claim',
    'ewallet_flag',
  ]),
};

export function hasPermission(
  role: StaffRole | undefined,
  permission: StorePermission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getActiveStaffMember(state: POSState): StaffMember {
  const owner = state.staff.find((s) => s.role === 'owner' && s.active);
  return owner ?? state.staff[0] ?? DEFAULT_STAFF[0];
}

export function maskMobileNumber(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.trim();
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) {
    return `${cleaned.slice(0, 2)}•••${cleaned.slice(-2)}`;
  }
  return `${cleaned.slice(0, 4)}••••${cleaned.slice(-3)}`;
}

export function createAuditLog(
  staff: StaffMember,
  module: AuditModule,
  action: string,
  details: string,
  nowIso = new Date().toISOString()
): AuditLogEntry {
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id: `aud-${Date.now().toString(36)}-${suffix}`,
    module,
    action,
    details,
    staffId: staff.id,
    staffName: staff.name,
    staffRole: staff.role,
    createdAt: nowIso,
  };
}

export function generateEWalletInternalId(
  existing: EWalletTransaction[],
  now = new Date()
): string {
  const datePart = toLocalDateKey(now).replace(/-/g, '');
  const prefix = `EW-${datePart}-`;
  let seq = existing.filter((t) => t.id.startsWith(prefix)).length + 1;
  const ids = new Set(existing.map((t) => t.id));
  while (ids.has(`${prefix}${String(seq).padStart(4, '0')}`)) {
    seq += 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function normalizeReferenceNumber(ref: string): string {
  return ref.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function findDuplicateReference(
  transactions: EWalletTransaction[],
  provider: EWalletProvider,
  referenceNumber: string,
  options?: { customProviderName?: string; excludeId?: string }
): EWalletTransaction | undefined {
  const normRef = normalizeReferenceNumber(referenceNumber);
  if (!normRef) return undefined;

  return transactions.find((tx) => {
    if (options?.excludeId && tx.id === options.excludeId) return false;
    if (tx.status === 'cancelled') return false;
    if (tx.provider !== provider) return false;
    if (provider === 'Other') {
      const a = (tx.customProviderName ?? '').trim().toLowerCase();
      const b = (options?.customProviderName ?? '').trim().toLowerCase();
      if (a && b && a !== b) return false;
    }
    return normalizeReferenceNumber(tx.referenceNumber) === normRef;
  });
}

export function enqueueSyncMutation(
  queue: SyncQueueItem[],
  params: {
    idempotencyKey: string;
    entityType: SyncQueueItem['entityType'];
    entityId: string;
    operation: SyncQueueItem['operation'];
    revision: number;
    payloadSummary: string;
    nowIso?: string;
  }
): SyncQueueItem[] {
  const existing = queue.find(
    (q) => q.idempotencyKey === params.idempotencyKey
  );
  if (existing) {
    // Safeguard against duplicate submissions
    return queue;
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  const item: SyncQueueItem = {
    id: `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    idempotencyKey: params.idempotencyKey,
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    revision: params.revision,
    payloadSummary: params.payloadSummary,
    status: 'pending',
    createdAt: nowIso,
  };

  return [item, ...queue].slice(0, 200);
}

export function reconcileSyncQueue(
  state: POSState,
  nowIso = new Date().toISOString()
): { nextState: POSState; syncedCount: number; conflictCount: number } {
  let syncedCount = 0;
  let conflictCount = 0;

  // Detect any stale revision conflicts against current local state before marking synced
  const txMap = new Map(state.ewalletTransactions.map((t) => [t.id, t]));
  const seenKeys = new Set<string>();

  const nextQueue: SyncQueueItem[] = state.syncQueue.map((item) => {
    if (item.status === 'synced') {
      seenKeys.add(item.idempotencyKey);
      return item;
    }
    if (seenKeys.has(item.idempotencyKey)) {
      conflictCount += 1;
      return {
        ...item,
        status: 'conflict',
        conflictReason: 'Duplicate submission prevented by idempotency check.',
      };
    }
    seenKeys.add(item.idempotencyKey);

    if (item.entityType === 'ewallet_tx') {
      const current = txMap.get(item.entityId);
      if (current && item.revision > current.revision) {
        conflictCount += 1;
        return {
          ...item,
          status: 'conflict',
          conflictReason: `Revision mismatch (queued v${item.revision} vs local v${current.revision}).`,
        };
      }
    }

    syncedCount += 1;
    return {
      ...item,
      status: 'synced',
      syncedAt: nowIso,
    };
  });

  const activeStaff = getActiveStaffMember(state);
  const nextAudit =
    syncedCount > 0 || conflictCount > 0
      ? [
          createAuditLog(
            activeStaff,
            'sync',
            'Synchronized offline queue',
            `Synced ${syncedCount} item(s), ${conflictCount} conflict(s).`,
            nowIso
          ),
          ...state.auditLogs,
        ].slice(0, 300)
      : state.auditLogs;

  return {
    nextState: {
      ...state,
      syncQueue: nextQueue,
      lastSyncedAt: nowIso,
      auditLogs: nextAudit,
    },
    syncedCount,
    conflictCount,
  };
}

export function getSuggestedServiceFee(amount: number, type: EWalletTxType): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (type === 'eload') return 3;
  if (type === 'bills_payment') return 15;
  if (amount <= 500) return 10;
  if (amount <= 1000) return 20;
  if (amount <= 2000) return 30;
  return Math.ceil(amount / 1000) * 15;
}

export function createEWalletTransaction(
  state: POSState,
  input: {
    provider: EWalletProvider;
    customProviderName?: string;
    type: EWalletTxType;
    amount: number;
    serviceFee: number;
    customerName?: string;
    customerMobile?: string;
    referenceNumber: string;
    notes?: string;
    idempotencyKey?: string;
    nowIso?: string;
  }
): { nextState: POSState; transaction?: EWalletTransaction; error?: string } {
  const staff = getActiveStaffMember(state);
  if (!hasPermission(staff.role, 'ewallet_create')) {
    return { nextState: state, error: 'Your role cannot record E-Wallet transactions.' };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { nextState: state, error: 'Amount must be greater than ₱0.00.' };
  }
  if (!Number.isFinite(input.serviceFee) || input.serviceFee < 0) {
    return { nextState: state, error: 'Service fee cannot be negative.' };
  }

  const ref = input.referenceNumber.trim();
  if (!ref) {
    return { nextState: state, error: 'Reference number is required.' };
  }

  if (input.provider === 'Other' && !input.customProviderName?.trim()) {
    return { nextState: state, error: 'Please specify the wallet or bank name.' };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const idemKey =
    input.idempotencyKey ??
    `idem-${input.provider}-${normalizeReferenceNumber(ref)}-${nowIso}-${Math.random().toString(36).slice(2, 6)}`;

  if (
    input.idempotencyKey &&
    state.ewalletTransactions.some((tx) => tx.idempotencyKey === idemKey)
  ) {
    return {
      nextState: state,
      error: 'Duplicate submission blocked. This transaction was already saved.',
    };
  }

  const dupRef = findDuplicateReference(
    state.ewalletTransactions,
    input.provider,
    ref,
    { customProviderName: input.customProviderName }
  );
  if (dupRef) {
    return {
      nextState: state,
      error: `Duplicate reference number "${ref}" already exists for ${input.provider} (${dupRef.id}, status: ${dupRef.status}).`,
    };
  }

  const nowDate = new Date(nowIso);
  const openSession = state.ewalletSessions.find((s) => s.status === 'open');
  const id = generateEWalletInternalId(state.ewalletTransactions, nowDate);

  // CRITICAL SECURITY RULE:
  // Never auto-verify a transaction based solely on an entered reference number or screenshot.
  // Transactions always start as 'pending' and verified: false until confirmed via authorized provider or manual staff check.
  const transaction: EWalletTransaction = {
    id,
    idempotencyKey: idemKey,
    revision: 1,
    provider: input.provider,
    customProviderName:
      input.provider === 'Other' ? input.customProviderName?.trim() : undefined,
    type: input.type,
    amount: Number(input.amount.toFixed(2)),
    serviceFee: Number(input.serviceFee.toFixed(2)),
    customerName: input.customerName?.trim() || undefined,
    customerMobile: input.customerMobile?.trim() || undefined,
    referenceNumber: ref,
    notes: input.notes?.trim() || undefined,
    status: 'pending',
    verified: false,
    verificationMethod: 'none',
    sessionId: openSession?.id,
    createdByStaffId: staff.id,
    createdByStaffName: staff.name,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const providerLabel =
    transaction.provider === 'Other'
      ? transaction.customProviderName || 'Other Wallet'
      : transaction.provider;

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    'Recorded E-Wallet transaction (Pending Verification)',
    `${transaction.id} · ${providerLabel} ${formatTxTypeLabel(transaction.type)} ₱${transaction.amount.toFixed(2)} (Ref: ${transaction.referenceNumber})`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `create-${transaction.id}`,
    entityType: 'ewallet_tx',
    entityId: transaction.id,
    operation: 'create',
    revision: 1,
    payloadSummary: `${providerLabel} ${transaction.id} ₱${transaction.amount.toFixed(2)}`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletTransactions: [transaction, ...state.ewalletTransactions],
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
    transaction,
  };
}

export function verifyEWalletTransaction(
  state: POSState,
  txId: string,
  options: {
    method: Exclude<VerificationMethod, 'none'>;
    staffConfirmedReceipt: boolean;
    note?: string;
    markCompleted?: boolean;
    nowIso?: string;
  }
): { nextState: POSState; error?: string } {
  const staff = getActiveStaffMember(state);
  if (!hasPermission(staff.role, 'ewallet_verify')) {
    return { nextState: state, error: 'Your role cannot verify transactions.' };
  }
  if (!options.staffConfirmedReceipt) {
    return {
      nextState: state,
      error:
        'Verification requires confirming actual receipt via provider app/SMS or authorized integration.',
    };
  }

  const target = state.ewalletTransactions.find((t) => t.id === txId);
  if (!target) return { nextState: state, error: 'Transaction not found.' };
  if (target.status === 'cancelled') {
    return { nextState: state, error: 'Cancelled transactions cannot be verified.' };
  }
  if (target.status === 'flagged') {
    return {
      nextState: state,
      error: 'Resolve the flag before verifying this transaction.',
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const nextStatus: EWalletTxStatus =
    target.status === 'claimed'
      ? 'claimed'
      : options.markCompleted
        ? 'completed'
        : target.status;

  const nextRev = target.revision + 1;
  const updated: EWalletTransaction = {
    ...target,
    verified: true,
    verificationMethod: options.method,
    verifiedAt: nowIso,
    verifiedByStaffId: staff.id,
    verifiedByStaffName: staff.name,
    verificationNote: options.note?.trim() || target.verificationNote,
    status: nextStatus,
    revision: nextRev,
    updatedAt: nowIso,
  };

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    'Verified E-Wallet payment',
    `${target.id} verified via ${options.method === 'authorized_provider' ? 'Authorized Provider' : 'Manual Staff Check'}${nextStatus === 'completed' ? ' and marked Completed' : ''}.`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `verify-${target.id}-v${nextRev}`,
    entityType: 'ewallet_tx',
    entityId: target.id,
    operation: 'update',
    revision: nextRev,
    payloadSummary: `Verify ${target.id} (${nextStatus})`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletTransactions: state.ewalletTransactions.map((t) =>
        t.id === txId ? updated : t
      ),
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
  };
}

export function claimEWalletTransaction(
  state: POSState,
  txId: string,
  options: {
    staffConfirmedReceipt: boolean;
    verificationMethod?: Exclude<VerificationMethod, 'none'>;
    note?: string;
    nowIso?: string;
  }
): { nextState: POSState; error?: string } {
  const staff = getActiveStaffMember(state);
  if (!hasPermission(staff.role, 'ewallet_claim')) {
    return { nextState: state, error: 'Your role cannot claim transactions.' };
  }

  const target = state.ewalletTransactions.find((t) => t.id === txId);
  if (!target) return { nextState: state, error: 'Transaction not found.' };

  if (target.status === 'claimed') {
    return {
      nextState: state,
      error: `Already claimed on ${target.claimedAt ?? 'earlier'} by ${target.claimedByStaffName ?? 'staff'}. Duplicate claims are blocked.`,
    };
  }
  if (target.status === 'cancelled') {
    return { nextState: state, error: 'Cannot claim a cancelled transaction.' };
  }
  if (target.status === 'flagged') {
    return {
      nextState: state,
      error: 'Cannot claim a flagged transaction until reviewed by an Owner or Manager.',
    };
  }

  if (!target.verified && !options.staffConfirmedReceipt) {
    return {
      nextState: state,
      error:
        'Confirm actual payment verification in the e-wallet app/SMS before claiming.',
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const nextRev = target.revision + 1;
  const method = target.verified
    ? target.verificationMethod
    : options.verificationMethod ?? 'manual_staff';

  const updated: EWalletTransaction = {
    ...target,
    status: 'claimed',
    verified: true,
    verificationMethod: method,
    verifiedAt: target.verifiedAt ?? nowIso,
    verifiedByStaffId: target.verifiedByStaffId ?? staff.id,
    verifiedByStaffName: target.verifiedByStaffName ?? staff.name,
    verificationNote: options.note?.trim() || target.verificationNote,
    claimedAt: nowIso,
    claimedByStaffId: staff.id,
    claimedByStaffName: staff.name,
    revision: nextRev,
    updatedAt: nowIso,
  };

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    'Claimed E-Wallet transaction',
    `${target.id} (Ref: ${target.referenceNumber}, ₱${target.amount.toFixed(2)}) marked Claimed by ${staff.name}.`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `claim-${target.id}-v${nextRev}`,
    entityType: 'ewallet_tx',
    entityId: target.id,
    operation: 'update',
    revision: nextRev,
    payloadSummary: `Claim ${target.id} by ${staff.name}`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletTransactions: state.ewalletTransactions.map((t) =>
        t.id === txId ? updated : t
      ),
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
  };
}

export function updateEWalletTransactionStatus(
  state: POSState,
  txId: string,
  nextStatus: 'flagged' | 'cancelled' | 'pending',
  reason: string,
  nowIso = new Date().toISOString()
): { nextState: POSState; error?: string } {
  const staff = getActiveStaffMember(state);
  if (nextStatus === 'cancelled' && !hasPermission(staff.role, 'ewallet_cancel')) {
    return {
      nextState: state,
      error: 'Only an Owner or Manager can cancel transactions.',
    };
  }
  if (nextStatus === 'flagged' && !hasPermission(staff.role, 'ewallet_flag')) {
    return { nextState: state, error: 'Your role cannot flag transactions.' };
  }
  if (nextStatus === 'pending' && !hasPermission(staff.role, 'ewallet_cancel')) {
    return {
      nextState: state,
      error: 'Only an Owner or Manager can unflag or reopen a transaction.',
    };
  }

  const target = state.ewalletTransactions.find((t) => t.id === txId);
  if (!target) return { nextState: state, error: 'Transaction not found.' };

  if (target.status === 'claimed' && nextStatus !== 'flagged') {
    return {
      nextState: state,
      error: 'Claimed transactions cannot be cancelled or reopened.',
    };
  }

  const cleanedReason = reason.trim();
  if ((nextStatus === 'flagged' || nextStatus === 'cancelled') && !cleanedReason) {
    return { nextState: state, error: 'Please provide a reason.' };
  }

  const nextRev = target.revision + 1;
  const updated: EWalletTransaction = {
    ...target,
    status: nextStatus,
    flagReason: nextStatus === 'flagged' ? cleanedReason : undefined,
    cancelReason: nextStatus === 'cancelled' ? cleanedReason : target.cancelReason,
    revision: nextRev,
    updatedAt: nowIso,
  };

  const actionLabel =
    nextStatus === 'flagged'
      ? 'Flagged E-Wallet transaction'
      : nextStatus === 'cancelled'
        ? 'Cancelled E-Wallet transaction'
        : 'Cleared flag (returned to Pending)';

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    actionLabel,
    `${target.id} (${target.referenceNumber}) · ${cleanedReason || 'Reopened'}`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `status-${target.id}-${nextStatus}-v${nextRev}`,
    entityType: 'ewallet_tx',
    entityId: target.id,
    operation: 'update',
    revision: nextRev,
    payloadSummary: `${target.id} -> ${nextStatus}`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletTransactions: state.ewalletTransactions.map((t) =>
        t.id === txId ? updated : t
      ),
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
  };
}

export function searchEWalletTransactions(
  transactions: EWalletTransaction[],
  options?: {
    query?: string;
    status?: EWalletTxStatus | 'all';
    provider?: EWalletProvider | 'all';
    type?: EWalletTxType | 'all';
    dateKey?: string;
  }
): EWalletTransaction[] {
  const q = (options?.query ?? '').trim().toLowerCase();
  const qNorm = q.replace(/\s+/g, '');

  return transactions
    .filter((tx) => {
      if (options?.status && options.status !== 'all' && tx.status !== options.status) {
        return false;
      }
      if (
        options?.provider &&
        options.provider !== 'all' &&
        tx.provider !== options.provider
      ) {
        return false;
      }
      if (options?.type && options.type !== 'all' && tx.type !== options.type) {
        return false;
      }
      if (options?.dateKey && toLocalDateKey(tx.createdAt) !== options.dateKey) {
        return false;
      }
      if (!q) return true;

      const refMatch = tx.referenceNumber.toLowerCase().replace(/\s+/g, '').includes(qNorm);
      const idMatch = tx.id.toLowerCase().includes(q);
      const nameMatch = tx.customerName?.toLowerCase().includes(q) ?? false;
      const mobileMatch =
        tx.customerMobile?.replace(/[^0-9+]/g, '').includes(q.replace(/[^0-9+]/g, '')) ??
        false;

      return refMatch || idMatch || nameMatch || mobileMatch;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function formatTxTypeLabel(type: EWalletTxType): string {
  switch (type) {
    case 'cash_in':
      return 'Cash-In';
    case 'cash_out':
      return 'Cash-Out';
    case 'money_transfer':
      return 'Money Transfer';
    case 'bills_payment':
      return 'Bills Payment';
    case 'eload':
      return 'Load / Promo';
    default:
      return 'Other';
  }
}

export function getWalletBucket(provider: EWalletProvider): keyof Omit<EWalletBalances, 'cashOnHand'> {
  if (provider === 'GCash') return 'GCash';
  if (provider === 'Maya') return 'Maya';
  if (provider === 'MariBank') return 'MariBank';
  return 'Other';
}

export function computeEWalletSummary(
  transactions: EWalletTransaction[],
  dateKey?: string
): {
  totalCashIn: number;
  totalCashOut: number;
  totalTransfersAndBills: number;
  totalServiceFees: number;
  pendingCount: number;
  completedCount: number;
  claimedCount: number;
  flaggedCount: number;
  cancelledCount: number;
  totalCount: number;
} {
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalTransfersAndBills = 0;
  let totalServiceFees = 0;
  let pendingCount = 0;
  let completedCount = 0;
  let claimedCount = 0;
  let flaggedCount = 0;
  let cancelledCount = 0;

  const list = dateKey
    ? transactions.filter((t) => toLocalDateKey(t.createdAt) === dateKey)
    : transactions;

  for (const tx of list) {
    if (tx.status === 'pending') pendingCount += 1;
    else if (tx.status === 'completed') completedCount += 1;
    else if (tx.status === 'claimed') claimedCount += 1;
    else if (tx.status === 'flagged') flaggedCount += 1;
    else if (tx.status === 'cancelled') cancelledCount += 1;

    if (tx.status === 'cancelled') continue;

    // Count financial volumes for active / non-cancelled transactions
    if (tx.status === 'completed' || tx.status === 'claimed') {
      totalServiceFees += tx.serviceFee;
      if (tx.type === 'cash_in') totalCashIn += tx.amount;
      else if (tx.type === 'cash_out') totalCashOut += tx.amount;
      else totalTransfersAndBills += tx.amount;
    }
  }

  return {
    totalCashIn: Number(totalCashIn.toFixed(2)),
    totalCashOut: Number(totalCashOut.toFixed(2)),
    totalTransfersAndBills: Number(totalTransfersAndBills.toFixed(2)),
    totalServiceFees: Number(totalServiceFees.toFixed(2)),
    pendingCount,
    completedCount,
    claimedCount,
    flaggedCount,
    cancelledCount,
    totalCount: list.length,
  };
}

export function calculateExpectedBalances(
  startingBalances: EWalletBalances,
  sessionTransactions: EWalletTransaction[]
): EWalletBalances {
  const balances: EWalletBalances = { ...startingBalances };

  for (const tx of sessionTransactions) {
    if (tx.status !== 'completed' && tx.status !== 'claimed') continue;
    const bucket = getWalletBucket(tx.provider);

    if (tx.type === 'cash_in') {
      // Customer gives store physical cash (+amount +fee); store sends wallet funds (-amount)
      balances.cashOnHand += tx.amount + tx.serviceFee;
      balances[bucket] -= tx.amount;
    } else if (tx.type === 'cash_out') {
      // Customer sends wallet funds (+amount); store gives physical cash (-amount), collects fee (+fee)
      balances[bucket] += tx.amount;
      balances.cashOnHand += tx.serviceFee - tx.amount;
    } else {
      // Money transfer / Bills payment / Load: customer pays cash (+amount +fee), wallet sends (-amount)
      balances.cashOnHand += tx.amount + tx.serviceFee;
      balances[bucket] -= tx.amount;
    }
  }

  return {
    cashOnHand: Number(balances.cashOnHand.toFixed(2)),
    GCash: Number(balances.GCash.toFixed(2)),
    Maya: Number(balances.Maya.toFixed(2)),
    MariBank: Number(balances.MariBank.toFixed(2)),
    Other: Number(balances.Other.toFixed(2)),
  };
}

export function openEWalletSession(
  state: POSState,
  startingBalances: EWalletBalances,
  notes?: string,
  nowIso = new Date().toISOString()
): { nextState: POSState; session?: EWalletSession; error?: string } {
  const staff = getActiveStaffMember(state);
  if (!hasPermission(staff.role, 'ewallet_session_manage')) {
    return {
      nextState: state,
      error: 'Only an Owner or Manager can open or close an E-Wallet session.',
    };
  }
  if (state.ewalletSessions.some((s) => s.status === 'open')) {
    return { nextState: state, error: 'An E-Wallet session is already open.' };
  }

  const session: EWalletSession = {
    id: `ews-${Date.now().toString(36)}`,
    status: 'open',
    openedAt: nowIso,
    openedByStaffId: staff.id,
    openedByStaffName: staff.name,
    startingBalances: {
      cashOnHand: Number((startingBalances.cashOnHand || 0).toFixed(2)),
      GCash: Number((startingBalances.GCash || 0).toFixed(2)),
      Maya: Number((startingBalances.Maya || 0).toFixed(2)),
      MariBank: Number((startingBalances.MariBank || 0).toFixed(2)),
      Other: Number((startingBalances.Other || 0).toFixed(2)),
    },
    notes: notes?.trim() || undefined,
  };

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    'Opened E-Wallet Session',
    `Starting Cash ₱${session.startingBalances.cashOnHand.toFixed(2)} · GCash ₱${session.startingBalances.GCash.toFixed(2)} · Maya ₱${session.startingBalances.Maya.toFixed(2)} · MariBank ₱${session.startingBalances.MariBank.toFixed(2)}`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `session-open-${session.id}`,
    entityType: 'ewallet_session',
    entityId: session.id,
    operation: 'create',
    revision: 1,
    payloadSummary: `Open E-Wallet Session ${session.id}`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletSessions: [session, ...state.ewalletSessions],
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
    session,
  };
}

export function getSessionTransactions(
  session: EWalletSession,
  allTransactions: EWalletTransaction[]
): EWalletTransaction[] {
  return allTransactions.filter(
    (tx) =>
      tx.sessionId === session.id ||
      (!tx.sessionId &&
        tx.createdAt >= session.openedAt &&
        (!session.closedAt || tx.createdAt <= session.closedAt))
  );
}

export function closeEWalletSession(
  state: POSState,
  sessionId: string,
  actualBalances: EWalletBalances,
  notes?: string,
  nowIso = new Date().toISOString()
): {
  nextState: POSState;
  report?: EWalletReconciliationReport;
  error?: string;
} {
  const staff = getActiveStaffMember(state);
  if (!hasPermission(staff.role, 'ewallet_session_manage')) {
    return {
      nextState: state,
      error: 'Only an Owner or Manager can close an E-Wallet session.',
    };
  }

  const session = state.ewalletSessions.find((s) => s.id === sessionId);
  if (!session || session.status !== 'open') {
    return { nextState: state, error: 'Open session not found.' };
  }

  const sessionTxs = getSessionTransactions(session, state.ewalletTransactions);
  const expectedBalances = calculateExpectedBalances(
    session.startingBalances,
    sessionTxs
  );
  const summary = computeEWalletSummary(sessionTxs);

  const actual: EWalletBalances = {
    cashOnHand: Number((actualBalances.cashOnHand || 0).toFixed(2)),
    GCash: Number((actualBalances.GCash || 0).toFixed(2)),
    Maya: Number((actualBalances.Maya || 0).toFixed(2)),
    MariBank: Number((actualBalances.MariBank || 0).toFixed(2)),
    Other: Number((actualBalances.Other || 0).toFixed(2)),
  };

  const discrepancies: EWalletBalances = {
    cashOnHand: Number((actual.cashOnHand - expectedBalances.cashOnHand).toFixed(2)),
    GCash: Number((actual.GCash - expectedBalances.GCash).toFixed(2)),
    Maya: Number((actual.Maya - expectedBalances.Maya).toFixed(2)),
    MariBank: Number((actual.MariBank - expectedBalances.MariBank).toFixed(2)),
    Other: Number((actual.Other - expectedBalances.Other).toFixed(2)),
  };

  const report: EWalletReconciliationReport = {
    expectedBalances,
    actualBalances: actual,
    discrepancies,
    totalCashIn: summary.totalCashIn,
    totalCashOut: summary.totalCashOut,
    totalTransfersAndBills: summary.totalTransfersAndBills,
    totalServiceFees: summary.totalServiceFees,
    transactionCount: summary.totalCount,
    pendingCount: summary.pendingCount,
    flaggedCount: summary.flaggedCount,
  };

  const closedSession: EWalletSession = {
    ...session,
    status: 'closed',
    closedAt: nowIso,
    closedByStaffId: staff.id,
    closedByStaffName: staff.name,
    reconciliation: report,
    notes: notes?.trim() || session.notes,
  };

  const auditEntry = createAuditLog(
    staff,
    'ewallet',
    'Closed E-Wallet Session & Reconciled',
    `Session ${session.id} closed. Fees earned: ₱${report.totalServiceFees.toFixed(2)}, Cash variance: ₱${discrepancies.cashOnHand.toFixed(2)}`,
    nowIso
  );

  const nextQueue = enqueueSyncMutation(state.syncQueue, {
    idempotencyKey: `session-close-${session.id}`,
    entityType: 'ewallet_session',
    entityId: session.id,
    operation: 'update',
    revision: 2,
    payloadSummary: `Close E-Wallet Session ${session.id} (Fees ₱${report.totalServiceFees.toFixed(2)})`,
    nowIso,
  });

  return {
    nextState: {
      ...state,
      ewalletSessions: state.ewalletSessions.map((s) =>
        s.id === sessionId ? closedSession : s
      ),
      auditLogs: [auditEntry, ...state.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    },
    report,
  };
}
