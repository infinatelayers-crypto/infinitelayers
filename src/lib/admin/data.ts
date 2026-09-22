import "server-only";

import { requireAdmin } from "./auth";
import { mapProductRow, type DbProduct } from "@/lib/products";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ORDER_STATUSES,
  type CartItem,
  type Coupon,
  type OrderStatus,
  type PaymentStatus,
  type Product,
  type StoreOrder,
} from "@/lib/types";

const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "paid",
  "failed",
  "refunded",
];

function isPaymentStatus(value: string | null): value is PaymentStatus {
  return PAYMENT_STATUSES.some((status) => status === value);
}

type DbOrder = {
  id: string;
  order_no: string | null;
  phone: string;
  address: string;
  items: unknown;
  total_paise: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyBookingMetric = {
  key: string;
  label: string;
  orders: number;
  valuePaise: number;
};

export type AdminDashboardData = {
  products: Product[];
  orders: StoreOrder[];
  recentOrders: StoreOrder[];
  dailyBookings: DailyBookingMetric[];
  productCount: number;
  inStockCount: number;
  orderCount: number;
  openOrderCount: number;
  handledOrderCount: number;
  bookedValuePaise: number;
  deliveredValuePaise: number;
  statusCounts: Record<OrderStatus, number>;
};

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status === value);
}

function mapOrderItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): CartItem[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;

    if (
      typeof record.productId !== "string" ||
      typeof record.name !== "string" ||
      typeof record.slug !== "string" ||
      typeof record.pricePaise !== "number" ||
      typeof record.quantity !== "number"
    ) {
      return [];
    }

    return [
      {
        productId: record.productId,
        slug: record.slug,
        name: record.name,
        pricePaise: record.pricePaise,
        imageUrl:
          typeof record.imageUrl === "string" ? record.imageUrl : null,
        quantity: record.quantity,
      },
    ];
  });
}

function mapOrder(row: DbOrder): StoreOrder {
  return {
    id: row.id,
    orderNo: row.order_no ?? `#${row.id.slice(0, 8).toUpperCase()}`,
    phone: row.phone,
    address: row.address,
    items: mapOrderItems(row.items),
    totalPaise: row.total_paise,
    status: isOrderStatus(row.status) ? row.status : "pending",
    paymentStatus: isPaymentStatus(row.payment_status)
      ? row.payment_status
      : "unpaid",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedClient() {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function getAdminProducts(): Promise<Product[]> {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data as DbProduct[]).map(mapProductRow);
}

export async function getAdminProduct(id: string): Promise<Product | null> {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load product: ${error.message}`);
  return data ? mapProductRow(data as DbProduct) : null;
}

export async function getAdminOrders(limit = 1000): Promise<StoreOrder[]> {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_no, phone, address, items, total_paise, status, payment_status, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return (data as DbOrder[]).map(mapOrder);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [products, orders] = await Promise.all([
    getAdminProducts(),
    getAdminOrders(5000),
  ]);

  const statusCounts = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<OrderStatus, number>;

  for (const order of orders) statusCounts[order.status] += 1;

  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const closedStatuses: OrderStatus[] = ["delivered", "cancelled"];
  const todayIstKey = getIstDayKey(new Date());
  const todayIstMidnightUtc = new Date(`${todayIstKey}T00:00:00.000Z`).getTime() - IST_OFFSET_MS;
  const dailyBookings = Array.from({ length: 7 }, (_, index) => {
    const dayStartUtc = new Date(
      todayIstMidnightUtc + (index - 6) * 24 * 60 * 60 * 1000,
    );
    const key = getIstDayKey(dayStartUtc);
    const dayOrders = activeOrders.filter(
      (order) => getIstDayKey(new Date(order.createdAt)) === key,
    );

    return {
      key,
      label: new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      orders: dayOrders.length,
      valuePaise: dayOrders.reduce(
        (total, order) => total + order.totalPaise,
        0,
      ),
    };
  });

  return {
    products,
    orders,
    recentOrders: orders.slice(0, 5),
    dailyBookings,
    productCount: products.length,
    inStockCount: products.filter((product) => product.inStock).length,
    orderCount: orders.length,
    openOrderCount: orders.filter(
      (order) => !closedStatuses.includes(order.status),
    ).length,
    handledOrderCount: orders.filter((order) =>
      closedStatuses.includes(order.status),
    ).length,
    bookedValuePaise: activeOrders.reduce(
      (total, order) => total + order.totalPaise,
      0,
    ),
    deliveredValuePaise: orders
      .filter((order) => order.status === "delivered")
      .reduce((total, order) => total + order.totalPaise, 0),
    statusCounts,
  };
}

type DbCoupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  active: boolean;
  expires_at: string | null;
  usage_count: number;
};

export async function getAdminCoupons() {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load coupons: ${error.message}`);

  return (data as DbCoupon[]).map(
    (row): Coupon => ({
      id: row.id,
      code: row.code,
      discountType: row.discount_type === "percent" ? "percent" : "flat",
      discountValue: row.discount_value,
      minOrderPaise: row.min_order_paise,
      maxDiscountPaise: row.max_discount_paise,
      active: row.active,
      expiresAt: row.expires_at,
      usageCount: row.usage_count,
    }),
  );
}

type DbReviewRow = {
  id: string;
  name: string;
  rating: number;
  message: string;
  approved: boolean;
  featured: boolean;
  created_at: string;
};

export async function getAdminReviews() {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Could not load reviews: ${error.message}`);

  return (data as DbReviewRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    rating: row.rating,
    message: row.message,
    approved: row.approved,
    featured: row.featured,
    createdAt: row.created_at,
  }));
}

type DbSupportRow = {
  id: string;
  name: string;
  contact: string;
  message: string;
  handled: boolean;
  created_at: string;
};

export async function getAdminSupportMessages() {
  const supabase = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Could not load support messages: ${error.message}`);

  return (data as DbSupportRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    message: row.message,
    handled: row.handled,
    createdAt: row.created_at,
  }));
}
