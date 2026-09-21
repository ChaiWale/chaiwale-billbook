const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const BILLBOOK_TOKEN_KEY = 'chaiwale_billbook_auth_token';

export interface MenuItemDto {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_egg?: boolean;
  tags?: string[];
  image_path: string | null;
  is_available: boolean;
  variants?: Array<{
    id?: string;
    name: string;
    price: number;
    is_available?: boolean;
  }>;
}

export interface BillingItemInput {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  taxRatePercent?: number;
}

export interface BillingCalculationResultDto {
  items: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    taxAmount: number;
    netTotal: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  additionalCharges: number;
  grandTotal: number;
  roundedTotal: number;
  currency: string;
}

export interface GenerateInvoiceInputDto {
  orderId?: string;
  corporateClientId?: string;
  cateringQuoteId?: string;
  invoiceType: 'DIRECT' | 'CORPORATE_CREDIT' | 'CATERING';
  department?: string;
  customerName?: string;
  customerPhone?: string;
  issueDate?: string;
  items: BillingItemInput[];
  overallDiscountPercent?: number;
  additionalCharges?: number;
  paymentMode?: 'CASH' | 'UPI' | 'CREDIT' | 'CARD' | 'SPLIT';
  transactionRef?: string;
}

export interface GeneratedInvoiceResponseDto {
  invoice: {
    id: string;
    invoiceNumber: string;
    status?: string;
    paidAmount?: number;
    outstandingAmount?: number;
  };
  calculation: BillingCalculationResultDto;
}

export interface InvoiceRecordDto {
  id: string;
  invoice_number: string;
  invoice_type: string;
  department?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'CANCELLED';
  issued_at: string;
  pdf_storage_path?: string | null;
  corporate_clients?: {
    id?: string;
    company_name: string;
  } | null;
  orders?: {
    id?: string;
    order_number?: string;
    customer_name?: string;
    order_type?: string;
    payment_mode?: string;
    delivery_address?: string;
    order_items?: Array<{
      item_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }>;
  } | null;
}

export interface InvoiceDetailDto extends InvoiceRecordDto {
  corporate_clients?: {
    id?: string;
    company_name: string;
    gstin?: string;
    billing_address?: string;
  } | null;
  orders?: {
    id?: string;
    order_number?: string;
    customer_id?: string;
    customer_name?: string;
    delivery_address?: string;
    payment_mode?: string;
    customers?: {
      name: string;
      phone: string;
    } | null;
    order_items?: Array<{
      item_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }>;
  } | null;
  payments?: Array<{
    id: string;
    amount: number;
    payment_mode: string;
    payment_status: string;
    transaction_ref?: string;
    paid_at: string;
  }>;
}

export interface LedgerRecordDto {
  id: string;
  entry_type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance_after: number;
  reference_note: string;
  created_at: string;
  corporate_clients?: {
    id?: string;
    company_name: string;
  } | null;
  invoices?: {
    invoice_number: string;
  } | null;
}

export interface WebOrderDto {
  id: string;
  order_number: string;
  order_type: string;
  customer_name?: string;
  delivery_address?: string;
  payment_mode?: string;
  transaction_ref?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  status: string;
  payment_status: string;
  created_at: string;
  items?: Array<{
    id?: string;
    item_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
}

export interface CounterStaffUser {
  email: string;
  role: string;
  fullName?: string;
}

const BILLBOOK_USER_KEY = 'chaiwale_billbook_auth_user';

// Session Token Storage Utilities
export function getBillbookAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BILLBOOK_TOKEN_KEY);
}

export function getBillbookAuthUser(): CounterStaffUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(BILLBOOK_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setBillbookAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BILLBOOK_TOKEN_KEY, token);
}

export function setBillbookSession(token: string, user: CounterStaffUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BILLBOOK_TOKEN_KEY, token);
  localStorage.setItem(BILLBOOK_USER_KEY, JSON.stringify(user));
}

export function clearBillbookAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BILLBOOK_TOKEN_KEY);
  localStorage.removeItem(BILLBOOK_USER_KEY);
}

/**
 * Authenticated Fetch for Protected BillBook Endpoints
 * Automatically re-authenticates counter staff if token is missing or expired (401)
 */
async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let token = getBillbookAuthToken();

  if (!token && typeof window !== 'undefined') {
    try {
      const auth = await quickLoginBillingStaff();
      token = auth.accessToken;
    } catch (loginErr) {
      console.warn('Silent counter auto-login failed on initial check:', loginErr);
    }
  }

  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(input, {
    ...init,
    headers
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    clearBillbookAuthToken();
    try {
      // Re-authenticate silently and retry request once
      const auth = await quickLoginBillingStaff();
      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set('Authorization', `Bearer ${auth.accessToken}`);
      if (init.body && !retryHeaders.has('Content-Type')) {
        retryHeaders.set('Content-Type', 'application/json');
      }
      response = await fetch(input, {
        ...init,
        headers: retryHeaders
      });
    } catch (retryErr) {
      console.error('Silent counter re-authentication failed on 401 retry:', retryErr);
    }
  }

  return response;
}

/**
 * Authenticate Counter Staff / Manager
 */
export async function loginStaff(email: string, pass: string): Promise<{ accessToken: string; user: CounterStaffUser }> {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Staff authentication failed.');
  }

  const { accessToken, user } = json.data;
  const staffUser: CounterStaffUser = {
    email: user.email,
    role: user.role,
    fullName: user.fullName || user.email
  };
  setBillbookSession(accessToken, staffUser);
  return { accessToken, user: staffUser };
}

/**
 * 1-Click Counter Activation for Billing Staff
 */
export async function quickLoginBillingStaff(): Promise<{ accessToken: string; user: CounterStaffUser }> {
  return loginStaff('bills@chaiwale.co.in', 'Chaiwale@2026');
}

/**
 * Health check
 */
export async function fetchBillbookHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${BACKEND_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Billbook health check failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch available menu items from backend (Public)
 */
export async function fetchMenuItems(): Promise<MenuItemDto[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/menu/items`);
  if (!res.ok) {
    throw new Error(`Failed to fetch menu items: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Fetch public UPI config from backend
 */
export async function fetchUpiConfig(): Promise<{
  upiId: string;
  merchantName: string;
  accountHolder: string;
  qrPublicUrl: string;
}> {
  const res = await fetch(`${BACKEND_URL}/api/v1/config/upi`);
  if (!res.ok) {
    return {
      upiId: 'chaiwale@ptyes',
      merchantName: 'Chaiwale',
      accountHolder: 'Shubham Sharma',
      qrPublicUrl: '/media/branding/qr/chaiwale-upi-qr.jpeg'
    };
  }
  const data = await res.json();
  return data.data;
}

/**
 * Request authoritative calculation from backend billing engine (Public pure arithmetic engine)
 */
export async function calculateBill(payload: {
  items: BillingItemInput[];
  overallDiscountPercent?: number;
  additionalCharges?: number;
  billType?: string;
}): Promise<BillingCalculationResultDto> {
  const res = await fetch(`${BACKEND_URL}/api/v1/billing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Calculation failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
}

/**
 * Generate invoice in Supabase with exact payment mode (CASH, UPI, CREDIT)
 */
export async function generateInvoice(
  payload: GenerateInvoiceInputDto
): Promise<GeneratedInvoiceResponseDto> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/billing/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create invoice: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
}

/**
 * Record full or partial payment against an existing invoice
 */
export async function recordInvoicePayment(payload: {
  invoiceId: string;
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD';
  transactionRef?: string;
  notes?: string;
}): Promise<{
  paymentId: string;
  invoiceNumber: string;
  status: string;
  paidAmount: number;
  outstandingAmount: number;
}> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/billing/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to record payment');
  }
  const data = await res.json();
  return data.data;
}

/**
 * Fetch past invoices with optional status and client filter
 */
export async function fetchInvoices(filters?: {
  status?: string;
  clientId?: string;
  limit?: number;
}): Promise<InvoiceRecordDto[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  params.set('limit', String(filters?.limit || 50));

  const res = await authFetch(`${BACKEND_URL}/api/v1/billing/invoices?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch invoices: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Fetch incoming online web orders for 1-click invoice conversion
 */
export async function fetchWebOrders(limit = 20): Promise<WebOrderDto[]> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/orders/recent?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch incoming orders');
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Verify customer UPI payment for an order
 */
export async function verifyOrderPayment(orderId: string): Promise<boolean> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/orders/${encodeURIComponent(orderId)}/verify-payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to verify payment');
  }
  return true;
}

/**
 * Fetch customer & corporate ledger records
 */
export async function fetchLedger(clientId?: string, limit = 50): Promise<LedgerRecordDto[]> {
  const url = clientId
    ? `${BACKEND_URL}/api/v1/billing/ledger?clientId=${encodeURIComponent(clientId)}&limit=${limit}`
    : `${BACKEND_URL}/api/v1/billing/ledger?limit=${limit}`;
  const res = await authFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch ledger: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Generate thermal ESC/POS payload (Customer Bill, KOT, Credit Bill)
 */
export async function fetchPrintPayload(params: {
  receiptType: 'CUSTOMER_BILL' | 'KOT' | 'CREDIT_BILL';
  orderId?: string;
  invoiceId?: string;
}): Promise<{
  receiptType: string;
  base64String: string;
  plainTextPreview: string;
}> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/printing/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate print receipt');
  }
  const data = await res.json();
  return data.data;
}

/**
 * Get direct URL for Invoice PDF (served through bills.chaiwale.co.in domain)
 */
export function getInvoicePdfUrl(invoiceId: string): string {
  return `/api/pdf/invoice/${encodeURIComponent(invoiceId)}`;
}

/**
 * Get direct download URL for Corporate Statement PDF
 */
export function getStatementPdfUrl(clientId: string): string {
  const token = getBillbookAuthToken();
  return `${BACKEND_URL}/api/v1/documents/pdf/statement/${encodeURIComponent(clientId)}?token=${token || ''}`;
}

/**
 * Get direct download URL for Sales Report Excel
 */
export function getSalesExcelUrl(): string {
  const token = getBillbookAuthToken();
  return `${BACKEND_URL}/api/v1/documents/excel/sales?token=${token || ''}`;
}

/**
 * Fetch Full Invoice Details by ID
 */
export async function fetchInvoiceById(invoiceId: string): Promise<InvoiceDetailDto> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch invoice details for ${invoiceId}`);
  }
  const data = await res.json();
  return data.data;
}

/**
 * Fetch Brand Details & Official WhatsApp Number
 */
export async function fetchBrandConfig(): Promise<{
  brandName: string;
  tagline: string;
  whatsappNumber: string;
  phone: string;
  address: string;
  email: string;
  upiId: string;
  logoUrl: string;
}> {
  const res = await fetch(`${BACKEND_URL}/api/v1/config/brand`);
  if (!res.ok) {
    return {
      brandName: 'Chaiwale',
      tagline: 'Sip, Bite, Repeat',
      whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919310112564',
      phone: '+91 93101 12564',
      address: 'Upper Ground Floor, Vardhman Grand Plaza, G-31, M2K Rd, Mangalam Place, Sector 03, Rohini, New Delhi, Delhi 110085',
      email: 'admin@chaiwale.co.in',
      upiId: 'paytmqr28100505010115gsv3315o55@paytm',
      logoUrl: '/media/branding/logo/chaiwale-logo.jpeg'
    };
  }
  const data = await res.json();
  return data.data;
}

// ==========================================
// KHATABOOK / CANTEEN OFFICE KHATA API
// ==========================================

export interface KhataOfficeDto {
  id: string;
  name: string;
  phone: string;
  company_name?: string;
  floor_unit?: string;
  notes?: string;
  client_pin?: string;
  generated_pin?: string;
  total_consumption: number;
  total_payments: number;
  balance_due: number;
  last_entry_date?: string;
}

export interface KhataEntryDto {
  id: string;
  office_id: string;
  date: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes?: string;
}

export interface KhataPaymentDto {
  id: string;
  office_id: string;
  date: string;
  amount: number;
  payment_mode: string;
  notes?: string;
}

export interface KhataStatementDto {
  office: KhataOfficeDto;
  entries: KhataEntryDto[];
  payments: KhataPaymentDto[];
  dateGroups: {
    date: string;
    items: KhataEntryDto[];
    dateTotal: number;
  }[];
  totalConsumption: number;
  totalPayments: number;
  balanceDue: number;
  whatsappText: string;
}

export async function fetchKhataOffices(): Promise<KhataOfficeDto[]> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/offices`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load Khata offices');
  }
  const data = await res.json();
  return data.data || [];
}

export async function createKhataOffice(input: {
  name: string;
  phone: string;
  company_name?: string;
  floor_unit?: string;
  notes?: string;
}): Promise<KhataOfficeDto> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/offices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create office account');
  }
  const data = await res.json();
  return data.data;
}

export async function addKhataEntry(input: {
  office_id: string;
  date: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}): Promise<KhataEntryDto> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to add Khata entry');
  }
  const data = await res.json();
  return data.data;
}

export async function deleteKhataEntry(id: string): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/entries/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete Khata entry');
  }
}

export async function addKhataPayment(input: {
  office_id: string;
  date: string;
  amount: number;
  payment_mode: string;
  notes?: string;
}): Promise<KhataPaymentDto> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to record Khata payment');
  }
  const data = await res.json();
  return data.data;
}

export async function fetchKhataStatement(
  officeId: string,
  startDate?: string,
  endDate?: string
): Promise<KhataStatementDto> {
  let url = `${BACKEND_URL}/api/v1/khata/statement/${encodeURIComponent(officeId)}`;
  const params: string[] = [];
  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  if (params.length) url += `?${params.join('&')}`;

  const res = await authFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch Khata statement');
  }
  const data = await res.json();
  return data.data;
}

export async function deleteKhataOffice(id: string): Promise<void> {
  const res = await authFetch(`${BACKEND_URL}/api/v1/khata/offices/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete Khata account');
  }
}

/**
 * Get direct download URL for Date-wise Khata Excel report (.xlsx)
 */
export function getKhataExcelExportUrl(params?: {
  startDate?: string;
  endDate?: string;
  office_id?: string;
}): string {
  const token = getBillbookAuthToken();
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.office_id) query.set('office_id', params.office_id);
  return `${BACKEND_URL}/api/v1/khata/export/excel?${query.toString()}`;
}

/**
 * Get direct streaming/download URL for Customer Date-wise Khata PDF bill
 */
export function getKhataStatementPdfUrl(
  officeId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    pin?: string;
  }
): string {
  const token = getBillbookAuthToken();
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  if (params?.pin) query.set('pin', params.pin);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  return `${BACKEND_URL}/api/v1/khata/statement/${encodeURIComponent(officeId)}/pdf?${query.toString()}`;
}


