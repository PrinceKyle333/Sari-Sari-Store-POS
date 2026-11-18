import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Edit3,
  Package,
  PackagePlus,
  ScanBarcode,
  Settings as SettingsIcon,
  ShoppingBag,
  ShoppingBasket,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { BarcodeScanner } from './components/BarcodeScanner';
import { Cart } from './components/Cart';
import { CheckoutModal } from './components/CheckoutModal';
import { CreditList } from './components/CreditList';
import { EWalletModule } from './components/EWalletModule';
import { LandingPage } from './components/LandingPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProductForm } from './components/ProductForm';
import { ProductList } from './components/ProductList';
import { Reports } from './components/Reports';
import { SellScreen } from './components/SellScreen';
import { Settings } from './components/Settings';
import { StaffAuthModal } from './components/StaffAuthModal';
import { StockAdjust } from './components/StockAdjust';
import { ToastContainer, type ToastMessage } from './components/ToastContainer';
import { loadPOSStateFromDB, savePOSStateToDB } from './db/posDb';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type {
  CartItem,
  EWalletBalances,
  EWalletProvider,
  EWalletTxType,
  PaymentMethod,
  POSState,
  Product,
  Sale,
  SaleUnit,
  ScannerSettings,
  VerificationMethod,
} from './types/pos';
import { formatPHP } from './utils/format';
import {
  claimEWalletTransaction,
  closeEWalletSession,
  createAuditLog,
  createEWalletTransaction,
  enqueueSyncMutation,
  getActiveStaffMember,
  hasPermission,
  openEWalletSession,
  reconcileSyncQueue,
  updateEWalletTransactionStatus,
  verifyEWalletTransaction,
} from './utils/ewalletLogic';
import {
  addProductToCart,
  applyStockAdjustment,
  applyStockRestock,
  calculateCartTotal,
  completeCheckout,
  createId,
  DEFAULT_POS_STATE,
  findProductByBarcode,
  getCustomerCreditSummaries,
  recordCustomerPayment,
  updateCartItemQuantity,
  voidSaleTransaction,
} from './utils/posLogic';
import { createSamplePOSState } from './utils/sampleData';

type AppModule = 'landing' | 'pos' | 'ewallet';
type TabId = 'sell' | 'products' | 'credit' | 'reports' | 'settings';
type ScannerPurpose = 'sell' | 'add_product' | 'restock';

const NAV_TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'sell', label: 'Sell', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'credit', label: 'Credit', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function getInitialModule(): AppModule {
  if (typeof window === 'undefined') return 'landing';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1' || params.get('module') === 'pos') {
    return 'pos';
  }
  if (params.get('module') === 'ewallet') {
    return 'ewallet';
  }
  return 'landing';
}

export default function App() {
  const [state, setState] = useState<POSState>(DEFAULT_POS_STATE);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [activeModule, setActiveModule] = useState<AppModule>(getInitialModule);
  // Branded welcome screen shown each time the app is opened on the home screen.
  const [showWelcome, setShowWelcome] = useState(() => getInitialModule() === 'landing');
  const [activeTab, setActiveTab] = useState<TabId>('sell');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Activity Log Modal
  const [activityLogOpen, setActivityLogOpen] = useState(false);

  // Scanner states
  const [scannerPurpose, setScannerPurpose] = useState<ScannerPurpose | null>(null);
  const [continuousScan, setContinuousScan] = useState(false);
  const [lastScannedMsg, setLastScannedMsg] = useState<string | null>(null);
  const [unmatchedBarcode, setUnmatchedBarcode] = useState<string | null>(null);
  const [sellUnitPrompt, setSellUnitPrompt] = useState<Product | null>(null);

  // Existing product choice when scanning to add
  const [existingScanProduct, setExistingScanProduct] = useState<Product | null>(null);

  // Modals
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prefillBarcode, setPrefillBarcode] = useState('');

  // StockAdjust modal
  const [stockAdjustTarget, setStockAdjustTarget] = useState<Product | null>(null);
  const [stockAdjustMode, setStockAdjustMode] = useState<'restock' | 'adjust' | 'history'>('restock');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const isOnline = useOnlineStatus();

  // Load initial state from IndexedDB via Dexie
  useEffect(() => {
    let active = true;
    void loadPOSStateFromDB().then((loaded) => {
      if (active) {
        setState(loaded);
        setDbLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist updates to IndexedDB after initial load
  useEffect(() => {
    if (!dbLoaded) return;
    void savePOSStateToDB(state);
  }, [state, dbLoaded]);

  // Auto-reconcile offline sync queue when connectivity is restored
  useEffect(() => {
    if (!dbLoaded || !isOnline) return;
    const hasPending = state.syncQueue.some((q) => q.status === 'pending');
    if (!hasPending) return;
    setState((prev) => {
      const stillPending = prev.syncQueue.some((q) => q.status === 'pending');
      if (!stillPending) return prev;
      return reconcileSyncQueue(prev).nextState;
    });
  }, [dbLoaded, isOnline, state.syncQueue]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab, activeModule]);

  const activeStaff = useMemo(() => getActiveStaffMember(state), [state]);

  const notify = useCallback(
    (text: string, type: ToastMessage['type'] = 'success') => {
      const id = createId('toast');
      setToasts([{ id, text, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 1800);
    },
    []
  );

  // Android back button: close the top-most layer, then step back through
  // tabs/modules, and only exit the app from the landing screen.
  useAndroidBackButton(() => {
    if (showWelcome) return false;
    if (scannerPurpose !== null) return setScannerPurpose(null), true;
    if (stockAdjustTarget !== null) return setStockAdjustTarget(null), true;
    if (productFormOpen) {
      setProductFormOpen(false);
      setEditingProduct(null);
      setPrefillBarcode('');
      return true;
    }
    if (checkoutOpen) {
      setCheckoutOpen(false);
      setCompletedSale(null);
      return true;
    }
    if (activityLogOpen) return setActivityLogOpen(false), true;
    if (sellUnitPrompt !== null) return setSellUnitPrompt(null), true;
    if (existingScanProduct !== null) return setExistingScanProduct(null), true;
    if (mobileCartOpen) return setMobileCartOpen(false), true;
    if (activeModule === 'pos' && activeTab !== 'sell') return setActiveTab('sell'), true;
    if (activeModule !== 'landing') return setActiveModule('landing'), true;
    return false;
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- E-Wallet Handlers ---
  const handleCreateEWalletTx = (input: {
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
  }) => {
    const res = createEWalletTransaction(state, input);
    if (res.error || !res.transaction) {
      return { ok: false, error: res.error };
    }
    setState(res.nextState);
    notify(`Recorded ${res.transaction.id} (Pending verification)`, 'success');
    return { ok: true, transaction: res.transaction };
  };

  const handleVerifyEWalletTx = (
    txId: string,
    options: {
      method: Exclude<VerificationMethod, 'none'>;
      staffConfirmedReceipt: boolean;
      note?: string;
      markCompleted?: boolean;
    }
  ) => {
    const res = verifyEWalletTransaction(state, txId, options);
    if (res.error) return { ok: false, error: res.error };
    setState(res.nextState);
    notify('Transaction verified', 'success');
    return { ok: true };
  };

  const handleClaimEWalletTx = (
    txId: string,
    options: {
      staffConfirmedReceipt: boolean;
      verificationMethod?: Exclude<VerificationMethod, 'none'>;
      note?: string;
    }
  ) => {
    const res = claimEWalletTransaction(state, txId, options);
    if (res.error) return { ok: false, error: res.error };
    setState(res.nextState);
    notify('Transaction marked Claimed', 'success');
    return { ok: true };
  };

  const handleUpdateEWalletStatus = (
    txId: string,
    nextStatus: 'flagged' | 'cancelled' | 'pending',
    reason: string
  ) => {
    const res = updateEWalletTransactionStatus(state, txId, nextStatus, reason);
    if (res.error) return { ok: false, error: res.error };
    setState(res.nextState);
    notify(
      nextStatus === 'flagged'
        ? 'Transaction flagged'
        : nextStatus === 'cancelled'
          ? 'Transaction cancelled'
          : 'Flag cleared',
      'info'
    );
    return { ok: true };
  };

  const handleOpenEWalletSession = (
    startingBalances: EWalletBalances,
    notes?: string
  ) => {
    const res = openEWalletSession(state, startingBalances, notes);
    if (res.error) return { ok: false, error: res.error };
    setState(res.nextState);
    notify('E-Wallet session opened', 'success');
    return { ok: true };
  };

  const handleCloseEWalletSession = (
    sessionId: string,
    actualBalances: EWalletBalances,
    notes?: string
  ) => {
    const res = closeEWalletSession(state, sessionId, actualBalances, notes);
    if (res.error) return { ok: false, error: res.error };
    setState(res.nextState);
    notify('E-Wallet session closed & reconciled', 'success');
    return { ok: true };
  };

  // --- Existing POS Handlers (Preserved) ---
  const handleAddToCart = useCallback(
    (product: Product, unit?: SaleUnit) => {
      setCart((prev) => {
        const res = addProductToCart(prev, product, unit);
        if (res.error) {
          notify(res.error, 'error');
          return prev;
        }
        notify(`Added ${product.name}`, 'success');
        return res.cart;
      });
    },
    [notify]
  );

  const handleBarcodeOnSell = useCallback(
    (rawBarcode: string) => {
      const code = rawBarcode.trim();
      if (!code) return;
      const product = findProductByBarcode(state.products, code);
      if (product) {
        setUnmatchedBarcode(null);
        const hasPiece = product.piecePrice !== undefined && product.piecePrice > 0;
        if (hasPiece && !continuousScan) {
          setSellUnitPrompt(product);
          return;
        }
        setCart((prev) => {
          const res = addProductToCart(prev, product);
          if (res.error) {
            setLastScannedMsg(res.error);
            notify(res.error, 'error');
            return prev;
          }
          setLastScannedMsg(`Added: ${product.name}`);
          notify('Added to cart', 'success');
          return res.cart;
        });
      } else {
        setUnmatchedBarcode(code);
        setLastScannedMsg(`Not found: ${code}`);
        if (continuousScan) {
          setScannerPurpose(null);
        }
      }
    },
    [state.products, continuousScan, notify]
  );

  const handleScannerDetected = useCallback(
    (code: string) => {
      if (scannerPurpose === 'sell') {
        handleBarcodeOnSell(code);
        return;
      }
      if (scannerPurpose === 'add_product') {
        const existing = findProductByBarcode(state.products, code);
        if (existing) {
          setExistingScanProduct(existing);
        } else {
          setEditingProduct(null);
          setPrefillBarcode(code);
          setProductFormOpen(true);
        }
        return;
      }
      if (scannerPurpose === 'restock') {
        const existing = findProductByBarcode(state.products, code);
        if (existing) {
          setStockAdjustTarget(existing);
          setStockAdjustMode('restock');
        } else {
          notify('Product not found', 'error');
        }
      }
    },
    [scannerPurpose, state.products, handleBarcodeOnSell, notify]
  );

  const handleUpdateCartQty = (productId: string, unit: SaleUnit, delta: number) => {
    setCart((prev) => {
      const res = updateCartItemQuantity(prev, productId, unit, delta, state.products);
      if (res.error) {
        notify(res.error, 'error');
        return prev;
      }
      return res.cart;
    });
  };

  const handleRemoveCartItem = (productId: string, unit: SaleUnit) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.unit === unit))
    );
  };

  const handleConfirmSale = (options: {
    paymentMethod: PaymentMethod;
    cashReceived?: number;
    customerName?: string;
  }) => {
    const result = completeCheckout(state, cart, options);
    if (result.error || !result.sale) {
      notify(result.error ?? 'Could not complete sale', 'error');
      return;
    }
    const saleWithStaff: Sale = {
      ...result.sale,
      staffId: activeStaff.id,
      staffName: activeStaff.name,
    };
    const audit = createAuditLog(
      activeStaff,
      'pos',
      'Completed POS sale',
      `${saleWithStaff.receiptNumber} · ${formatPHP(saleWithStaff.total)} (${saleWithStaff.paymentMethod})`,
      saleWithStaff.createdAt
    );
    const nextQueue = enqueueSyncMutation(result.nextState.syncQueue, {
      idempotencyKey: `pos-sale-${saleWithStaff.id}`,
      entityType: 'pos_sale',
      entityId: saleWithStaff.id,
      operation: 'create',
      revision: 1,
      payloadSummary: `POS ${saleWithStaff.receiptNumber} ${formatPHP(saleWithStaff.total)}`,
      nowIso: saleWithStaff.createdAt,
    });
    setState({
      ...result.nextState,
      sales: [saleWithStaff, ...result.nextState.sales.slice(1)],
      auditLogs: [audit, ...result.nextState.auditLogs].slice(0, 300),
      syncQueue: nextQueue,
    });
    setCart([]);
    setMobileCartOpen(false);
    setCompletedSale(saleWithStaff);
    notify('Sale saved', 'success');
  };

  const handleSaveProduct = (
    data: Omit<Product, 'id' | 'updatedAt'>,
    existingId?: string
  ) => {
    const nowIso = new Date().toISOString();
    if (existingId) {
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === existingId ? { ...p, ...data, updatedAt: nowIso } : p
        ),
      }));
      notify('Product saved', 'success');
    } else {
      const created: Product = {
        ...data,
        id: createId('prod'),
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        products: [created, ...prev.products],
        stockMovements:
          created.stock > 0
            ? [
                {
                  id: createId('mov'),
                  productId: created.id,
                  type: 'restock',
                  quantityChange: created.stock,
                  previousStock: 0,
                  newStock: created.stock,
                  unitCost: created.costPrice,
                  reason: 'Initial stock',
                  createdAt: nowIso,
                },
                ...prev.stockMovements,
              ]
            : prev.stockMovements,
      }));
      notify('Product saved', 'success');
    }
    setProductFormOpen(false);
    setEditingProduct(null);
    setPrefillBarcode('');
    setUnmatchedBarcode(null);
  };

  const handleDeleteProduct = (productId: string) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    notify('Product deleted', 'info');
  };

  const handleRestock = (
    productId: string,
    addQty: number,
    newCostPrice?: number,
    note?: string
  ) => {
    const res = applyStockRestock(state, productId, addQty, {
      newCostPrice,
      note,
    });
    if (res.error) {
      notify(res.error, 'error');
      return;
    }
    setState(res.nextState);
    notify('Stock updated', 'success');
  };

  const handleAdjustStock = (productId: string, deltaQty: number, reason: string) => {
    const res = applyStockAdjustment(state, productId, deltaQty, reason);
    if (res.error) {
      notify(res.error, 'error');
      return;
    }
    setState(res.nextState);
    notify('Stock updated', 'success');
  };

  const handleAddCategory = (category: string) => {
    setState((prev) => {
      if (prev.categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        categories: [...prev.categories, category],
      };
    });
  };

  const handleRecordCreditPayment = (
    customerName: string,
    amount: number,
    note?: string
  ) => {
    const res = recordCustomerPayment(state, customerName, amount, note);
    if (res.error) {
      notify(res.error, 'error');
      return;
    }
    setState(res.nextState);
    notify(`Recorded ${formatPHP(amount)} payment`, 'success');
  };

  const handleVoidSale = (saleId: string) => {
    setState((prev) => {
      const next = voidSaleTransaction(prev, saleId);
      const target = prev.sales.find((s) => s.id === saleId);
      const audit = createAuditLog(
        activeStaff,
        'pos',
        'Voided POS sale',
        target ? `${target.receiptNumber} (${formatPHP(target.total)})` : saleId
      );
      return {
        ...next,
        auditLogs: [audit, ...next.auditLogs].slice(0, 300),
      };
    });
    notify('Sale voided and stock restored', 'info');
  };

  const handleLoadSampleData = () => {
    const sample = createSamplePOSState();
    setState((prev) => ({
      ...sample,
      settings: {
        ...sample.settings,
        storeName:
          prev.settings.storeName === DEFAULT_POS_STATE.settings.storeName
            ? sample.settings.storeName
            : prev.settings.storeName,
      },
    }));
    setCart([]);
    setUnmatchedBarcode(null);
    notify('Sample POS & E-Wallet data loaded', 'success');
  };

  const handleUpdateStoreName = (storeName: string) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, storeName },
    }));
    notify('Store name updated', 'success');
  };

  const handleUpdateDefaultThreshold = (defaultLowStockThreshold: number) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, defaultLowStockThreshold },
    }));
    notify('Default alert level saved', 'success');
  };

  const handleUpdateScannerSettings = (scanner: ScannerSettings) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, scanner },
    }));
    notify('Scanner settings saved', 'success');
  };

  const handleImportData = (imported: POSState) => {
    setState(imported);
    setCart([]);
    notify('Backup restored', 'success');
  };

  const handleResetAllData = () => {
    setState(DEFAULT_POS_STATE);
    setCart([]);
    setUnmatchedBarcode(null);
    notify('All data reset', 'info');
  };

  const existingCustomers = useMemo(() => {
    return getCustomerCreditSummaries(state.sales, state.creditPayments).map(
      (c) => c.customerName
    );
  }, [state.sales, state.creditPayments]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = calculateCartTotal(cart);

  const showFloatingScan =
    activeModule === 'pos' && (activeTab === 'sell' || activeTab === 'products');

  if (showWelcome) {
    return (
      <WelcomeScreen
        storeName={state.settings.storeName}
        onEnter={() => setShowWelcome(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-200/70">
      {/* Android-first mobile shell */}
      <div className="relative mx-auto min-h-screen w-full max-w-[440px] bg-stone-50 text-stone-900 shadow-sm pb-20">
        {/* Compact Sticky Top Bar (48px) */}
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-md">
          <div className="flex h-12 items-center justify-between gap-2 px-3">
            <div className="flex items-center gap-2 min-w-0">
              {activeModule !== 'landing' && (
                <button
                  type="button"
                  onClick={() => setActiveModule('landing')}
                  aria-label="Back to store landing page"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {activeModule === 'landing' && (
                <img
                  src="/reston-logo.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-lg"
                />
              )}
              <h1 className="truncate text-base font-bold tracking-tight text-stone-900 whitespace-nowrap">
                {activeModule === 'ewallet'
                  ? 'E-Wallet Manager'
                  : state.settings.storeName}
              </h1>
              {!isOnline && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Offline</span>
                </span>
              )}
            </div>

            {activeModule === 'pos' && activeTab === 'sell' && (
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                aria-label={`Open cart with ${cartItemCount} items, total ${formatPHP(cartTotal)}`}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition shrink-0 whitespace-nowrap ${
                  cartItemCount > 0
                    ? 'bg-emerald-700 text-white'
                    : 'border border-stone-300 bg-white text-stone-800'
                }`}
              >
                <ShoppingBasket className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-mono-num">
                  {cartItemCount > 0
                    ? `${cartItemCount} · ${formatPHP(cartTotal)}`
                    : 'Cart (0)'}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="px-3 py-3">
          {!dbLoaded ? (
            <div className="py-16 text-center text-sm font-medium text-stone-500">
              Loading store data...
            </div>
          ) : activeModule === 'landing' ? (
            <LandingPage
              state={state}
              onOpenPOS={() => setActiveModule('pos')}
              onOpenEWallet={() => setActiveModule('ewallet')}
              onOpenActivityLog={() => setActivityLogOpen(true)}
              onLoadSampleData={handleLoadSampleData}
            />
          ) : activeModule === 'ewallet' ? (
            <EWalletModule
              transactions={state.ewalletTransactions}
              sessions={state.ewalletSessions}
              activeStaff={activeStaff}
              onCreateTransaction={handleCreateEWalletTx}
              onVerifyTransaction={handleVerifyEWalletTx}
              onClaimTransaction={handleClaimEWalletTx}
              onUpdateStatus={handleUpdateEWalletStatus}
              onOpenSession={handleOpenEWalletSession}
              onCloseSession={handleCloseEWalletSession}
            />
          ) : (
            <>
              {activeTab === 'sell' && (
                <SellScreen
                  products={state.products}
                  categories={state.categories}
                  cart={cart}
                  continuousScan={continuousScan}
                  onToggleContinuousScan={setContinuousScan}
                  onManualBarcodeSubmit={handleBarcodeOnSell}
                  unmatchedBarcode={unmatchedBarcode}
                  onDismissUnmatched={() => setUnmatchedBarcode(null)}
                  onAddProductWithBarcode={(code) => {
                    setEditingProduct(null);
                    setPrefillBarcode(code);
                    setProductFormOpen(true);
                  }}
                  onAddToCart={handleAddToCart}
                  onOpenCart={() => setMobileCartOpen(true)}
                  onOpenAddProduct={() => {
                    setEditingProduct(null);
                    setPrefillBarcode('');
                    setProductFormOpen(true);
                  }}
                  onLoadSampleData={handleLoadSampleData}
                />
              )}

              {activeTab === 'products' && (
                <ProductList
                  products={state.products}
                  categories={state.categories}
                  onScanToAdd={() => {
                    setLastScannedMsg(null);
                    setScannerPurpose('add_product');
                  }}
                  onScanToRestock={() => {
                    setLastScannedMsg(null);
                    setScannerPurpose('restock');
                  }}
                  onOpenAddManual={() => {
                    setEditingProduct(null);
                    setPrefillBarcode('');
                    setProductFormOpen(true);
                  }}
                  onOpenEdit={(prod) => {
                    setEditingProduct(prod);
                    setPrefillBarcode('');
                    setProductFormOpen(true);
                  }}
                  onOpenStockAdjust={(prod, mode = 'restock') => {
                    setStockAdjustTarget(prod);
                    setStockAdjustMode(mode);
                  }}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {activeTab === 'credit' && (
                <CreditList
                  sales={state.sales}
                  creditPayments={state.creditPayments}
                  onRecordPayment={handleRecordCreditPayment}
                />
              )}

              {activeTab === 'reports' && (
                <Reports
                  products={state.products}
                  sales={state.sales}
                  onVoidSale={handleVoidSale}
                />
              )}

              {activeTab === 'settings' && (
                <Settings
                  state={state}
                  onUpdateStoreName={handleUpdateStoreName}
                  onUpdateDefaultThreshold={handleUpdateDefaultThreshold}
                  onUpdateScannerSettings={handleUpdateScannerSettings}
                  onLoadSampleData={handleLoadSampleData}
                  onImportData={handleImportData}
                  onResetAllData={handleResetAllData}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>

        {/* Floating "Scan" Button on POS Sell and Products Screens */}
        {showFloatingScan && (
          <div className="pointer-events-none fixed bottom-[76px] left-1/2 z-30 flex w-full max-w-[440px] -translate-x-1/2 justify-end px-4">
            <button
              type="button"
              onClick={() => {
                setLastScannedMsg(null);
                setScannerPurpose(activeTab === 'sell' ? 'sell' : 'add_product');
              }}
              aria-label="Scan barcode"
              className="pointer-events-auto flex min-h-[56px] items-center gap-2 rounded-full bg-emerald-700 px-5 text-base font-bold text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-800 active:scale-95 transition"
            >
              <ScanBarcode className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Scan</span>
            </button>
          </div>
        )}

        {/* Fixed Bottom 5-Tab Navigation Bar when inside POS */}
        {activeModule === 'pos' && (
          <nav
            aria-label="Bottom navigation"
            className="fixed bottom-0 left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe"
          >
            <div className="grid h-[60px] grid-cols-5 items-center">
              {NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-full min-h-[48px] flex-col items-center justify-center gap-0.5 transition ${
                      active
                        ? 'text-emerald-700 font-bold'
                        : 'text-stone-500 font-medium hover:text-stone-900'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[11px] leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Cart Drawer Modal */}
        {mobileCartOpen && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Cart"
          >
            <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col rounded-t-3xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <span className="text-sm font-bold text-stone-500">Order Details</span>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  aria-label="Close cart"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <Cart
                  items={cart}
                  onUpdateQty={handleUpdateCartQty}
                  onRemoveItem={handleRemoveCartItem}
                  onClearCart={() => {
                    setCart([]);
                    setMobileCartOpen(false);
                  }}
                  onCheckout={() => {
                    setMobileCartOpen(false);
                    setCompletedSale(null);
                    setCheckoutOpen(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Scanned Barcode Unit Choice on Sell */}
        {sellUnitPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Choose piece or pack"
          >
            <div className="w-full max-w-[440px] rounded-t-3xl bg-white p-5 shadow-xl pb-safe">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Per piece or per {sellUnitPrompt.unit}?
                  </h3>
                  <p className="text-sm text-stone-600">{sellUnitPrompt.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSellUnitPrompt(null)}
                  aria-label="Cancel selection"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(sellUnitPrompt, 'piece');
                    setSellUnitPrompt(null);
                  }}
                  className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-stone-300 bg-stone-50 p-3"
                >
                  <span className="text-xs font-bold text-stone-600">Per Piece</span>
                  <span className="mt-1 font-mono-num text-xl font-bold text-stone-900">
                    {formatPHP(sellUnitPrompt.piecePrice ?? sellUnitPrompt.sellingPrice)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(sellUnitPrompt, 'pack');
                    setSellUnitPrompt(null);
                  }}
                  className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 p-3"
                >
                  <span className="text-xs font-bold text-emerald-800">
                    Per {sellUnitPrompt.unit}
                  </span>
                  <span className="mt-1 font-mono-num text-xl font-bold text-emerald-900">
                    {formatPHP(sellUnitPrompt.sellingPrice)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanned Existing Product Choice */}
        {existingScanProduct && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Product already exists"
          >
            <div className="w-full max-w-[440px] rounded-t-3xl bg-white p-5 shadow-xl pb-safe">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700">Product Already Exists</p>
                  <h3 className="mt-0.5 text-base font-bold text-stone-900">
                    {existingScanProduct.name}
                  </h3>
                  <p className="text-xs text-stone-600">
                    Stock: {existingScanProduct.stock} · {formatPHP(existingScanProduct.sellingPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExistingScanProduct(null)}
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-500"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const p = existingScanProduct;
                    setExistingScanProduct(null);
                    setStockAdjustTarget(p);
                    setStockAdjustMode('restock');
                  }}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white"
                >
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = existingScanProduct;
                    setExistingScanProduct(null);
                    setEditingProduct(p);
                    setPrefillBarcode('');
                    setProductFormOpen(true);
                  }}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-bold text-stone-900"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  <span>Edit Product</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Barcode Scanner */}
        <BarcodeScanner
          open={scannerPurpose !== null}
          title={
            scannerPurpose === 'add_product'
              ? 'Scan to Add Product'
              : scannerPurpose === 'restock'
                ? 'Scan to Restock'
                : 'Scan Item to Sell'
          }
          continuousMode={scannerPurpose === 'sell' ? continuousScan : false}
          onToggleContinuous={
            scannerPurpose === 'sell' ? setContinuousScan : undefined
          }
          scannerSettings={state.settings.scanner}
          lastScannedMessage={lastScannedMsg}
          onDetected={handleScannerDetected}
          onClose={() => setScannerPurpose(null)}
        />

        {/* Checkout & Receipt Modal */}
        <CheckoutModal
          open={checkoutOpen}
          storeName={state.settings.storeName}
          cart={cart}
          existingCustomers={existingCustomers}
          completedSale={completedSale}
          onConfirmSale={handleConfirmSale}
          onClose={() => {
            setCheckoutOpen(false);
            setCompletedSale(null);
          }}
        />

        {/* Add / Edit Product Modal */}
        <ProductForm
          open={productFormOpen}
          editingProduct={editingProduct}
          initialBarcode={prefillBarcode}
          allProducts={state.products}
          categories={state.categories}
          defaultLowStockThreshold={state.settings.defaultLowStockThreshold}
          scannerSettings={state.settings.scanner}
          onAddCategory={handleAddCategory}
          onSave={handleSaveProduct}
          onClose={() => {
            setProductFormOpen(false);
            setEditingProduct(null);
            setPrefillBarcode('');
          }}
        />

        {/* Stock Restock / Adjust / History Modal */}
        <StockAdjust
          open={stockAdjustTarget !== null}
          initialMode={stockAdjustMode}
          product={
            stockAdjustTarget
              ? state.products.find((p) => p.id === stockAdjustTarget.id) ??
                stockAdjustTarget
              : null
          }
          movements={state.stockMovements}
          onRestock={handleRestock}
          onAdjust={handleAdjustStock}
          onClose={() => setStockAdjustTarget(null)}
        />

        {/* Store Activity Log Modal */}
        <StaffAuthModal
          open={activityLogOpen}
          auditLogs={state.auditLogs}
          onClose={() => setActivityLogOpen(false)}
        />

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
