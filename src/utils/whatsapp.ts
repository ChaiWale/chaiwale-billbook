/**
 * Chaiwale Centralized WhatsApp Service & Message Builder
 * Generates direct wa.me URLs for manual staff/customer chat dispatch.
 * 
 * ARCHITECTURE PRINCIPLES:
 * - Purely manual wa.me link/chat trigger flow.
 * - NO automated outbound messaging.
 * - NO WhatsApp Cloud API, BSP, or webhooks.
 * - When clicked, opens WhatsApp Web or the WhatsApp app with pre-filled text.
 * - Staff/customer manually reviews and taps send.
 */

export const DEFAULT_STORE_WHATSAPP = '919310112564';
export const DEFAULT_STORE_MESSAGE = 'Hello Chaiwale, I’d like some help with my order / enquiry.';

export interface PhoneValidationResult {
  isValid: boolean;
  normalizedPhone?: string;
  error?: string;
}

export interface WhatsAppLinkResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates and normalizes phone numbers for wa.me links.
 * Handles Indian numbers with or without country code.
 * If number is missing, invalid, or all zeros, returns a clear error without inventing numbers.
 */
export function validateAndNormalizePhone(rawPhone?: string | null): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  const clean = rawPhone.replace(/\D/g, '');

  if (!clean || clean.length < 10) {
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  // Reject all identical repeating digits like 0000000000
  if (/^(\d)\1+$/.test(clean)) {
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  // Standard 10-digit Indian mobile (starts with 6, 7, 8, or 9)
  if (clean.length === 10) {
    if (/^[6-9]\d{9}$/.test(clean)) {
      return { isValid: true, normalizedPhone: `91${clean}` };
    }
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  // 11 digits starting with 0 (e.g. 09876543210)
  if (clean.length === 11 && clean.startsWith('0')) {
    const withoutZero = clean.slice(1);
    if (/^[6-9]\d{9}$/.test(withoutZero)) {
      return { isValid: true, normalizedPhone: `91${withoutZero}` };
    }
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  // 12 digits starting with 91
  if (clean.length === 12 && clean.startsWith('91')) {
    const subscriber = clean.slice(2);
    if (/^[6-9]\d{9}$/.test(subscriber)) {
      return { isValid: true, normalizedPhone: clean };
    }
    return { isValid: false, error: 'WhatsApp number not available' };
  }

  // International numbers (between 10 and 15 digits)
  if (clean.length >= 11 && clean.length <= 15) {
    return { isValid: true, normalizedPhone: clean };
  }

  return { isValid: false, error: 'WhatsApp number not available' };
}

/**
 * WhatsApp Message Templates
 * Strict adherence to human, concise, polite, professional Chaiwale brand style.
 * Zero emojis, no marketing spam, no robotic AI wording.
 */
export const WhatsAppTemplates = {
  ORDER_CONFIRMATION: (params: {
    customerName: string;
    orderNumber: string;
    total: number | string;
    paymentMode: string;
    trackingUrl: string;
  }) =>
`Hello ${params.customerName},

Thank you for ordering from Chaiwale.

Your order #${params.orderNumber} has been confirmed.

Order Total: ₹${Number(params.total).toFixed(2)}
Payment: ${params.paymentMode}

Track your order:
${params.trackingUrl}

Thank you,
Chaiwale`,

  ORDER_PREPARING: (params: {
    customerName: string;
    orderNumber: string;
  }) =>
`Hello ${params.customerName},

A quick update from Chaiwale — your order #${params.orderNumber} is now being prepared.

We’ll keep you updated as it moves ahead.

Thank you,
Chaiwale`,

  ORDER_READY: (params: {
    customerName: string;
    orderNumber: string;
    total: number | string;
  }) =>
`Hello ${params.customerName},

Your Chaiwale order #${params.orderNumber} is ready.

Order Total: ₹${Number(params.total).toFixed(2)}

Thank you,
Chaiwale`,

  ORDER_OUT_FOR_DELIVERY: (params: {
    customerName: string;
    orderNumber: string;
  }) =>
`Hello ${params.customerName},

Your Chaiwale order #${params.orderNumber} is now out for delivery.

Please keep your phone available for delivery coordination.

Thank you,
Chaiwale`,

  ORDER_COMPLETED: (params: {
    customerName: string;
    orderNumber: string;
  }) =>
`Hello ${params.customerName},

Your Chaiwale order #${params.orderNumber} has been completed.

Thank you for choosing Chaiwale.

We hope to serve you again.

— Chaiwale`,

  PAYMENT_REMINDER: (params: {
    customerName: string;
    invoiceNumber: string;
    outstandingAmount: number | string;
  }) =>
`Hello ${params.customerName},

This is a gentle reminder regarding your Chaiwale invoice #${params.invoiceNumber}.

Outstanding amount: ₹${Number(params.outstandingAmount).toFixed(2)}

If you have already made the payment, please disregard this message.

Thank you,
Chaiwale`,

  PAYMENT_RECEIVED: (params: {
    customerName: string;
    amount: number | string;
    invoiceNumber: string;
    outstandingAmount: number | string;
  }) =>
`Hello ${params.customerName},

We’ve received your payment of ₹${Number(params.amount).toFixed(2)} against Chaiwale invoice #${params.invoiceNumber}.

Remaining outstanding: ₹${Number(params.outstandingAmount).toFixed(2)}

Thank you,
Chaiwale`,

  CREDIT_OUTSTANDING: (params: {
    customerName: string;
    outstandingAmount: number | string;
    invoiceNumber: string;
  }) =>
`Hello ${params.customerName},

This is regarding your Chaiwale account.

Current outstanding amount: ₹${Number(params.outstandingAmount).toFixed(2)}

Invoice / reference: ${params.invoiceNumber}

Please contact the Chaiwale team if you need any clarification.

Thank you,
Chaiwale`,

  CORPORATE_FOLLOWUP: (params: {
    contactName: string;
    staffName: string;
    eventDate: string;
    referenceNumber: string;
  }) =>
`Hello ${params.contactName},

This is ${params.staffName} from Chaiwale.

Following up regarding your catering requirement for ${params.eventDate}.

Requirement reference:
${params.referenceNumber}

Please let us know if you would like to discuss the requirement further.

Regards,
Chaiwale`,

  CATERING_FOLLOWUP: (params: {
    customerName: string;
    referenceNumber: string;
  }) =>
`Hello ${params.customerName},

Thank you for your catering enquiry with Chaiwale.

Reference: ${params.referenceNumber}

We’d be happy to discuss your requirement, including guest count, menu and event details.

Regards,
Chaiwale`,

  QUOTE_SENT: (params: {
    customerName: string;
    referenceNumber: string;
    quoteAmount: number | string;
  }) =>
`Hello ${params.customerName},

Your Chaiwale catering quotation for reference #${params.referenceNumber} is ready.

Estimated amount: ₹${Number(params.quoteAmount).toFixed(2)}

Please review the quotation and let us know if you would like to proceed.

Regards,
Chaiwale`,

  CUSTOM_ORDER_FOLLOWUP: (params: {
    customerName: string;
    referenceNumber: string;
  }) =>
`Hello ${params.customerName},

Thank you for contacting Chaiwale regarding your custom food requirement.

Reference: ${params.referenceNumber}

We’d be happy to discuss your requirement and prepare the details accordingly.

Regards,
Chaiwale`,

  SUPPORT_FOLLOWUP: (params: {
    customerName: string;
    referenceNumber: string;
  }) =>
`Hello ${params.customerName},

This is Chaiwale following up regarding your enquiry.

Reference: ${params.referenceNumber}

Please share any additional details that may help us assist you.

Regards,
Chaiwale`
};

/**
 * Builds a direct wa.me link for a given recipient phone and message text.
 * Returns { success: false, error: 'WhatsApp number not available' } if phone is missing or invalid.
 */
export function buildWhatsAppUrl(
  recipientPhone: string | null | undefined,
  messageText: string
): WhatsAppLinkResult {
  const validation = validateAndNormalizePhone(recipientPhone);

  if (!validation.isValid || !validation.normalizedPhone) {
    return {
      success: false,
      error: validation.error || 'WhatsApp number not available'
    };
  }

  const encodedText = encodeURIComponent(messageText.trim());
  return {
    success: true,
    url: `https://wa.me/${validation.normalizedPhone}?text=${encodedText}`
  };
}

/**
 * Returns the official Chaiwale store WhatsApp chat link.
 * Sourced from NEXT_PUBLIC_WHATSAPP_NUMBER or defaults to verified store contact.
 */
export function getStoreWhatsAppUrl(customMessage?: string): string {
  const storePhone =
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_WHATSAPP_NUMBER) ||
    DEFAULT_STORE_WHATSAPP;

  const validation = validateAndNormalizePhone(storePhone);
  const targetPhone = validation.normalizedPhone || DEFAULT_STORE_WHATSAPP;
  const msg = customMessage || DEFAULT_STORE_MESSAGE;

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg.trim())}`;
}
