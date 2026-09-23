'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchKhataOffices,
  createKhataOffice,
  addKhataEntry,
  deleteKhataEntry,
  addKhataPayment,
  fetchKhataStatement,
  deleteKhataOffice,
  getKhataExcelExportUrl,
  getKhataStatementPdfUrl,
  KhataOfficeDto,
  KhataStatementDto
} from '../services/billbook-api.client';
import { ThermalReceiptModal, ThermalReceiptData } from './ThermalReceiptModal';
import { ChaiwaleDialog, ChaiwaleDialogConfig } from './ChaiwaleDialog';
import ChaiLoader from './ChaiLoader';

export const BillbookKhataView: React.FC = () => {
  const [offices, setOffices] = useState<KhataOfficeDto[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [statement, setStatement] = useState<KhataStatementDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Date Range Filter States (For Date-wise Excel & PDF Reports)
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [activeDatePreset, setActiveDatePreset] = useState<'all' | 'today' | 'yesterday' | 'this_month' | 'custom'>('all');

  // 3D Thermal Receipt Modal State for Khata
  const [thermalReceiptModalOpen, setThermalReceiptModalOpen] = useState(false);
  const [thermalReceiptData, setThermalReceiptData] = useState<ThermalReceiptData | null>(null);

  // Modals
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [newOfficeCompany, setNewOfficeCompany] = useState('');
  const [newOfficeFloor, setNewOfficeFloor] = useState('');
  const [newOfficeNotes, setNewOfficeNotes] = useState('');

  // Daily Entry Form (Debit Entry / Order Bill)
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryItemName, setEntryItemName] = useState('Kulhad Chai');
  const [entryQty, setEntryQty] = useState<number>(5);
  const [entryPrice, setEntryPrice] = useState<number>(15);
  const [entryNotes, setEntryNotes] = useState('');

  // Payment Form (Credit Entry / Settlement)
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Quick Preset Items for Canteen, Tobacco & Offline Drinks (Editable rate)
  const QUICK_ITEMS = [
    { name: 'Kulhad Chai', price: 15 },
    { name: 'Bun Maska', price: 25 },
    { name: 'Samosa', price: 15 },
    { name: 'Poha', price: 30 },
    { name: 'Cold Coffee', price: 60 },
    { name: '🥤 Cold Drink', price: 40 },
    { name: '💧 Mineral Water', price: 20 },
    { name: '🚬 Cigarette', price: 18 },
    { name: '🚬 Cigarette Pack', price: 180 },
    { name: '⚡ Sting / Red Bull', price: 50 },
    { name: '✨ Custom Item', price: 0 }
  ];

  const loadOffices = async () => {
    setLoading(true);
    try {
      const list = await fetchKhataOffices();
      setOffices(list);
      if (list.length > 0 && !selectedOfficeId) {
        setSelectedOfficeId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Khata offices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDatePreset = (preset: 'all' | 'today' | 'yesterday' | 'this_month' | 'custom') => {
    setActiveDatePreset(preset);
    const today = new Date();
    const toYmd = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setFilterStartDate('');
      setFilterEndDate('');
    } else if (preset === 'today') {
      const todayStr = toYmd(today);
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYmd(yest);
      setFilterStartDate(yestStr);
      setFilterEndDate(yestStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterStartDate(toYmd(firstDay));
      setFilterEndDate(toYmd(today));
    }
  };

  const loadStatement = async (officeId: string, start = filterStartDate, end = filterEndDate) => {
    setStatementLoading(true);
    try {
      const stmt = await fetchKhataStatement(officeId, start || undefined, end || undefined);
      setStatement(stmt);
    } catch (err: any) {
      console.error('Failed to load statement:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  useEffect(() => {
    loadOffices();
  }, []);

  useEffect(() => {
    if (selectedOfficeId) {
      loadStatement(selectedOfficeId, filterStartDate, filterEndDate);
    } else {
      setStatement(null);
    }
  }, [selectedOfficeId, filterStartDate, filterEndDate]);

  // Custom Popups / Dialogs State
  const [dialogConfig, setDialogConfig] = useState<ChaiwaleDialogConfig | null>(null);

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setDialogConfig({ isOpen: true, mode: 'ALERT', title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm', isDanger = false) => {
    setDialogConfig({ isOpen: true, mode: 'CONFIRM', title, message, onConfirm, confirmText, isDanger });
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeName.trim() || !newOfficePhone.trim()) {
      showAlert('Required Fields Missing', 'Please enter both Office / Customer Name and Mobile number.', 'warning');
      return;
    }
    try {
      const created = await createKhataOffice({
        name: newOfficeName,
        phone: newOfficePhone,
        company_name: newOfficeCompany,
        floor_unit: newOfficeFloor,
        notes: newOfficeNotes
      });
      setShowAddOfficeModal(false);
      setNewOfficeName('');
      setNewOfficePhone('');
      setNewOfficeCompany('');
      setNewOfficeFloor('');
      setNewOfficeNotes('');
      showToast(`Account created for ${created.name}`);
      await loadOffices();
      setSelectedOfficeId(created.id);
    } catch (err: any) {
      showAlert('Creation Failed', err.message || 'Failed to create Khata office account.', 'error');
    }
  };

  const handleDeleteOffice = (officeId: string, officeName: string) => {
    showConfirm(
      'Delete Khata Account?',
      `Are you sure you want to permanently delete "${officeName}"?\n\nAll ledger entries, consumption history, and payment records for this account will be erased.`,
      async () => {
        try {
          await deleteKhataOffice(officeId);
          showToast(`Account "${officeName}" deleted successfully`);
          setSelectedOfficeId(null);
          await loadOffices();
        } catch (err: any) {
          showAlert('Delete Failed', err.message || 'Could not delete Khata office account.', 'error');
        }
      },
      'Delete Account',
      true
    );
  };

  const handleGenerateKhataBillSlip = (office: KhataOfficeDto, stmt: KhataStatementDto | null) => {
    const items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number; notes?: string }> = [];

    if (stmt && stmt.dateGroups && stmt.dateGroups.length > 0) {
      stmt.dateGroups.forEach((grp) => {
        grp.items.forEach((it) => {
          items.push({
            name: `${it.item_name} [${grp.date}]`,
            quantity: it.quantity,
            unitPrice: it.unit_price,
            lineTotal: it.total_amount ?? (it.quantity * it.unit_price),
            notes: it.notes || undefined
          });
        });
      });
    } else {
      items.push({
        name: 'Khata Statement Balance',
        quantity: 1,
        unitPrice: office.balance_due,
        lineTotal: office.balance_due
      });
    }

    const cleanPhone = office.phone ? office.phone.replace(/\D/g, '') : '';
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = stmt?.whatsappText && cleanPhone ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(stmt.whatsappText)}` : undefined;

    setThermalReceiptData({
      receiptType: 'CREDIT_BILL',
      invoiceNumber: `KHATA-${(office.name || 'ACC').slice(0, 4).toUpperCase().replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      paymentMode: 'CREDIT',
      customerName: office.name,
      customerPhone: office.phone,
      customerAddress: office.company_name ? `${office.company_name}${office.floor_unit ? ` (${office.floor_unit})` : ''}` : office.floor_unit || undefined,
      customerPin: office.client_pin || office.generated_pin || undefined,
      customerTotalDue: office.balance_due,
      items,
      subtotal: stmt?.totalConsumption || office.balance_due,
      paidAmount: stmt?.totalPayments || 0,
      grandTotal: office.balance_due,
      whatsAppUrl: waUrl
    });
    setThermalReceiptModalOpen(true);
  };

  const handleSelectQuickItem = (qi: { name: string; price: number }) => {
    if (qi.name.includes('Custom Item')) {
      setEntryItemName('');
      setEntryPrice(0);
      return;
    }
    // Remove leading emoji icon for clean database logging
    const cleanName = qi.name.replace(/^[^\w\s]+\s*/, '');
    setEntryItemName(cleanName);
    if (qi.price > 0) {
      setEntryPrice(qi.price);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId) return;
    if (!entryItemName.trim() || entryQty <= 0 || entryPrice < 0) {
      showAlert('Validation Error', 'Please enter a valid item name, quantity, and price.', 'warning');
      return;
    }
    try {
      await addKhataEntry({
        office_id: selectedOfficeId,
        date: entryDate,
        item_name: entryItemName,
        quantity: Number(entryQty),
        unit_price: Number(entryPrice),
        notes: entryNotes
      });
      showToast(`Added ${entryQty}x ${entryItemName} (₹${entryQty * entryPrice})`);
      setEntryNotes('');
      await loadStatement(selectedOfficeId);
      await loadOffices();

      // Automatically pop up the 3D Thermal Receipt modal with this updated entry!
      const curr = offices.find((o) => o.id === selectedOfficeId);
      if (curr) {
        const cleanPhone = curr.phone ? curr.phone.replace(/\D/g, '') : '';
        const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const entryTotal = Number(entryQty) * Number(entryPrice);
        const newDue = curr.balance_due + entryTotal;
        const pin = curr.client_pin || curr.generated_pin || '----';
        const formattedDate = new Date(entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const waMsg = `Namaste ${curr.name}, Chaiwale Debit Bill (${formattedDate}) of ₹${entryTotal} [${entryQty}x ${entryItemName}] has been recorded. Total Khata Due: ₹${newDue}. Check statement with PIN ${pin} at https://chaiwale.co.in/check-bill?phone=${cleanPhone}&pin=${pin}`;
        const waUrl = cleanPhone ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(waMsg)}` : undefined;

        setThermalReceiptData({
          receiptType: 'CREDIT_BILL',
          invoiceNumber: `DEBIT-${Date.now().toString().slice(-6)}`,
          date: formattedDate + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          paymentMode: 'CREDIT',
          customerName: curr.name,
          customerPhone: curr.phone,
          customerAddress: curr.company_name || curr.floor_unit || undefined,
          customerPin: pin,
          customerTotalDue: newDue,
          items: [{
            name: entryItemName,
            quantity: Number(entryQty),
            unitPrice: Number(entryPrice),
            lineTotal: entryTotal,
            notes: entryNotes || undefined
          }],
          subtotal: entryTotal,
          grandTotal: entryTotal,
          whatsAppUrl: waUrl
        });
        setThermalReceiptModalOpen(true);
      }
    } catch (err: any) {
      showAlert('Entry Failed', err.message || 'Failed to add entry', 'error');
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    showConfirm(
      'Remove Khata Entry?',
      'Are you sure you want to remove this item from the khata ledger?',
      async () => {
        try {
          await deleteKhataEntry(entryId);
          showToast('Entry removed successfully');
          if (selectedOfficeId) {
            await loadStatement(selectedOfficeId);
            await loadOffices();
          }
        } catch (err: any) {
          showAlert('Delete Failed', err.message || 'Failed to delete entry', 'error');
        }
      },
      'Remove Item',
      true
    );
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeId) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.', 'warning');
      return;
    }
    try {
      await addKhataPayment({
        office_id: selectedOfficeId,
        date: paymentDate,
        amount: amt,
        payment_mode: paymentMode,
        notes: paymentNotes
      });
      showToast(`Payment of ₹${amt} recorded!`);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadStatement(selectedOfficeId);
      await loadOffices();

      const curr = offices.find((o) => o.id === selectedOfficeId);
      if (curr) {
        const cleanPhone = curr.phone ? curr.phone.replace(/\D/g, '') : '';
        const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const newDue = Math.max(0, curr.balance_due - amt);
        const pin = curr.client_pin || curr.generated_pin || '----';
        const formattedDate = new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const waMsg = `Namaste ${curr.name}, payment of ₹${amt} received via ${paymentMode} on ${formattedDate}. Updated Outstanding Khata Balance: ₹${newDue}. View statement with PIN ${pin} at https://chaiwale.co.in/check-bill?phone=${cleanPhone}&pin=${pin}`;
        const waUrl = cleanPhone ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(waMsg)}` : undefined;

        setThermalReceiptData({
          receiptType: 'CREDIT_BILL',
          invoiceNumber: `SETTLE-${Date.now().toString().slice(-6)}`,
          date: formattedDate + ', ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          paymentMode: paymentMode,
          customerName: curr.name,
          customerPhone: curr.phone,
          customerAddress: curr.company_name || curr.floor_unit || undefined,
          customerPin: pin,
          customerTotalDue: newDue,
          items: [{
            name: `Settlement Payment Received (${paymentMode})`,
            quantity: 1,
            unitPrice: amt,
            lineTotal: amt,
            notes: paymentNotes || 'Settlement Credit'
          }],
          subtotal: amt,
          paidAmount: amt,
          grandTotal: 0,
          whatsAppUrl: waUrl
        });
        setThermalReceiptModalOpen(true);
      }
    } catch (err: any) {
      showAlert('Payment Failed', err.message || 'Failed to record payment', 'error');
    }
  };

  const triggerWhatsApp = () => {
    if (!statement || !statement.office.phone) {
      showAlert('Mobile Missing', 'Customer mobile number is not registered for WhatsApp.', 'warning');
      return;
    }
    const cleanPhone = statement.office.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const pin = statement.office.client_pin || '----';
    let text = statement.whatsappText;
    text += `\n📄 *Official Itemized Statement & Verification:*\nhttps://chaiwale.co.in/check-bill?phone=${cleanPhone}&pin=${pin} (PIN: ${pin})\n`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const copyStatementText = () => {
    if (!statement) return;
    navigator.clipboard.writeText(statement.whatsappText);
    showToast('Bill statement copied to clipboard!');
  };

  const filteredOffices = offices.filter((o) => {
    const q = searchTerm.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.phone.includes(searchTerm) ||
      (o.company_name && o.company_name.toLowerCase().includes(q)) ||
      (o.floor_unit && o.floor_unit.toLowerCase().includes(q)) ||
      ((o.client_pin || o.generated_pin) && (o.client_pin || o.generated_pin)!.includes(searchTerm))
    );
  });

  const selectedOffice = offices.find((o) => o.id === selectedOfficeId);
  const totalMarketDue = offices.reduce((s, o) => s + (o.balance_due > 0 ? o.balance_due : 0), 0);

  // Immediate authoritative metrics (prevent jumping from 0 to actual value)
  const effectiveTotalBilled = statement ? statement.totalConsumption : (selectedOffice?.total_consumption ?? 0);
  const effectiveTotalPaid = statement ? statement.totalPayments : (selectedOffice?.total_payments ?? 0);
  const effectiveDue = statement ? statement.balanceDue : (selectedOffice?.balance_due ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: '#F8F9FA' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          ✓ {notification}
        </div>
      )}

      {/* Khatabook Top Header Banner */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#DC2626',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 800
            }}
          >
            📖
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>
              Bill Khata (Office & Customer Ledger)
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
              Daily consumption, date-wise item entries & instant 1-Click WhatsApp bills
            </p>
          </div>
        </div>

        {/* Total Market Due Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              padding: '8px 16px',
              borderRadius: '8px',
              textAlign: 'right'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
              Total Market / Office Due
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>
              ₹{totalMarketDue.toLocaleString('en-IN')}
            </div>
          </div>

          <button
            onClick={() => setShowAddOfficeModal(true)}
            style={{
              backgroundColor: '#1E3A8A',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Add New Office / Client
          </button>
        </div>
      </div>

      {/* Date Filter & Excel Export Toolbar */}
      <div
        style={{
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📅 Date Range:
          </span>
          <div style={{ display: 'inline-flex', gap: '4px', background: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_month', label: 'This Month' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyDatePreset(p.id as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeDatePreset === p.id ? '#FFFFFF' : 'transparent',
                  color: activeDatePreset === p.id ? '#1E293B' : '#64748B',
                  boxShadow: activeDatePreset === p.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>From:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => {
                setFilterStartDate(e.target.value);
                setActiveDatePreset('custom');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF'
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748B' }}>To:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => {
                setFilterEndDate(e.target.value);
                setActiveDatePreset('custom');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                backgroundColor: '#FFFFFF'
              }}
            />
          </div>
        </div>

        {/* Global Export Excel Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              const url = getKhataExcelExportUrl({
                startDate: filterStartDate || undefined,
                endDate: filterEndDate || undefined
              });
              window.open(url, '_blank');
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #16A34A',
              backgroundColor: '#F0FDF4',
              color: '#15803D',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(22, 163, 74, 0.15)'
            }}
            title="Download 4-sheet date-wise Excel workbook covering all active Khata customers"
          >
            <span>📊 Export Khata Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Two Column Layout */}
      <div className="khata-main-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Column: Office / Client Directory (340px) */}
        <div
          className="khata-directory-column"
          style={{
            width: '340px',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <input
              type="text"
              placeholder="🔍 Search Name, Phone, Building, Office, PIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Office List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredOffices.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                No office accounts found. Click "+ Add New Office" to start.
              </div>
            ) : (
              filteredOffices.map((off) => {
                const isSelected = off.id === selectedOfficeId;
                return (
                  <div
                    key={off.id}
                    onClick={() => setSelectedOfficeId(off.id)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #F3F4F6',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                      borderLeft: isSelected ? '4px solid #2563EB' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: isSelected ? '#1E40AF' : '#1F2937',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {off.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                          📱 {off.phone}
                        </div>
                        {(off.company_name || off.floor_unit) && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {off.company_name ? `🏢 ${off.company_name}` : ''} {off.floor_unit ? `• 📍 ${off.floor_unit}` : ''}
                          </div>
                        )}
                      </div>

                      {/* Balance Badge */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: off.balance_due > 0 ? '#DC2626' : '#059669'
                          }}
                        >
                          ₹{off.balance_due.toLocaleString('en-IN')}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: off.balance_due > 0 ? '#DC2626' : '#059669',
                            textTransform: 'uppercase'
                          }}
                        >
                          {off.balance_due > 0 ? 'Due' : 'Settled'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Office Khata Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          {selectedOffice ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Card & WhatsApp Action Bar */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '18px 24px',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>
                      {selectedOffice.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: effectiveDue > 0 ? '#FEE2E2' : '#D1FAE5',
                        color: effectiveDue > 0 ? '#991B1B' : '#065F46',
                        fontWeight: 700
                      }}
                    >
                      {effectiveDue > 0 ? `₹${effectiveDue.toLocaleString('en-IN')} Due` : 'All Cleared (₹0 Due)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: '6px', fontSize: '13px', color: '#6B7280' }}>
                    <span>📱 WhatsApp: <strong style={{ color: '#111827' }}>{selectedOffice.phone}</strong></span>
                    {selectedOffice.company_name && (
                      <span>🏢 Company: <strong style={{ color: '#111827' }}>{selectedOffice.company_name}</strong></span>
                    )}
                    {selectedOffice.floor_unit && (
                      <span>📍 Floor: <strong style={{ color: '#111827' }}>{selectedOffice.floor_unit}</strong></span>
                    )}
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Download Official Date-wise PDF Bill */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedOffice) return;
                      const url = getKhataStatementPdfUrl(selectedOffice.id, {
                        startDate: filterStartDate || undefined,
                        endDate: filterEndDate || undefined,
                        pin: selectedOffice.client_pin
                      });
                      window.open(url, '_blank');
                    }}
                    style={{
                      backgroundColor: '#0F172A',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Generate and download official PDF bill for customer with itemized date-wise breakdown"
                  >
                    📄 Download PDF Bill
                  </button>

                  {/* Customer Excel Export */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedOffice) return;
                      const url = getKhataExcelExportUrl({
                        office_id: selectedOffice.id,
                        startDate: filterStartDate || undefined,
                        endDate: filterEndDate || undefined
                      });
                      window.open(url, '_blank');
                    }}
                    style={{
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Export this customer's date-wise entries to Excel"
                  >
                    📊 Excel
                  </button>

                  <button
                    onClick={() => selectedOffice && handleGenerateKhataBillSlip(selectedOffice, statement)}
                    style={{
                      background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🧾 Generate Bill Slip
                  </button>

                  <button
                    onClick={copyStatementText}
                    style={{
                      background: '#F3F4F6',
                      border: '1px solid #D1D5DB',
                      color: '#374151',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy Text
                  </button>

                  <button
                    onClick={triggerWhatsApp}
                    style={{
                      backgroundColor: '#25D366',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
                    }}
                  >
                    💬 Send Bill on WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => selectedOffice && handleDeleteOffice(selectedOffice.id, selectedOffice.name)}
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                    title="Permanently delete this Khata account"
                  >
                    🗑️ Delete Account
                  </button>
                </div>
              </div>

              {/* Two Action Input Panels: DEBIT ENTRY (BILL) vs CREDIT ENTRY (PAYMENT) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
                {/* 1. DEBIT ENTRY (Order Bill / Daily Consumption Punch) */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #FCA5A5',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '18px' }}>📑</span>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#B91C1C' }}>
                      Debit Entry / Order Bill (Billed Amount)
                    </h4>
                  </div>

                  {/* Quick Item Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>
                      ⚡ Fast-Tap Presets (Tap any item, rate can be adjusted below):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {QUICK_ITEMS.map((qi) => {
                        const isCustom = qi.name.includes('Custom');
                        const isTobacco = qi.name.includes('Cigarette');
                        const isDrink = qi.name.includes('Cold Drink') || qi.name.includes('Water') || qi.name.includes('Red Bull');
                        const isSelected = entryItemName === qi.name.replace(/^[^\w\s]+\s*/, '');

                        let bg = isSelected ? '#FEE2E2' : '#F9FAFB';
                        let border = isSelected ? '1.5px solid #EF4444' : '1px solid #E5E7EB';
                        let color = isSelected ? '#B91C1C' : '#374151';

                        if (isTobacco && !isSelected) {
                          bg = '#FFF1F2';
                          border = '1px solid #FECDD3';
                          color = '#9F1239';
                        } else if (isDrink && !isSelected) {
                          bg = '#F0FDF4';
                          border = '1px solid #BBF7D0';
                          color = '#166534';
                        } else if (isCustom && !isSelected) {
                          bg = '#EFF6FF';
                          border = '1.5px dashed #3B82F6';
                          color = '#1D4ED8';
                        }

                        return (
                          <button
                            key={qi.name}
                            type="button"
                            onClick={() => handleSelectQuickItem(qi)}
                            style={{
                              background: bg,
                              border,
                              color,
                              padding: '5px 11px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{qi.name}</span>
                            {qi.price > 0 && <span style={{ opacity: 0.85 }}>(₹{qi.price})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1.2fr 80px 80px', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Bill Date
                        </label>
                        <input
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={entryItemName}
                          onChange={(e) => setEntryItemName(e.target.value)}
                          placeholder="e.g. Kulhad Chai, Bun Maska, Samosa..."
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={entryQty}
                          onChange={(e) => setEntryQty(Math.max(1, Number(e.target.value)))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={entryPrice}
                          onChange={(e) => setEntryPrice(Math.max(0, Number(e.target.value)))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        Total: <strong style={{ color: '#DC2626', fontSize: '15px' }}>₹{entryQty * entryPrice}</strong>
                      </span>

                      <button
                        type="submit"
                        style={{
                          background: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 18px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        + Log Debit Bill
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. CREDIT ENTRY (Payment Received / Settlement) */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #A7F3D0',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '18px' }}>💳</span>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#047857' }}>
                      Credit Entry / Payment Received (Settlement)
                    </h4>
                  </div>

                  <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Date
                        </label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Amount Received (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 500"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Mode
                        </label>
                        <select
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CASH">Cash</option>
                          <option value="GPAY">Google Pay / PhonePe</option>
                          <option value="PAYTM">Paytm</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', marginBottom: '4px' }}>
                          Remarks (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Weekly settlement"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #D1D5DB',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        marginTop: '4px',
                        background: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      + Record Settlement (Credit)
                    </button>
                  </form>
                </div>
              </div>

              {/* 3. Date-Wise Itemized Ledger Statement */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                    📋 Date-Wise Canteen Consumption Ledger
                  </h4>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Total Billed: <strong style={{ color: '#0F172A' }}>₹{effectiveTotalBilled.toLocaleString('en-IN')}</strong></span>
                    <span>Total Paid: <strong style={{ color: '#059669' }}>₹{effectiveTotalPaid.toLocaleString('en-IN')}</strong></span>
                    <span>Balance Due: <strong style={{ color: effectiveDue > 0 ? '#DC2626' : '#059669' }}>₹{effectiveDue.toLocaleString('en-IN')}</strong></span>
                    {statementLoading && (
                      <span style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        ⏳ Syncing date range...
                      </span>
                    )}
                  </div>
                </div>

                {statementLoading && !statement ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <ChaiLoader label="Loading Statement..." sublabel="Fetching date-wise consumption & payments..." />
                  </div>
                ) : !statement || (statement.dateGroups.length === 0 && statement.payments.length === 0) ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                    No consumption entries recorded for this client yet. Use "Debit Entry" panel above to add billing items.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Date Groups */}
                    {statement.dateGroups.map((grp) => (
                      <div
                        key={grp.date}
                        style={{
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Date Group Header */}
                        <div
                          style={{
                            background: '#F9FAFB',
                            padding: '10px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #E5E7EB',
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#374151'
                          }}
                        >
                          <span>🗓️ Date: {grp.date}</span>
                          <span style={{ color: '#DC2626', fontWeight: 800 }}>
                            Day Total: ₹{grp.dateTotal}
                          </span>
                        </div>

                        {/* Items in Day */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#FFFFFF', color: '#6B7280', fontSize: '11px', textAlign: 'left' }}>
                              <th style={{ padding: '8px 16px' }}>Item Description</th>
                              <th style={{ padding: '8px 16px' }}>Qty</th>
                              <th style={{ padding: '8px 16px' }}>Rate</th>
                              <th style={{ padding: '8px 16px' }}>Line Total</th>
                              <th style={{ padding: '8px 16px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grp.items.map((it) => (
                              <tr key={it.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '8px 16px', fontWeight: 600, color: '#111827' }}>
                                  {it.item_name}
                                  {it.notes && <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '6px' }}>({it.notes})</span>}
                                </td>
                                <td style={{ padding: '8px 16px', color: '#374151' }}>{it.quantity}</td>
                                <td style={{ padding: '8px 16px', color: '#6B7280' }}>₹{it.unit_price}</td>
                                <td style={{ padding: '8px 16px', fontWeight: 700, color: '#DC2626' }}>₹{it.total_amount}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleDeleteEntry(it.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#9CA3AF',
                                      cursor: 'pointer',
                                      fontSize: '13px'
                                    }}
                                    title="Delete entry"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Payments History in this khata */}
                    {statement.payments.length > 0 && (
                      <div style={{ border: '1px solid #A7F3D0', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
                        <div
                          style={{
                            background: '#ECFDF5',
                            padding: '10px 16px',
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#065F46',
                            borderBottom: '1px solid #A7F3D0'
                          }}
                        >
                          💵 Payments / Settlements Received
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tbody>
                            {statement.payments.map((p) => (
                              <tr key={p.id} style={{ borderTop: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                                <td style={{ padding: '8px 16px', color: '#6B7280' }}>{p.date}</td>
                                <td style={{ padding: '8px 16px', fontWeight: 600, color: '#047857' }}>
                                  Payment Received ({p.payment_mode})
                                </td>
                                <td style={{ padding: '8px 16px', color: '#6B7280' }}>{p.notes || '-'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                                  - ₹{p.amount}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>
              Select an office from the left directory to view their Khata or record daily consumption.
            </div>
          )}
        </div>
      </div>

      {/* Add New Office Modal */}
      {showAddOfficeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px 28px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                + Add New Office / Client Account
              </h3>
              <button
                onClick={() => setShowAddOfficeModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOffice} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Client / Person Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sharma Ji or Tech Mahindra Support"
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  WhatsApp / Mobile Number * (No country code)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9811223344"
                  value={newOfficePhone}
                  onChange={(e) => setNewOfficePhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Building Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vardhman Grand Plaza"
                    value={newOfficeCompany}
                    onChange={(e) => setNewOfficeCompany(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Office Detail
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Office 302, Shop G-12"
                    value={newOfficeFloor}
                    onChange={(e) => setNewOfficeFloor(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Billing Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Friday billing"
                  value={newOfficeNotes}
                  onChange={(e) => setNewOfficeNotes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddOfficeModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#1E3A8A', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3D Thermal Receipt Modal for Khata */}
      <ThermalReceiptModal
        isOpen={thermalReceiptModalOpen}
        onClose={() => setThermalReceiptModalOpen(false)}
        data={thermalReceiptData}
      />

      {/* Custom Chaiwale Alert / Confirm Dialog */}
      <ChaiwaleDialog
        config={dialogConfig}
        onClose={() => setDialogConfig(null)}
      />

      <style jsx>{`
        .khata-main-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
          width: 100%;
        }
        @media (max-width: 768px) {
          .khata-main-layout {
            flex-direction: column !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            width: 100% !important;
          }
          .khata-directory-column {
            width: 100% !important;
            max-height: 240px !important;
            border-right: none !important;
            border-bottom: 1px solid #E5E7EB !important;
          }
        }
      `}</style>
    </div>
  );
};

