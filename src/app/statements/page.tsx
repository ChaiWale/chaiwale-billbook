'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillbookStatementsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Statements and financial reports moved exclusively to Admin Portal
    router.replace('/');
  }, [router]);

  return null;
}
