import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "Review desk · MindBill starter", description: "A fictional medical-records review app with a complete MindBill billing integration." };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
