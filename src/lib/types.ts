export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  details: string;
  pricePaise: number;
  imageUrl: string | null;
  imageUrls: string[];
  category: string;
  featured: boolean;
  inStock: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  pricePaise: number;
  imageUrl: string | null;
  quantity: number;
};

export type CheckoutPayload = {
  phone: string;
  address: string;
  items: CartItem[];
};

export type StoreSettings = {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  instagramUrl: string;
  whatsappNumber: string;
  deliveryFeePaise: number;
  freeDeliveryOverPaise: number;
  supportEmail: string;
  supportFormUrl: string;
  feedbackFormUrl: string;
  showWhatsapp: boolean;
  showEmail: boolean;
};

export type Review = {
  id: string;
  name: string;
  rating: number;
  message: string;
  approved: boolean;
  featured: boolean;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  name: string;
  contact: string;
  message: string;
  handled: boolean;
  createdAt: string;
};

export type CouponType = "flat" | "percent";

export type Coupon = {
  id: string;
  code: string;
  discountType: CouponType;
  discountValue: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  active: boolean;
  expiresAt: string | null;
  usageCount: number;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  heroBadge: "Handcrafted 3D prints · Made in India",
  heroTitle: "Cosplay, collectibles & custom 3D prints",
  heroSubtitle:
    "Shop precision-printed helmets, desk pieces, and made-to-order builds. Browse freely — checkout only when you're ready.",
  aboutText:
    "Endless possibilities in 3D printing — cosplay helmets, collectibles, and custom builds, crafted layer by layer in India.",
  instagramUrl: "https://www.instagram.com/infinite_layers_/",
  whatsappNumber: "",
  deliveryFeePaise: 0,
  freeDeliveryOverPaise: 0,
  supportEmail: "",
  supportFormUrl: "",
  feedbackFormUrl: "",
  showWhatsapp: false,
  showEmail: false,
};

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

export type StoreOrder = {
  id: string;
  orderNo: string;
  phone: string;
  address: string;
  items: CartItem[];
  totalPaise: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};
