"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

const MotionStreamdown = motion.create(Streamdown);

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <MotionStreamdown
      layout
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
