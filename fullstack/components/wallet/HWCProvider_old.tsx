"use client";

import type { ReactNode } from "react";

/**
 * Deprecated legacy HashConnect provider kept for reference only.
 * Use `components/wallet/HWCProvider.tsx` instead.
 */
export default function HWCProviderOld({ children }: { children: ReactNode }) {
  void children;
  throw new Error("HWCProvider_old has been deprecated. Use HWCProvider instead.");
}
