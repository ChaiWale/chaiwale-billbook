'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchMenuItems,
  calculateBill,
  generateInvoice,
  fetchWebOrders,
  verifyOrderPayment,
  fetchPrintPayload,
  getInvoicePdfUrl,
  MenuItemDto,
  BillingCalculationResultDto,
  GeneratedInvoiceResponseDto,
  WebOrderDto
} from '../services/billbook-api.client';
import { BillbookKhataView } from '../components/BillbookKhataView';

interface CartLineItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export default function BillbookPosPage() {
  const [activeTab, setActiveTab] = useState<'POS' | 'KHATABOOK' | 'WEB_ORDERS'>('POS');

  // Menu catalog state
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // POS Billing Form State
  const [customerType, setCustomerType] = useState<'Walk-in' | 'Credit' | 'Corporate Bill'>('Walk-in');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [department, setDepartment] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<CartLineItem[]>([]);

  // Server Calculation
  const [calculation, setCalculation] = useState<BillingCalculationResultDto | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Submission State
  const [generating, setGenerating] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<GeneratedInvoiceResponseDto | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Web Orders Tab State
  const [webOrders, setWebOrders] = useState<WebOrderDto[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Load real catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      setLoadingMenu(true);
      setMenuError(null);
      try {
        const items = await fetchMenuItems();
        setMenuItems(items);
        if (items.length > 0) {
          setSelectedProductId(items[0].id);
          setCart([
            { productId: items[0].id, name: items[0].name, unitPrice: Number(items[0].base_price), quantity: 2 }
          ]);
        }
      } catch (err: any) {
        setMenuError(err.message || 'Failed to load catalog');
      } finally {
        setLoadingMenu(false);
      }
    }
    loadCatalog();
  }, []);

  // Synchronize payment mode with customer type
  useEffect(() => {
    if (customerType === 'Credit') {
      setPaymentMode('CREDIT');
    } else if (customerType === 'Corporate Bill') {
      setPaymentMode('CREDIT');
    } else if (paymentMode === 'CREDIT') {
      setPaymentMode('CASH');
    }
  }, [customerType]);

  // Authoritative Server Calculation (debounced)
  const runServerCalculation = useCallback(async (currentCart: CartLineItem[], discount: number, cType: string) => {
    if (currentCart.length === 0) {
      setCalculation(null);
      return;
    }
    setCalculating(true);
    setCalcError(null);
    try {
      const result = await calculateBill({
        items: currentCart.map((c) => ({
          productId: c.productId,
          name: c.name,
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          taxRatePercent: 0
        })),
        overallDiscountPercent: discount,
        billType: cType === 'Corporate Bill' ? 'CORPORATE_CREDIT' : 'DIRECT'
      });
      setCalculation(result);
    } catch (err: any) {
      setCalcError(err.message || 'Calculation error');
    } finally {
      setCalculating(false);
    }
  }, []);

  useEffect(() => {
    runServerCalculation(cart, discountPercent, customerType);
  }, [cart, discountPercent, customerType, runServerCalculation]);

  // Load online orders when tab switched
  const loadOnlineOrders = async () => {
    setLoadingOrders(true);
    try {
      const orders = await fetchWebOrders(20);
      setWebOrders(orders);
    } catch (err: any) {
      console.error('Error fetching online orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'WEB_ORDERS') {
      loadOnlineOrders();
    }
  }, [activeTab]);

  // Cart operations
  const addItemToCart = () => {
    if (!selectedProductId) return;
    const item = menuItems.find((m) => m.id === selectedProductId);
    if (!item) return;

    setCart((prev) => {
      const existing = prev.find((p) => p.productId === item.id);
      if (existing) {
        return prev.map((p) => (p.productId === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { productId: item.id, name: item.name, unitPrice: Number(item.base_price), quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((p) => (p.productId === productId ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p))
        .filter((p) => p.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((p) => p.productId !== productId));
  };

  // Generate Invoice
  const handleGenerateInvoice = async () => {
    if (cart.length === 0) {
      alert('Please add at least one item to generate an invoice.');
      return;
    }
    setGenerating(true);
    setSuccessMessage(null);
    try {
      const invType = customerType === 'Corporate Bill' ? 'CORPORATE_CREDIT' : 'DIRECT';

      const invoiceRes = await generateInvoice({
        invoiceType: invType,
        department: department || undefined,
        paymentMode,
        transactionRef: transactionRef || undefined,
        items: cart.map((c) => ({
          productId: c.productId,
          name: c.name,
          unitPrice: c.unitPrice,
          quantity: c.quantity,
          taxRatePercent: 0
        })),
        overallDiscountPercent: discountPercent
      });

      setLastInvoice(invoiceRes);
      const isCredit = paymentMode === 'CREDIT';
      setSuccessMessage(
        `Invoice ${invoiceRes.invoice.invoiceNumber} created! ${
          isCredit ? `[CREDIT - Outstanding: ₹${invoiceRes.calculation.roundedTotal}]` : '[PAID]'
        }`
      );
    } catch (err: any) {
      if (err.message?.includes('Authentication required') || err.message?.includes('Missing Bearer token')) {
        window.dispatchEvent(new CustomEvent('open-counter-auth'));
      } else {
        alert(`Invoice generation error: ${err.message}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  // Convert Web Order to BillBook Invoice
  const handleConvertWebOrderToBill = async (order: WebOrderDto) => {
    try {
      const invoiceRes = await generateInvoice({
        orderId: order.id,
        invoiceType: 'DIRECT',
        paymentMode: (order.payment_mode as any) || 'CASH',
        transactionRef: order.transaction_ref,
        items: (order.items || []).map((it) => ({
          productId: it.id || 'item',
          name: it.item_name,
          unitPrice: Number(it.unit_price),
          quantity: it.quantity,
          taxRatePercent: 0
        }))
      });
      alert(`Order ${order.order_number} converted to BillBook Invoice ${invoiceRes.invoice.invoiceNumber}!`);
      loadOnlineOrders();
    } catch (err: any) {
      if (err.message?.includes('Authentication required') || err.message?.includes('Missing Bearer token')) {
        window.dispatchEvent(new CustomEvent('open-counter-auth'));
      } else {
        alert(`Conversion error: ${err.message}`);
      }
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    try {
      await verifyOrderPayment(orderId);
      alert('UPI payment verified and marked PAID in database!');
      loadOnlineOrders();
    } catch (err: any) {
      alert(`Verification error: ${err.message}`);
    }
  };

  const handlePrintKOT = async (orderId?: string) => {
    try {
      const payload = await fetchPrintPayload({
        receiptType: 'KOT',
        orderId: orderId || lastInvoice?.invoice?.id
      });
      alert(`KOT ESC/POS Payload Ready (No Prices):\n\n${payload.plainTextPreview}`);
    } catch (err: any) {
      alert(`KOT Print Error: ${err.message}`);
    }
  };

  const handlePrintCustomerBill = async () => {
    if (!lastInvoice) return;
    try {
      const payload = await fetchPrintPayload({
        receiptType: customerType === 'Corporate Bill' ? 'CREDIT_BILL' : 'CUSTOMER_BILL',
        invoiceId: lastInvoice.invoice.id
      });
      alert(`Thermal Receipt Ready:\n\n${payload.plainTextPreview}`);
    } catch (err: any) {
      window.print();
    }
  };

  const handleResetForNewBill = () => {
    setCart([]);
    setLastInvoice(null);
    setSuccessMessage(null);
    setDiscountPercent(0);
    setDepartment('');
    setTransactionRef('');
  };

  const currentSubtotal = calculation ? calculation.subtotal : cart.reduce((a, c) => a + c.quantity * c.unitPrice, 0);
  const currentTax = calculation ? calculation.totalTax : 0;
  const currentDiscount = calculation ? calculation.totalDiscount : 0;
  const currentGrandTotal = calculation ? calculation.roundedTotal : Math.round(currentSubtotal - currentDiscount);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('POS')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'POS' ? 'var(--cw-color-primary)' : 'transparent',
            color: activeTab === 'POS' ? '#FFFFFF' : '#64748B'
          }}
        >
          🧾 New Bill (POS Counter)
        </button>
        <button
          onClick={() => setActiveTab('KHATABOOK')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'KHATABOOK' ? '#DC2626' : 'transparent',
            color: activeTab === 'KHATABOOK' ? '#FFFFFF' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📖 Bill Khata
        </button>
        <button
          onClick={() => setActiveTab('WEB_ORDERS')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'WEB_ORDERS' ? 'var(--cw-color-primary)' : 'transparent',
            color: activeTab === 'WEB_ORDERS' ? '#FFFFFF' : '#64748B'
          }}
        >
          🌐 Website Orders Feed ({webOrders.length})
        </button>
      </div>

      {activeTab === 'KHATABOOK' ? (
        <BillbookKhataView />
      ) : activeTab === 'WEB_ORDERS' ? (
        /* Website Orders Feed Tab */
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Incoming Storefront Online Orders</h2>
            <button
              onClick={loadOnlineOrders}
              style={{ padding: '6px 14px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              🔄 Refresh Orders
            </button>
          </div>

          {loadingOrders ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading web orders...</div>
          ) : webOrders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No incoming website orders right now.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 14px' }}>Order #</th>
                    <th style={{ padding: '10px 14px' }}>Customer</th>
                    <th style={{ padding: '10px 14px' }}>Type</th>
                    <th style={{ padding: '10px 14px' }}>Items</th>
                    <th style={{ padding: '10px 14px' }}>Total (₹)</th>
                    <th style={{ padding: '10px 14px' }}>Payment Mode</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace' }}>{o.order_number}</td>
                      <td style={{ padding: '12px 14px' }}>{o.customer_name}</td>
                      <td style={{ padding: '12px 14px' }}>{o.order_type}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {(o.items || []).map((it) => `${it.item_name} x${it.quantity}`).join(', ')}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>₹{Number(o.grand_total).toFixed(2)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 700, color: o.payment_mode === 'UPI' ? '#2563EB' : '#166534' }}>
                          {o.payment_mode || 'CASH'}
                        </span>
                        {o.transaction_ref && (
                          <div style={{ fontSize: '10px', color: '#64748B' }}>UTR: {o.transaction_ref}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: o.payment_status === 'PAID' ? '#DCFCE7' : '#FEF3C7',
                            color: o.payment_status === 'PAID' ? '#166534' : '#92400E'
                          }}
                        >
                          {o.payment_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {o.payment_status !== 'PAID' && o.payment_mode === 'UPI' && (
                            <button
                              onClick={() => handleVerifyPayment(o.id)}
                              style={{ padding: '4px 8px', backgroundColor: '#10B981', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Verify UPI
                            </button>
                          )}
                          <button
                            onClick={() => handleConvertWebOrderToBill(o)}
                            style={{ padding: '4px 8px', backgroundColor: 'var(--cw-color-primary)', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Convert to Bill
                          </button>
                          <button
                            onClick={() => handlePrintKOT(o.id)}
                            style={{ padding: '4px 8px', backgroundColor: '#475569', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            KOT
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* POS Counter Billing Tab */
        <div>
          {successMessage && (
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: '#DCFCE7',
                color: '#166534',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>✓ {successMessage}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handlePrintCustomerBill}
                  style={{ padding: '6px 12px', backgroundColor: '#166534', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                >
                  🖨️ Print Bill
                </button>
                <button
                  onClick={() => handlePrintKOT()}
                  style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                >
                  🍳 Print KOT
                </button>
                {lastInvoice?.invoice?.id && (
                  <a
                    href={getInvoicePdfUrl(lastInvoice.invoice.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '6px 12px', backgroundColor: '#F1F5F9', color: '#0F172A', textDecoration: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center' }}
                  >
                    📄 PDF
                  </a>
                )}
                <button
                  onClick={handleResetForNewBill}
                  style={{ padding: '6px 12px', backgroundColor: '#FFFFFF', color: '#166534', border: '1px solid #166534', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                >
                  + Next Bill
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
            {/* Left: Product Selector & Line Items */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>POS Billing Engine</h2>

              {/* Add Item Bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                >
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — ₹{Number(item.base_price).toFixed(2)} {item.is_veg ? '🌱' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addItemToCart}
                  style={{ padding: '10px 20px', backgroundColor: 'var(--cw-color-primary)', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add Item
                </button>
              </div>

              {/* Cart Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>₹{item.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <button onClick={() => updateQuantity(item.productId, -1)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', cursor: 'pointer' }}>-</button>
                        <span style={{ margin: '0 8px', fontWeight: 700 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, 1)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', cursor: 'pointer' }}>+</button>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>₹{(item.quantity * item.unitPrice).toFixed(2)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <button onClick={() => removeItem(item.productId)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right: Payment & Summary Panel */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Billing & Payment Mode</h3>

              {/* Customer Type Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Customer Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(['Walk-in', 'Credit', 'Corporate Bill'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCustomerType(t)}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: customerType === t ? 'var(--cw-color-primary)' : '#F1F5F9',
                        color: customerType === t ? '#FFFFFF' : '#475569'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corporate / Department input if applicable */}
              {customerType === 'Corporate Bill' && (
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569' }}>Company / Client Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Infotech Solutions"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569' }}>Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Marketing / HR / Pantry"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {/* Payment Mode Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'CASH', label: 'Cash / COD' },
                    { id: 'UPI', label: 'UPI QR' },
                    { id: 'CREDIT', label: 'Credit' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMode(m.id as any)}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: paymentMode === m.id ? '#166534' : '#F1F5F9',
                        color: paymentMode === m.id ? '#FFFFFF' : '#475569'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI UTR input if mode is UPI */}
              {paymentMode === 'UPI' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    UPI Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 12-digit UPI UTR..."
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Chaiwale Official UPI: <strong>chaiwale@ptyes</strong>
                  </div>
                </div>
              )}

              {/* Financial Calculation Summary */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Subtotal:</span>
                  <span>₹{currentSubtotal.toFixed(2)}</span>
                </div>
                {currentTax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Tax:</span>
                    <span>₹{currentTax.toFixed(2)}</span>
                  </div>
                )}
                {currentDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#10B981' }}>
                    <span>Discount:</span>
                    <span>-₹{currentDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', fontSize: '16px', fontWeight: 800 }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--cw-color-primary)' }}>₹{currentGrandTotal}</span>
                </div>
                {paymentMode === 'CREDIT' && (
                  <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    Outstanding: ₹{currentGrandTotal} (UNPAID)
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateInvoice}
                disabled={generating || cart.length === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'var(--cw-color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: generating || cart.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {generating ? 'Processing Bill...' : `Generate Bill (₹${currentGrandTotal})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
