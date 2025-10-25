"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingItem {
  id: string;
  x: number;
  y: number;
  icon: string;
  color: string;
  size: number;
}

const items = [
  { icon: "🏢", color: "text-blue-400" },
  { icon: "🎵", color: "text-purple-400" },
  { icon: "🎮", color: "text-green-400" },
  { icon: "🏠", color: "text-yellow-400" },
  { icon: "💎", color: "text-cyan-400" },
  { icon: "🎨", color: "text-pink-400" },
  { icon: "⚡", color: "text-orange-400" },
  { icon: "🌟", color: "text-amber-400" },
];

export default function AnimatedBackground() {
  const [floatingItems, setFloatingItems] = useState<FloatingItem[]>([]);

  useEffect(() => {
    const createItem = () => {
      const item = items[Math.floor(Math.random() * items.length)];
      const newItem: FloatingItem = {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * window.innerWidth,
        y: -50,
        icon: item.icon,
        color: item.color,
        size: Math.random() * 20 + 20, // 20-40px
      };
      
      setFloatingItems(prev => [...prev, newItem]);
      
      // Remove item after animation completes
      setTimeout(() => {
        setFloatingItems(prev => prev.filter(i => i.id !== newItem.id));
      }, 8000);
    };

    // Create initial items
    const initialCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < initialCount; i++) {
      setTimeout(() => createItem(), i * 1000);
    }

    // Create new items periodically
    const interval = setInterval(() => {
      if (Math.random() < 0.7) { // 70% chance
        createItem();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <AnimatePresence>
        {floatingItems.map(item => (
          <motion.div
            key={item.id}
            className={`absolute ${item.color} select-none`}
            style={{
              fontSize: `${item.size}px`,
              left: item.x,
            }}
            initial={{
              y: -50,
              opacity: 0,
              scale: 0.5,
              rotate: 0,
            }}
            animate={{
              y: window.innerHeight + 50,
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 1, 0.5],
              rotate: 360,
            }}
            exit={{
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: 8,
              ease: "linear",
              opacity: {
                times: [0, 0.1, 0.9, 1],
                duration: 8,
              },
              scale: {
                times: [0, 0.1, 0.9, 1],
                duration: 8,
              },
            }}
          >
            {item.icon}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}