'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
  notes?: string;
}

export interface ThermalReceiptData {
  receiptType: 'CUSTOMER_BILL' | 'KOT' | 'CREDIT_BILL';
  invoiceNumber?: string;
  orderNumber?: string;
  date?: string;
  paymentMode?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerPin?: string;
  customerTotalDue?: number;
  items: ThermalReceiptItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  paidAmount?: number;
  grandTotal?: number;
  pdfDownloadUrl?: string;
  whatsAppUrl?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: ThermalReceiptData | null;
}

export const ThermalReceiptModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  const [animState, setAnimState] = useState<'retracted' | 'printing-anim' | 'printed' | 'torn-anim'>('retracted');
  const [cutterFlash, setCutterFlash] = useState(false);
  const [viewMode, setViewMode] = useState<'CUSTOMER_BILL' | 'KOT'>('CUSTOMER_BILL');
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (data) {
      setViewMode(data.receiptType === 'KOT' ? 'KOT' : 'CUSTOMER_BILL');
    }
  }, [data]);

  // Web Audio Synthesizer for Thermal Printer Sound FX
  const playThermalPrinterSound = (durationMs = 2200) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const duration = durationMs / 1000;

      // 1. Motor hum (filtered white noise)
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.Q.setValueAtTime(4.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.08);
      gain.gain.setValueAtTime(0.05, now + duration - 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(now);
      whiteNoise.stop(now + duration);

      // 2. High-pitch thermal head stepper pulses
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(0.02, now + 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  };

  // Synthesize paper cutter slice sound
  const playCutterSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.18);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  };

  // Trigger rollout animation whenever modal opens
  useEffect(() => {
    if (isOpen && data) {
      setAnimState('retracted');
      setCutterFlash(false);

      const timer = setTimeout(() => {
        playThermalPrinterSound(2200);
        setAnimState('printing-anim');

        const endTimer = setTimeout(() => {
          setAnimState('printed');
        }, 2200);

        return () => clearTimeout(endTimer);
      }, 50);

      return () => clearTimeout(timer);
    } else {
      setAnimState('retracted');
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const handleTear = () => {
    playCutterSound();
    setCutterFlash(true);
    setAnimState('torn-anim');

    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handlePrint = () => {
    window.print();
  };

  const isKOT = viewMode === 'KOT';
  const displayDate = data.date || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const displayId = isKOT
    ? (data.orderNumber || data.invoiceNumber || 'KOT-POS')
    : (data.invoiceNumber || data.orderNumber || 'POS-INV');

  return (
    <div
      className="receipt-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        padding: '12px 10px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          maxHeight: '96vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'slideUpDispenser 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Close / Tear Button (Top Right) */}
        <button
          type="button"
          onClick={onClose}
          title="Close (Tear Slip)"
          style={{
            position: 'absolute',
            top: '-12px',
            right: '-6px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
            color: '#FFFFFF',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#EF4444')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
        >
          ✕
        </button>

        {/* 3D Dispenser Machine Unit */}
        <div style={{ width: '100%', maxWidth: '350px', position: 'relative', zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Top 3D Metallic Hood */}
          <div
            style={{
              width: '100%',
              height: '34px',
              borderRadius: '12px 12px 4px 4px',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F5E8D3 20%, #D4A359 55%, #9E6D2B 100%)',
              boxShadow: '0 -2px 6px rgba(255, 255, 255, 0.8), 0 6px 16px rgba(158, 109, 43, 0.3), inset 0 2px 2px rgba(255, 255, 255, 0.9), inset 0 -2px 4px rgba(80, 50, 10, 0.45)',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '3px',
                left: '5%',
                width: '90%',
                height: '4px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)',
                borderRadius: '999px',
                filter: 'blur(1px)'
              }}
            />
            <span style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '2px', color: '#543209', textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>
              CHAIWALE THERMAL DISPENSER
            </span>
          </div>

          {/* Slit mouth where paper emerges */}
          <div
            style={{
              width: '90%',
              margin: '-4px auto 0',
              height: '8px',
              background: '#0a0805',
              borderRadius: '2px',
              boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.95), inset 0 -1px 2px rgba(255,255,255,0.2)',
              position: 'relative',
              zIndex: 5
            }}
          />

          {/* Cutter Flash Blade */}
          <div
            style={{
              position: 'absolute',
              top: '38px',
              left: '5%',
              width: '90%',
              height: '3px',
              background: '#FFFFFF',
              boxShadow: '0 0 16px #FFFFFF',
              zIndex: 35,
              opacity: cutterFlash ? 1 : 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none'
            }}
          />

          {/* Bottom Lip */}
          <div
            style={{
              width: '100%',
              height: '10px',
              marginTop: '-2px',
              borderRadius: '0 0 10px 10px',
              background: 'linear-gradient(180deg, #8C5F22 0%, #C49852 40%, #F5E8D3 100%)',
              boxShadow: '0 6px 14px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              zIndex: 10
            }}
          />

          {/* Paper Viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              perspective: '1200px',
              perspectiveOrigin: '50% 0%',
              marginTop: '-4px',
              maxHeight: 'calc(80vh - 130px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingBottom: '8px',
              scrollbarWidth: 'thin'
            }}
          >
            {/* The Thermal Paper Roll */}
            <div
              id="chaiwale-receipt-slip"
              className={`receipt-paper-slip ${animState}`}
              style={{
                width: '320px',
                maxWidth: '100%',
                margin: '0 auto',
                background: '#FCFCFB',
                color: '#18181B',
                fontFamily: "'JetBrains Mono', 'Space Grotesk', 'Courier New', monospace",
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0,0,0,0.2)',
                clipPath: `polygon(
                  0% 0%, 100% 0%,
                  100% calc(100% - 8px),
                  98.33% 100%, 96.67% calc(100% - 8px),
                  95.00% 100%, 93.33% calc(100% - 8px),
                  91.67% 100%, 90.00% calc(100% - 8px),
                  88.33% 100%, 86.67% calc(100% - 8px),
                  85.00% 100%, 83.33% calc(100% - 8px),
                  81.67% 100%, 80.00% calc(100% - 8px),
                  78.33% 100%, 76.67% calc(100% - 8px),
                  75.00% 100%, 73.33% calc(100% - 8px),
                  71.67% 100%, 70.00% calc(100% - 8px),
                  68.33% 100%, 66.67% calc(100% - 8px),
                  65.00% 100%, 63.33% calc(100% - 8px),
                  61.67% 100%, 60.00% calc(100% - 8px),
                  58.33% 100%, 56.67% calc(100% - 8px),
                  55.00% 100%, 53.33% calc(100% - 8px),
                  51.67% 100%, 50.00% calc(100% - 8px),
                  48.33% 100%, 46.67% calc(100% - 8px),
                  45.00% 100%, 43.33% calc(100% - 8px),
                  41.67% 100%, 40.00% calc(100% - 8px),
                  38.33% 100%, 36.67% calc(100% - 8px),
                  35.00% 100%, 33.33% calc(100% - 8px),
                  31.67% 100%, 30.00% calc(100% - 8px),
                  28.33% 100%, 26.67% calc(100% - 8px),
                  25.00% 100%, 23.33% calc(100% - 8px),
                  21.67% 100%, 20.00% calc(100% - 8px),
                  18.33% 100%, 16.67% calc(100% - 8px),
                  15.00% 100%, 13.33% calc(100% - 8px),
                  11.67% 100%, 10.00% calc(100% - 8px),
                  8.33% 100%, 6.67% calc(100% - 8px),
                  5.00% 100%, 3.33% calc(100% - 8px),
                  1.67% 100%, 0% calc(100% - 8px)
                )`,
                padding: '14px 12px 18px',
                fontSize: '11px',
                lineHeight: 1.4,
                transformOrigin: 'top center',
                transition: 'transform 2.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease'
              }}
            >
              {/* Receipt Header with Chaiwale Logo */}
              <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #D1D5DB', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                  <img
                    src="/assets/chaiwale-logo.jpeg"
                    alt="Chaiwale Official Logo"
                    style={{
                      width: '52px',
                      height: '52px',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '2px solid #E5E7EB',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      backgroundColor: '#2A1810',
                      display: 'block'
                    }}
                  />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '2px', color: '#000000', textTransform: 'uppercase' }}>
                  CHAIWALE
                </div>
                <div style={{ fontSize: '9px', color: '#4B5563', fontWeight: 700, margin: '2px 0 3px' }}>
                  {isKOT ? '🔥 KITCHEN ORDER TICKET (KOT) 🔥' : 'Taste of Desi Swag • Cafe & Refreshments'}
                </div>
                {!isKOT && (
                  <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: 1.3 }}>
                    Rohini Sector-7, New Delhi - 110085<br />
                    Tel / WhatsApp: +91 92890 28620 • @chaiwale.co.in
                  </div>
                )}
              </div>

              {/* Meta Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '3px 8px',
                  fontSize: '10.5px',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px dashed #E5E7EB'
                }}
              >
                <span style={{ color: '#6B7280', fontWeight: 600 }}>{isKOT ? 'KOT #' : 'INVOICE #'}:</span>
                <span style={{ fontWeight: 800, textAlign: 'right', color: '#000000' }}>#{displayId}</span>

                <span style={{ color: '#6B7280', fontWeight: 600 }}>DATE & TIME:</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#000000' }}>{displayDate}</span>

                {!isKOT && (
                  <>
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>PAYMENT:</span>
                    <span style={{ fontWeight: 800, textAlign: 'right', color: data.paymentMode === 'CREDIT' ? '#DC2626' : '#16A34A' }}>
                      {data.paymentMode === 'CREDIT' ? 'KHATA (CREDIT)' : (data.paymentMode || 'PAID')}
                    </span>
                  </>
                )}

                <span style={{ color: '#6B7280', fontWeight: 600 }}>ORDER TYPE:</span>
                <span style={{ fontWeight: 700, textAlign: 'right', color: '#000000' }}>
                  {isKOT ? 'KITCHEN QUEUE' : 'COUNTER POS / TAKEAWAY'}
                </span>
              </div>

              {/* Customer Box (if name/phone available) */}
              {(data.customerName || data.customerPhone) && (
                <div
                  style={{
                    background: '#F3F4F6',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    marginBottom: '10px',
                    fontSize: '10.5px'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#111827' }}>
                    CUSTOMER: {data.customerName || 'Walk-in'} {data.customerPhone ? `(${data.customerPhone})` : ''}
                  </div>
                  {data.customerAddress && (
                    <div style={{ fontSize: '9.5px', color: '#4B5563', marginTop: '2px' }}>
                      Loc: {data.customerAddress}
                    </div>
                  )}
                  {data.customerPin && (
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                      🔑 Khata PIN: {data.customerPin}
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #D1D5DB', textTransform: 'uppercase', fontSize: '9.5px', color: '#4B5563' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '4px' }}>ITEM & QTY</th>
                    {!isKOT && <th style={{ textAlign: 'right', paddingBottom: '4px' }}>AMT (₹)</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed #F3F4F6' }}>
                      <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                        <strong style={{ fontSize: isKOT ? '13px' : '11.5px', color: '#000000' }}>
                          {item.quantity}x {item.name}
                        </strong>
                        {item.notes && (
                          <div style={{ fontSize: '9.5px', color: '#DC2626', fontWeight: 600 }}>
                            Note: {item.notes}
                          </div>
                        )}
                      </td>
                      {!isKOT && (
                        <td style={{ textAlign: 'right', fontWeight: 700, padding: '6px 0', verticalAlign: 'top' }}>
                          ₹{Number(item.lineTotal || (item.unitPrice ? item.unitPrice * item.quantity : 0)).toFixed(0)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Section (Hidden for KOT) */}
              {!isKOT && (
                <div style={{ borderTop: '1.5px dashed #D1D5DB', paddingTop: '8px', marginBottom: '12px' }}>
                  {data.subtotal !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', fontSize: '11px', marginBottom: '3px' }}>
                      <span>Subtotal</span>
                      <span>₹{Number(data.subtotal).toFixed(0)}</span>
                    </div>
                  )}

                  {Number(data.discount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontSize: '11px', marginBottom: '3px' }}>
                      <span>Discount</span>
                      <span>-₹{Number(data.discount).toFixed(0)}</span>
                    </div>
                  )}

                  {Number(data.paidAmount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontSize: '11px', marginBottom: '3px', fontWeight: 600 }}>
                      <span>Paid / Settlement</span>
                      <span>-₹{Number(data.paidAmount).toFixed(0)}</span>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#000000',
                      borderTop: '1.5px solid #18181B',
                      borderBottom: '1.5px solid #18181B',
                      padding: '6px 0',
                      marginTop: '6px'
                    }}
                  >
                    <span>GRAND TOTAL</span>
                    <span>₹{Number(data.grandTotal || data.subtotal || 0).toFixed(0)}</span>
                  </div>

                  {data.paymentMode === 'CREDIT' && data.customerTotalDue !== undefined && (
                    <div
                      style={{
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        marginTop: '8px',
                        fontSize: '10px',
                        color: '#991B1B',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 700
                      }}
                    >
                      <span>Khata Outstanding Balance:</span>
                      <span style={{ fontWeight: 900 }}>₹{data.customerTotalDue}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Greeting & Barcode */}
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                  {isKOT ? '*** KITCHEN PREPARATION SLIP ***' : '*** THANK YOU! VISIT AGAIN ***'}
                </div>
                {!isKOT && (
                  <div style={{ fontSize: '8.5px', color: '#6B7280', marginBottom: '6px' }}>
                    Check bill online: chaiwale.co.in/check-bill
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div
                    style={{
                      height: '24px',
                      width: '160px',
                      background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px, #000 9px, #000 10px, transparent 10px, transparent 13px, #000 13px, #000 16px, transparent 16px, transparent 17px)'
                    }}
                  />
                  <span style={{ fontSize: '8.5px', letterSpacing: '2px', fontWeight: 700, color: '#6B7280' }}>
                    CW-{displayId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Strip - ALWAYS VISIBLE FLOATING DOCK */}
        <div
          className="receipt-action-buttons"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: '50px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            zIndex: 60,
            maxWidth: '380px'
          }}
        >
          {/* Print Slip Button */}
          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50px',
              padding: '7px 15px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
            }}
          >
            🖨️ Print Slip
          </button>

          {/* Toggle KOT / Customer Bill */}
          <button
            type="button"
            onClick={() => setViewMode(isKOT ? 'CUSTOMER_BILL' : 'KOT')}
            style={{
              background: isKOT ? '#DC2626' : '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '50px',
              padding: '7px 13px',
              fontWeight: 700,
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isKOT ? '📄 Show Bill' : '👨‍🍳 Show KOT'}
          </button>

          {/* Tear Slip Button */}
          <button
            type="button"
            onClick={handleTear}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50px',
              padding: '7px 13px',
              fontWeight: 700,
              fontSize: '11.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            ✂️ Tear & Close
          </button>

          {/* WhatsApp Share (if URL provided) */}
          {data.whatsAppUrl && (
            <a
              href={data.whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: '#FFFFFF',
                borderRadius: '50px',
                padding: '7px 13px',
                fontWeight: 700,
                fontSize: '11.5px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              💬 WhatsApp
            </a>
          )}

          {/* A4 PDF Download (if URL available) */}
          {data.pdfDownloadUrl && !isKOT && (
            <a
              href={data.pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                borderRadius: '50px',
                padding: '7px 13px',
                fontWeight: 700,
                fontSize: '11.5px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              📥 A4 PDF
            </a>
          )}
        </div>
      </div>

      {/* Scoped CSS for 3D Thermal Animations and Print Media */}
      <style jsx global>{`
        @keyframes slideUpDispenser {
          from {
            transform: translateY(28px) scale(0.96);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .receipt-paper-slip.retracted {
          transform: translateY(-93%) rotateX(-18deg) translateZ(-30px);
          opacity: 0.2;
        }

        .receipt-paper-slip.printed {
          transform: translateY(0%) rotateX(0deg) translateZ(0px);
          opacity: 1;
        }

        .receipt-paper-slip.printing-anim {
          animation: chaiwaleRollout3D 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .receipt-paper-slip.torn-anim {
          animation: chaiwaleTearDown 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes chaiwaleRollout3D {
          0% {
            transform: translateY(-93%) rotateX(-18deg) translateZ(-30px) scale(0.97);
            opacity: 0.3;
          }
          25% {
            transform: translateY(-68%) rotateX(-12deg) translateZ(15px) scale(0.985);
            opacity: 0.85;
          }
          55% {
            transform: translateY(-30%) rotateX(-6deg) translateZ(8px) scale(0.995);
            opacity: 0.96;
          }
          100% {
            transform: translateY(0%) rotateX(0deg) translateZ(0px) scale(1);
            opacity: 1;
          }
        }

        @keyframes chaiwaleTearDown {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          30% {
            transform: translateY(28px) rotate(3deg) skewY(2deg);
            opacity: 0.95;
          }
          100% {
            transform: translateY(240px) rotate(8deg) scale(0.92);
            opacity: 0;
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .receipt-modal-backdrop,
          #chaiwale-receipt-slip,
          #chaiwale-receipt-slip * {
            visibility: visible !important;
          }
          .receipt-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            backdrop-filter: none !important;
          }
          .receipt-action-buttons,
          button {
            display: none !important;
          }
          #chaiwale-receipt-slip {
            position: static !important;
            transform: none !important;
            width: 100% !important;
            max-width: 320px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            clip-path: none !important;
            border: 1px solid #ccc !important;
          }
        }
      `}</style>
    </div>
  );
};
