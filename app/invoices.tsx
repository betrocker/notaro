import { BucketScreen } from "@/components/BucketScreen";

export default function InvoicesScreen() {
  return (
    <BucketScreen
      title="Invoices"
      icon="dollar"
      accentColor="var(--color-inbox)"
      emptyStateMessage="No invoices yet."
    />
  );
}
