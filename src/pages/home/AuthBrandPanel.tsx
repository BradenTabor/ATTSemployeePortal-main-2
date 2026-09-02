import React, { useMemo } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { BrandMark } from "@/components/canopy/BrandMark";
import { AUTH_VALUE_PROP, AUTH_TRUST_SIGNALS } from "./authCopy";
import { Eyebrow } from "@/components/canopy/Eyebrow";
import { EASE_CANOPY } from "@/motion/presets";
import { getDeviceCapabilities } from "@/lib/mobilePerf";

interface AuthBrandPanelProps {
  title: string;
  subtitle: string;
  /** Show the eyebrow + trust signals (desktop brand panel). Defaults to true. */
  showTrust?: boolean;
}

/**
 * Brand side of the auth split. The obsidian leaf hero floats in the
 * understory behind a display headline whose final word is set in italic
 * verdant. Entrance: everything rises through a blur in a cascade; the leaf
 * then drifts indefinitely.
 */
export const AuthBrandPanel: React.FC<AuthBrandPanelProps> = ({ title, subtitle, showTrust = true }) => {
  const reduce = useReducedMotion();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const words = title.split(" ");

  const container: Variants = reduce
    ? {}
    : { hidden: {}, visible: { transition: { staggerChildren: 0.11, delayChildren: 0.1 } } };

  const item: Variants = reduce
    ? {}
    : {
        hidden: { opacity: 0, y: 22, filter: "blur(10px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE_CANOPY } },
      };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="relative flex w-full max-w-2xl flex-col items-center xl:items-start"
    >
      {/* Obsidian leaf hero — desktop only, behind the copy. Gated in JS (not
          just `hidden`) so phones never download the 140 KB texture. */}
      {!caps.isLowEnd && !caps.isMobile && (
        <motion.picture
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-28 hidden w-[520px] xl:block 2xl:-right-24 2xl:w-[640px]"
          initial={reduce ? false : { opacity: 0, scale: 0.92, rotate: -6, filter: "blur(16px)" }}
          animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.6, ease: EASE_CANOPY, delay: 0.2 }}
        >
          <source srcSet="/assets/canopy/leaf.webp" type="image/webp" />
          <img
            src="/assets/canopy/leaf.webp"
            alt=""
            width={1536}
            height={1024}
            decoding="async"
            className={`mix-blend-screen ${reduce ? "" : "animate-drift"}`}
            style={{
              maskImage: "radial-gradient(50% 50% at 50% 50%, black 40%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(50% 50% at 50% 50%, black 40%, transparent 100%)",
            }}
          />
        </motion.picture>
      )}

      <motion.div variants={item} className="relative flex items-center gap-4">
        <BrandMark size={64} live />
        <span className="flex flex-col leading-none">
          <span className="type-display text-2xl font-medium text-bone-50 sm:text-[1.7rem]">All Terrain</span>
          <span className="type-instrument mt-1.5 text-verdant-300">Tree Service · Portal</span>
        </span>
      </motion.div>

      {showTrust && (
        <motion.div variants={item} className="relative mt-8 hidden w-full max-w-sm xl:block">
          <Eyebrow tone="verdant">{AUTH_VALUE_PROP}</Eyebrow>
        </motion.div>
      )}

      <motion.h1
        variants={item}
        className="type-display relative mt-6 text-balance text-[clamp(2.75rem,7vw,5.5rem)] font-light text-bone-50 xl:mt-5"
      >
        {words.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className={i === words.length - 1 ? "italic text-verdant-300 text-glow" : undefined}
          >
            {w}
            {i < words.length - 1 && " "}
          </span>
        ))}
      </motion.h1>

      <motion.p
        variants={item}
        className="relative mt-5 min-h-[3.5rem] max-w-md text-pretty text-base leading-relaxed text-bone-300 sm:text-lg xl:max-w-lg"
      >
        {subtitle}
      </motion.p>

      {showTrust && (
        <motion.ul variants={item} className="relative mt-10 hidden w-full max-w-md flex-col xl:flex">
          {AUTH_TRUST_SIGNALS.map(({ icon: Icon, label }, i) => (
            <li
              key={label}
              className="flex items-center gap-4 border-t border-bone-50/[0.08] py-3.5 text-sm text-bone-200 last:border-b"
            >
              <span className="type-instrument w-6 text-verdant-300/70">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-leaf-xs border border-verdant-400/25 bg-verdant-500/10 text-verdant-300">
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              {label}
            </li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  );
};
