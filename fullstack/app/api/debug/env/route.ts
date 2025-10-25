import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Server-side environment variables (won't be exposed to client)
  const serverEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? "***HIDDEN***" : "undefined",
    OPERATOR_ID: process.env.OPERATOR_ID ? "***HIDDEN***" : "undefined",
  };

  // Client-side environment variables (NEXT_PUBLIC_ prefixed)
  const clientEnv = {
    NEXT_PUBLIC_HEDERA_NETWORK: process.env.NEXT_PUBLIC_HEDERA_NETWORK,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_WC_RELAY_URL: process.env.NEXT_PUBLIC_WC_RELAY_URL,
  };

  return NextResponse.json({
    serverEnv,
    clientEnv,
    timestamp: new Date().toISOString(),
    message: "Environment variables check",
  });
}