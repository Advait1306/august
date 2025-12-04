"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FullPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FullPageDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: FullPageDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DialogPrimitive.Content asChild>
                  <motion.div
                    className={cn(
                      "relative w-[80%] max-w-[1600px] h-[80%] bg-background border border-black/20 dark:border-white/20 shadow-[0px_4px_14px_0px_rgba(0,_0,_0,_0.1)] rounded-xl overflow-hidden flex flex-col",
                      className
                    )}
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Title Bar */}
                    <div className="flex-shrink-0 flex items-center justify-between pl-2 pr-4 py-2 border-b border-border bg-sidebar">
                      <DialogPrimitive.Title className="text-xs font-semibold text-muted-foreground/60 px-2">
                        {title}
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Close asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </DialogPrimitive.Close>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">{children}</div>
                  </motion.div>
                </DialogPrimitive.Content>
              </motion.div>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
