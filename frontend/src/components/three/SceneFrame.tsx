import { Component, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";

import { isWebGLAvailable } from "@/lib/capabilities";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";

interface SceneErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("Sahayak 3D scene fell back to 2D:", error.message, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface SceneFrameProps {
  children: (animated: boolean) => ReactNode;
  fallback: ReactNode;
  label: string;
  className?: string;
  cameraPosition?: [number, number, number];
  fov?: number;
}

/**
 * Shared WebGL guard for every garden scene.
 *
 * Uses the 2D illustration on small screens, when WebGL is unavailable, and
 * inside an error boundary. Reduced-motion users still get the static 3D
 * composition, but without animation.
 */
export function SceneFrame({
  children,
  fallback,
  label,
  className,
  cameraPosition = [0, 1.1, 6.8],
  fov = 42,
}: SceneFrameProps) {
  const [webgl] = useState(isWebGLAvailable);
  const isMobile = useIsMobile();
  const prefersReduced = usePrefersReducedMotion();
  const storeReduced = useAppStore((state) => state.reduceMotion);
  const animated = !prefersReduced && !storeReduced;

  if (!webgl || isMobile) {
    return (
      <div className={cn("relative h-full w-full", className)} role="img" aria-label={label}>
        {fallback}
      </div>
    );
  }

  return (
    <SceneErrorBoundary fallback={fallback}>
      <div className={cn("relative h-full w-full", className)} role="img" aria-label={label}>
        <div aria-hidden="true" className="absolute inset-0">
          <Canvas
            camera={{ position: cameraPosition, fov }}
            dpr={[1, 1.65]}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            frameloop={animated ? "always" : "demand"}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[4, 6, 4]} intensity={2.2} color="#fff7e6" />
            <directionalLight position={[-4, 2, -3]} intensity={1.2} color="#bbf7ec" />
            <pointLight position={[0, 0.5, 2]} intensity={1.4} color="#fde68a" distance={7} />
            {children(animated)}
          </Canvas>
        </div>
      </div>
    </SceneErrorBoundary>
  );
}
