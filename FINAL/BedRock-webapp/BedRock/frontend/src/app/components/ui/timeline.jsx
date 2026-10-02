"use client";
import { useScroll, useTransform, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function Timeline({ data }) {
  const ref = useRef(null);
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full font-sans" ref={containerRef}>
      <div ref={ref} className="relative max-w-5xl mx-auto">
        {data.map((item, index) => (
          <div key={index} className="flex justify-start pt-10 md:pt-14 md:gap-10">
            {/* Sticky label column */}
            <div className="sticky flex flex-col md:flex-row z-40 items-start top-32 self-start max-w-xs lg:max-w-sm md:w-full">
              {/* Timeline dot */}
              <div
                className="h-10 absolute left-3 md:left-3 w-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(13,11,30,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    background: "radial-gradient(circle, #F4A554 0%, rgba(244,165,84,0.4) 100%)",
                    boxShadow: "0 0 8px rgba(244,165,84,0.5)",
                  }}
                />
              </div>
              {/* Title — md+ */}
              <h3
                className="hidden md:block text-xl md:pl-20 md:text-3xl font-semibold"
                style={{ color: "rgba(244,238,255,0.4)", letterSpacing: "-0.02em" }}
              >
                {item.title}
              </h3>
            </div>

            {/* Content column */}
            <div className="relative pl-20 pr-4 md:pl-4 w-full">
              {/* Title — mobile */}
              <h3
                className="md:hidden block text-2xl mb-4 text-left font-semibold"
                style={{ color: "rgba(244,238,255,0.4)", letterSpacing: "-0.02em" }}
              >
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}

        {/* Track line background */}
        <div
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px]"
          style={{
            height: height + "px",
            background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.06) 10%, rgba(255,255,255,0.06) 90%, transparent 100%)",
          }}
        >
          {/* Scroll-driven fill line */}
          <motion.div
            className="absolute inset-x-0 top-0 w-[2px] rounded-full"
            style={{
              height: heightTransform,
              opacity: opacityTransform,
              background: "linear-gradient(to bottom, transparent 0%, #F4A554 30%, rgba(244,165,84,0.5) 80%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
