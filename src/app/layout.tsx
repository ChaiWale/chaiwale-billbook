import type { Metadata } from 'next';
import React from 'react';
import BillbookShell from '../components/BillbookShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chaiwale Billbook | POS Billing Terminal',
  description: 'Chaiwale Dedicated POS Counter Billing Terminal & Direct Receipts',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  },
  icons: {
    icon: '/assets/chaiwale-logo.jpeg',
    apple: '/assets/chaiwale-logo.jpeg'
  }
};

export default function BillbookLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/jpeg" href="/assets/chaiwale-logo.jpeg" />
      </head>
      <body>
        <BillbookShell>
          {children}
        </BillbookShell>
      </body>
    </html>
  );
}
