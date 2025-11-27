import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";

function ToolGroupTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" {...props} asChild>
      <motion.div className={cn("flex flex-col", className)}>
        {props.children}
      </motion.div>
    </TabsPrimitive.Root>
  );
}

function ToolGroupTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List data-slot="tabs-list" {...props} asChild>
      <motion.div
        className={cn(
          "text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-t-2xl",
          className
        )}
      >
        {props.children}
      </motion.div>
    </TabsPrimitive.List>
  );
}

function ToolGroupTabsTrigger({
  className,
  isSelected,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  isSelected?: boolean;
}) {
  return (
    <TabsPrimitive.Trigger data-slot="tabs-trigger" {...props} asChild>
      <motion.div
        className={cn(
          "data-[state=active]:bg-accent dark:data-[state=active]:text-foreground dark:data-[state=active]:bg-[transparent] text-foreground dark:text-muted-foreground inline-flex h-[calc(100%)] flex-1 items-center justify-center gap-1.5 px-1 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
          "z-1 relative"
        )}
      >
        {props.children}
        {isSelected && (
          <motion.div
            className="absolute inset-0 -z-1 bg-accent rounded-t-2xl"
            layoutId="tool-group-tabs-trigger-background"
            transition={{
              type: "spring",
              stiffness: 1000,
              damping: 50,
            }}
          />
        )}
      </motion.div>
    </TabsPrimitive.Trigger>
  );
}

function ToolGroupTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" {...props} asChild>
      <motion.div className={cn("flex-1 outline-none relative", className)}>
        {props.children}

        <div className="absolute inset-0 -z-1 bg-accent rounded-b-2xl"></div>
      </motion.div>
    </TabsPrimitive.Content>
  );
}

export {
  ToolGroupTabs,
  ToolGroupTabsList,
  ToolGroupTabsTrigger,
  ToolGroupTabsContent,
};
