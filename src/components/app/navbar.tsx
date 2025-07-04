"use client";

import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useScroll,
  type AnimationGeneratorType,
} from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/app/signout-button";

const INITIAL_WIDTH = "70rem";
const MAX_WIDTH = "800px";

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const drawerVariants = {
  hidden: { opacity: 0, y: 100 },
  visible: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      type: "spring" as AnimationGeneratorType,
      damping: 15,
      stiffness: 200,
      staggerChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    y: 100,
    transition: { duration: 0.1 },
  },
};

export function Navbar() {
  const { scrollY } = useScroll();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      setHasScrolled(latest > 10);
    });
    return unsubscribe;
  }, [scrollY]);

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);
  const handleOverlayClick = () => setIsDrawerOpen(false);

  return (
    <header
      className={cn(
        "sticky z-50 mx-4 flex justify-center transition-all duration-300 md:mx-0",
        hasScrolled ? "top-6" : "top-4 mx-0",
      )}
    >
      <motion.div
        initial={{ width: INITIAL_WIDTH }}
        animate={{ width: hasScrolled ? MAX_WIDTH : INITIAL_WIDTH }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div
          className={cn(
            "mx-auto max-w-7xl rounded-2xl transition-all duration-300 xl:px-0",
            hasScrolled
              ? "border-border bg-background/75 border px-2 backdrop-blur-lg"
              : "px-7 shadow-none",
          )}
        >
          <div className="flex h-[56px] items-center justify-between p-4">
            <Link href="/" className="flex items-center gap-3">
              <Icons.logo className="size-7 md:size-10" />
              <p className="text-primary text-lg font-semibold">SkyAgent</p>
            </Link>

            <div className="flex shrink-0 flex-row items-center gap-1 md:gap-3">
              <div className="flex items-center space-x-6">
                <SignOutButton className="bg-secondary text-primary-foreground dark:text-secondary-foreground hidden h-8 w-fit items-center justify-center rounded-full border border-white/[0.12] px-4 text-sm font-normal tracking-wide shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)] md:flex" />
              </div>
              <ThemeToggle />
              <button
                className="border-border flex size-8 cursor-pointer items-center justify-center rounded-md border md:hidden"
                onClick={toggleDrawer}
              >
                {isDrawerOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={overlayVariants}
              transition={{ duration: 0.2 }}
              onClick={handleOverlayClick}
            />

            <motion.div
              className="bg-background border-border fixed inset-x-0 bottom-3 mx-auto w-[95%] rounded-xl border p-4 shadow-lg"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={drawerVariants}
            >
              {/* Mobile menu content */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Link href="/" className="flex items-center gap-3">
                    <Icons.logo className="size-7 md:size-10" />
                    <p className="text-primary text-lg font-semibold">
                      SkyAgent
                    </p>
                  </Link>
                  <button
                    onClick={toggleDrawer}
                    className="border-border cursor-pointer rounded-md border p-1"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  <SignOutButton className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
