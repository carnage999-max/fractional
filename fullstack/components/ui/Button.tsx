"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React from "react";
interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDrag">{ 
  variant?: "primary"|"ghost"|"outline"; 
  size?: "sm"|"md"|"lg";
}
export const Button=({className,variant="primary",size="md",children,...props}:ButtonProps)=>{
  const base="relative inline-flex items-center justify-center rounded-2xl font-semibold transition-all focus:outline-none focus:ring-2";
  const styles={ 
    primary:"bg-accent text-black hover:bg-accent-600 shadow-glow", 
    ghost:"bg-transparent text-foreground hover:bg-muted/60 border border-border", 
    outline:"bg-transparent text-accent hover:text-black hover:bg-accent border border-accent"
  } as const;
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base"
  } as const;
  return (<motion.button whileHover={{y:-1}} whileTap={{scale:0.98}} className={cn(base,styles[variant],sizes[size],className)} {...props}>{children}</motion.button>);
};
