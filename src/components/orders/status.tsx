import { cn } from "@/lib/utils";

export type OrderStatus = "pending_payment" | "paid" | "shipped" | "delivered" | "payment_failed" | "cancelled";

const LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Preparing to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === "delivered" || status === "paid" || status === "shipped"
      ? "bg-stock/10 text-stock"
      : status === "payment_failed" || status === "cancelled"
        ? "bg-sale/10 text-sale"
        : "bg-black/5 text-foreground";
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", tone)}>{LABELS[status]}</span>;
}
