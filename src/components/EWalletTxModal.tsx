import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flag,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  EWalletTransaction,
  EWalletTxStatus,
  StaffMember,
  VerificationMethod,
} from '../types/pos';
import { formatPHP, formatShortDateTime } from '../utils/format';
import {
  formatTxTypeLabel,
  hasPermission,
  maskMobileNumber,
} from '../utils/ewalletLogic';
import { ConfirmDialog } from './ConfirmDialog';

interface EWalletTxModalProps {
  transaction: EWalletTransaction | null;
  activeStaff: StaffMember;
  onVerify: (
    txId: string,
    options: {
      method: Exclude<VerificationMethod, 'none'>;
      staffConfirmedReceipt: boolean;
      note?: string;
      markCompleted?: boolean;
    }
  ) => { ok: boolean; error?: string };
  onClaim: (
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
  onClose: () => void;
}

export const STATUS_META: Record<
  EWalletTxStatus,
  { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  completed: {
    label: 'Completed',
    colorClass: 'text-sky-800 bg-sky-50 border-sky-200',
    Icon: ShieldCheck,
  },
  claimed: {
    label: 'Claimed',
    colorClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  flagged: {
    label: 'Flagged',
    colorClass: 'text-red-700 bg-red-50 border-red-200',
    Icon: Flag,
  },
  cancelled: {
    label: 'Cancelled',
    colorClass: 'text-stone-600 bg-stone-100 border-stone-200',
    Icon: Ban,
  },
};

export const EWalletTxModal: React.FC<EWalletTxModalProps> = ({
  transaction,
  activeStaff,
  onVerify,
  onClaim,
  onUpdateStatus,
  onClose,
}) => {
  const [revealMobile, setRevealMobile] = useState(false);
  const [staffConfirmedReceipt, setStaffConfirmedReceipt] = useState(false);
  const [verificationMethod, setVerificationMethod] =
    useState<Exclude<VerificationMethod, 'none'>>('manual_staff');
  const [verificationNote, setVerificationNote] = useState('');
  const [reasonMode, setReasonMode] = useState<'flag' | 'cancel' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirmClaimOpen, setConfirmClaimOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setRevealMobile(false);
      setStaffConfirmedReceipt(transaction.verified);
      setVerificationMethod(
        transaction.verificationMethod === 'authorized_provider'
          ? 'authorized_provider'
          : 'manual_staff'
      );
      setVerificationNote(transaction.verificationNote ?? '');
      setReasonMode(null);
      setReasonText('');
      setConfirmClaimOpen(false);
      setError(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const meta = STATUS_META[transaction.status];
  const StatusIcon = meta.Icon;
  const providerLabel =
    transaction.provider === 'Other'
      ? transaction.customProviderName || 'Other Wallet'
      : transaction.provider;

  const canClaim =
    (transaction.status === 'pending' || transaction.status === 'completed') &&
    hasPermission(activeStaff.role, 'ewallet_claim');
  const canVerify =
    (transaction.status === 'pending' || transaction.status === 'completed') &&
    !transaction.verified &&
    hasPermission(activeStaff.role, 'ewallet_verify');
  const canCancel =
    transaction.status !== 'claimed' &&
    transaction.status !== 'cancelled' &&
    hasPermission(activeStaff.role, 'ewallet_cancel');
  const canFlag =
    transaction.status !== 'cancelled' &&
    transaction.status !== 'flagged' &&
    hasPermission(activeStaff.role, 'ewallet_flag');
  const canReopenFlagged =
    transaction.status === 'flagged' &&
    hasPermission(activeStaff.role, 'ewallet_cancel');

  const handleVerifyAction = (markCompleted: boolean) => {
    setError(null);
    const res = onVerify(transaction.id, {
      method: verificationMethod,
      staffConfirmedReceipt,
      note: verificationNote,
      markCompleted,
    });
    if (!res.ok) {
      setError(res.error ?? 'Could not verify transaction.');
    }
  };

  const handleClaimConfirmed = () => {
    setConfirmClaimOpen(false);
    setError(null);
    const res = onClaim(transaction.id, {
      staffConfirmedReceipt: transaction.verified || staffConfirmedReceipt,
      verificationMethod,
      note: verificationNote,
    });
    if (!res.ok) {
      setError(res.error ?? 'Could not claim transaction.');
    }
  };

  const handleReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonMode) return;
    setError(null);
    const res = onUpdateStatus(
      transaction.id,
      reasonMode === 'flag' ? 'flagged' : 'cancelled',
      reasonText
    );
    if (!res.ok) {
      setError(res.error ?? 'Could not update status.');
      return;
    }
    setReasonMode(null);
    setReasonText('');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label="E-Wallet Transaction Details"
      >
        <div className="flex max-h-[92vh] w-full max-w-[440px] flex-col rounded-t-3xl bg-white shadow-xl pb-safe">
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-num text-sm font-bold text-stone-900">
                  {transaction.id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-bold ${meta.colorClass}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{meta.label}</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {providerLabel} · {formatTxTypeLabel(transaction.type)} ·{' '}
                {formatShortDateTime(transaction.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close transaction details"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Financial Breakdown */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-stone-600">Principal Amount</span>
                <span className="font-mono-num text-2xl font-bold text-stone-900">
                  {formatPHP(transaction.amount)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-stone-600">Service Fee</span>
                <span className="font-mono-num font-bold text-sky-800">
                  {formatPHP(transaction.serviceFee)}
                </span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-stone-600">Reference Number</span>
                <span className="font-mono-num text-sm font-bold text-stone-900">
                  {transaction.referenceNumber}
                </span>
              </div>
            </div>

            {/* Customer & Staff Metadata */}
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-2 text-xs">
              {transaction.customerName && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Customer</span>
                  <span className="font-semibold text-stone-900">
                    {transaction.customerName}
                  </span>
                </div>
              )}
              {transaction.customerMobile && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Mobile Number</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-num font-semibold text-stone-900">
                      {revealMobile
                        ? transaction.customerMobile
                        : maskMobileNumber(transaction.customerMobile)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealMobile((v) => !v)}
                      aria-label={revealMobile ? 'Hide mobile number' : 'Reveal mobile number'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600"
                    >
                      {revealMobile ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-500">Recorded By</span>
                <span className="font-semibold text-stone-800">
                  {transaction.createdByStaffName}
                </span>
              </div>
              {transaction.notes && (
                <div className="pt-1 border-t border-stone-100 text-stone-600">
                  Note: {transaction.notes}
                </div>
              )}
            </div>

            {/* Already Claimed Banner */}
            {transaction.status === 'claimed' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Already Claimed</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Claimed on{' '}
                  {formatShortDateTime(transaction.claimedAt ?? transaction.updatedAt)} by{' '}
                  <span className="font-bold">
                    {transaction.claimedByStaffName ?? 'Staff'}
                  </span>
                  . Duplicate claiming is disabled.
                </p>
              </div>
            )}

            {/* Flagged / Cancelled Reason Banner */}
            {transaction.status === 'flagged' && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Flagged for Review</span>
                </div>
                <p className="text-xs text-red-700">{transaction.flagReason}</p>
                {canReopenFlagged && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onUpdateStatus(
                        transaction.id,
                        'pending',
                        'Flag resolved by manager/owner'
                      );
                      if (!res.ok) setError(res.error ?? 'Unable to reopen');
                    }}
                    className="min-h-[42px] w-full rounded-xl border border-red-300 bg-white text-xs font-bold text-red-800"
                  >
                    Clear Flag &amp; Return to Pending
                  </button>
                )}
              </div>
            )}

            {transaction.status === 'cancelled' && (
              <div className="rounded-2xl border border-stone-300 bg-stone-100 p-3.5">
                <p className="text-xs font-bold text-stone-800">Transaction Cancelled</p>
                {transaction.cancelReason && (
                  <p className="mt-1 text-xs text-stone-600">{transaction.cancelReason}</p>
                )}
              </div>
            )}

            {/* Verification & Claim Controls */}
            {(canVerify || canClaim) && (
              <div className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">
                    Payment Verification &amp; Claim
                  </h3>
                  <span
                    className={`text-xs font-bold ${
                      transaction.verified ? 'text-emerald-700' : 'text-amber-800'
                    }`}
                  >
                    {transaction.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>

                {transaction.verified ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    Verified via{' '}
                    <span className="font-bold">
                      {transaction.verificationMethod === 'authorized_provider'
                        ? 'Authorized Provider'
                        : 'Manual Staff Check'}
                    </span>{' '}
                    by {transaction.verifiedByStaffName} (
                    {formatShortDateTime(
                      transaction.verifiedAt ?? transaction.updatedAt
                    )}
                    )
                    {transaction.verificationNote
                      ? ` · ${transaction.verificationNote}`
                      : ''}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Reference numbers alone do not confirm payment. Verify receipt in the official wallet app/SMS or authorized provider first.
                    </p>

                    <div>
                      <label
                        htmlFor="tx-verify-method"
                        className="block text-xs font-semibold text-stone-700"
                      >
                        Verification Method
                      </label>
                      <select
                        id="tx-verify-method"
                        value={verificationMethod}
                        onChange={(e) =>
                          setVerificationMethod(
                            e.target.value as Exclude<VerificationMethod, 'none'>
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-900"
                      >
                        <option value="manual_staff">
                          Manual Staff Verification (Checked Wallet App / SMS)
                        </option>
                        <option value="authorized_provider">
                          Authorized Provider Integration Confirmation
                        </option>
                      </select>
                    </div>

                    <input
                      type="text"
                      aria-label="Verification note"
                      value={verificationNote}
                      onChange={(e) => setVerificationNote(e.target.value)}
                      placeholder="Verification note (e.g. Checked GCash SMS balance)"
                      className="min-h-[44px] w-full rounded-xl border border-stone-300 px-3 text-xs text-stone-900"
                    />

                    <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs font-semibold text-stone-800">
                      <input
                        type="checkbox"
                        checked={staffConfirmedReceipt}
                        onChange={(e) => {
                          setStaffConfirmedReceipt(e.target.checked);
                          setError(null);
                        }}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
                      />
                      <span>
                        I confirm actual payment was verified in the official provider app/SMS or authorized provider system.
                      </span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {canVerify && (
                    <button
                      type="button"
                      onClick={() => handleVerifyAction(true)}
                      className="min-h-[48px] w-full rounded-xl border border-sky-700 bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800"
                    >
                      Verify &amp; Mark Completed
                    </button>
                  )}

                  {canClaim && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!transaction.verified && !staffConfirmedReceipt) {
                          setError(
                            'Please check the verification confirmation box before claiming.'
                          );
                          return;
                        }
                        setConfirmClaimOpen(true);
                      }}
                      className="min-h-[50px] w-full rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
                    >
                      Confirm &amp; Mark Claimed
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Flag / Cancel Section */}
            {(canFlag || canCancel) && !reasonMode && (
              <div className="grid grid-cols-2 gap-2">
                {canFlag && (
                  <button
                    type="button"
                    onClick={() => setReasonMode('flag')}
                    className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-bold text-amber-900"
                  >
                    <Flag className="h-4 w-4" aria-hidden="true" />
                    <span>Flag Issue</span>
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => setReasonMode('cancel')}
                    className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700"
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    <span>Cancel Tx</span>
                  </button>
                )}
              </div>
            )}

            {reasonMode && (
              <form
                onSubmit={handleReasonSubmit}
                className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2.5"
              >
                <p className="text-xs font-bold text-stone-900">
                  {reasonMode === 'flag' ? 'Flag Transaction' : 'Cancel Transaction'}
                </p>
                <input
                  type="text"
                  aria-label="Reason"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={
                    reasonMode === 'flag'
                      ? 'Reason (e.g. Reference mismatch in SMS)'
                      : 'Reason (e.g. Customer backed out)'
                  }
                  className="min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-xs text-stone-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReasonMode(null);
                      setReasonText('');
                    }}
                    className="min-h-[42px] rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className={`min-h-[42px] rounded-xl text-xs font-bold text-white ${
                      reasonMode === 'flag' ? 'bg-amber-700' : 'bg-red-700'
                    }`}
                  >
                    {reasonMode === 'flag' ? 'Submit Flag' : 'Confirm Cancel'}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClaimOpen}
        title="Confirm Claim Transaction"
        message={`Mark ${transaction.id} (${providerLabel} ${formatPHP(
          transaction.amount
        )}, Ref: ${transaction.referenceNumber}) as Claimed by ${
          activeStaff.name
        }? This cannot be undone or claimed again.`}
        confirmLabel="Mark Claimed"
        variant="primary"
        onConfirm={handleClaimConfirmed}
        onCancel={() => setConfirmClaimOpen(false)}
      />
    </>
  );
};
