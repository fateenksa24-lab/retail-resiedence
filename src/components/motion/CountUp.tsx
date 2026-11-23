'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { EASE_OUT, VIEWPORT } from '@/lib/motion';

const DURATION = 1.6;

// Counts every number in a value ("84–363", "24/7") up from 0 when it scrolls into view.
// The final value holds the width so nothing shifts while counting.
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, 1, { duration: DURATION, ease: EASE_OUT, onUpdate: setProgress });
    return () => controls.stop();
  }, [inView, reduce]);

  const shown = reduce ? value : value.replace(/\d+/g, (n) => String(Math.round(Number(n) * progress)));

  return (
    <span ref={ref} dir="ltr" className={cn('relative inline-block', className)}>
      <span className="invisible">{value}</span>
      <span className="absolute inset-0" aria-hidden>
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
