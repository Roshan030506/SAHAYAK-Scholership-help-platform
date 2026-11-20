import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, RoundedBox, Sparkles } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import { GardenFallback } from "@/components/three/GardenFallback";
import { SceneFrame } from "@/components/three/SceneFrame";

const PILLARS: Array<{ x: number; z: number; height: number; color: string }> = [
  { x: -2.05, z: 0.6, height: 0.85, color: "#0F766E" },
  { x: -1.1, z: 1.35, height: 1.25, color: "#F59E0B" },
  { x: 0.05, z: 1.62, height: 1.55, color: "#5EEAD4" },
  { x: 1.15, z: 1.25, height: 1.05, color: "#1E3A5F" },
  { x: 2.05, z: 0.55, height: 0.72, color: "#FCD34D" },
];

function Pillar({ x, z, height, color }: (typeof PILLARS)[number]) {
  return (
    <group position={[x, -1.55, z]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.18, height, 24]} />
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={[0, height + 0.12, 0]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function SchemeTile({
  position,
  rotation,
  accent,
  animated,
  delay,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  accent: string;
  animated: boolean;
  delay: number;
}) {
  return (
    <Float
      speed={animated ? 1.3 + delay : 0}
      rotationIntensity={animated ? 0.22 : 0}
      floatIntensity={animated ? 1.1 : 0}
    >
      <group position={position} rotation={rotation}>
        <RoundedBox args={[0.94, 1.14, 0.07]} radius={0.09} smoothness={4}>
          <meshStandardMaterial color="#ffffff" roughness={0.62} metalness={0.02} />
        </RoundedBox>
        <mesh position={[0, 0.37, 0.045]}>
          <planeGeometry args={[0.5, 0.065]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        <mesh position={[-0.04, 0.2, 0.045]}>
          <planeGeometry args={[0.62, 0.035]} />
          <meshBasicMaterial color="#CBD5E1" />
        </mesh>
        <mesh position={[-0.09, 0.09, 0.045]}>
          <planeGeometry args={[0.52, 0.035]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
        <mesh position={[-0.13, -0.02, 0.045]}>
          <planeGeometry args={[0.44, 0.035]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
        <mesh position={[-0.02, -0.32, 0.045]}>
          <planeGeometry args={[0.32, 0.11]} />
          <meshBasicMaterial color={accent} transparent opacity={0.18} />
        </mesh>
      </group>
    </Float>
  );
}

function Garden({ animated }: { animated: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!animated || !group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.14) * 0.055;
    group.current.position.y = -0.12 + Math.sin(clock.elapsedTime * 0.5) * 0.025;
  });

  return (
    <group ref={group} position={[0, -0.12, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
        <circleGeometry args={[3.35, 72]} />
        <meshStandardMaterial color="#E8F5F0" roughness={0.92} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.58, 0]}>
        <ringGeometry args={[2.45, 2.47, 80]} />
        <meshBasicMaterial color="#0F766E" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.57, 0]}>
        <ringGeometry args={[1.7, 1.715, 80]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {PILLARS.map((pillar) => (
        <Pillar key={`${pillar.x}-${pillar.z}`} {...pillar} />
      ))}

      <Float
        speed={animated ? 1.5 : 0}
        rotationIntensity={animated ? 0.18 : 0}
        floatIntensity={animated ? 0.85 : 0}
      >
        <group position={[0, 0.52, 0.72]}>
          <mesh>
            <sphereGeometry args={[0.76, 64, 64]} />
            <MeshDistortMaterial
              color="#F59E0B"
              emissive="#B45309"
              emissiveIntensity={0.16}
              roughness={0.22}
              metalness={0.16}
              distort={0.34}
              speed={animated ? 1.5 : 0}
            />
          </mesh>
          <mesh position={[-0.22, 0.22, 0.5]}>
            <sphereGeometry args={[0.16, 24, 24]} />
            <meshBasicMaterial color="#FFFBEB" transparent opacity={0.55} />
          </mesh>
          <mesh scale={1.42}>
            <sphereGeometry args={[0.76, 24, 24]} />
            <meshBasicMaterial color="#5EEAD4" transparent opacity={0.11} wireframe />
          </mesh>
          <mesh rotation={[Math.PI / 2.3, 0.25, 0]}>
            <torusGeometry args={[1.1, 0.012, 8, 96]} />
            <meshBasicMaterial color="#0F766E" transparent opacity={0.34} />
          </mesh>
          <mesh rotation={[Math.PI / 1.8, -0.35, 0.25]}>
            <torusGeometry args={[1.35, 0.009, 8, 96]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.3} />
          </mesh>
        </group>
      </Float>

      <SchemeTile
        position={[-2.25, 1.15, 0.15]}
        rotation={[0.05, 0.42, -0.12]}
        accent="#F59E0B"
        animated={animated}
        delay={0}
      />
      <SchemeTile
        position={[2.3, 0.98, -0.2]}
        rotation={[0.02, -0.38, 0.1]}
        accent="#0F766E"
        animated={animated}
        delay={0.5}
      />
      <SchemeTile
        position={[1.55, 1.95, -1.2]}
        rotation={[0.1, -0.22, 0.06]}
        accent="#5EEAD4"
        animated={animated}
        delay={0.9}
      />

      <Sparkles
        count={34}
        scale={[6.5, 4, 4]}
        size={2.4}
        speed={animated ? 0.28 : 0}
        opacity={0.55}
        color="#F59E0B"
      />
      <Sparkles
        count={20}
        scale={[5, 3.5, 3]}
        size={2}
        speed={animated ? 0.2 : 0}
        opacity={0.4}
        color="#5EEAD4"
      />
    </group>
  );
}

export function LandingScene({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <SceneFrame
      className={className}
      label={t("landing.scene.aria")}
      fallback={<GardenFallback />}
      cameraPosition={[0, 1.35, 7.2]}
    >
      {(animated) => <Garden animated={animated} />}
    </SceneFrame>
  );
}
