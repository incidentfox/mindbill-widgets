import { Billing } from "./Billing";

export default function Page() {
  const billId = process.env.MINDBILL_SYNTHETIC_BILL_ID;
  if (!billId) {
    return <main style={{ padding: 32 }}>Set MINDBILL_SYNTHETIC_BILL_ID after running npm run create-bill.</main>;
  }
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 32 }}>
      <h1>Billing</h1>
      <Billing billId={billId} />
    </main>
  );
}
