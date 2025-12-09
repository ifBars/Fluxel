import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Mesh, Vector2, Vector3 } from "three";
import { useSettingsStore, AccentColor } from "@/stores/useSettingsStore";

// Map accent colors to RGB values based on OKLCH hues in index.css
const accentColorMap: Record<AccentColor, [number, number, number]> = {
    orange: [0.976, 0.451, 0.086],   // hue 50 - #f97316
    blue: [0.22, 0.52, 0.95],      // hue 240
    green: [0.16, 0.82, 0.42],      // hue 140
    purple: [0.68, 0.35, 0.92],      // hue 280
    red: [0.92, 0.26, 0.28],      // hue 25
};

interface NeonGooMeshProps {
    mouse: Vector2;
    accentColor: AccentColor;
}

const NeonGooMesh = ({ mouse, accentColor }: NeonGooMeshProps) => {
    const meshRef = useRef<Mesh>(null);
    const { size } = useThree();

    // Get RGB values for current accent
    const colorRGB = accentColorMap[accentColor];

    const uniforms = useMemo(
        () => ({
            u_time: { value: 0 },
            u_mouse: { value: new Vector2(0.5, 0.5) },
            u_resolution: { value: new Vector2(size.width, size.height) },
            u_accent: { value: new Vector3(colorRGB[0], colorRGB[1], colorRGB[2]) },
        }),
        []
    );

    // Update accent color uniform when it changes
    useEffect(() => {
        const rgb = accentColorMap[accentColor];
        uniforms.u_accent.value.set(rgb[0], rgb[1], rgb[2]);
    }, [accentColor, uniforms]);

    useEffect(() => {
        uniforms.u_resolution.value.set(size.width, size.height);
    }, [size, uniforms]);

    useFrame((state) => {
        if (meshRef.current) {
            const material = meshRef.current.material as any;
            material.uniforms.u_time.value = state.clock.getElapsedTime();
            material.uniforms.u_mouse.value.lerp(mouse, 0.05);
        }
    });

    const vertexShader = `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform vec2 u_resolution;
        uniform vec3 u_accent;
        varying vec2 vUv;

        // Simplex 2D noise
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                               -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                dot(x12.zw,x12.zw)), 0.0);
            m = m*m;
            m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        // Metaball function - returns field strength
        float metaball(vec2 p, vec2 center, float radius) {
            float d = distance(p, center);
            return (radius * radius) / (d * d + 0.001);
        }

        void main() {
            vec2 uv = vUv;
            float aspect = u_resolution.x / u_resolution.y;
            uv.x *= aspect;
            
            float t = u_time * 0.4;
            
            // Blob centers with organic motion using noise
            vec2 center1 = vec2(
                0.3 * aspect + 0.2 * sin(t * 0.7) + 0.1 * snoise(vec2(t * 0.3, 0.0)),
                0.5 + 0.25 * cos(t * 0.5) + 0.1 * snoise(vec2(0.0, t * 0.4))
            );
            vec2 center2 = vec2(
                0.6 * aspect + 0.15 * cos(t * 0.6 + 1.0) + 0.1 * snoise(vec2(t * 0.25, 1.0)),
                0.4 + 0.2 * sin(t * 0.8 + 2.0) + 0.1 * snoise(vec2(1.0, t * 0.35))
            );
            vec2 center3 = vec2(
                0.45 * aspect + 0.18 * sin(t * 0.9 + 3.0) + 0.12 * snoise(vec2(t * 0.2, 2.0)),
                0.65 + 0.22 * cos(t * 0.4 + 1.5) + 0.1 * snoise(vec2(2.0, t * 0.3))
            );
            vec2 center4 = vec2(
                0.7 * aspect + 0.12 * cos(t * 0.5 + 4.0) + 0.08 * snoise(vec2(t * 0.35, 3.0)),
                0.3 + 0.18 * sin(t * 0.65 + 0.8) + 0.1 * snoise(vec2(3.0, t * 0.25))
            );
            vec2 center5 = vec2(
                0.2 * aspect + 0.15 * sin(t * 0.55 + 2.5) + 0.1 * snoise(vec2(t * 0.4, 4.0)),
                0.7 + 0.15 * cos(t * 0.75 + 3.2) + 0.08 * snoise(vec2(4.0, t * 0.45))
            );
            
            // Mouse influence - subtle repulsion from blobs
            vec2 mousePos = u_mouse;
            mousePos.x *= aspect;
            
            float mouseInfluence1 = smoothstep(0.4, 0.0, distance(center1, mousePos));
            float mouseInfluence2 = smoothstep(0.4, 0.0, distance(center2, mousePos));
            float mouseInfluence3 = smoothstep(0.4, 0.0, distance(center3, mousePos));
            
            center1 += (center1 - mousePos) * mouseInfluence1 * 0.15;
            center2 += (center2 - mousePos) * mouseInfluence2 * 0.15;
            center3 += (center3 - mousePos) * mouseInfluence3 * 0.15;
            
            // Calculate combined metaball field with varying radii
            float r1 = 0.12 + 0.02 * sin(t * 1.2);
            float r2 = 0.10 + 0.015 * cos(t * 0.9 + 1.0);
            float r3 = 0.14 + 0.025 * sin(t * 0.7 + 2.0);
            float r4 = 0.08 + 0.01 * cos(t * 1.1 + 1.5);
            float r5 = 0.09 + 0.015 * sin(t * 0.8 + 0.5);
            
            float field = 0.0;
            field += metaball(uv, center1, r1);
            field += metaball(uv, center2, r2);
            field += metaball(uv, center3, r3);
            field += metaball(uv, center4, r4);
            field += metaball(uv, center5, r5);
            
            // Color palette based on accent
            vec3 neonCore = u_accent;
            vec3 neonGlow = u_accent * 0.7 + vec3(0.1);
            vec3 neonOuter = u_accent * 0.3;
            vec3 background = vec3(0.02, 0.02, 0.03);
            
            // Multi-layered glow effect
            float threshold = 1.0;
            
            // Core (brightest, inside the blob)
            float core = smoothstep(threshold * 0.8, threshold * 2.0, field);
            
            // Inner glow
            float innerGlow = smoothstep(threshold * 0.3, threshold * 1.2, field);
            
            // Outer glow (wide, faint)
            float outerGlow = smoothstep(threshold * 0.1, threshold * 0.5, field);
            
            // Subtle ambient glow
            float ambientGlow = smoothstep(0.0, threshold * 0.2, field);
            
            // Compose final color
            vec3 color = background;
            
            // Add ambient neon haze
            color = mix(color, neonOuter * 0.15, ambientGlow * 0.5);
            
            // Add outer glow
            color = mix(color, neonOuter * 0.4, outerGlow * 0.6);
            
            // Add inner glow
            color = mix(color, neonGlow * 0.8, innerGlow * 0.7);
            
            // Add bright core
            color = mix(color, neonCore * 1.2, core);
            
            // Add subtle surface shimmer
            float shimmer = snoise(uv * 8.0 + t * 0.5) * 0.5 + 0.5;
            color += neonOuter * shimmer * innerGlow * 0.1;
            
            // Vignette for depth
            float vignette = 1.0 - smoothstep(0.3, 1.2, length(vUv - 0.5) * 1.3);
            color *= vignette * 0.85 + 0.15;
            
            // Slight bloom/HDR effect on bright areas
            float brightness = dot(color, vec3(0.299, 0.587, 0.114));
            color += color * smoothstep(0.6, 1.0, brightness) * 0.3;
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[2, 2, 1, 1]} />
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
            />
        </mesh>
    );
};

export const AuthShader = () => {
    const [mouse, setMouse] = useState(new Vector2(0.5, 0.5));
    const containerRef = useRef<HTMLDivElement>(null);
    const accentColor = useSettingsStore((state) => state.accentColor);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1.0 - (e.clientY - rect.top) / rect.height;
            setMouse(new Vector2(x, y));
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener("mousemove", handleMouseMove);
            return () => container.removeEventListener("mousemove", handleMouseMove);
        }
    }, [handleMouseMove]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden bg-background"
        >
            <Canvas
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                }}
                orthographic
                camera={{ zoom: 1, position: [0, 0, 1], left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 10 }}
            >
                <NeonGooMesh mouse={mouse} accentColor={accentColor} />
            </Canvas>
        </div>
    );
};
