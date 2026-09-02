import { useEffect, useRef } from "react";
import { getDeviceCapabilities } from "@/lib/mobilePerf";

/**
 * UnderstoryGL — the WebGL2 half of the CANOPY atmosphere. Lazy-loaded by
 * `Understory` so the shader source never lands in the main bundle.
 *
 * Domain-warped fbm paints bioluminescent light filtering through a dark
 * canopy; god-rays fall from a gap at the top-left; the whole field leans
 * gently toward the pointer. Renders at reduced resolution (noise is smooth,
 * upscaling is invisible), is frame-capped on mobile, and pauses when hidden.
 */

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_intensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.02 + 3.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv; p.x *= u_res.x / u_res.y;
  float t = u_time * 0.045;

  p += (u_mouse - 0.5) * 0.12;

  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(fbm(p * 1.6 + 3.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                fbm(p * 1.6 + 3.0 * q + vec2(8.3, 2.8) + 0.126 * t));
  float f = fbm(p * 1.6 + 3.2 * r);

  vec3 ink     = vec3(0.016, 0.024, 0.020);
  vec3 moss    = vec3(0.039, 0.165, 0.098);
  vec3 verdant = vec3(0.239, 0.863, 0.518);
  vec3 lime    = vec3(0.722, 1.000, 0.478);

  float depth = smoothstep(0.15, 0.95, f);
  vec3 col = mix(ink, moss, depth * 0.9);
  col = mix(col, verdant, pow(depth, 3.2) * 0.42);
  col = mix(col, lime, pow(clamp(length(r) * 0.9, 0.0, 1.0), 9.0) * 0.16);

  vec2 light = vec2(-0.15, 1.25) + (u_mouse - 0.5) * 0.25;
  vec2 d = p - light;
  float ang = atan(d.y, d.x);
  float rays = pow(max(0.0, sin(ang * 14.0 + t * 2.0) * 0.5 + sin(ang * 23.0 - t * 1.3) * 0.5), 6.0);
  float dist = length(d);
  float rayMask = smoothstep(2.4, 0.2, dist) * smoothstep(0.0, 0.6, uv.y);
  col += verdant * rays * rayMask * 0.14 * u_intensity;

  col *= mix(0.55, 1.0, smoothstep(0.0, 0.7, uv.y));
  vec2 vg = uv * (1.0 - uv);
  col *= pow(vg.x * vg.y * 18.0, 0.22);

  col += (hash(gl_FragCoord.xy + u_time) - 0.5) / 255.0;

  outColor = vec4(col, 1.0);
}
`;

interface UnderstoryGLProps {
  intensity: number;
  /** Called if WebGL2 is unavailable or shader compilation fails */
  onUnsupported: () => void;
}

export default function UnderstoryGL({ intensity, onUnsupported }: UnderstoryGLProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const caps = getDeviceCapabilities();
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    // Some environments (jsdom, canvas mocks, headless drivers) hand back a
    // context object that is missing the real API surface.
    if (!gl || typeof gl.createShader !== "function" || typeof gl.createProgram !== "function") {
      onUnsupported();
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let prog: WebGLProgram | null = null;
    try {
      vs = compile(gl.VERTEX_SHADER, VERT);
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
      prog = vs && fs ? gl.createProgram() : null;
      if (!vs || !fs || !prog) {
        onUnsupported();
        return;
      }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        onUnsupported();
        return;
      }
    } catch {
      onUnsupported();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uIntensity = gl.getUniformLocation(prog, "u_intensity");

    // The field drifts very slowly (t scales at 0.045), so 24 fps on phones is
    // visually identical to 30 while giving translucent/backdrop-blur layers
    // above the canvas 20% fewer recomposites per second (battery + thermals).
    const scale = caps.isMobile ? 0.4 : 0.55;
    const frameInterval = caps.isMobile ? 1000 / 24 : 1000 / 60;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    };
    if (!caps.isMobile) window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let last = 0;
    let running = true;
    const start = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < frameInterval) return;
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uIntensity, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [intensity, onUnsupported]);

  return <canvas ref={canvasRef} className="h-full w-full animate-[fadeIn_1.4s_ease-out_both]" />;
}
