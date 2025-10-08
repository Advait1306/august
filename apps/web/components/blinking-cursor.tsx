import { motion } from "motion/react";

export const BlinkingCursor = () => {
  return (
    <motion.div
      className="w-2 h-5 bg-foreground rounded-[2px]"
      animate={{
        opacity: [1, 0.5],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        repeatType: "reverse",
      }}
    ></motion.div>
  );
};
