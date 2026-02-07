"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10, filter: "blur(2px)" }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.18, ease: [0.2, 0.9, 0.2, 1] }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
