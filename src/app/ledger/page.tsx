'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillbookLedgerRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Ledger and financial management moved exclusively to Admin Portal
    router.replace('/');
  }, [router]);

  return null;
}
