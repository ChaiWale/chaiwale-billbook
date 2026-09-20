/**
 * Billbook Domain Types
 * Note: Billing calculations are exclusively executed centrally in the backend.
 * Billbook UI communicates with the backend billing engine.
 */

export type InvoiceStatus = 'UNPAID' | 'PAID' | 'PARTIAL' | 'CANCELLED';

export interface BillDraftItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BillDraft {
  billType: 'DIRECT' | 'CORPORATE_CREDIT' | 'CATERING';
  items: BillDraftItem[];
  customerPhone?: string;
  corporateClientId?: string;
}

export interface LedgerEntrySummary {
  entryId: string;
  entityName: string;
  totalBilled: number;
  totalReceived: number;
  balanceDue: number;
}
