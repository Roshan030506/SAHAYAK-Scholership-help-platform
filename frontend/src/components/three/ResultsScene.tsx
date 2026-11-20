import { useState } from "react";
import { Float, RoundedBox, Sparkles } from "@react-three/drei";
import { useTranslation } from "react-i18next";
import * as THREE from "three";

import { SceneFrame } from "@/components/three/SceneFrame";
import type { EligibilityResult } from "@/types/api";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<EligibilityResult["status"], { body: string; top: string }> = {
  eligible: { body: "#10B981", top: "#A7F3D0" },
  likely: { body: "#F59E0B", top: "#FDE68A" },
  not_eligible: { body: "#94A3B8", top: "#E2E8F0" },
};

interface ResultsSceneProps {
  results: EligibilityResult[];
  selectedId: string | null;
  onSelect: (schemeId: string) => void;
  className?: string;
}

function ResultPillar({
  result,
  index,
  total,
  maxBenefit,
  selected,
  onSelect,
}: {
  result: EligibilityResult;
  index: number;
  total: number;
  maxBenefit: number;
  selected: boolean;
  onSelect: (schemeId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const spacing = total > 4 ? 1.12 : 1.3;
  const x = (index - (total - 1) / 2) * spacing;
  const ratio = maxBenefit > 0 ? result.benefit_amount_per_year / maxBenefit : 0.4;
  const height = 0.6 + ratio * 1.9;
  const base = -1.45;
  const colors = STATUS_COLORS[result.status];
  const scale = hovered ? 1.035 : 1;

  return (
    <group position={[x, base, 0]}>
      <group
        position={[0, height / 2, 0]}
        scale={[scale, scale, scale]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(result.scheme_id);
        }}
      >
        <RoundedBox args={[0.56, height, 0.56]} radius={0.17} smoothness={4}>
          <meshStandardMaterial
            color={colors.body}
            emissive={colors.body}
            emissiveIntensity={selected ? 0.22 : 0.05}
            roughness={0.38}
            metalness={0.08}
          />
        </RoundedBox>
      </group>
      <Float
        speed={selected ? 1.4 : 0.9}
        rotationIntensity={0.08}
        floatIntensity={0.4}
      >
        <mesh position={[0, height + 0.18, 0]}>
          <icosahedronGeometry args={[0.2, 1]} />
          <meshStandardMaterial
            color={colors.top}
            emissive={colors.top}
            emissiveIntensity={0.3}
            roughness={0.28}
          />
        </mesh>
      </Float>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.47, 48]} />
        <meshBasicMaterial
          color={selected ? "#0F766E" : colors.body}
          transparent
          opacity={selected ? 0.85 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {selected ? (
        <pointLight position={[0, height / 2, 0.6]} intensity={1.4} color={colors.body} distance={2.6} />
      ) : null}
    </group>
  );
}

function GardenBars({
  results,
  selectedId,
  onSelect,
}: {
  results: EligibilityResult[];
  selectedId: string | null;
  onSelect: (schemeId: string) => void;
}) {
  const maxBenefit = Math.max(...results.map((result) => result.benefit_amount_per_year), 1);
  return (
    <div className="flex h-full w-full items-end justify-center gap-1.5 px-4 pb-6 pt-8 sm:gap-3 sm:px-8">
      {results.map((result) => {
        const colors = STATUS_COLORS[result.status];
        const height = 22 + (result.benefit_amount_per_year / maxBenefit) * 62;
        const selected = selectedId === result.scheme_id;
        return (
          <button
            key={result.scheme_id}
            type="button"
            onClick={() => onSelect(result.scheme_id)}
            aria-pressed={selected}
            aria-label={result.scheme_name}
            className={cn(
              "group flex h-full max-w-[5rem] flex-1 flex-col items-center justify-end gap-1.5 rounded-2xl px-1 pb-1 pt-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30",
              selected ? "bg-white/60 shadow-sm" : "hover:bg-white/35",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 rounded-full shadow-sm transition-transform",
                selected && "scale-125",
              )}
              style={{ backgroundColor: colors.top }}
              aria-hidden="true"
            />
            <div
              className={cn(
                "w-full rounded-t-2xl rounded-b-md opacity-95 shadow-[0_14px_30px_rgba(11,27,58,0.12)] transition-all",
                selected && "ring-2 ring-navy/15",
              )}
              style={{ height: `${height}%`, backgroundColor: colors.body }}
              aria-hidden="true"
            />
            <span
              className={cn(
                "line-clamp-2 w-full text-center font-heading text-[0.58rem] font-semibold leading-tight",
                selected ? "text-navy" : "text-navy-soft/75",
              )}
            >
              {result.short_name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ResultsGarden({
  results,
  selectedId,
  onSelect,
  animated,
}: Omit<ResultsSceneProps, "className"> & { animated: boolean }) {
  const maxBenefit = Math.max(...results.map((result) => result.benefit_amount_per_year), 1);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.47, 0]}>
        <circleGeometry args={[3.3, 72]} />
        <meshStandardMaterial color="#E8F5F0" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]}>
        <ringGeometry args={[2.5, 2.52, 80]} />
        <meshBasicMaterial color="#0F766E" transparent opacity={0.24} side={THREE.DoubleSide} />
      </mesh>
      {results.map((result, index) => (
        <ResultPillar
          key={result.scheme_id}
          result={result}
          index={index}
          total={results.length}
          maxBenefit={maxBenefit}
          selected={selectedId === result.scheme_id}
          onSelect={onSelect}
        />
      ))}
      <Sparkles
        count={26}
        scale={[6, 3.4, 3]}
        size={2.2}
        speed={animated ? 0.24 : 0}
        opacity={0.45}
        color="#F59E0B"
      />
      <Sparkles
        count={16}
        scale={[5, 2.8, 3]}
        size={1.8}
        speed={animated ? 0.18 : 0}
        opacity={0.35}
        color="#5EEAD4"
      />
    </group>
  );
}

export function ResultsScene({ results, selectedId, onSelect, className }: ResultsSceneProps) {
  const { t } = useTranslation();

  if (!results.length) return null;

  return (
    <SceneFrame
      className={cn("min-h-[21rem]", className)}
      label={t("results.sceneHint")}
      fallback={
        <GardenBars results={results} selectedId={selectedId} onSelect={onSelect} />
      }
      cameraPosition={[0, 0.6, 6.6]}
      fov={40}
    >
      {(animated) => (
        <ResultsGarden
          results={results}
          selectedId={selectedId}
          onSelect={onSelect}
          animated={animated}
        />
      )}
    </SceneFrame>
  );
}
