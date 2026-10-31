"use client";

import { useEffect, useRef, useState } from "react";
import type { Material, MeshStandardMaterial } from "three";
import styles from "./ProblemHologram.module.css";

export interface HologramTag {
  label: string;
  from: [number, number];
  to: [number, number];
  anchor: [number, number];
}

interface ProblemHologramProps {
  tags?: HologramTag[];
  className?: string;
}

export const defaultHologramTags: HologramTag[] = [
  { label: "processos", from: [22, 3], to: [50, 10], anchor: [50, 30] },
  { label: "pessoas", from: [97, 8], to: [88, 37.6], anchor: [69, 43.8] },
  { label: "tecnologia", from: [95, 97], to: [73.5, 82.4], anchor: [61.8, 66.2] },
  { label: "execução", from: [4, 94], to: [26.5, 82.4], anchor: [38.2, 66.2] },
  { label: "decisões", from: [2, 44], to: [12, 37.6], anchor: [31, 43.8] },
];

export default function ProblemHologram({
  tags = defaultHologramTags,
  className = "",
}: ProblemHologramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);
  const restartRef = useRef<(() => void) | null>(null);

  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Viewport intersection observer: lazy load Three.js & GLTF
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = !!entry?.isIntersecting;
        if (isVisibleRef.current) {
          setInView(true);
          restartRef.current?.();
        }
      },
      { rootMargin: "50px", threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Mouse parallax interaction
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !isVisibleRef.current) return;
      const rect = el.getBoundingClientRect();
      pointerRef.current = {
        x: Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1)),
        y: Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1)),
      };
    };

    const onPointerLeave = () => {
      pointerRef.current = { x: 0, y: 0 };
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!inView) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let animId = 0;
    let cleanupFn: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);

      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
      camera.position.set(0, 0, 4.6);

      // Holographic & theatrical lighting in sculpted rich purple tones with brilliant crystalline white highlights
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a0e4e, 3.0);
      scene.add(hemiLight);

      // Brilho principal: branco puro cristalino de altíssimo reflexo especular
      const dirLightCrystal = new THREE.DirectionalLight(0xffffff, 7.2);
      dirLightCrystal.position.set(4, 5, 5);
      scene.add(dirLightCrystal);

      // Luz frontal adicional para cintilação branca nos contornos e cristas
      const dirLightFrontWhite = new THREE.DirectionalLight(0xffffff, 5.0);
      dirLightFrontWhite.position.set(-1.8, 3.2, 4.5);
      scene.add(dirLightFrontWhite);

      // Luz pontual frontal cristalina para brilho vívido branco nas partículas da frente
      const pointLightFrontCrystal = new THREE.PointLight(0xffffff, 30, 12);
      pointLightFrontCrystal.position.set(0, 0.6, 3.8);
      scene.add(pointLightFrontCrystal);

      // Tons de roxo desenhados para escultura tridimensional e relevo do cérebro
      const pointLightRoyal = new THREE.PointLight(0x9d4edd, 22, 12);
      pointLightRoyal.position.set(-3.2, -1, 3);
      scene.add(pointLightRoyal);

      const pointLightPurpura = new THREE.PointLight(0xc084fc, 18, 11);
      pointLightPurpura.position.set(3, -1.8, 2);
      scene.add(pointLightPurpura);

      const pointLightDeepViolet = new THREE.PointLight(0x6b21a8, 16, 9);
      pointLightDeepViolet.position.set(0, -3.5, 2);
      scene.add(pointLightDeepViolet);

      const pointLightTopCrystal = new THREE.PointLight(0xffffff, 24, 10);
      pointLightTopCrystal.position.set(0, 3.4, 2.2);
      scene.add(pointLightTopCrystal);

      // Luz de contorno posterior cristalina branca para destacar suavemente a silhueta do cérebro
      const rimLight = new THREE.DirectionalLight(0xffffff, 5.2);
      rimLight.position.set(-3.2, 2.2, -4);
      scene.add(rimLight);

      // Root tilt & rotation group
      const rotGroup = new THREE.Group();
      rotGroup.rotation.set(0.12, 0, 0);
      scene.add(rotGroup);

      // Auto-spinning & floating mesh group
      const meshGroup = new THREE.Group();
      rotGroup.add(meshGroup);

      // Load 3D Brain Hologram model
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);

      const gltf = await loader.loadAsync("/models/brain-hologram.glb");
      if (cancelled) {
        renderer.dispose();
        return;
      }

      const model = gltf.scene;
      const purpleTint = new THREE.Color(0x7e22ce);
      const purpleDeep = new THREE.Color(0x581c87);
      const purpleEmissive = new THREE.Color(0x4c1d95);

      // Harmonize materials into rich deep purple points with brilliant crystalline white specular gleam
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats: Material[] = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((raw) => {
            const mat = raw as MeshStandardMaterial;
            if (mat.color) {
              mat.color.set(purpleTint).lerp(purpleDeep, 0.35);
            }
            if (mat.emissive) {
              mat.emissive.copy(purpleEmissive);
              mat.emissiveIntensity = 0.08;
            }
            // Keep points rich and solid while specular reflection sparkles crystalline white with smooth falloff
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.blending = THREE.NormalBlending;
            mat.roughness = 0.20;
            mat.metalness = 0.04;
            mat.needsUpdate = true;
          });
        }
      });

      // Fit model to scene
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(2.9 / maxDim);

      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      model.position.sub(center);
      meshGroup.add(model);

      const handleResize = () => {
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      handleResize();

      let lastTime = performance.now();
      let elapsed = 0;

      const renderLoop = (now: number) => {
        if (!isVisibleRef.current) {
          animId = 0;
          return;
        }

        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        elapsed += delta;

        // Continuous rotation & gentle hovering
        meshGroup.rotation.y += delta * 0.028;
        meshGroup.position.y = Math.sin(0.72 * elapsed) * 0.07;

        // Smooth mouse parallax interpolation
        rotGroup.rotation.x += (0.12 + 0.22 * pointerRef.current.y - rotGroup.rotation.x) * 0.045;
        const targetRotY = 0.38 * pointerRef.current.x;
        rotGroup.rotation.y += (targetRotY - rotGroup.rotation.y) * 0.025;

        renderer.render(scene, camera);
        animId = requestAnimationFrame(renderLoop);
      };

      restartRef.current = () => {
        if (!animId && !cancelled) {
          lastTime = performance.now();
          animId = requestAnimationFrame(renderLoop);
        }
      };

      setLoaded(true);
      animId = requestAnimationFrame(renderLoop);

      cleanupFn = () => {
        cancelAnimationFrame(animId);
        restartRef.current = null;
        resizeObserver?.disconnect();
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (child.material) {
              const mats: Material[] = Array.isArray(child.material)
                ? child.material
                : [child.material];
              mats.forEach((m) => m.dispose());
            }
          }
        });
        renderer.dispose();
      };
    })().catch((err) => {
      console.error("Failed to load ThreeScene hologram:", err);
      setLoaded(false);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      cleanupFn?.();
    };
  }, [inView]);

  return (
    <div
      ref={containerRef}
      className={`${styles.hologramWrapper} ${className}`}
      data-problem-brain="true"
    >
      {/* Projector Base Lights & Glow Rings */}
      <div aria-hidden="true" className={styles.projectorBase}>
        <div className={styles.projectorBeam} />
        <div className={styles.projectorGlow} />
        <div className={styles.projectorRingInner} />
        <div className={styles.projectorRingOuter} />
      </div>

      {/* 3D Brain Hologram Viewport */}
      <div className={styles.brainContainer}>
        <div className={styles.holoGlitch}>
          <div className={styles.holoFlicker}>
            <div
              role="img"
              aria-label="Holograma tridimensional de um cérebro que organiza a operação"
              className={styles.threeScene}
            >
              {/* Pulse glow while model is loading */}
              <div
                aria-hidden="true"
                className={`${styles.canvasPlaceholder} ${
                  loaded ? styles.canvasLoaded : styles.canvasLoading
                }`}
              />
              <canvas
                ref={canvasRef}
                className={`${styles.canvas} ${
                  loaded ? styles.canvasVisible : styles.canvasHidden
                }`}
                data-engine="three.js r186"
                width={458}
                height={458}
              />
            </div>
          </div>
        </div>

        {/* Scanlines & Holographic Scan Bar */}
        <div aria-hidden="true" className={styles.holoScanlines} />
        <div aria-hidden="true" className={styles.holoScanMask}>
          <div className={styles.holoScanBar} />
        </div>
      </div>

      {/* Connecting Laser Network (SVG) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className={styles.laserSvg}
      >
        <defs>
          <linearGradient id="problem-hologram-link" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.98)" />
            <stop offset="100%" stopColor="rgba(216, 180, 254, 0.95)" />
          </linearGradient>
        </defs>
        {tags.map((tag) => (
          <g key={tag.label}>
            <line
              x1={tag.to[0]}
              y1={tag.to[1]}
              x2={tag.anchor[0]}
              y2={tag.anchor[1]}
              pathLength={1}
              stroke="url(#problem-hologram-link)"
              strokeWidth="0.25"
              strokeLinecap="round"
              className={styles.laserLine}
            />
            <circle
              cx={tag.anchor[0]}
              cy={tag.anchor[1]}
              r="0.9"
              className={styles.laserDot}
            />
          </g>
        ))}
      </svg>

      {/* Floating Interactive Tags */}
      {tags.map((tag) => (
        <div
          key={tag.label}
          className={styles.tagWrap}
          style={{ left: `${tag.to[0]}%`, top: `${tag.to[1]}%` }}
        >
          <span className={styles.tagPill}>
            {tag.label}
          </span>
        </div>
      ))}
    </div>
  );
}
