import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import { OrbFallback } from "@/components/three/GardenFallback";
import { SceneFrame } from "@/components/three/SceneFrame";

interface VoiceOrbSceneProps {
  listening: boolean;
  speaking: boolean;
  level: number;
  className?: string;
}

function Orb({
  listening,
  speaking,
  level,
  animated,
}: VoiceOrbSceneProps & { animated: boolean }) {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const color = listening ? "#F59E0B" : speaking ? "#0F766E" : "#FBBF24";

  useFrame(({ clock }) => {
    if (!animated || !orbRef.current) return;
    const target =
      1 + (listening ? level * 0.3 : 0) + (speaking ? Math.sin(clock.elapsedTime * 5.4) * 0.035 : 0);
    const next = THREE.MathUtils.lerp(orbRef.current.scale.x, target, 0.12);
    orbRef.current.scale.setScalar(next);
    orbRef.current.rotation.y += 0.0035;
    if (ringRef.current) {
      ringRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.16;
      ringRef.current.rotation.x = Math.PI / 2.4 + Math.cos(clock.elapsedTime * 0.28) * 0.08;
    }
  });

  return (
    <group>
      <Float
        speed={animated ? 1.15 : 0}
        rotationIntensity={animated ? 0.12 : 0}
        floatIntensity={animated ? 0.55 : 0}
      >
        <mesh ref={orbRef}>
          <sphereGeometry args={[0.95, 64, 64]} />
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.16}
            roughness={0.24}
            metalness={0.12}
            distort={listening ? 0.42 : 0.3}
            speed={animated ? 1.6 : 0}
          />
        </mesh>
        <mesh position={[-0.3, 0.3, 0.62]}>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshBasicMaterial color="#FFFBEB" transparent opacity={0.55} />
        </mesh>
        <mesh scale={1.34}>
          <sphereGeometry args={[0.95, 26, 26]} />
          <meshBasicMaterial color="#5EEAD4" transparent opacity={0.12} wireframe />
        </mesh>
      </Float>

      <group ref={ringRef} rotation={[Math.PI / 2.4, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.55, 0.016, 8, 120]} />
          <meshBasicMaterial color="#0F766E" transparent opacity={0.35} />
        </mesh>
        <mesh rotation={[0.35, 0.1, 0.15]}>
          <torusGeometry args={[1.85, 0.01, 8, 120]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.38} />
        </mesh>
      </group>

      <Sparkles
        count={26}
        scale={[4, 3.4, 3]}
        size={2.2}
        speed={animated ? 0.25 : 0}
        opacity={0.5}
        color="#F59E0B"
      />
    </group>
  );
}

export function VoiceOrbScene({ listening, speaking, level, className }: VoiceOrbSceneProps) {
  const { t } = useTranslation();
  return (
    <SceneFrame
      className={className}
      label={t("a11y.orb")}
      fallback={<OrbFallback listening={listening} speaking={speaking} level={level} />}
      cameraPosition={[0, 0.2, 5.2]}
      fov={38}
    >
      {(animated) => (
        <group position={[0, 0.1, 0]}>
          <Orb listening={listening} speaking={speaking} level={level} animated={animated} />
        </group>
      )}
    </SceneFrame>
  );
}
