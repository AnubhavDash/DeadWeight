"use client";

/**
 * The consignment, before anyone weighs it.
 *
 * A crate rebuilt out of particles that scatter under the reader's cursor —
 * Canvas UI's `ParticleObject`, driven through its imperative API rather than
 * its React wrapper so this file owns the canvas element and can do three
 * things the wrapper cannot.
 *
 * It keeps three.js out of the first load, by importing the module inside an
 * effect instead of at the top level. It never mounts WebGL at all when the
 * browser has none or the reader has asked for reduced motion — in both cases
 * the same crate is painted as a still background image, so the header reads
 * correctly with the GPU switched off entirely. And it puts `touch-action`
 * back to `pan-y` after `OrbitControls` sets it to `none` on construction,
 * because a full-width canvas that swallows vertical drags is a canvas that
 * traps a phone reader halfway down the page.
 *
 * Decorative. The crate carries no figure, and the header says everything it
 * needs to say with this element absent.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ASSET = "/crate.svg";

/** Painted whenever the particles are not. */
const STILL = {
  backgroundImage: `url(${ASSET})`,
} as const;

function canRenderParticles(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    // A browser that throws on getContext has answered the question.
    return false;
  }
}

export function CrateObject({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Starts false so the server and the first client paint agree, and so the
  // still crate is what a reader without WebGL ever sees.
  const [particles, setParticles] = useState(false);

  useEffect(() => {
    if (!canRenderParticles()) return;

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    void import("@/components/canvasui/ParticleObject")
      .then(({ createParticleObject }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        instance = createParticleObject(
          { canvas },
          {
            src: ASSET,
            count: 9_000,
            size: 2.2,
            sizeVariance: 0.55,
            radius: 130,
            strength: 1.15,
            swirl: 0.7,
            spring: 0.9,
            damping: 0.32,
            drift: 0.5,
            scale: 3.5,
            floatIntensity: 1.4,
            rotationIntensity: 0.6,
            floatSpeed: 1.6,
            // No orbit and no zoom: the interaction is pushing the crate
            // apart, and a camera the reader can lose is not worth the
            // gesture it costs on a touchscreen.
            orbit: false,
            zoom: false,
            onError: () => setParticles(false),
          },
        );

        // WebGL probed fine but the renderer still refused: keep the still one.
        if (instance === null) return;

        canvas.style.touchAction = "pan-y";
        setParticles(true);
      })
      .catch(() => {
        // The chunk did not arrive. The still crate is already on screen.
      });

    return () => {
      cancelled = true;
      instance?.destroy();
      setParticles(false);
    };
  }, []);

  return (
    <div aria-hidden="true" className={cn("relative select-none", className)}>
      <div
        style={STILL}
        className={cn(
          "absolute inset-0 bg-contain bg-center bg-no-repeat transition-opacity duration-700",
          particles ? "opacity-0" : "opacity-70",
        )}
      />
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 block size-full transition-opacity duration-700",
          particles ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
