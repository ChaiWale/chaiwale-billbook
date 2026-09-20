'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchMenuItems,
  calculateBill,
  generateInvoice,
  fetchWebOrders,
  verifyOrderPayment,
  fetchPrintPayload,
  getInvoicePdfUrl,
  fetchKhataOffices,
  createKhataOffice,
  addKhataEntry,
  MenuItemDto,
  BillingCalculationResultDto,
  GeneratedInvoiceResponseDto,
  WebOrderDto,
  KhataOfficeDto
} from '../services/billbook-api.client';
import { BillbookKhataView } from '../components/BillbookKhataView';
import { ThermalReceiptModal, ThermalReceiptData } from '../components/ThermalReceiptModal';
import { ChaiwaleDialog, ChaiwaleDialogConfig } from '../components/ChaiwaleDialog';
import { buildWhatsAppUrl } from '../utils/whatsapp';

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
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // 3D Thermal Receipt Printer Modal State
  const [thermalReceiptModalOpen, setThermalReceiptModalOpen] = useState<boolean>(false);
  const [thermalReceiptData, setThermalReceiptData] = useState<ThermalReceiptData | null>(null);

  // Custom Chaiwale Dialog State
  const [dialogConfig, setDialogConfig] = useState<ChaiwaleDialogConfig | null>(null);

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setDialogConfig({ isOpen: true, mode: 'ALERT', title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', isDanger = false) => {
    setDialogConfig({ isOpen: true, mode: 'CONFIRM', title, message, onConfirm, confirmText, isDanger });
  };

  // Khata & Credit Customers Registry State
  const [khataOffices, setKhataOffices] = useState<KhataOfficeDto[]>([]);
  const [loadingKhata, setLoadingKhata] = useState<boolean>(false);
  const [khataSearchQuery, setKhataSearchQuery] = useState<string>('');
  const [selectedKhataOffice, setSelectedKhataOffice] = useState<KhataOfficeDto | null>(null);
  const [isNewKhataCustomer, setIsNewKhataCustomer] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [newCustomerCompany, setNewCustomerCompany] = useState<string>('');
  const [newCustomerFloor, setNewCustomerFloor] = useState<string>('');
  const [lastCreditKhataEntry, setLastCreditKhataEntry] = useState<{
    officeName: string;
    phone: string;
    pin: string;
    totalDue: number;
    whatsAppUrl?: string;
  } | null>(null);

  // POS Searchable Autocomplete Combobox State
  const [searchItemText, setSearchItemText] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Cart State
  const [cart, setCart] = useState<CartLineItem[]>([]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Flatten menu items so that portion variants (Half/Full) are individual selectable items
  const billableItems = useMemo(() => {
    const list: Array<{
      productId: string;
      rawItemId: string;
      name: string;
      portionLabel?: string;
      unitPrice: number;
      is_veg: boolean;
      is_egg?: boolean;
      tags?: string[];
    }> = [];

    menuItems.forEach((item) => {
      if (item.variants && item.variants.length > 0) {
        item.variants.forEach((v) => {
          list.push({
            productId: `${item.id}-var-${v.id || v.name}`,
            rawItemId: item.id,
            name: `${item.name} (${v.name})`,
            portionLabel: v.name,
            unitPrice: Number(v.price),
            is_veg: item.is_veg,
            is_egg: item.is_egg,
            tags: item.tags
          });
        });
      } else {
        list.push({
          productId: item.id,
          rawItemId: item.id,
          name: item.name,
          unitPrice: Number(item.base_price),
          is_veg: item.is_veg,
          is_egg: item.is_egg,
          tags: item.tags
        });
      }
    });

    return list;
  }, [menuItems]);

  // Filtered billable items by multi-keyword search
  const filteredBillableItems = useMemo(() => {
    const raw = searchItemText.toLowerCase().trim();
    if (!raw) return billableItems.slice(0, 30);

    const keywords = raw.split(/\s+/).filter(Boolean);
    return billableItems.filter((item) => {
      const searchTarget = [
        item.name,
        item.portionLabel || '',
        (item.tags || []).join(' '),
        item.is_veg ? 'veg pure' : (item.is_egg ? 'egg' : 'non-veg nonveg')
      ].join(' ').toLowerCase();

      return keywords.every((kw) => searchTarget.includes(kw));
    });
  }, [billableItems, searchItemText]);

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
          // Select a random product in dropdown selector
          const randomIdx = Math.floor(Math.random() * items.length);
          setSelectedProductId(items[randomIdx].id);
          // Start with empty cart so POS does not start with a hardcoded item
          setCart([]);
        }
      } catch (err: any) {
        setMenuError(err.message || 'Failed to load catalog');
      } finally {
        setLoadingMenu(false);
      }
    }
    loadCatalog();
  }, []);

  // Load Khata offices for Credit / Ledger customer matching
  const loadKhata = useCallback(async () => {
    setLoadingKhata(true);
    try {
      const offices = await fetchKhataOffices();
      setKhataOffices(offices);
    } catch (err: any) {
      console.error('Failed to load Khata offices:', err);
    } finally {
      setLoadingKhata(false);
    }
  }, []);

  useEffect(() => {
    loadKhata();
  }, [loadKhata]);

  // Real-time matched Khata offices for customer search across 4 fields + PIN
  const matchedKhataOffices = useMemo(() => {
    const q = khataSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, '');
    return khataOffices.filter((o) => {
      const phoneMatch = digits.length >= 2 && o.phone.replace(/\D/g, '').includes(digits);
      const nameMatch = o.name.toLowerCase().includes(q);
      const buildingMatch = o.company_name?.toLowerCase().includes(q);
      const officeMatch = o.floor_unit?.toLowerCase().includes(q);
      const pinMatch = (o.client_pin || o.generated_pin)?.toLowerCase().includes(q);
      return Boolean(phoneMatch || nameMatch || buildingMatch || officeMatch || pinMatch);
    });
  }, [khataOffices, khataSearchQuery]);

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
  const addItemToCart = (itemToAdd?: { productId: string; name: string; unitPrice: number }, qty?: number) => {
    let target = itemToAdd;
    if (!target) {
      if (!selectedProductId) {
        if (filteredBillableItems.length > 0) {
          const first = filteredBillableItems[0];
          target = { productId: first.productId, name: first.name, unitPrice: first.unitPrice };
        } else {
          return;
        }
      } else {
        const bItem = billableItems.find((b) => b.productId === selectedProductId);
        if (bItem) {
          target = { productId: bItem.productId, name: bItem.name, unitPrice: bItem.unitPrice };
        } else {
          const mItem = menuItems.find((m) => m.id === selectedProductId);
          if (mItem) {
            target = { productId: mItem.id, name: mItem.name, unitPrice: Number(mItem.base_price) };
          }
        }
      }
    }
    if (!target) return;

    const addQty = Math.max(1, qty ?? inputQuantity ?? 1);

    setCart((prev) => {
      const existing = prev.find((p) => p.productId === target!.productId);
      if (existing) {
        return prev.map((p) => (p.productId === target!.productId ? { ...p, quantity: p.quantity + addQty } : p));
      }
      return [...prev, { productId: target!.productId, name: target!.name, unitPrice: target!.unitPrice, quantity: addQty }];
    });

    setInputQuantity(1);
    setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsSearchOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredBillableItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredBillableItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBillableItems.length > 0) {
        const itemToSelect = highlightedIndex >= 0 && highlightedIndex < filteredBillableItems.length
          ? filteredBillableItems[highlightedIndex]
          : filteredBillableItems[0];
        setSelectedProductId(itemToSelect.productId);
        addItemToCart({ productId: itemToSelect.productId, name: itemToSelect.name, unitPrice: itemToSelect.unitPrice }, inputQuantity);
        setSearchItemText('');
        setIsSearchOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
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
      showAlert('Cart Empty', 'Please add at least one item to generate an invoice.', 'warning');
      return;
    }

    const isCredit = paymentMode === 'CREDIT' || customerType === 'Credit' || customerType === 'Corporate Bill';
    let targetOffice = selectedKhataOffice;

    if (isCredit) {
      if (!targetOffice) {
        if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
          showAlert('Customer Details Required', 'Credit / Khata bill ke liye Customer ka Name aur Mobile number zaroori hai. Kripya customer search karein ya new customer details bharein.', 'warning');
          return;
        }
      }
    }

    setGenerating(true);
    setSuccessMessage(null);
    setLastCreditKhataEntry(null);

    // 1. Prepare printable items immediately
    const printableItems = cart.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      lineTotal: c.quantity * c.unitPrice
    }));

    const billRoundedTotal = currentGrandTotal;
    const initialDue = targetOffice ? (targetOffice.balance_due + billRoundedTotal) : billRoundedTotal;
    const tempInvNum = `CW-INV-${Date.now().toString().slice(-6)}`;
    const pin = targetOffice?.client_pin || targetOffice?.generated_pin || '----';

    // 2. TURANT: Launch 3D Thermal Receipt Dispenser INSTANTLY (0ms perceived delay)
    setThermalReceiptData({
      receiptType: isCredit ? 'CREDIT_BILL' : 'CUSTOMER_BILL',
      invoiceNumber: tempInvNum,
      date: new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      paymentMode: isCredit ? 'CREDIT' : paymentMode,
      customerName: targetOffice?.name || newCustomerName.trim() || undefined,
      customerPhone: targetOffice?.phone || newCustomerPhone.trim() || undefined,
      customerAddress: targetOffice?.company_name || targetOffice?.floor_unit || department || undefined,
      customerPin: pin !== '----' ? pin : undefined,
      customerTotalDue: targetOffice ? initialDue : undefined,
      items: printableItems,
      subtotal: currentSubtotal,
      discount: currentDiscount,
      grandTotal: billRoundedTotal
    });
    setThermalReceiptModalOpen(true);

    try {
      // If new customer on credit, register Khata office first
      if (isCredit && !targetOffice) {
        try {
          const created = await createKhataOffice({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim(),
            company_name: newCustomerCompany.trim() || companyName.trim() || undefined,
            floor_unit: newCustomerFloor.trim() || department.trim() || undefined,
            notes: 'Auto-registered via POS Counter-01 (Credit Bill)'
          });
          targetOffice = created;
          setKhataOffices((prev) => [created, ...prev]);
          setSelectedKhataOffice(created);
          setIsNewKhataCustomer(false);
        } catch (khataCreateErr: any) {
          showAlert('Khata Account Error', `New Khata Account create karne me error: ${khataCreateErr.message}`, 'error');
          setGenerating(false);
          return;
        }
      }

      const invType = customerType === 'Corporate Bill' ? 'CORPORATE_CREDIT' : 'DIRECT';

      const invoiceRes = await generateInvoice({
        invoiceType: invType,
        corporateClientId: targetOffice?.id || undefined,
        department: targetOffice?.company_name || targetOffice?.floor_unit || department || undefined,
        customerName: targetOffice?.name || newCustomerName.trim() || undefined,
        customerPhone: targetOffice?.phone || newCustomerPhone.trim() || undefined,
        issueDate: billDate,
        paymentMode: isCredit ? 'CREDIT' : paymentMode,
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

      const realRoundedTotal = invoiceRes.calculation.roundedTotal;
      const realDue = targetOffice ? (targetOffice.balance_due + realRoundedTotal) : realRoundedTotal;
      const finalPin = targetOffice?.client_pin || targetOffice?.generated_pin || '----';

      let generatedWaUrl: string | undefined = undefined;
      if (isCredit && targetOffice) {
        const formattedBillDate = new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const itemsSummary = cart.map(c => `${c.quantity}x ${c.name}`).join(', ');
        const waMsg = `Namaste ${targetOffice.name}, your Chaiwale Credit Bill #${invoiceRes.invoice.invoiceNumber} (${formattedBillDate}) of ₹${realRoundedTotal} [${itemsSummary}] has been recorded. Total Outstanding Khata Balance: ₹${realDue}. View itemized statement with your 4-digit PIN ${finalPin} at https://chaiwale.co.in/check-bill`;
        const waLinkRes = buildWhatsAppUrl(targetOffice.phone, waMsg);
        if (waLinkRes.success && waLinkRes.url) {
          generatedWaUrl = waLinkRes.url;
        }

        setLastCreditKhataEntry({
          officeName: targetOffice.name,
          phone: targetOffice.phone,
          pin: finalPin,
          totalDue: realDue,
          whatsAppUrl: generatedWaUrl
        });
      }

      setSuccessMessage(
        `Invoice ${invoiceRes.invoice.invoiceNumber} created! ${
          isCredit && targetOffice
            ? `[CREDIT - Logged to ${targetOffice.name}'s Khata • PIN: ${finalPin}]`
            : isCredit
            ? `[CREDIT - Outstanding: ₹${realRoundedTotal}]`
            : '[PAID]'
        }`
      );

      // Seamlessly sync authoritative invoice number and URLs into the active receipt modal
      setThermalReceiptData((prev) =>
        prev
          ? {
              ...prev,
              invoiceNumber: invoiceRes.invoice.invoiceNumber,
              customerPin: finalPin !== '----' ? finalPin : prev.customerPin,
              customerTotalDue: targetOffice ? realDue : prev.customerTotalDue,
              pdfDownloadUrl: getInvoicePdfUrl(invoiceRes.invoice.id),
              whatsAppUrl: generatedWaUrl
            }
          : null
      );

      // Refresh Khata offices state so balances and ledger update immediately
      if (isCredit) {
        fetchKhataOffices().then(setKhataOffices).catch(() => {});
      }
    } catch (err: any) {
      if (err.message?.includes('Authentication required') || err.message?.includes('Missing Bearer token')) {
        window.dispatchEvent(new CustomEvent('open-counter-auth'));
      } else {
        showAlert('Invoice Error', `Invoice generation error: ${err.message}`, 'error');
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
        issueDate: billDate,
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
      setSuccessMessage(`Order ${order.order_number} converted to BillBook Invoice ${invoiceRes.invoice.invoiceNumber}!`);
      loadOnlineOrders();

      setThermalReceiptData({
        receiptType: 'CUSTOMER_BILL',
        invoiceNumber: invoiceRes.invoice.invoiceNumber,
        date: new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        paymentMode: order.payment_mode || 'CASH',
        customerName: order.customer_name || 'Online Customer',
        customerPhone: (order as any).customer_phone || undefined,
        customerAddress: order.delivery_address || undefined,
        items: (order.items || []).map((it) => ({
          name: it.item_name,
          quantity: it.quantity,
          unitPrice: Number(it.unit_price),
          lineTotal: it.quantity * Number(it.unit_price)
        })),
        subtotal: invoiceRes.calculation.subtotal,
        discount: invoiceRes.calculation.totalDiscount,
        grandTotal: invoiceRes.calculation.roundedTotal,
        pdfDownloadUrl: getInvoicePdfUrl(invoiceRes.invoice.id)
      });
      setThermalReceiptModalOpen(true);
    } catch (err: any) {
      if (err.message?.includes('Authentication required') || err.message?.includes('Missing Bearer token')) {
        window.dispatchEvent(new CustomEvent('open-counter-auth'));
      } else {
        showAlert('Conversion Error', `Conversion error: ${err.message}`, 'error');
      }
    }
  };

  const handleVerifyPayment = async (orderId: string) => {
    try {
      await verifyOrderPayment(orderId);
      showAlert('Payment Verified', 'UPI payment verified and marked PAID in database!', 'success');
      loadOnlineOrders();
    } catch (err: any) {
      showAlert('Verification Error', `Verification error: ${err.message}`, 'error');
    }
  };

  const handlePrintKOT = (orderId?: string) => {
    const itemsToPrint = cart.length > 0
      ? cart.map(c => ({ name: c.name, quantity: c.quantity, unitPrice: c.unitPrice, lineTotal: c.quantity * c.unitPrice }))
      : (lastInvoice ? [{ name: 'Kitchen Order Items', quantity: 1 }] : []);

    if (itemsToPrint.length === 0) {
      showAlert('Cart Empty', 'Cart is empty. Please add items to preview or print Kitchen Order Ticket (KOT).', 'warning');
      return;
    }

    setThermalReceiptData({
      receiptType: 'KOT',
      orderNumber: lastInvoice?.invoice?.invoiceNumber || `KOT-${Date.now().toString().slice(-4)}`,
      date: new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      paymentMode: paymentMode,
      customerName: selectedKhataOffice?.name || newCustomerName || undefined,
      customerAddress: selectedKhataOffice?.floor_unit || department || 'Counter Walk-in',
      items: itemsToPrint
    });
    setThermalReceiptModalOpen(true);
  };

  const handlePrintCustomerBill = () => {
    if (!lastInvoice && cart.length === 0) {
      showAlert('No Items', 'No invoice or cart items to print.', 'info');
      return;
    }


    const itemsToPrint = cart.length > 0
      ? cart.map(c => ({ name: c.name, quantity: c.quantity, unitPrice: c.unitPrice, lineTotal: c.quantity * c.unitPrice }))
      : [{ name: 'Cafe Refreshments', quantity: 1, unitPrice: lastInvoice?.calculation?.roundedTotal || 0, lineTotal: lastInvoice?.calculation?.roundedTotal || 0 }];

    const sub = lastInvoice ? lastInvoice.calculation.subtotal : currentSubtotal;
    const disc = lastInvoice ? lastInvoice.calculation.totalDiscount : currentDiscount;
    const tot = lastInvoice ? lastInvoice.calculation.roundedTotal : currentGrandTotal;

    setThermalReceiptData({
      receiptType: customerType === 'Corporate Bill' ? 'CREDIT_BILL' : 'CUSTOMER_BILL',
      invoiceNumber: lastInvoice?.invoice?.invoiceNumber || `REC-${Date.now().toString().slice(-4)}`,
      date: new Date(billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      paymentMode: paymentMode,
      customerName: selectedKhataOffice?.name || newCustomerName || undefined,
      customerPhone: selectedKhataOffice?.phone || newCustomerPhone || undefined,
      customerAddress: selectedKhataOffice?.company_name || department || undefined,
      customerPin: selectedKhataOffice?.client_pin || selectedKhataOffice?.generated_pin || undefined,
      items: itemsToPrint,
      subtotal: sub,
      discount: disc,
      grandTotal: tot,
      pdfDownloadUrl: lastInvoice?.invoice?.id ? getInvoicePdfUrl(lastInvoice.invoice.id) : undefined,
      whatsAppUrl: lastCreditKhataEntry?.whatsAppUrl
    });
    setThermalReceiptModalOpen(true);
  };

  const handleResetForNewBill = () => {
    setCart([]);
    setLastInvoice(null);
    setSuccessMessage(null);
    setDiscountPercent(0);
    setDepartment('');
    setCompanyName('');
    setTransactionRef('');
    setSelectedKhataOffice(null);
    setKhataSearchQuery('');
    setIsNewKhataCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerCompany('');
    setNewCustomerFloor('');
    setLastCreditKhataEntry(null);
  };

  const currentSubtotal = calculation ? calculation.subtotal : cart.reduce((a, c) => a + c.quantity * c.unitPrice, 0);
  const currentTax = calculation ? calculation.totalTax : 0;
  const currentDiscount = calculation ? calculation.totalDiscount : 0;
  const currentGrandTotal = calculation ? calculation.roundedTotal : Math.round(currentSubtotal - currentDiscount);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Navigation Tabs */}
      <div
        className="billbook-top-tabs"
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '2px solid #E2E8F0',
          paddingBottom: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100%',
          scrollbarWidth: 'none'
        }}
      >
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
                padding: '14px 18px',
                backgroundColor: '#DCFCE7',
                color: '#166534',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #86EFAC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>✓ {successMessage}</div>
                {lastCreditKhataEntry && (
                  <div style={{ fontSize: '12px', color: '#15803D', marginTop: '4px', fontWeight: 600 }}>
                    Client: <strong>{lastCreditKhataEntry.officeName}</strong> ({lastCreditKhataEntry.phone}) • PIN: <span style={{ padding: '1px 6px', backgroundColor: '#BBF7D0', borderRadius: '4px', fontFamily: 'monospace' }}>{lastCreditKhataEntry.pin}</span> • Current Total Due: <strong>₹{lastCreditKhataEntry.totalDue.toFixed(2)}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {lastCreditKhataEntry?.whatsAppUrl && (
                  <a
                    href={lastCreditKhataEntry.whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#25D366',
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    💬 WhatsApp Bill
                  </a>
                )}
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

          <div className="pos-billing-grid">
            {/* Left: Product Selector & Line Items */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>POS Billing Engine</h2>

              {/* Searchable Autocomplete Combobox Bar */}
              <div ref={searchContainerRef} style={{ position: 'relative', marginBottom: '16px' }}>
                <div className="billbook-search-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Input Box */}
                  <div style={{ flex: 1, minWidth: '200px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#94A3B8', fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
                    <input
                      type="text"
                      value={searchItemText}
                      onChange={(e) => {
                        setSearchItemText(e.target.value);
                        setIsSearchOpen(true);
                        setHighlightedIndex(0);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Type dish name or variant (e.g. Chai, Samosa, Half, Full)..."
                      style={{
                        width: '100%',
                        padding: '11px 36px 11px 38px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        backgroundColor: '#FFFFFF'
                      }}
                    />
                    {searchItemText && (
                      <button
                        onClick={() => {
                          setSearchItemText('');
                          setHighlightedIndex(-1);
                        }}
                        title="Clear search"
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="billbook-stepper-add-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Quantity Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', height: '42px', backgroundColor: '#F8FAFC' }}>
                      <button
                        type="button"
                        onClick={() => setInputQuantity((prev) => Math.max(1, prev - 1))}
                        style={{ padding: '0 12px', height: '100%', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '15px', color: '#475569' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={inputQuantity}
                        onChange={(e) => setInputQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '42px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '14px', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setInputQuantity((prev) => prev + 1)}
                        style={{ padding: '0 12px', height: '100%', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '15px', color: '#475569' }}
                      >
                        +
                      </button>
                    </div>

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (filteredBillableItems.length > 0) {
                          const sel = highlightedIndex >= 0 && highlightedIndex < filteredBillableItems.length
                            ? filteredBillableItems[highlightedIndex]
                            : filteredBillableItems[0];
                          addItemToCart({ productId: sel.productId, name: sel.name, unitPrice: sel.unitPrice }, inputQuantity);
                          setSearchItemText('');
                        } else if (selectedProductId) {
                          addItemToCart(undefined, inputQuantity);
                        }
                      }}
                      style={{
                        padding: '11px 22px',
                        backgroundColor: 'var(--cw-color-primary, #C85A17)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>+ Add to Bill</span>
                    </button>
                  </div>
                </div>

                {/* Autocomplete Suggestions Popup */}
                {isSearchOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: '150px',
                      marginTop: '6px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                      maxHeight: '340px',
                      overflowY: 'auto',
                      zIndex: 50
                    }}
                  >
                    {filteredBillableItems.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                        No menu items found matching "{searchItemText}"
                      </div>
                    ) : (
                      filteredBillableItems.map((item, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <div
                            key={item.productId}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            onClick={() => {
                              setSelectedProductId(item.productId);
                              addItemToCart({ productId: item.productId, name: item.name, unitPrice: item.unitPrice }, inputQuantity);
                              setSearchItemText('');
                              setIsSearchOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              cursor: 'pointer',
                              backgroundColor: isHighlighted ? '#F1F5F9' : '#FFFFFF',
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {/* Veg / Non-Veg Badge */}
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '16px',
                                  height: '16px',
                                  border: `1.5px solid ${item.is_veg ? '#16A34A' : (item.is_egg ? '#EAB308' : '#DC2626')}`,
                                  borderRadius: '3px',
                                  padding: '1px'
                                }}
                                title={item.is_veg ? 'Pure Veg' : (item.is_egg ? 'Egg' : 'Non-Veg')}
                              >
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    backgroundColor: item.is_veg ? '#16A34A' : (item.is_egg ? '#EAB308' : '#DC2626')
                                  }}
                                />
                              </span>

                              {/* Item Name & Portion Badge */}
                              <div>
                                <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>
                                  {item.name}
                                </span>
                                {item.portionLabel && (
                                  <span
                                    style={{
                                      marginLeft: '8px',
                                      padding: '2px 7px',
                                      borderRadius: '999px',
                                      backgroundColor: '#EFF6FF',
                                      color: '#2563EB',
                                      fontSize: '11px',
                                      fontWeight: 700
                                    }}
                                  >
                                    {item.portionLabel}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Price and Action */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                                ₹{item.unitPrice.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: isHighlighted ? 'var(--cw-color-primary, #C85A17)' : '#FFFFFF',
                                  color: isHighlighted ? '#FFFFFF' : '#334155',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Fast-Tap Counter Quick Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Quick Add:</span>
                  {[
                    { label: '☕ Chai', search: 'chai' },
                    { label: '🍞 Bun Maska', search: 'bun maska' },
                    { label: '🥟 Samosa', search: 'samosa' },
                    { label: '🥣 Poha', search: 'poha' },
                    { label: '🍛 Chhole Chawal', search: 'chhole' },
                    { label: '🍟 Fries', search: 'fries' },
                    { label: '🧋 Cold Coffee', search: 'cold coffee' }
                  ].map((chip) => {
                    const match = billableItems.find((b) => b.name.toLowerCase().includes(chip.search));
                    if (!match) return null;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => addItemToCart({ productId: match.productId, name: match.name, unitPrice: match.unitPrice }, 1)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#EFF6FF';
                          e.currentTarget.style.borderColor = '#93C5FD';
                          e.currentTarget.style.color = '#1D4ED8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#F8FAFC';
                          e.currentTarget.style.borderColor = '#E2E8F0';
                          e.currentTarget.style.color = '#334155';
                        }}
                      >
                        {chip.label} (₹{match.unitPrice})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cart Table or Empty State */}
              {cart.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '13px' }}>
                  No items in active bill. Select an item above and click <strong>+ Add Item</strong> to start billing.
                </div>
              ) : (
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
              )}
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

              {/* Bill Date Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  📅 Bill Date
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

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

              {/* Khata / Credit Customer Card (Mandatory for Credit) */}
              {(paymentMode === 'CREDIT' || customerType === 'Credit' || customerType === 'Corporate Bill') && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: selectedKhataOffice ? '1.5px solid #16A34A' : '1px solid #CBD5E1'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>📑 Khata Customer *</span>
                      <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 600 }}>(Required for Credit)</span>
                    </label>
                    {!selectedKhataOffice && !isNewKhataCustomer && (
                      <button
                        type="button"
                        onClick={() => setIsNewKhataCustomer(true)}
                        style={{ fontSize: '11px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        + New Customer
                      </button>
                    )}
                  </div>

                  {/* Case 1: Existing Khata Customer Selected */}
                  {selectedKhataOffice ? (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>{selectedKhataOffice.name}</span>
                            <span style={{ fontSize: '11px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontFamily: 'monospace' }}>
                              PIN: {selectedKhataOffice.client_pin || selectedKhataOffice.generated_pin || '----'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                            📞 {selectedKhataOffice.phone} {selectedKhataOffice.company_name ? `• 🏢 ${selectedKhataOffice.company_name}` : ''} {selectedKhataOffice.floor_unit ? `• 📍 ${selectedKhataOffice.floor_unit}` : ''}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 800, marginTop: '5px', color: selectedKhataOffice.balance_due > 0 ? '#DC2626' : '#16A34A' }}>
                            {selectedKhataOffice.balance_due > 0 ? `Current Outstanding Udhaar: ₹${selectedKhataOffice.balance_due.toFixed(2)}` : '✓ All Previous Bills Settled (₹0 Due)'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKhataOffice(null);
                            setKhataSearchQuery('');
                          }}
                          style={{ fontSize: '11px', color: '#EF4444', background: 'none', border: '1px solid #FECACA', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : isNewKhataCustomer ? (
                    /* Case 2: Register New Customer for Khata (4 Simple Fields) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF' }}>✨ Register New Khata Account</span>
                        <button
                          type="button"
                          onClick={() => setIsNewKhataCustomer(false)}
                          style={{ fontSize: '11px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          ✕ Search Existing
                        </button>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>1. Customer / Client Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Ramesh Kumar"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>2. Mobile / WhatsApp Number *</label>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value.replace(/\D/g, ''))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>3. Building (Opt)</label>
                          <input
                            type="text"
                            placeholder="e.g. Vardhman Plaza"
                            value={newCustomerCompany}
                            onChange={(e) => setNewCustomerCompany(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>4. Office Detail (Opt)</label>
                          <input
                            type="text"
                            placeholder="e.g. Office 302, Shop G-12"
                            value={newCustomerFloor}
                            onChange={(e) => setNewCustomerFloor(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#15803D', fontWeight: 600, backgroundColor: '#F0FDF4', padding: '4px 6px', borderRadius: '4px' }}>
                        ℹ️ 4-digit PIN will be auto-generated for customer to check bills online!
                      </div>
                    </div>
                  ) : (
                    /* Case 3: Search Existing Customer */
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search by Name, Phone, Building, Office, or PIN..."
                        value={khataSearchQuery}
                        onChange={(e) => setKhataSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                      />
                      {khataSearchQuery.trim().length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            maxHeight: '190px',
                            overflowY: 'auto',
                            zIndex: 40,
                            marginTop: '4px'
                          }}
                        >
                          {matchedKhataOffices.length > 0 ? (
                            matchedKhataOffices.map((off) => (
                              <div
                                key={off.id}
                                onClick={() => {
                                  setSelectedKhataOffice(off);
                                  setKhataSearchQuery('');
                                }}
                                style={{
                                  padding: '8px 10px',
                                  borderBottom: '1px solid #F1F5F9',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                              >
                                <div>
                                  <strong style={{ color: '#0F172A' }}>{off.name}</strong>
                                  <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>({off.phone})</span>
                                  {off.company_name && <span style={{ fontSize: '10px', color: '#475569', marginLeft: '4px' }}>• 🏢 {off.company_name}</span>}
                                  {off.floor_unit && <span style={{ fontSize: '10px', color: '#475569', marginLeft: '4px' }}>• 📍 {off.floor_unit}</span>}
                                  <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>
                                    PIN: {off.client_pin || off.generated_pin || '----'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: off.balance_due > 0 ? '#DC2626' : '#16A34A', whiteSpace: 'nowrap' }}>
                                  {off.balance_due > 0 ? `Due: ₹${off.balance_due}` : '₹0 Due'}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
                              <div>No existing Khata customer found.</div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsNewKhataCustomer(true);
                                  if (/^\d+$/.test(khataSearchQuery.trim())) {
                                    setNewCustomerPhone(khataSearchQuery.trim());
                                  } else {
                                    setNewCustomerName(khataSearchQuery.trim());
                                  }
                                }}
                                style={{
                                  marginTop: '6px',
                                  padding: '5px 12px',
                                  backgroundColor: '#2563EB',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                + Register "{khataSearchQuery.trim()}" in Khata
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                  backgroundColor: paymentMode === 'CREDIT' ? '#DC2626' : 'var(--cw-color-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: generating || cart.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {generating
                  ? 'Processing Bill...'
                  : paymentMode === 'CREDIT'
                  ? selectedKhataOffice
                    ? `+ Add to ${selectedKhataOffice.name}'s Khata (₹${currentGrandTotal})`
                    : `+ Generate Credit Bill (₹${currentGrandTotal})`
                  : `Generate Bill (₹${currentGrandTotal})`}
              </button>

              {/* Instant Generated Bill Dock (Appears Right Below Button) */}
              {lastInvoice && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    backgroundColor: '#F0FDF4',
                    border: '1.5px solid #86EFAC',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
                        ✓ Bill #{lastInvoice.invoice.invoiceNumber}
                      </span>
                      <div style={{ fontSize: '11px', color: '#15803D' }}>
                        {lastCreditKhataEntry ? `Khata: ${lastCreditKhataEntry.officeName}` : 'Counter Walk-in'} • ₹{lastInvoice.calculation.roundedTotal}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetForNewBill}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      + New Bill
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setThermalReceiptModalOpen(true)}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#16A34A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      🧾 Open Slip
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintCustomerBill}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: '#F97316',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      🖨️ Direct Print
                    </button>
                  </div>

                  {lastCreditKhataEntry?.whatsAppUrl && (
                    <a
                      href={lastCreditKhataEntry.whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#25D366',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '11.5px',
                        fontWeight: 700
                      }}
                    >
                      💬 WhatsApp Bill to {lastCreditKhataEntry.officeName}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3D Thermal Receipt Printer Rollout & KOT Modal */}
      <ThermalReceiptModal
        isOpen={thermalReceiptModalOpen}
        onClose={() => setThermalReceiptModalOpen(false)}
        data={thermalReceiptData}
      />

      {/* Custom Chaiwale Dialog (Popups & Confirmations) */}
      <ChaiwaleDialog
        config={dialogConfig}
        onClose={() => setDialogConfig(null)}
      />

      <style jsx>{`
        .pos-billing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 400px;
          gap: 20px;
        }
        @media (max-width: 1024px) {
          .pos-billing-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
        @media (max-width: 640px) {
          .billbook-search-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .billbook-stepper-add-group {
            display: flex !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .billbook-stepper-add-group button[type="button"]:last-child {
            flex: 1 !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}


