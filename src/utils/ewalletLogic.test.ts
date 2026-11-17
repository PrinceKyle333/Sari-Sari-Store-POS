import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POS_STATE } from './posLogic';
import {
  calculateExpectedBalances,
  claimEWalletTransaction,
  closeEWalletSession,
  computeEWalletSummary,
  createEWalletTransaction,
  hasPermission,
  maskMobileNumber,
  openEWalletSession,
  reconcileSyncQueue,
  searchEWalletTransactions,
  updateEWalletTransactionStatus,
  verifyEWalletTransaction,
} from './ewalletLogic';

test('creating an e-wallet transaction generates unique internal ID and never auto-verifies from ref number', () => {
  const res = createEWalletTransaction(DEFAULT_POS_STATE, {
    provider: 'GCash',
    type: 'cash_in',
    amount: 500,
    serviceFee: 10,
    customerName: 'Ate Tess',
    customerMobile: '09171234567',
    referenceNumber: 'GC-99887766',
    nowIso: '2026-11-17T09:00:00.000Z',
  });

  assert.equal(res.error, undefined);
  assert.ok(res.transaction);
  assert.match(res.transaction.id, /^EW-\d{8}-\d{4}$/);
  assert.equal(res.transaction.status, 'pending');
  assert.equal(res.transaction.verified, false);
  assert.equal(res.transaction.verificationMethod, 'none');
  assert.equal(res.nextState.auditLogs.length, 1);
  assert.equal(res.nextState.syncQueue.length, 1);
});

test('duplicate reference numbers are blocked within same provider but allowed across different providers or cancelled tx', () => {
  const r1 = createEWalletTransaction(DEFAULT_POS_STATE, {
    provider: 'GCash',
    type: 'cash_in',
    amount: 500,
    serviceFee: 10,
    referenceNumber: 'REF-12345',
    nowIso: '2026-11-17T09:00:00.000Z',
  });
  assert.ok(r1.transaction);

  const dupSame = createEWalletTransaction(r1.nextState, {
    provider: 'GCash',
    type: 'cash_out',
    amount: 300,
    serviceFee: 10,
    referenceNumber: 'ref 12345',
    nowIso: '2026-11-17T09:05:00.000Z',
  });
  assert.match(dupSame.error ?? '', /Duplicate reference number/);

  const diffProvider = createEWalletTransaction(r1.nextState, {
    provider: 'Maya',
    type: 'cash_in',
    amount: 500,
    serviceFee: 10,
    referenceNumber: 'REF-12345',
    nowIso: '2026-11-17T09:06:00.000Z',
  });
  assert.equal(diffProvider.error, undefined);
  assert.ok(diffProvider.transaction);

  // Cancel original GCash tx -> reference number can be reused if needed
  const cancelled = updateEWalletTransactionStatus(
    r1.nextState,
    r1.transaction.id,
    'cancelled',
    'Customer cancelled',
    '2026-11-17T09:07:00.000Z'
  );
  assert.equal(cancelled.error, undefined);
  const reentered = createEWalletTransaction(cancelled.nextState, {
    provider: 'GCash',
    type: 'cash_in',
    amount: 500,
    serviceFee: 10,
    referenceNumber: 'REF-12345',
    nowIso: '2026-11-17T09:08:00.000Z',
  });
  assert.equal(reentered.error, undefined);
});

test('claiming requires manual staff verification, records staff & time, and prevents double-claiming', () => {
  const created = createEWalletTransaction(DEFAULT_POS_STATE, {
    provider: 'Maya',
    type: 'cash_out',
    amount: 1000,
    serviceFee: 20,
    customerMobile: '09189990001',
    referenceNumber: 'MAYA-778899',
    nowIso: '2026-11-17T10:00:00.000Z',
  });
  const txId = created.transaction!.id;

  // Trying to claim without confirmation fails
  const unconfirmedClaim = claimEWalletTransaction(created.nextState, txId, {
    staffConfirmedReceipt: false,
  });
  assert.match(unconfirmedClaim.error ?? '', /Confirm actual payment verification/);

  // Explicit verification then claim succeeds and records staff + timestamp
  const verified = verifyEWalletTransaction(created.nextState, txId, {
    method: 'manual_staff',
    staffConfirmedReceipt: true,
    note: 'Checked Maya SMS',
    nowIso: '2026-11-17T10:02:00.000Z',
  });
  assert.equal(verified.error, undefined);

  const claimed = claimEWalletTransaction(verified.nextState, txId, {
    staffConfirmedReceipt: true,
    nowIso: '2026-11-17T10:03:00.000Z',
  });
  assert.equal(claimed.error, undefined);

  const txAfter = claimed.nextState.ewalletTransactions[0];
  assert.equal(txAfter.status, 'claimed');
  assert.equal(txAfter.verified, true);
  assert.equal(txAfter.claimedAt, '2026-11-17T10:03:00.000Z');
  assert.equal(txAfter.claimedByStaffName, 'Store Owner');

  // Second claim must be blocked
  const secondClaim = claimEWalletTransaction(claimed.nextState, txId, {
    staffConfirmedReceipt: true,
    nowIso: '2026-11-17T10:05:00.000Z',
  });
  assert.match(secondClaim.error ?? '', /Already claimed/);
});

test('flagged transactions cannot be claimed and role permissions guard non-owner actions', () => {
  assert.equal(DEFAULT_POS_STATE.staff.length, 1);
  assert.equal(hasPermission('cashier', 'ewallet_create'), true);
  assert.equal(hasPermission('cashier', 'ewallet_cancel'), false);
  assert.equal(hasPermission('cashier', 'pos_void_sale'), false);
  assert.equal(hasPermission('owner', 'staff_manage'), true);

  const created = createEWalletTransaction(DEFAULT_POS_STATE, {
    provider: 'MariBank',
    type: 'money_transfer',
    amount: 2000,
    serviceFee: 30,
    referenceNumber: 'MB-554433',
    nowIso: '2026-11-17T11:00:00.000Z',
  });
  const txId = created.transaction!.id;

  const flagged = updateEWalletTransactionStatus(
    created.nextState,
    txId,
    'flagged',
    'Ref mismatch in SMS'
  );
  assert.equal(flagged.error, undefined);
  assert.equal(flagged.nextState.ewalletTransactions[0].status, 'flagged');

  const claimFlagged = claimEWalletTransaction(flagged.nextState, txId, {
    staffConfirmedReceipt: true,
  });
  assert.match(claimFlagged.error ?? '', /flagged/);
});

test('e-wallet session open, balance monitoring, and end-of-day reconciliation compute discrepancies accurately', () => {
  const opened = openEWalletSession(
    DEFAULT_POS_STATE,
    {
      cashOnHand: 5000,
      GCash: 4000,
      Maya: 3000,
      MariBank: 2000,
      Other: 0,
    },
    'Morning shift',
    '2026-11-17T07:00:00.000Z'
  );
  assert.equal(opened.error, undefined);
  const sessionId = opened.session!.id;

  // Cash-In 1000 GCash (fee 20) -> verified & completed
  const tx1 = createEWalletTransaction(opened.nextState, {
    provider: 'GCash',
    type: 'cash_in',
    amount: 1000,
    serviceFee: 20,
    referenceNumber: 'GC-1001',
    nowIso: '2026-11-17T08:00:00.000Z',
  });
  const tx1Done = verifyEWalletTransaction(tx1.nextState, tx1.transaction!.id, {
    method: 'manual_staff',
    staffConfirmedReceipt: true,
    markCompleted: true,
    nowIso: '2026-11-17T08:01:00.000Z',
  });

  // Cash-Out 500 Maya (fee 10) -> claimed
  const tx2 = createEWalletTransaction(tx1Done.nextState, {
    provider: 'Maya',
    type: 'cash_out',
    amount: 500,
    serviceFee: 10,
    referenceNumber: 'MY-2002',
    nowIso: '2026-11-17T09:00:00.000Z',
  });
  const tx2Claimed = claimEWalletTransaction(tx2.nextState, tx2.transaction!.id, {
    staffConfirmedReceipt: true,
    nowIso: '2026-11-17T09:02:00.000Z',
  });

  // Pending tx should NOT affect expected balances yet
  const tx3 = createEWalletTransaction(tx2Claimed.nextState, {
    provider: 'MariBank',
    type: 'cash_in',
    amount: 1500,
    serviceFee: 25,
    referenceNumber: 'MB-3003',
    nowIso: '2026-11-17T10:00:00.000Z',
  });

  const expected = calculateExpectedBalances(
    opened.session!.startingBalances,
    tx3.nextState.ewalletTransactions
  );
  // Cash: 5000 + (1000+20) + (10-500) = 5530
  assert.equal(expected.cashOnHand, 5530);
  // GCash: 4000 - 1000 = 3000
  assert.equal(expected.GCash, 3000);
  // Maya: 3000 + 500 = 3500
  assert.equal(expected.Maya, 3500);
  // MariBank untouched by pending tx: 2000
  assert.equal(expected.MariBank, 2000);

  const closed = closeEWalletSession(
    tx3.nextState,
    sessionId,
    {
      cashOnHand: 5520, // -10 short
      GCash: 3000,
      Maya: 3500,
      MariBank: 2000,
      Other: 0,
    },
    'End of day',
    '2026-11-17T20:00:00.000Z'
  );
  assert.equal(closed.error, undefined);
  assert.ok(closed.report);
  assert.equal(closed.report.discrepancies.cashOnHand, -10);
  assert.equal(closed.report.totalCashIn, 1000);
  assert.equal(closed.report.totalCashOut, 500);
  assert.equal(closed.report.totalServiceFees, 30);
  assert.equal(closed.report.pendingCount, 1);
});

test('search, mobile masking, summaries, and offline sync reconciliation behave safely', () => {
  assert.equal(maskMobileNumber('09171234567'), '0917••••567');

  const r1 = createEWalletTransaction(DEFAULT_POS_STATE, {
    provider: 'GCash',
    type: 'cash_in',
    amount: 250,
    serviceFee: 10,
    customerName: 'Kuya Ben',
    customerMobile: '09175551234',
    referenceNumber: 'GC-777001',
    nowIso: '2026-11-17T08:00:00.000Z',
  });
  const searchedByMobile = searchEWalletTransactions(
    r1.nextState.ewalletTransactions,
    { query: '09175551234' }
  );
  assert.equal(searchedByMobile.length, 1);

  const searchedByRef = searchEWalletTransactions(
    r1.nextState.ewalletTransactions,
    { query: 'gc-777001' }
  );
  assert.equal(searchedByRef.length, 1);

  const summary = computeEWalletSummary(r1.nextState.ewalletTransactions);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.totalServiceFees, 0); // Pending is not yet completed/claimed

  const syncRes = reconcileSyncQueue(r1.nextState, '2026-11-17T08:05:00.000Z');
  assert.equal(syncRes.syncedCount, 1);
  assert.equal(syncRes.conflictCount, 0);
  assert.equal(syncRes.nextState.syncQueue[0].status, 'synced');
});
