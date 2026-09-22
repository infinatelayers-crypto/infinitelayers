import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CartProvider } from "@/context/cart-context";
import { ThemeProvider, ThemeScript } from "@/context/theme-context";
import { getStoreSettings } from "@/lib/settings";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Infinite Layers | 3D Prints & Custom Builds",
    template: "%s | Infinite Layers",
  },
  description:
    "Cosplay helmets, collectibles, and custom 3D prints — handcrafted layer by layer in India.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${dmSans.variable} h-full`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <ThemeProvider>
          <CartProvider>
            <SiteHeader instagramUrl={settings.instagramUrl} />
            <main className="flex-1">{children}</main>
            <SiteFooter
              instagramUrl={settings.instagramUrl}
              aboutText={settings.aboutText}
              whatsappNumber={settings.whatsappNumber}
              showWhatsapp={settings.showWhatsapp}
              supportEmail={settings.supportEmail}
              showEmail={settings.showEmail}
            />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
