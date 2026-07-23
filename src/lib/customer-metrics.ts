import type { Customer } from "@/types";

export function computeCustomerMetrics(customers: Customer[]) {
  return {
    total_customers: customers.length,
    total_orders: customers.reduce((acc, c) => acc + c.total_orders, 0),
    total_revenue: customers.reduce((acc, c) => acc + c.total_spent, 0),
    vip_count: customers.filter((c) => c.is_vip).length,
  };
}
