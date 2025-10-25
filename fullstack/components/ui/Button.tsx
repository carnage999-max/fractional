"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React from "react";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>{ variant?: "primary"|"ghost"|"outline"; }
export const Button=({className,variant="primary",children,...props}:ButtonProps)=>{
  const base="relative inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2";
  const styles={ primary:"bg-accent text-black hover:bg-accent-600 shadow-glow", ghost:"bg-transparent text-foreground hover:bg-muted/60 border border-border", outline:"bg-transparent text-accent hover:text-black hover:bg-accent border border-accent"} as const;
  return (<motion.button whileHover={{y:-1}} whileTap={{scale:0.98}} className={cn(base,styles[variant],className)} {...props}>{children}</motion.button>);
};
