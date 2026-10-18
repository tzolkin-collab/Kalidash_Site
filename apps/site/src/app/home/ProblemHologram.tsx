"use client";

import { useEffect, useRef, useState } from "react";
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
      { rootMargin: "300px" }
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

      // Holographic & theatrical lighting in Kalidash warm copper & amber tones
      const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x6b4a3a, 1.6);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xfff5ec, 3.8);
      dirLight.position.set(4, 5, 5);
      scene.add(dirLight);

      const pointLightCopper = new THREE.PointLight(0xf38763, 18, 12);
      pointLightCopper.position.set(-3, -1, 3);
      scene.add(pointLightCopper);

      const pointLightAmber = new THREE.PointLight(0xffb347, 15, 10);
      pointLightAmber.position.set(3, -2, 2);
      scene.add(pointLightAmber);

      const pointLightWarmGlow = new THREE.PointLight(0xe04410, 10, 8);
      pointLightWarmGlow.position.set(0, 3, 2);
      scene.add(pointLightWarmGlow);

      // Cool-ish back rim light to separate the brain from the light background
      const rimLight = new THREE.DirectionalLight(0xffd9c4, 2.2);
      rimLight.position.set(-3, 2, -4);
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
      const warmTint = new THREE.Color(0xf38763);
      const warmEmissive = new THREE.Color(0xff8844);

      // Harmonize materials into warm glowing copper/terracotta hologram
      model.traverse((child) => {
        if ("isMesh" in child && (child as any).material) {
          const mats = Array.isArray((child as any).material)
            ? (child as any).material
            : [(child as any).material];
          mats.forEach((mat: any) => {
            if (mat.color) {
              mat.color.lerp(warmTint, 0.2);
            }
            if (mat.emissive) {
              mat.emissive.copy(warmEmissive);
              mat.emissiveIntensity = 0.06;
            }
            // Normalize holographic/translucent materials into a solid, readable surface
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.blending = THREE.NormalBlending;
            if ("roughness" in mat) mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55);
            if ("metalness" in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
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
          if ("isMesh" in child) {
            const mesh = child as any;
            mesh.geometry?.dispose();
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m: any) => m.dispose());
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
            <stop offset="0%" stopColor="rgba(255, 209, 125, 0.85)" />
            <stop offset="100%" stopColor="rgba(243, 135, 99, 0.95)" />
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
          <span className={styles.tagPing} />
          <span className={styles.tagPill}>
            <span className={styles.tagDot} />
            {tag.label}
          </span>
        </div>
      ))}
    </div>
  );
}
