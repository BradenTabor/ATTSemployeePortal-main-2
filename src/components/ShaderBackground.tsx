import React, { FC, useEffect, useRef, useState } from "react";

let FiberCanvas: any = null;
let DreiPlane: any = null;
let THREE: any = null;
let useFrame: any = null;
let useThree: any = null;

try {
  const fiber = require("@react-three/fiber");
  const drei = require("@react-three/drei");
  FiberCanvas = fiber.Canvas;
  useFrame = fiber.useFrame;
  useThree = fiber.useThree;
  DreiPlane = drei.Plane;
  THREE = require("three");
} catch (err) {
  console.warn("Three.js modules not loaded:", err);
}

export const ShaderBackground: FC = () => {
  const [webglAvailable, setWebglAvailable] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setWebglAvailable(!!gl);
    } catch {
      setWebglAvailable(false);
    }
  }, []);

  if (!webglAvailable || !FiberCanvas || !DreiPlane || !THREE || !useFrame || !useThree) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-neutral-950 animate-gradient">
        <style>{`
          @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient {
            background-size: 200% 200%;
            animation: gradient 12s ease infinite;
          }
        `}</style>
      </div>
    );
  }

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
    uniform vec2 u_res;
    varying vec2 vUv;
    void main() {
      vec2 uv = (vUv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
      float dist = length(uv - (u_mouse - 0.5) * 1.5);
      float pulse = sin(u_time * 0.5) * 0.5 + 0.5;
      float ring = smoothstep(0.3 + pulse * 0.1, 0.28 + pulse * 0.1, dist);
      vec3 color = mix(vec3(0.0, 0.1, 0.0), vec3(0.0, 0.8, 0.4), ring);
      color += 0.1 * vec3(0.2, 1.0, 0.2) * (1.0 - dist);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const ShaderPlane = () => {
    const { viewport } = useThree();
    const matRef = useRef<any>(null);
    const mouse = useRef([0.5, 0.5]);

    useEffect(() => {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        let x = 0.5, y = 0.5;
        if ("touches" in e && e.touches[0]) {
          x = e.touches[0].clientX / window.innerWidth;
          y = 1.0 - e.touches[0].clientY / window.innerHeight;
        } else if ("clientX" in e) {
          x = e.clientX / window.innerWidth;
          y = 1.0 - e.clientY / window.innerHeight;
        }
        mouse.current = [x, y];
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove);
      return () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("touchmove", handleMove);
      };
    }, []);

    useFrame(({ clock }: any) => {
      if (matRef.current) {
        matRef.current.uniforms.u_time.value = clock.getElapsedTime();
        matRef.current.uniforms.u_mouse.value = new THREE.Vector2(mouse.current[0], mouse.current[1]);
      }
    });

    return (
      <DreiPlane args={[1, 1]} scale={[viewport.width, viewport.height, 1]}>
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            u_time: { value: 0 },
            u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
            u_res: { value: new THREE.Vector2(viewport.width, viewport.height) },
          }}
          transparent
        />
      </DreiPlane>
    );
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <FiberCanvas camera={{ position: [0, 0, 3], fov: 60 }} dpr={1.5}>
        <ShaderPlane />
      </FiberCanvas>
    </div>
  );
};
