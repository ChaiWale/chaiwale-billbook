'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillbookInvoicesRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Invoices and financial audit moved exclusively to Admin Portal
    router.replace('/');
  }, [router]);

  return null;
}
