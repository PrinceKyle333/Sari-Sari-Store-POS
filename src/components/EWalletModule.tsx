import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  History,
  Lock,
  PlusCircle,
  Search,
  ShieldAlert,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import {
  EWALLET_PROVIDERS,
  EWALLET_TX_TYPES,
  type EWalletBalances,
  type EWalletProvider,
  type EWalletSession,
  type EWalletTransaction,
  type EWalletTxStatus,
  type EWalletTxType,
  type StaffMember,
  type VerificationMethod,
} from '../types/pos';
import { formatPHP, formatShortDateTime, toLocalDateKey } from '../utils/format';
import {
  calculateExpectedBalances,
  computeEWalletSummary,
  findDuplicateReference,
  formatTxTypeLabel,
  getSessionTransactions,
  getSuggestedServiceFee,
  hasPermission,
  maskMobileNumber,
  searchEWalletTransactions,
} from '../utils/ewalletLogic';
import { EWalletTxModal, STATUS_META } from './EWalletTxModal';

type EWalletTab = 'transact' | 'claim' | 'history' | 'session';

interface EWalletModuleProps {
  transactions: EWalletTransaction[];
  sessions: EWalletSession[];
  activeStaff: StaffMember;
  onCreateTransaction: (input: {
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
  }) => { ok: boolean; transaction?: EWalletTransaction; error?: string };
  onVerifyTransaction: (
    txId: string,
    options: {
      method: Exclude<VerificationMethod, 'none'>;
      staffConfirmedReceipt: boolean;
      note?: string;
      markCompleted?: boolean;
    }
  ) => { ok: boolean; error?: string };
  onClaimTransaction: (
    txId: string,
    options: {
      staffConfirmedReceipt: boolean;
      verificationMethod?: Exclude<VerificationMethod, 'none'>;
      note?: string;
    }
  ) => { ok: boolean; error?: string };
  onUpdateStatus: (
    txId: string,
    nextStatus: 'flagged' | 'cancelled' | 'pending',
    reason: string
  ) => { ok: boolean; error?: string };
  onOpenSession: (
    startingBalances: EWalletBalances,
    notes?: string
  ) => { ok: boolean; error?: string };
  onCloseSession: (
    sessionId: string,
    actualBalances: EWalletBalances,
    notes?: string
  ) => { ok: boolean; error?: string };
}

export const EWalletModule: React.FC<EWalletModuleProps> = ({
  transactions,
  sessions,
  activeStaff,
  onCreateTransaction,
  onVerifyTransaction,
  onClaimTransaction,
  onUpdateStatus,
  onOpenSession,
  onCloseSession,
}) => {
  const [tab, setTab] = useState<EWalletTab>('transact');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // --- Transact Form State ---
  const [provider, setProvider] = useState<EWalletProvider>('GCash');
  const [customProviderName, setCustomProviderName] = useState('');
  const [txType, setTxType] = useState<EWalletTxType>('cash_in');
  const [amountInput, setAmountInput] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitNonce, setSubmitNonce] = useState(() => `sub-${Date.now()}`);

  // --- Claim Lookup State ---
  const [claimQuery, setClaimQuery] = useState('');

  // --- History Filter State ---
  const [historyQuery, setHistoryQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EWalletTxStatus | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<EWalletProvider | 'all'>('all');

  // --- Session Open / Close State ---
  const [openCash, setOpenCash] = useState('5000');
  const [openGcash, setOpenGcash] = useState('5000');
  const [openMaya, setOpenMaya] = useState('3000');
  const [openMaribank, setOpenMaribank] = useState('2000');
  const [openOther, setOpenOther] = useState('0');
  const [openNotes, setOpenNotes] = useState('');

  const [closeMode, setCloseMode] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [actualGcash, setActualGcash] = useState('');
  const [actualMaya, setActualMaya] = useState('');
  const [actualMaribank, setActualMaribank] = useState('');
  const [actualOther, setActualOther] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);

  const openSession = sessions.find((s) => s.status === 'open') ?? null;
  const closedSessions = sessions.filter((s) => s.status === 'closed');
  const todayKey = toLocalDateKey(new Date());

  const todaySummary = useMemo(
    () => computeEWalletSummary(transactions, todayKey),
    [transactions, todayKey]
  );

  const liveBalances = useMemo(() => {
    if (!openSession) return null;
    const sessionTxs = getSessionTransactions(openSession, transactions);
    return calculateExpectedBalances(openSession.startingBalances, sessionTxs);
  }, [openSession, transactions]);

  const duplicateRefMatch = useMemo(() => {
    if (!referenceNumber.trim()) return undefined;
    return findDuplicateReference(transactions, provider, referenceNumber, {
      customProviderName,
    });
  }, [transactions, provider, referenceNumber, customProviderName]);

  const claimMatches = useMemo(() => {
    if (!claimQuery.trim()) {
      return transactions
        .filter((t) => t.status === 'pending' || t.status === 'completed' || t.status === 'flagged')
        .slice(0, 15);
    }
    return searchEWalletTransactions(transactions, { query: claimQuery });
  }, [transactions, claimQuery]);

  const historyList = useMemo(
    () =>
      searchEWalletTransactions(transactions, {
        query: historyQuery,
        status: statusFilter,
        provider: providerFilter,
      }),
    [transactions, historyQuery, statusFilter, providerFilter]
  );

  const selectedTx = selectedTxId
    ? transactions.find((t) => t.id === selectedTxId) ?? null
    : null;

  const canManageSession = hasPermission(
    activeStaff.role,
    'ewallet_session_manage'
  );

  const handleRecordTx = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = parseFloat(amountInput);
    const fee = feeInput.trim() === '' ? 0 : parseFloat(feeInput);

    const res = onCreateTransaction({
      provider,
      customProviderName,
      type: txType,
      amount,
      serviceFee: fee,
      customerName,
      customerMobile,
      referenceNumber,
      notes,
      idempotencyKey: submitNonce,
    });

    if (!res.ok) {
      setFormError(res.error ?? 'Could not save transaction.');
      return;
    }

    setAmountInput('');
    setFeeInput('');
    setCustomerName('');
    setCustomerMobile('');
    setReferenceNumber('');
    setNotes('');
    setSubmitNonce(`sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`);
    if (res.transaction) {
      setSelectedTxId(res.transaction.id);
    }
  };

  const handleOpenSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);
    const res = onOpenSession(
      {
        cashOnHand: parseFloat(openCash) || 0,
        GCash: parseFloat(openGcash) || 0,
        Maya: parseFloat(openMaya) || 0,
        MariBank: parseFloat(openMaribank) || 0,
        Other: parseFloat(openOther) || 0,
      },
      openNotes
    );
    if (!res.ok) {
      setSessionError(res.error ?? 'Could not open session.');
    }
  };

  const handleStartCloseSession = () => {
    if (!liveBalances) return;
    setActualCash(String(liveBalances.cashOnHand));
    setActualGcash(String(liveBalances.GCash));
    setActualMaya(String(liveBalances.Maya));
    setActualMaribank(String(liveBalances.MariBank));
    setActualOther(String(liveBalances.Other));
    setCloseNotes('');
    setSessionError(null);
    setCloseMode(true);
  };

  const handleCloseSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openSession) return;
    setSessionError(null);
    const res = onCloseSession(
      openSession.id,
      {
        cashOnHand: parseFloat(actualCash) || 0,
        GCash: parseFloat(actualGcash) || 0,
        Maya: parseFloat(actualMaya) || 0,
        MariBank: parseFloat(actualMaribank) || 0,
        Other: parseFloat(actualOther) || 0,
      },
      closeNotes
    );
    if (!res.ok) {
      setSessionError(res.error ?? 'Could not close session.');
      return;
    }
    setCloseMode(false);
  };

  const renderTxCard = (tx: EWalletTransaction) => {
    const meta = STATUS_META[tx.status];
    const StatusIcon = meta.Icon;
    const prov =
      tx.provider === 'Other' ? tx.customProviderName || 'Other' : tx.provider;

    return (
      <button
        key={tx.id}
        type="button"
        onClick={() => setSelectedTxId(tx.id)}
        className="w-full rounded-2xl border border-stone-200 bg-white p-3.5 text-left hover:border-sky-600 active:scale-[0.99] transition"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-900">
                {prov} · {formatTxTypeLabel(tx.type)}
              </span>
            </div>
            <p className="mt-0.5 font-mono-num text-xs text-stone-600">
              Ref: {tx.referenceNumber} · {tx.id}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono-num text-base font-bold text-stone-900">
              {formatPHP(tx.amount)}
            </p>
            <p className="font-mono-num text-[11px] font-semibold text-sky-800">
              Fee {formatPHP(tx.serviceFee)}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-stone-100 pt-2">
          <span className="truncate text-xs text-stone-500">
            {tx.customerName ? `${tx.customerName} ` : ''}
            {tx.customerMobile ? maskMobileNumber(tx.customerMobile) : ''}
            {!tx.customerName && !tx.customerMobile
              ? formatShortDateTime(tx.createdAt)
              : ''}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold shrink-0 ${meta.colorClass}`}
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            <span>{meta.label}</span>
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Live Wallet Balances or Session Banner */}
      {openSession && liveBalances ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">
              Session Open · Cash {formatPHP(liveBalances.cashOnHand)}
            </span>
            <button
              type="button"
              onClick={() => setTab('session')}
              className="text-xs font-bold text-sky-800 underline"
            >
              Manage
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-xl bg-sky-50/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-sky-900">GCash</p>
              <p className="font-mono-num text-xs font-bold text-stone-900 truncate">
                {formatPHP(liveBalances.GCash)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-emerald-900">Maya</p>
              <p className="font-mono-num text-xs font-bold text-stone-900 truncate">
                {formatPHP(liveBalances.Maya)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-amber-900">MariBank</p>
              <p className="font-mono-num text-xs font-bold text-stone-900 truncate">
                {formatPHP(liveBalances.MariBank)}
              </p>
            </div>
          </div>
        </section>
      ) : tab !== 'session' ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900">No E-Wallet Session Open</p>
            <p className="text-[11px] text-amber-800">
              Open a session to track starting balances &amp; EOD reconciliation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTab('session')}
            className="min-h-[40px] rounded-xl bg-amber-700 px-3 text-xs font-bold text-white shrink-0"
          >
            Open Session
          </button>
        </div>
      ) : null}

      {/* TAB 1: TRANSACT (Record Cash-In / Cash-Out / Transfer / Payments) */}
      {tab === 'transact' && (
        <form
          onSubmit={handleRecordTx}
          className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900">
              New E-Wallet Transaction
            </h2>
          </div>

          {/* Provider Selector */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone-700">Provider</p>
            <div className="grid grid-cols-3 gap-1.5">
              {EWALLET_PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    setFormError(null);
                  }}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition ${
                    provider === p
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {provider === 'Other' && (
              <input
                type="text"
                aria-label="Custom wallet or bank name"
                value={customProviderName}
                onChange={(e) => setCustomProviderName(e.target.value)}
                placeholder="Enter bank or wallet name (e.g. SeaBank / BPI)"
                className="mt-2 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-900"
              />
            )}
          </div>

          {/* Transaction Type */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone-700">
              Transaction Type
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {EWALLET_TX_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTxType(t);
                    setFormError(null);
                  }}
                  className={`min-h-[44px] rounded-xl border px-2.5 text-xs font-bold transition ${
                    txType === t
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  {formatTxTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Service Fee */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="ew-amount"
                className="block text-xs font-semibold text-stone-700"
              >
                Amount (₱) *
              </label>
              <input
                id="ew-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="1"
                required
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setFormError(null);
                }}
                placeholder="500.00"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-lg font-bold text-stone-900 focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ew-fee"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Service Fee (₱)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const amt = parseFloat(amountInput);
                    if (Number.isFinite(amt) && amt > 0) {
                      setFeeInput(String(getSuggestedServiceFee(amt, txType)));
                    }
                  }}
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-sky-800"
                >
                  <Calculator className="h-3 w-3" aria-hidden="true" />
                  <span>Auto</span>
                </button>
              </div>
              <input
                id="ew-fee"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="10.00"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-lg font-bold text-sky-900 focus:border-sky-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Reference Number with Duplicate Detection */}
          <div>
            <label
              htmlFor="ew-ref"
              className="block text-xs font-semibold text-stone-700"
            >
              Reference Number *
            </label>
            <input
              id="ew-ref"
              type="text"
              required
              value={referenceNumber}
              onChange={(e) => {
                setReferenceNumber(e.target.value);
                setFormError(null);
              }}
              placeholder="e.g. GC-90123456"
              className={`mt-1 min-h-[48px] w-full rounded-xl border px-3 font-mono-num text-base text-stone-900 focus:outline-none ${
                duplicateRefMatch
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-stone-300 focus:border-sky-700'
              }`}
            />
            {duplicateRefMatch && (
              <div
                role="alert"
                className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Duplicate ref for {provider}: matches {duplicateRefMatch.id} (
                  {duplicateRefMatch.status}).{' '}
                  <button
                    type="button"
                    onClick={() => setSelectedTxId(duplicateRefMatch.id)}
                    className="underline font-bold"
                  >
                    Inspect
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Customer Name & Mobile */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="ew-cust-name"
                className="block text-xs font-semibold text-stone-700"
              >
                Customer Name
              </label>
              <input
                id="ew-cust-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
                className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-900"
              />
            </div>
            <div>
              <label
                htmlFor="ew-cust-mobile"
                className="block text-xs font-semibold text-stone-700"
              >
                Mobile Number
              </label>
              <input
                id="ew-cust-mobile"
                type="tel"
                inputMode="tel"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="0917..."
                className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm text-stone-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ew-notes"
              className="block text-xs font-semibold text-stone-700"
            >
              Notes (Optional)
            </label>
            <input
              id="ew-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified SMS or customer details"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-sm text-stone-900"
            />
          </div>

          {/* Guardrail Notice */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              Recorded transactions start as <strong>Pending</strong>. Staff must manually confirm receipt in the wallet app/SMS or via authorized provider before completing or claiming.
            </span>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-semibold text-red-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={!!duplicateRefMatch}
            className="min-h-[52px] w-full rounded-xl bg-sky-700 px-4 text-base font-bold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Record E-Wallet Transaction
          </button>
        </form>
      )}

      {/* TAB 2: CLAIM & VERIFY */}
      {tab === 'claim' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
            <h2 className="text-base font-bold text-stone-900">
              Verify &amp; Claim Transaction
            </h2>
            <p className="text-xs text-stone-600">
              Enter a reference number, mobile number, or internal ID to check claim status and verify payment.
            </p>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <label htmlFor="ew-claim-search" className="sr-only">
                Search by reference number or mobile number
              </label>
              <input
                id="ew-claim-search"
                type="search"
                value={claimQuery}
                onChange={(e) => setClaimQuery(e.target.value)}
                placeholder="Search Ref #, 09XX mobile, or EW-ID..."
                className="min-h-[48px] w-full rounded-xl border border-stone-300 bg-white pl-9 pr-9 font-mono-num text-sm text-stone-900 focus:border-sky-700 focus:outline-none"
              />
              {claimQuery && (
                <button
                  type="button"
                  onClick={() => setClaimQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-bold text-stone-700">
              {claimQuery.trim()
                ? `Search Results (${claimMatches.length})`
                : `Awaiting Verification / Claim (${claimMatches.length})`}
            </p>
          </div>

          {claimMatches.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
              <p className="text-sm font-semibold text-stone-700">
                No matching E-Wallet transactions
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Check the reference number or mobile number and try again.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">{claimMatches.map(renderTxCard)}</div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY & SUMMARIES */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* Today's E-Wallet Financial Summary */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>Today Cash-In</span>
              </div>
              <p className="mt-1 font-mono-num text-lg font-bold text-stone-900">
                {formatPHP(todaySummary.totalCashIn)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                <ArrowDownLeft className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
                <span>Today Cash-Out</span>
              </div>
              <p className="mt-1 font-mono-num text-lg font-bold text-stone-900">
                {formatPHP(todaySummary.totalCashOut)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-stone-500">Service Fees Earned</p>
              <p className="mt-1 font-mono-num text-lg font-bold text-sky-800">
                {formatPHP(todaySummary.totalServiceFees)}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-stone-500">Pending · Flagged</p>
              <p className="mt-1 font-mono-num text-lg font-bold text-amber-800">
                {todaySummary.pendingCount} ·{' '}
                <span className="text-red-700">{todaySummary.flaggedCount}</span>
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filter E-Wallet history"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search ref, customer, mobile, ID..."
                className="min-h-[44px] w-full rounded-xl border border-stone-200 pl-9 pr-3 text-sm text-stone-900 focus:border-sky-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as EWalletTxStatus | 'all')
                }
                className="min-h-[42px] rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-800"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="claimed">Claimed</option>
                <option value="flagged">Flagged</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                aria-label="Filter by provider"
                value={providerFilter}
                onChange={(e) =>
                  setProviderFilter(e.target.value as EWalletProvider | 'all')
                }
                className="min-h-[42px] rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-800"
              >
                <option value="all">All Providers</option>
                {EWALLET_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {historyList.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
              <p className="text-sm font-semibold text-stone-700">
                No E-Wallet transactions yet
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">{historyList.map(renderTxCard)}</div>
          )}
        </div>
      )}

      {/* TAB 4: OPEN / CLOSE SESSION & EOD RECONCILIATION */}
      {tab === 'session' && (
        <div className="space-y-4">
          {!openSession ? (
            <form
              onSubmit={handleOpenSessionSubmit}
              className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3.5"
            >
              <div className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Open E-Wallet Session
                  </h2>
                  <p className="text-xs text-stone-500">
                    Enter starting cash &amp; wallet balances for today
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="open-cash"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Cash on Hand (₱)
                  </label>
                  <input
                    id="open-cash"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openCash}
                    onChange={(e) => setOpenCash(e.target.value)}
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="open-gcash"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    GCash Start (₱)
                  </label>
                  <input
                    id="open-gcash"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openGcash}
                    onChange={(e) => setOpenGcash(e.target.value)}
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="open-maya"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Maya Start (₱)
                  </label>
                  <input
                    id="open-maya"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openMaya}
                    onChange={(e) => setOpenMaya(e.target.value)}
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="open-maribank"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    MariBank Start (₱)
                  </label>
                  <input
                    id="open-maribank"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openMaribank}
                    onChange={(e) => setOpenMaribank(e.target.value)}
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="open-other"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Other Wallets (₱)
                  </label>
                  <input
                    id="open-other"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={openOther}
                    onChange={(e) => setOpenOther(e.target.value)}
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-base font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="open-notes"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Shift Note
                  </label>
                  <input
                    id="open-notes"
                    type="text"
                    value={openNotes}
                    onChange={(e) => setOpenNotes(e.target.value)}
                    placeholder="Morning shift"
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 text-sm"
                  />
                </div>
              </div>

              {sessionError && (
                <p role="alert" className="text-xs font-semibold text-red-700">
                  {sessionError}
                </p>
              )}

              {!canManageSession ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Only an Owner or Manager can open an E-Wallet session.
                </p>
              ) : (
                <button
                  type="submit"
                  className="min-h-[50px] w-full rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800"
                >
                  Open E-Wallet Session
                </button>
              )}
            </form>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-emerald-700">Active Session</p>
                  <h2 className="text-base font-bold text-stone-900">
                    Opened {formatShortDateTime(openSession.openedAt)}
                  </h2>
                </div>
                {!closeMode && canManageSession && (
                  <button
                    type="button"
                    onClick={handleStartCloseSession}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 text-xs font-bold text-white"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Close &amp; Reconcile</span>
                  </button>
                )}
              </div>

              {liveBalances && !closeMode && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-stone-700">
                    Expected Balances (Starting vs Current)
                  </p>
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {(
                      [
                        ['Cash Drawer', openSession.startingBalances.cashOnHand, liveBalances.cashOnHand],
                        ['GCash', openSession.startingBalances.GCash, liveBalances.GCash],
                        ['Maya', openSession.startingBalances.Maya, liveBalances.Maya],
                        ['MariBank', openSession.startingBalances.MariBank, liveBalances.MariBank],
                        ['Other Wallets', openSession.startingBalances.Other, liveBalances.Other],
                      ] as Array<[string, number, number]>
                    ).map(([label, startVal, currVal]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                      >
                        <span className="font-semibold text-stone-700">{label}</span>
                        <div className="text-right font-mono-num">
                          <span className="text-stone-400 mr-2">
                            Start {formatPHP(startVal)}
                          </span>
                          <span className="font-bold text-stone-900">
                            {formatPHP(currVal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {closeMode && liveBalances && (
                <form
                  onSubmit={handleCloseSessionSubmit}
                  className="border-t border-stone-200 pt-4 space-y-3"
                >
                  <h3 className="text-sm font-bold text-stone-900">
                    Enter Actual Closing Balances
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="actual-cash" className="block text-xs font-semibold text-stone-700">
                        Actual Cash (₱)
                      </label>
                      <input
                        id="actual-cash"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="actual-gcash" className="block text-xs font-semibold text-stone-700">
                        Actual GCash (₱)
                      </label>
                      <input
                        id="actual-gcash"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={actualGcash}
                        onChange={(e) => setActualGcash(e.target.value)}
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="actual-maya" className="block text-xs font-semibold text-stone-700">
                        Actual Maya (₱)
                      </label>
                      <input
                        id="actual-maya"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={actualMaya}
                        onChange={(e) => setActualMaya(e.target.value)}
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="actual-maribank" className="block text-xs font-semibold text-stone-700">
                        Actual MariBank (₱)
                      </label>
                      <input
                        id="actual-maribank"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={actualMaribank}
                        onChange={(e) => setActualMaribank(e.target.value)}
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="actual-other" className="block text-xs font-semibold text-stone-700">
                        Actual Other (₱)
                      </label>
                      <input
                        id="actual-other"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={actualOther}
                        onChange={(e) => setActualOther(e.target.value)}
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 font-mono-num text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="close-notes" className="block text-xs font-semibold text-stone-700">
                        Closing Note
                      </label>
                      <input
                        id="close-notes"
                        type="text"
                        value={closeNotes}
                        onChange={(e) => setCloseNotes(e.target.value)}
                        placeholder="End of day"
                        className="mt-1 min-h-[46px] w-full rounded-xl border border-stone-300 px-3 text-sm"
                      />
                    </div>
                  </div>
                  {sessionError && (
                    <p role="alert" className="text-xs font-semibold text-red-700">
                      {sessionError}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloseMode(false)}
                      className="min-h-[48px] rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="min-h-[48px] rounded-xl bg-sky-700 text-xs font-bold text-white"
                    >
                      Generate EOD Report
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* End-of-Day Reconciliation Reports */}
          <div className="space-y-2.5">
            <h3 className="px-1 text-sm font-bold text-stone-900">
              End-of-Day Reconciliation Reports ({closedSessions.length})
            </h3>
            {closedSessions.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-xs text-stone-500">
                No closed E-Wallet sessions yet. Close an active session to generate an end-of-day reconciliation report.
              </div>
            ) : (
              closedSessions.map((sess) => {
                const rep = sess.reconciliation;
                if (!rep) return null;
                return (
                  <div
                    key={sess.id}
                    className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-stone-900">
                          Closed {formatShortDateTime(sess.closedAt ?? sess.openedAt)}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {rep.transactionCount} transaction(s)
                        </p>
                      </div>
                      <span className="font-mono-num text-sm font-bold text-emerald-700">
                        Fees +{formatPHP(rep.totalServiceFees)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-stone-50 p-2.5">
                        <p className="text-stone-500">Total Cash-In</p>
                        <p className="font-mono-num font-bold text-stone-900">
                          {formatPHP(rep.totalCashIn)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-stone-50 p-2.5">
                        <p className="text-stone-500">Total Cash-Out</p>
                        <p className="font-mono-num font-bold text-stone-900">
                          {formatPHP(rep.totalCashOut)}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-xs">
                      {(
                        [
                          ['Cash Drawer', rep.expectedBalances.cashOnHand, rep.actualBalances.cashOnHand, rep.discrepancies.cashOnHand],
                          ['GCash', rep.expectedBalances.GCash, rep.actualBalances.GCash, rep.discrepancies.GCash],
                          ['Maya', rep.expectedBalances.Maya, rep.actualBalances.Maya, rep.discrepancies.Maya],
                          ['MariBank', rep.expectedBalances.MariBank, rep.actualBalances.MariBank, rep.discrepancies.MariBank],
                          ['Other Wallets', rep.expectedBalances.Other, rep.actualBalances.Other, rep.discrepancies.Other],
                        ] as Array<[string, number, number, number]>
                      ).map(([label, exp, act, diff]) => (
                        <div
                          key={label}
                          className="px-3 py-2 space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-stone-800">{label}</span>
                            <span
                              className={`font-mono-num font-bold whitespace-nowrap ${
                                diff === 0
                                  ? 'text-emerald-700'
                                  : diff < 0
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                              }`}
                            >
                              {diff === 0
                                ? '₱0.00'
                                : `${diff > 0 ? '+' : ''}${formatPHP(diff)}`}
                            </span>
                          </div>
                          <p className="font-mono-num text-[11px] text-stone-500">
                            Exp {formatPHP(exp)} · Act {formatPHP(act)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* E-Wallet Bottom 4-Tab Bar */}
      <nav
        aria-label="E-Wallet navigation"
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe"
      >
        <div className="grid h-[60px] grid-cols-4 items-center">
          {(
            [
              { id: 'transact', label: 'Transact', Icon: PlusCircle },
              { id: 'claim', label: 'Claim', Icon: ClipboardCheck },
              { id: 'history', label: 'History', Icon: History },
              { id: 'session', label: 'Session', Icon: Wallet },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full min-h-[48px] flex-col items-center justify-center gap-0.5 transition ${
                  active
                    ? 'text-sky-700 font-bold'
                    : 'text-stone-500 font-medium hover:text-stone-900'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Transaction Verification / Claim Modal */}
      <EWalletTxModal
        transaction={selectedTx}
        activeStaff={activeStaff}
        onVerify={onVerifyTransaction}
        onClaim={onClaimTransaction}
        onUpdateStatus={onUpdateStatus}
        onClose={() => setSelectedTxId(null)}
      />
    </div>
  );
};
