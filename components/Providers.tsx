"use client";
import { ThemeProvider, globalStyles } from "@maximeheckel/design-system";

export default function Providers({ children }: { children: React.ReactNode }) {
  globalStyles();
  return <ThemeProvider>{children}</ThemeProvider>;
}
