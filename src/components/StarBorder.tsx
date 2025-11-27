import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StarBorderProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  color?: string;
}

export function StarBorder({ children, onClick, className = "", color = "hsl(142, 70%, 45%)" }: StarBorderProps) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center justify-center px-12 py-4 text-xl font-bold text-white bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-green-500/50 ${className}`}
      style={{
        boxShadow: `0 0 30px ${color}40, 0 0 60px ${color}20`,
      }}
    >
      <motion.span
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
