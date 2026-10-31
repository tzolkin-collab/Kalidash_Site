"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  maxOpacity?: number;
  className?: string;
}

export default function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.25,
  color = "rgb(182, 100, 77)",
  width,
  height,
  className,
  maxOpacity = 0.35,
  style,
  ...props
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInViewRef = useRef(false);

  // Converte a cor base em string estável para o context do Canvas
  const baseColor = useMemo(() => {
    return color;
  }, [color]);

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, w: number, h: number) => {
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const cols = Math.floor(w / (squareSize + gridGap));
      const rows = Math.floor(h / (squareSize + gridGap));

      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      return { cols, rows, squares, dpr };
    },
    [squareSize, gridGap, maxOpacity]
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaTime: number) => {
      const chance = flickerChance * deltaTime * 60;
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < chance) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    },
    [flickerChance, maxOpacity]
  );

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number
    ) => {
      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.fillStyle = baseColor;

      const step = (squareSize + gridGap) * dpr;
      const size = squareSize * dpr;

      for (let i = 0; i < cols; i++) {
        const x = i * step;
        for (let j = 0; j < rows; j++) {
          const opacity = squares[i * rows + j];
          if (opacity > 0.01) {
            ctx.globalAlpha = opacity;
            ctx.fillRect(x, j * step, size, size);
          }
        }
      }
      ctx.globalAlpha = 1;
    },
    [baseColor, squareSize, gridGap]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let currentWidth = width || container.clientWidth || 300;
    let currentHeight = height || container.clientHeight || 200;

    let { cols, rows, squares, dpr } = setupCanvas(canvas, currentWidth, currentHeight);

    let lastTime = 0;
    let lastDrawTime = 0;
    const FPS_INTERVAL = 1000 / 30; // 30 FPS estável para economizar CPU/GPU

    const animate = (time: number) => {
      if (!isInViewRef.current) {
        // Pausa o rAF completamente quando fora de tela
        return;
      }

      if (!lastTime) lastTime = time;
      const elapsedSinceDraw = time - lastDrawTime;

      if (elapsedSinceDraw >= FPS_INTERVAL) {
        const deltaTime = (time - lastTime) / 1000;
        lastTime = time;
        lastDrawTime = time;

        updateSquares(squares, deltaTime);
        drawGrid(ctx, currentWidth, currentHeight, cols, rows, squares, dpr);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      cancelAnimationFrame(animationFrameId);
      lastTime = 0;
      animationFrameId = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (rect.width > 0 && rect.height > 0) {
          currentWidth = rect.width;
          currentHeight = rect.height;
          const canvasData = setupCanvas(canvas, currentWidth, currentHeight);
          cols = canvasData.cols;
          rows = canvasData.rows;
          squares = canvasData.squares;
          dpr = canvasData.dpr;
          if (isInViewRef.current) {
            drawGrid(ctx, currentWidth, currentHeight, cols, rows, squares, dpr);
          }
        }
      }
    });

    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        isInViewRef.current = inView;
        if (inView) {
          startAnimation();
        } else {
          cancelAnimationFrame(animationFrameId);
        }
      },
      { threshold: 0.05 }
    );

    intersectionObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [setupCanvas, updateSquares, drawGrid, width, height]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
