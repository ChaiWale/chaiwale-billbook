import ChaiLoader from '@/components/ChaiLoader';

export default function Loading() {
  return (
    <ChaiLoader
      fullScreen
      label="Chaiwale Billbook"
      sublabel="Loading POS counter & ledger records..."
    />
  );
}
