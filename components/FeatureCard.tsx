'use client';

import { motion } from "framer-motion";
import { ReactNode } from "react";
export default function FeatureCard({icon,title,desc}:{icon:ReactNode;title:string;desc:string;}){
  return (<motion.div whileHover={{translateY:-4}} className="group relative rounded-3xl border border-border bg-card/70 p-5 shadow-innerglow">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/80 ring-1 ring-border">{icon}</div>
    <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-foreground/70">{desc}</p>
  </motion.div>);
}
