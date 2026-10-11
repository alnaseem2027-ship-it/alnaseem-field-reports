import type { Metadata } from "next";
import "@fontsource/tajawal/arabic-400.css";
import "@fontsource/tajawal/arabic-500.css";
import "@fontsource/tajawal/arabic-700.css";
import "@fontsource/tajawal/latin-400.css";
import "@fontsource/tajawal/latin-500.css";
import "@fontsource/tajawal/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "شركة النسيم إخوان | تقارير العمل الميداني",
  description: "تطبيق إدارة وتعبئة تقارير العمل الميداني لشركة النسيم إخوان"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
