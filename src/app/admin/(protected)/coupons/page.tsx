import { CouponsManager } from "@/components/admin/coupons-manager";
import { getAdminCoupons } from "@/lib/admin/data";

export default async function AdminCouponsPage() {
  const coupons = await getAdminCoupons();

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Promotions
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg">
          Coupons
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Create discount codes customers can apply at checkout.
        </p>
      </header>
      <CouponsManager coupons={coupons} />
    </div>
  );
}
