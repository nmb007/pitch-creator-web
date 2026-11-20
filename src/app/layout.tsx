import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/app/providers";
import { env } from "@/shared/config/env";

import "./globals.css";

void env.apiBaseUrl;

export const metadata: Metadata = {
  title: "Pitch Creator",
  description: "Find the closest case studies for a prospect.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
