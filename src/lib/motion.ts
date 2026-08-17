import type { Transition, Variants } from 'framer-motion';

export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

export const pageTransition: Transition = {
  duration: 0.28,
  ease: easeOutExpo,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985, filter: 'blur(4px)' },
  enter: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, scale: 0.99, filter: 'blur(3px)' },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOutExpo } },
};
