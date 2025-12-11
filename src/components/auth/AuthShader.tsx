import { useRef, useMemo, useEffect, useState, useCallback, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Mesh, Vector2, Vector3 } from "three";
import { useSettingsStore, AccentColor, Theme } from "@/stores/useSettingsStore";

// Map accent colors to RGB values based on OKLCH hues in index.css
const accentColorMap: Record<AccentColor, [number, number, number]> = {
    orange: [0.976, 0.451, 0.086],   // hue 50 - #f97316
    blue: [0.22, 0.52, 0.95],      // hue 240
    green: [0.16, 0.82, 0.42],      // hue 140
    purple: [0.68, 0.35, 0.92],      // hue 280
    red: [0.92, 0.26, 0.28],      // hue 25
};

const backgroundColorMap: Record<Theme, [number, number, number]> = {
    dark: [0.01, 0.01, 0.02],   // near black
    light: [0.96, 0.97, 0.99],  // soft light neutral
};

// Pre-define shaders outside component for better performance
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
    uniform vec3 u_background;
    varying vec2 vUv;

    #define MAX_STEPS 80
    #define MAX_DIST 20.0
    #define SURF_DIST 0.001
    #define PI 3.14159265359

    // Smooth minimum function for blob blending
    float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }

    // Sphere SDF
    float sdSphere(vec3 p, float r) {
        return length(p) - r;
    }

    // Scene SDF - multiple blob spheres
    float GetDist(vec3 p, float t) {
        float mouseInfluence = length(vec2(u_mouse.x - 0.5, u_mouse.y - 0.5)) * 2.0;

        // Multiple blob spheres with organic movement
        vec3 blob1 = vec3(
            sin(t * 0.5) * 2.0,
            cos(t * 0.4) * 1.5,
            sin(t * 0.3 + 1.0) * 1.0 + 5.0
        );

        vec3 blob2 = vec3(
            cos(t * 0.6 + 2.0) * 1.8,
            sin(t * 0.35 + 1.5) * 1.8,
            cos(t * 0.45) * 1.2 + 5.5
        );

        vec3 blob3 = vec3(
            sin(t * 0.45 + 4.0) * 1.5,
            cos(t * 0.55 + 3.0) * 1.3,
            sin(t * 0.5 + 2.5) * 0.8 + 4.5
        );

        vec3 blob4 = vec3(
            cos(t * 0.4 + 1.5) * 2.2,
            sin(t * 0.48 + 0.5) * 1.6,
            cos(t * 0.38 + 3.5) * 1.3 + 6.0
        );

        // Mouse interaction - push blobs away
        vec3 mouseOffset = vec3((u_mouse.x - 0.5) * 4.0, (u_mouse.y - 0.5) * 4.0, 0.0);
        blob1 -= mouseOffset * mouseInfluence * 0.3;
        blob2 -= mouseOffset * mouseInfluence * 0.25;
        blob3 -= mouseOffset * mouseInfluence * 0.2;

        // Calculate distances with varying sizes
        float d1 = sdSphere(p - blob1, 1.2 + sin(t * 1.1) * 0.2);
        float d2 = sdSphere(p - blob2, 1.0 + cos(t * 0.9) * 0.15);
        float d3 = sdSphere(p - blob3, 1.4 + sin(t * 1.3 + 1.0) * 0.25);
        float d4 = sdSphere(p - blob4, 0.9 + cos(t * 0.85 + 2.0) * 0.18);

        // Smooth blend all blobs
        float d = smin(d1, d2, 0.8);
        d = smin(d, d3, 0.8);
        d = smin(d, d4, 0.8);

        return d;
    }

    // Raymarch function
    float RayMarch(vec3 ro, vec3 rd, float t) {
        float dO = 0.0;

        for(int i = 0; i < MAX_STEPS; i++) {
            vec3 p = ro + rd * dO;
            float dS = GetDist(p, t);
            dO += dS;
            if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
        }

        return dO;
    }

    // Calculate normal for lighting
    vec3 GetNormal(vec3 p, float t) {
        float d = GetDist(p, t);
        vec2 e = vec2(0.001, 0.0);

        vec3 n = d - vec3(
            GetDist(p - e.xyy, t),
            GetDist(p - e.yxy, t),
            GetDist(p - e.yyx, t)
        );

        return normalize(n);
    }

    void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.6;

        // Camera setup
        vec3 ro = vec3(0.0, 0.0, 0.0); // Ray origin (camera position)
        vec3 rd = normalize(vec3(uv.x, uv.y, 1.5)); // Ray direction

        // Raymarch
        float d = RayMarch(ro, rd, t);

        // Background color - dark retro palette
        vec3 bgColor = u_background;
        vec3 color = bgColor;

        if(d < MAX_DIST) {
            vec3 p = ro + rd * d;
            vec3 n = GetNormal(p, t);

            // Retro lighting setup
            vec3 lightPos = vec3(3.0, 4.0, 1.0);
            vec3 lightDir = normalize(lightPos - p);

            // Diffuse lighting
            float diff = max(dot(n, lightDir), 0.0);

            // Rim lighting for retro effect
            float rim = 1.0 - max(dot(n, -rd), 0.0);
            rim = pow(rim, 3.0);

            // Fresnel-like effect
            float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);

            // Retro color palette using accent color
            vec3 baseColor = u_accent * 0.6;
            vec3 highlightColor = u_accent * 1.2;
            vec3 rimColor = u_accent * 1.5;

            // Combine lighting
            color = baseColor * diff;
            color += highlightColor * fresnel * 0.6;
            color += rimColor * rim * 0.8;

            // Add some ambient
            color += u_accent * 0.15;

            // Depth-based fog
            float fog = smoothstep(4.0, MAX_DIST, d);
            color = mix(color, bgColor, fog);

            // Retro banding effect (posterization)
            color = floor(color * 8.0) / 8.0;

        } else {
            // Background gradient
            float grad = length(uv) * 0.3;
            color = mix(bgColor, u_accent * 0.05, grad);
        }

        // Vignette
        float vignette = 1.0 - length(vUv - 0.5) * 0.8;
        vignette = smoothstep(0.3, 1.0, vignette);
        color *= vignette;

        gl_FragColor = vec4(color, 1.0);
    }
`;

interface NeonGooMeshProps {
    mouse: Vector2;
    accentColor: AccentColor;
    theme: Theme;
}

const NeonGooMesh = memo(({ mouse, accentColor, theme }: NeonGooMeshProps) => {
    const meshRef = useRef<Mesh>(null);
    const { size } = useThree();

    // Get RGB values for current accent
    const colorRGB = accentColorMap[accentColor];
    const backgroundRGB = backgroundColorMap[theme];

    const uniforms = useMemo(
        () => ({
            u_time: { value: 0 },
            u_mouse: { value: new Vector2(0.5, 0.5) },
            u_resolution: { value: new Vector2(size.width, size.height) },
            u_accent: { value: new Vector3(colorRGB[0], colorRGB[1], colorRGB[2]) },
            u_background: { value: new Vector3(backgroundRGB[0], backgroundRGB[1], backgroundRGB[2]) },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // Update accent color uniform when it changes
    useEffect(() => {
        const rgb = accentColorMap[accentColor];
        uniforms.u_accent.value.set(rgb[0], rgb[1], rgb[2]);
    }, [accentColor, uniforms]);

    // Update background color when theme changes
    useEffect(() => {
        const rgb = backgroundColorMap[theme];
        uniforms.u_background.value.set(rgb[0], rgb[1], rgb[2]);
    }, [theme, uniforms]);

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
});

export const AuthShader = () => {
    const [mouse, setMouse] = useState(new Vector2(0.5, 0.5));
    const [isReady, setIsReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const accentColor = useSettingsStore((state) => state.accentColor);
    const theme = useSettingsStore((state) => state.theme);
    const backgroundColor = theme === "dark" ? "#050506" : "#f4f5f7";

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

    // Set ready state after a short delay to allow canvas to initialize
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden"
            style={{ backgroundColor }}
        >
            {/* Fallback background - matches shader's background color */}
            <div className="absolute inset-0" style={{ backgroundColor }} />

            <Canvas
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: isReady ? 1 : 0,
                    transition: "opacity 0.3s ease-in",
                }}
                orthographic
                camera={{ zoom: 1, position: [0, 0, 1], left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 10 }}
                gl={{
                    antialias: false, // Disable antialiasing for better performance
                    powerPreference: "high-performance",
                    alpha: false,
                }}
                dpr={Math.min(window.devicePixelRatio, 2)} // Cap pixel ratio for performance
            >
                <NeonGooMesh mouse={mouse} accentColor={accentColor} theme={theme} />
            </Canvas>
        </div>
    );
};
