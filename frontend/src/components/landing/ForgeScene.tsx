/**
 * The hero's WebGL scene: a crucible holding molten metal, a faceted core
 * rising out of it and three rings in orbit. This module is the only one that
 * imports three.js, and it is loaded with React.lazy, so none of it lands in
 * the main bundle.
 *
 * GPU budget: a few thousand triangles in total, no post-processing, no
 * shadows, and the pixel ratio is capped at 1.5.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  type Group,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
  NormalBlending,
  Object3D,
  type Points,
  Vector2,
} from "three";
import type { ForgePalette } from "./palette";

export interface ForgeSceneProps {
  palette: ForgePalette;
  frameloop: "always" | "demand" | "never";
  /** Reduced motion: draw one still frame and ignore the pointer. */
  still: boolean;
  /** Pointer position over the hero, each axis in [-1, 1]. */
  pointer: RefObject<{ x: number; y: number }>;
  onReady: () => void;
}

export default function ForgeScene({ palette, frameloop, still, pointer, onReady }: ForgeSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={frameloop}
      camera={{ position: [0, 0.6, 10], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={() => onReady()}
      style={{ pointerEvents: "none" }}
    >
      <Invalidator />
      <Forge palette={palette} still={still} pointer={pointer} />
    </Canvas>
  );
}

/**
 * Requests a frame after every render of the canvas tree (new palette, new
 * frameloop), so demand mode repaints on a theme change and the loop restarts
 * after a pause.
 */
function Invalidator() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  });
  return null;
}

/** A white radial falloff; materials tint it, so one texture serves every glow. */
function useGlowTexture() {
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
      gradient.addColorStop(0.6, "rgba(255,255,255,0.12)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

// The crucible's cross-section, revolved by LatheGeometry: outer wall up to
// the lip, then the inner wall back down, so it reads as a thick cup.
const BOWL_PROFILE = [
  [0, -1.1],
  [0.62, -1.1],
  [0.95, -0.98],
  [1.22, -0.68],
  [1.4, -0.22],
  [1.47, 0.2],
  [1.5, 0.48],
  [1.62, 0.56],
  [1.6, 0.66],
  [1.4, 0.62],
  [1.34, 0.2],
  [1.24, -0.28],
  [1.02, -0.68],
  [0.6, -0.9],
  [0, -0.92],
].map(([x, y]) => new Vector2(x, y));

const SPARKS = 60;

/** Small seeded PRNG: the spark layout is the same on every load and render. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spark seeds: a position on the molten surface, a rise speed and a drift.
const random = seeded(7);
const SPARK_SEEDS = Array.from({ length: SPARKS }, () => ({
  r: Math.sqrt(random()) * 1.15,
  a: random() * Math.PI * 2,
  speed: 0.35 + random() * 0.55,
  drift: (random() - 0.5) * 0.25,
  offset: random() * 3,
}));
const DASHES = 44;
const BASE_TILT_X = 0.2;
const BASE_TILT_Y = -0.32;

function Forge({ palette, still, pointer }: Omit<ForgeSceneProps, "frameloop" | "onReady">) {
  const glow = useGlowTexture();
  const rig = useRef<Group>(null);
  const core = useRef<Group>(null);
  const shell = useRef<Mesh>(null);
  const ringA = useRef<Group>(null);
  const ringB = useRef<Group>(null);
  const ringC = useRef<Group>(null);
  const bead = useRef<Group>(null);
  const pool = useRef<MeshStandardMaterial>(null);
  const dashes = useRef<InstancedMesh>(null);
  const sparks = useRef<Points>(null);
  const clock = useRef(0);
  // Created once per mount; useFrame then writes into it through the geometry.
  const [sparkBuffer] = useState(() => new Float32Array(SPARKS * 3));

  const blending = palette.light ? NormalBlending : AdditiveBlending;

  // Lay the dashes of the frost ring out once; the ring group spins them.
  useEffect(() => {
    const mesh = dashes.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < DASHES; i++) {
      const angle = (i / DASHES) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, 0);
      dummy.rotation.set(0, 0, angle + Math.PI / 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, rawDelta) => {
    // Clamp: after a pause (off-screen, hidden tab) the first delta is huge.
    const delta = still ? 0 : Math.min(rawDelta, 0.1);
    clock.current += delta;
    const t = still ? 1.2 : clock.current;

    if (ringA.current) ringA.current.rotation.z = t * 0.35;
    if (ringB.current) ringB.current.rotation.z = -t * 0.22;
    if (ringC.current) ringC.current.rotation.z = t * 0.12;
    if (bead.current) bead.current.rotation.z = t * 0.6;

    if (core.current) {
      core.current.position.y = 1.55 + Math.sin(t * 1.1) * 0.09;
      core.current.rotation.y = t * 0.45;
      core.current.rotation.x = Math.sin(t * 0.4) * 0.25;
    }
    if (shell.current) {
      shell.current.rotation.y = -t * 0.25;
      shell.current.rotation.z = t * 0.15;
    }
    if (pool.current) pool.current.emissiveIntensity = 0.85 + Math.sin(t * 2.3) * 0.12 + Math.sin(t * 5.1) * 0.05;

    // Sparks rise off the molten surface and loop back to it.
    const attribute = sparks.current?.geometry.getAttribute("position");
    const positions = (attribute?.array ?? []) as Float32Array;
    if (attribute) SPARK_SEEDS.forEach((seed, i) => {
      const life = (t * seed.speed + seed.offset) % 2.4;
      const angle = seed.a + life * seed.drift * 3;
      positions[i * 3] = Math.cos(angle) * (seed.r + life * seed.drift);
      positions[i * 3 + 1] = 0.42 + life;
      positions[i * 3 + 2] = Math.sin(angle) * (seed.r + life * seed.drift);
    });
    if (attribute) attribute.needsUpdate = true;

    // Parallax: ease the whole rig toward the pointer.
    if (rig.current) {
      const p = still ? { x: 0, y: 0 } : (pointer.current ?? { x: 0, y: 0 });
      const ease = still ? 1 : Math.min(1, delta * 3);
      rig.current.rotation.x += (BASE_TILT_X + p.y * 0.14 - rig.current.rotation.x) * ease;
      rig.current.rotation.y += (BASE_TILT_Y + p.x * 0.3 - rig.current.rotation.y) * ease;
    }
  });

  const emberColor = useMemo(() => new Color(palette.ember), [palette.ember]);

  return (
    <>
      {/* Neutral fill: in light mode --ink is near black, so light from the page colour instead. */}
      <ambientLight intensity={palette.light ? 1.3 : 0.9} color={palette.light ? palette.bg : palette.ink} />
      <directionalLight
        position={[-4, 5, 4]}
        intensity={palette.light ? 1.6 : 0.9}
        color={palette.light ? palette.bg : palette.frost}
      />
      {/* Rim light from the molten pool: it should catch the lip, not flood the body. */}
      <pointLight position={[0, 1.2, 0.3]} intensity={palette.light ? 6 : 9} distance={7} decay={2} color={palette.ember} />

      <group ref={rig} position={[0, -0.35, 0]} rotation={[BASE_TILT_X, BASE_TILT_Y, 0]}>
        {/* Crucible body */}
        <mesh>
          <latheGeometry args={[BOWL_PROFILE, 40]} />
          <meshStandardMaterial
            color={palette.surface3}
            metalness={0.4}
            roughness={0.5}
            // Emissive is linear: even 0.08 of ember turns the body brown.
            emissive={emberColor}
            emissiveIntensity={0.012}
          />
        </mesh>

        {/* Molten pool */}
        <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.42, 40]} />
          <meshStandardMaterial
            ref={pool}
            color={palette.ember}
            emissive={emberColor}
            emissiveIntensity={0.85}
            toneMapped={false}
          />
        </mesh>
        <sprite position={[0, 0.7, 0]} scale={[4.2, 2.4, 1]}>
          <spriteMaterial
            map={glow}
            color={palette.ember}
            transparent
            opacity={palette.light ? 0.35 : 0.75}
            blending={blending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* The forged core */}
        <group ref={core} position={[0, 1.55, 0]}>
          <mesh>
            <icosahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial
              color={palette.ember2}
              emissive={emberColor}
              emissiveIntensity={0.9}
              flatShading
              roughness={0.3}
              metalness={0.2}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={shell}>
            <icosahedronGeometry args={[0.78, 1]} />
            <meshBasicMaterial color={palette.frost} wireframe transparent opacity={palette.light ? 0.55 : 0.4} />
          </mesh>
          <sprite scale={[2.6, 2.6, 1]}>
            <spriteMaterial
              map={glow}
              color={palette.ember2}
              transparent
              opacity={palette.light ? 0.3 : 0.6}
              blending={blending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        </group>

        {/* Rising sparks */}
        <points ref={sparks}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[sparkBuffer, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={glow}
            color={palette.ember2}
            size={0.14}
            sizeAttenuation
            transparent
            opacity={palette.light ? 0.85 : 0.9}
            blending={blending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>

        {/* Ring A: the solid ember orbit, with a bead riding it */}
        <group position={[0, 0.45, 0]} rotation={[Math.PI * 0.36, 0, 0.06]}>
          <group ref={ringA}>
            <mesh>
              <torusGeometry args={[2.95, 0.026, 6, 140]} />
              <meshBasicMaterial color={palette.ember} toneMapped={false} />
            </mesh>
          </group>
          <group ref={bead}>
            <mesh position={[2.95, 0, 0]}>
              <sphereGeometry args={[0.09, 12, 8]} />
              <meshBasicMaterial color={palette.ember2} toneMapped={false} />
            </mesh>
            <sprite position={[2.95, 0, 0]} scale={[0.9, 0.9, 1]}>
              <spriteMaterial map={glow} color={palette.ember} transparent opacity={0.8} blending={blending} depthWrite={false} />
            </sprite>
          </group>
        </group>

        {/* Ring B: the dashed frost orbit, tilted against A */}
        <group position={[0, 0.45, 0]} rotation={[Math.PI * 0.3, 0.36, 0]}>
          <group ref={ringB}>
            <instancedMesh ref={dashes} args={[undefined, undefined, DASHES]}>
              <boxGeometry args={[0.16, 0.022, 0.022]} />
              <meshBasicMaterial color={palette.frost} toneMapped={false} />
            </instancedMesh>
          </group>
        </group>

        {/* Ring C: the faint outer orbit */}
        <group position={[0, 0.45, 0]} rotation={[Math.PI * 0.4, -0.28, 0]}>
          <group ref={ringC}>
            <mesh>
              <torusGeometry args={[3.45, 0.012, 4, 160]} />
              <meshBasicMaterial color={palette.ink} transparent opacity={palette.light ? 0.3 : 0.22} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}
