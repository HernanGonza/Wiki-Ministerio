import { motion, useScroll, useSpring } from 'motion/react';

/** Barra fina de progreso de lectura, verde → rosa. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-verde-700 via-oliva to-rosa-fuerte"
    />
  );
}
