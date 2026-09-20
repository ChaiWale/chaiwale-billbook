'use client';

import React, { useState, useEffect } from 'react';
import {
  getBillbookAuthToken,
  getBillbookAuthUser,
  loginStaff,
  clearBillbookAuthToken,
  CounterStaffUser
} from '../services/billbook-api.client';

interface BillbookShellProps {
  children: React.ReactNode;
}

export default function BillbookShell({ children }: BillbookShellProps) {
  const [user, setUser] = useState<CounterStaffUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existingToken = getBillbookAuthToken();
    const existingUser = getBillbookAuthUser();
    if (existingToken && existingUser) {
      setUser(existingUser);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    const handleOpenAuth = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('open-counter-auth', handleOpenAuth);
    return () => window.removeEventListener('open-counter-auth', handleOpenAuth);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginStaff(email.trim(), password);
      setUser(res.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    clearBillbookAuthToken();
    setUser(null);
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  // 1. Checking Session Splash
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#0F172A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: '#FFFFFF'
        }}
      >
        <img
          src="/assets/chaiwale-logo.jpeg"
          alt="Chaiwale"
          style={{ width: '54px', height: '54px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        />
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#E2E8F0', letterSpacing: '0.02em' }}>
          Connecting to Terminal Counter-01...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Lock Screen (Mandatory Login Gate)
  if (!isAuthenticated || !user) {
    return (
      <main
        style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#0F172A',
          backgroundImage: 'radial-gradient(ellipse 80% 80% at 50% -20%, rgba(111, 67, 42, 0.35), rgba(15, 23, 42, 1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            padding: '36px 32px'
          }}
        >
          {/* Header Branding with Approved Official Logo */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img
              src="/assets/chaiwale-logo.jpeg"
              alt="Chaiwale Logo"
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '10px',
                objectFit: 'cover',
                margin: '0 auto 12px',
                display: 'block',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1E2328', margin: 0, letterSpacing: '0.04em' }}>
              Bill Book
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', marginBottom: 0 }}>
              Counter POS &amp; Billing Terminal Authentication
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                border: '1px solid #FECACA',
                borderRadius: 'var(--cw-radius-md)',
                marginBottom: '18px',
                fontSize: '12px',
                lineHeight: 1.4
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="billbook-email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1E293B',
                  marginBottom: '6px'
                }}
              >
                Counter Staff / Admin Email
              </label>
              <input
                id="billbook-email"
                type="email"
                required
                placeholder="e.g. counter01@pos-desk.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--cw-radius-md)',
                  border: '1px solid var(--cw-color-border)',
                  fontSize: '14px',
                  backgroundColor: '#F8FAFC'
                }}
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label
                htmlFor="billbook-password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1E293B',
                  marginBottom: '6px'
                }}
              >
                Staff Password
              </label>
              <input
                id="billbook-password"
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--cw-radius-md)',
                  border: '1px solid var(--cw-color-border)',
                  fontSize: '14px',
                  backgroundColor: '#F8FAFC'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--cw-color-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--cw-radius-md)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--cw-shadow-sm)'
              }}
            >
              {loading ? 'Authenticating Counter-01...' : 'Sign In to POS Terminal'}
            </button>
          </form>

          <div
            style={{
              marginTop: '24px',
              borderTop: '1px solid var(--cw-color-border)',
              paddingTop: '16px',
              textAlign: 'center',
              fontSize: '11px',
              color: '#94A3B8'
            }}
          >
            Authorized Terminal: Counter-01 • Zero-Tax POS Engine
          </div>
        </div>
      </main>
    );
  }

  // 3. Authenticated POS Interface with Streamlined Header
  return (
    <>
      <header
        className="no-print"
        style={{
          backgroundColor: '#0F172A',
          color: '#ffffff',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--cw-color-primary)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/assets/chaiwale-logo.jpeg"
            alt="Chaiwale"
            style={{ height: '34px', width: 'auto', borderRadius: '4px' }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <strong style={{ fontFamily: 'var(--cw-font-heading)', fontSize: '18px', fontWeight: 800, letterSpacing: '0.03em' }}>
              Bill Book
            </strong>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              POS Billing Terminal
            </span>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#CBD5E1', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span>Terminal: <strong style={{ color: '#F8FAFC' }}>Counter-01</strong></span>
          <span style={{ color: '#64748B' }}>|</span>
          <span style={{ color: '#22C55E', fontWeight: 600 }}>● Live Connected</span>
          <span style={{ color: '#64748B' }}>|</span>

          {/* Logged in Staff Badge + Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: '#064E3B',
                color: '#34D399',
                border: '1px solid #059669',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '6px', height: '6px', backgroundColor: '#34D399', borderRadius: '50%' }} />
              {user.fullName || (user.role === 'ADMIN' ? 'Head Cashier' : 'Counter Operator')}
            </span>
            <button
              onClick={handleSignOut}
              style={{
                backgroundColor: 'transparent',
                color: '#CBD5E1',
                border: '1px solid #475569',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Sign Out Counter Staff"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto' }}>
        {children}
      </main>
    </>
  );
}
