'use client';

import React, { useState, useEffect } from 'react';
import {
  getBillbookAuthToken,
  getBillbookAuthUser,
  loginStaff,
  quickLoginBillingStaff,
  clearBillbookAuthToken,
  CounterStaffUser
} from '../services/billbook-api.client';

export default function BillbookCounterAuth() {
  const [user, setUser] = useState<CounterStaffUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existingUser = getBillbookAuthUser();
    const existingToken = getBillbookAuthToken();
    if (existingToken && existingUser) {
      setUser(existingUser);
    }

    // Listen for custom event if another component needs authentication
    const handleOpenAuth = () => setShowModal(true);
    window.addEventListener('open-counter-auth', handleOpenAuth);
    return () => window.removeEventListener('open-counter-auth', handleOpenAuth);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginStaff(email, password);
      setUser(res.user);
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Counter staff login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await quickLoginBillingStaff();
      setUser(res.user);
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Quick counter login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    clearBillbookAuthToken();
    setUser(null);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
        {user ? (
          <>
            <span
              style={{
                backgroundColor: '#064E3B',
                color: '#34D399',
                border: '1px solid #059669',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ width: '6px', height: '6px', backgroundColor: '#34D399', borderRadius: '50%' }} />
              {user.fullName || (user.role === 'ADMIN' ? 'Head Cashier' : 'Counter Operator')} ({user.role})
            </span>
            <button
              onClick={handleSignOut}
              style={{
                backgroundColor: 'transparent',
                color: '#94A3B8',
                border: '1px solid #334155',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title="Sign Out Counter Staff"
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: '#991B1B',
              color: '#FEE2E2',
              border: '1px solid #DC2626',
              padding: '5px 12px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          >
            🔐 Sign In Counter Staff
          </button>
        )}
      </div>

      {/* Counter Authentication Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img
                src="/assets/chaiwale-logo.jpeg"
                alt="Chaiwale"
                style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', margin: '0 auto 10px', display: 'block' }}
              />
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Counter Staff Sign-In</h2>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', marginBottom: 0 }}>
                Authenticate Counter-01 for Invoicing &amp; Billing Operations
              </p>
            </div>

            {error && (
              <div style={{ backgroundColor: '#FEE2E2', color: '#991B1B', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
                ⚠️ {error}
              </div>
            )}


            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Staff Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Staff Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ flex: 2, padding: '10px', backgroundColor: 'var(--cw-color-primary)', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Authenticating...' : 'Sign In Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
