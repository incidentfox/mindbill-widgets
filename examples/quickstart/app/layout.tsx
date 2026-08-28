import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f8fa", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
