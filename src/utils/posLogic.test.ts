import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPHP } from './format';
import {
  addProductToCart,
  applyStockAdjustment,
  applyStockRestock,
  calculateCartCost,
  calculateCartTotal,
  calculateChange,
  calculateProfitAndMarkup,
  completeCheckout,
  DEFAULT_POS_STATE,
  filterAndSortProducts,
  findProductByBarcode,
  generateInternalBarcode,
  getCustomerCreditSummaries,
  getExpiryStatus,
  getInventoryValuation,
  getReportSummary,
  isBarcodeDuplicate,
  recordCustomerPayment,
  shouldAcceptScan,
  updateCartItemQuantity,
  validateBackupPayload,
  voidSaleTransaction,
} from './posLogic';
import { createSamplePOSState } from './sampleData';
import type { POSState, Product } from '../types/pos';

const sampleCoffee: Product = {
  id: 'p-coffee',
  name: 'Kopiko 3-in-1',
  barcode: '4800194112018',
  category: 'Drinks',
  unit: 'pack',
  sellingPrice: 95,
  costPrice: 80,
  piecePrice: 10,
  piecesPerPack: 10,
  stock: 25,
  lowStockThreshold: 10,
  updatedAt: '2026-11-15T08:00:00.000Z',
};

const sampleNoodles: Product = {
  id: 'p-noodles',
  name: 'Lucky Me Pancit Canton',
  barcode: '4807770270017',
  category: 'Noodles',
  unit: 'pack',
  sellingPrice: 18,
  costPrice: 15,
  stock: 5,
  lowStockThreshold: 5,
  expirationDate: '2026-11-25',
  updatedAt: '2026-11-15T08:00:00.000Z',
};

test('formatPHP formats Philippine Peso with 2 decimals and thousands separator', () => {
  assert.equal(formatPHP(1250), '₱1,250.00');
  assert.equal(formatPHP(9.5), '₱9.50');
  assert.equal(formatPHP(0), '₱0.00');
});

test('calculateProfitAndMarkup computes profit, markup %, and flags loss', () => {
  const ok = calculateProfitAndMarkup(15, 18);
  assert.equal(ok.profit, 3);
  assert.equal(ok.markupPercent, 20);
  assert.equal(ok.isLoss, false);

  const loss = calculateProfitAndMarkup(20, 15);
  assert.equal(loss.profit, -5);
  assert.equal(loss.isLoss, true);
});

test('getExpiryStatus detects expired, expiring soon (<=30 days), and ok', () => {
  const ref = new Date('2026-11-15T10:00:00');
  assert.equal(getExpiryStatus(undefined, ref).status, 'none');
  assert.equal(getExpiryStatus('2026-11-10', ref).status, 'expired');
  assert.equal(getExpiryStatus('2026-11-25', ref).status, 'expiring_soon');
  assert.equal(getExpiryStatus('2027-03-01', ref).status, 'ok');
});

test('generateInternalBarcode produces unique INT- codes', () => {
  const code = generateInternalBarcode([sampleCoffee, sampleNoodles]);
  assert.match(code, /^INT-\d{6}$/);
});

test('cart handles piece and pack pricing and stock limits accurately', () => {
  let cart: ReturnType<typeof addProductToCart>['cart'] = [];

  let res = addProductToCart(cart, sampleCoffee, 'piece');
  assert.equal(res.error, undefined);
  res = addProductToCart(res.cart, sampleCoffee, 'piece');
  assert.equal(res.error, undefined);
  cart = res.cart;

  res = addProductToCart(cart, sampleCoffee, 'pack');
  assert.equal(res.error, undefined);
  res = addProductToCart(res.cart, sampleCoffee, 'pack');
  assert.equal(res.error, undefined);
  cart = res.cart;

  assert.equal(calculateCartTotal(cart), 2 * 10 + 2 * 95);
  assert.equal(calculateCartCost(cart), 2 * 8 + 2 * 80);

  const blocked = addProductToCart(cart, sampleCoffee, 'pack');
  assert.ok(blocked.error);

  const dec = updateCartItemQuantity(cart, sampleCoffee.id, 'piece', -2, [sampleCoffee]);
  assert.equal(dec.cart.length, 1);
  assert.equal(dec.cart[0].unit, 'pack');
});

test('cash checkout deducts stock, logs sale movements, and void restores stock', () => {
  const initialState: POSState = {
    ...DEFAULT_POS_STATE,
    products: [sampleCoffee, sampleNoodles],
  };

  let cart = addProductToCart([], sampleCoffee, 'pack').cart;
  cart = addProductToCart(cart, sampleNoodles, 'unit').cart;
  const total = calculateCartTotal(cart);
  assert.equal(total, 113);
  assert.equal(calculateChange(total, 200), 87);

  const checkout = completeCheckout(initialState, cart, {
    paymentMethod: 'cash',
    cashReceived: 200,
    nowIso: '2026-11-15T10:00:00.000Z',
  });
  assert.equal(checkout.error, undefined);
  assert.ok(checkout.sale);
  assert.equal(checkout.nextState.products[0].stock, 15);
  assert.equal(checkout.nextState.products[1].stock, 4);
  assert.equal(checkout.nextState.stockMovements.length, 2);
  assert.equal(checkout.nextState.stockMovements[0].type, 'sale');

  const afterVoid = voidSaleTransaction(checkout.nextState, checkout.sale.id);
  assert.equal(afterVoid.products[0].stock, 25);
  assert.equal(afterVoid.products[1].stock, 5);
  assert.equal(afterVoid.sales[0].voided, true);
  assert.equal(afterVoid.stockMovements.length, 4);
});

test('restock and stock adjustment update stock, cost price, and movement history', () => {
  const initialState: POSState = {
    ...DEFAULT_POS_STATE,
    products: [sampleNoodles],
  };

  const restocked = applyStockRestock(initialState, sampleNoodles.id, 10, {
    newCostPrice: 15.5,
    note: 'Supplier delivery',
  });
  assert.equal(restocked.error, undefined);
  assert.equal(restocked.nextState.products[0].stock, 15);
  assert.equal(restocked.nextState.products[0].costPrice, 15.5);
  assert.equal(restocked.nextState.stockMovements[0].type, 'restock');

  const adjusted = applyStockAdjustment(
    restocked.nextState,
    sampleNoodles.id,
    -2,
    'Damaged pack'
  );
  assert.equal(adjusted.error, undefined);
  assert.equal(adjusted.nextState.products[0].stock, 13);
  assert.equal(adjusted.nextState.stockMovements[0].type, 'adjustment');
  assert.equal(adjusted.nextState.stockMovements[0].quantityChange, -2);
});

test('credit sales and partial/full payments calculate sorted balances accurately', () => {
  const initialState: POSState = {
    ...DEFAULT_POS_STATE,
    products: [sampleNoodles],
  };

  const cart1 = addProductToCart([], sampleNoodles, 'unit').cart;
  const c1 = completeCheckout(initialState, cart1, {
    paymentMethod: 'credit',
    customerName: 'Ate Maria',
    nowIso: '2026-11-15T09:00:00.000Z',
  });

  const cart2 = updateCartItemQuantity(
    addProductToCart([], sampleNoodles, 'unit').cart,
    sampleNoodles.id,
    'unit',
    1,
    c1.nextState.products
  ).cart;
  const c2 = completeCheckout(c1.nextState, cart2, {
    paymentMethod: 'credit',
    customerName: 'Kuya Jun',
    nowIso: '2026-11-15T09:30:00.000Z',
  });

  let balances = getCustomerCreditSummaries(c2.nextState.sales, c2.nextState.creditPayments);
  assert.equal(balances[0].customerName, 'Kuya Jun');
  assert.equal(balances[0].balance, 36);

  const paid = recordCustomerPayment(c2.nextState, 'Kuya Jun', 20, 'Partial');
  assert.equal(paid.error, undefined);
  balances = getCustomerCreditSummaries(paid.nextState.sales, paid.nextState.creditPayments);
  assert.equal(balances[0].customerName, 'Ate Maria');
  assert.equal(balances[1].balance, 16);
});

test('barcode lookup, duplicate check, and 1.5s scan cooldown work', () => {
  const products = [sampleCoffee, sampleNoodles];
  assert.equal(findProductByBarcode(products, '4800194112018')?.id, 'p-coffee');
  assert.equal(isBarcodeDuplicate(products, '4800194112018', 'p-coffee'), undefined);
  assert.equal(isBarcodeDuplicate(products, '4800194112018', 'p-noodles')?.id, 'p-coffee');

  const last = { code: '4800194112018', timestamp: 1000 };
  assert.equal(shouldAcceptScan(last, '4800194112018', 2000, 1500), false);
  assert.equal(shouldAcceptScan(last, '4800194112018', 2600, 1500), true);
});

test('reports summarize sales, gross profit, top selling & profitable products, and inventory valuation', () => {
  const sample = createSamplePOSState();
  const summary = getReportSummary(sample.sales, 'month');
  assert.equal(summary.transactionCount, 4);
  assert.equal(summary.totalSales, 168 + 96 + 94 + 83);
  assert.ok(summary.grossProfit > 0);
  assert.equal(summary.last7Days.length, 7);
  assert.ok(summary.topSellingProducts.length <= 5);
  assert.ok(summary.topProfitableProducts.length <= 5);

  const valuation = getInventoryValuation(sample.products);
  assert.ok(valuation.costValue > 0);
  assert.ok(valuation.sellingValue > valuation.costValue);
  assert.ok(valuation.lowStockProducts.length >= 2);
});

test('product filtering, sorting by expiry, and backup validation behave safely', () => {
  const sample = createSamplePOSState();
  assert.ok(sample.products.length >= 20);

  const byExpiry = filterAndSortProducts(sample.products, { sortBy: 'expiry' });
  assert.equal(byExpiry[0].id, 'prod-9'); // Fresh Chicken Egg expires in 14 days

  assert.equal(validateBackupPayload({ bad: true }), null);
  assert.ok(validateBackupPayload(sample));
});
