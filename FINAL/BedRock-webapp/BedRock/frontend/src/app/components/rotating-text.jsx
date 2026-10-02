import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Box } from '@mui/material';
import { TextShimmer } from '@/app/components/ui/text-shimmer';

export function RotatingText({ words, interval = 2800 }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <Box
      component="span"
      sx={{
        display: 'block',
        textAlign: 'center',
        perspective: '800px',
        height: '1.15em',
        paddingBottom: '0.25em',
        width: '100%',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{
            duration: 0.55,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            display: 'block',
            transformOrigin: '50% 50% -0.3em',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <TextShimmer
            as="span"
            duration={2.2}
            spread={3}
            className="[--base-color:#4043F1] [--base-gradient-color:#93C5FD] dark:[--base-color:#4043F1] dark:[--base-gradient-color:#93C5FD]"
            style={{
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              lineHeight: 'inherit',
              fontFamily: 'inherit',
            }}
          >
            {words[currentIndex]}
          </TextShimmer>
        </motion.span>
      </AnimatePresence>
    </Box>
  );
}
