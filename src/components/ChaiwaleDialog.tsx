'use client';

import React, { useEffect } from 'react';

export interface ChaiwaleDialogConfig {
  isOpen: boolean;
  mode: 'ALERT' | 'CONFIRM';
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface Props {
  config: ChaiwaleDialogConfig | null;
  onClose: () => void;
}

export const ChaiwaleDialog: React.FC<Props> = ({ config, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!config || !config.isOpen) return;
      if (e.key === 'Escape') {
        if (config.onCancel) config.onCancel();
        onClose();
      } else if (e.key === 'Enter') {
        if (config.onConfirm) config.onConfirm();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onClose]);

  if (!config || !config.isOpen) return null;

  const isConfirm = config.mode === 'CONFIRM';
  const type = config.type || (config.isDanger ? 'warning' : 'info');

  const getIcon = () => {
    switch (type) {
      case 'success':
        return { symbol: '✓', bg: '#DCFCE7', color: '#16A34A', border: '#86EFAC' };
      case 'error':
        return { symbol: '✕', bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' };
      case 'warning':
        return { symbol: '⚠️', bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' };
      default:
        return { symbol: 'ℹ️', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
    }
  };

  const iconStyle = getIcon();

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (config.onCancel) config.onCancel();
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'chaiwaleFadeIn 0.15s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'chaiwalePopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Brand Stamp / Icon */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: iconStyle.bg,
            border: `2px solid ${iconStyle.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 900,
            color: iconStyle.color,
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}
        >
          {iconStyle.symbol}
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '17px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.2px'
          }}
        >
          {config.title}
        </h3>

        {/* Message */}
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: '#475569',
            whiteSpace: 'pre-line'
          }}
        >
          {config.message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          {isConfirm && (
            <button
              type="button"
              onClick={() => {
                if (config.onCancel) config.onCancel();
                onClose();
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            >
              {config.cancelText || 'Cancel'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (config.onConfirm) config.onConfirm();
              onClose();
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: config.isDanger ? '#DC2626' : 'var(--cw-color-primary, #6F432A)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: config.isDanger
                ? '0 4px 12px rgba(220, 38, 38, 0.3)'
                : '0 4px 12px rgba(111, 67, 42, 0.3)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.opacity = '0.92')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.opacity = '1')
            }
          >
            {config.confirmText || (isConfirm ? 'Confirm' : 'Got it')}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes chaiwaleFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes chaiwalePopIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
