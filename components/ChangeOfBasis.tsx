"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import * as math from "mathjs";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vec2 = [number, number];
type Mat2 = [[number, number], [number, number]];

// ─── Math ─────────────────────────────────────────────────────────────────────
const inv2   = (m: Mat2): Mat2    => math.inv(m as number[][]) as Mat2;
const mv     = (m: Mat2, v: Vec2) => math.multiply(m as number[][], v as number[]) as Vec2;
const mm     = (a: Mat2, b: Mat2) => math.multiply(a as number[][], b as number[][]) as Mat2;
const f2     = (n: number)        => (Math.round(n * 100) / 100).toFixed(2);
const fv     = (v: Vec2)          => `[${f2(v[0])}, ${f2(v[1])}]`;
const rotMat = (deg: number): Mat2 => {
  const r = deg * Math.PI / 180;
  return [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]];
};

// ─── Minecraft character pixel sprites (8×16 front-facing) ───────────────────
// Palette keys: 0=transparent, then hex color
const STEVE_PAL = ['','#3B2A1A','#C68642','#1A1A1A','#3C5AA6','#7B5535','#8B6914','#5C8526'];
const STEVE_MAP = [
  '0555550000000000', // hair top
  '5112111500000000', // hair + face
  '5133131500000000', // eyes
  '5111111500000000', // face
  '5116111500000000', // mouth / stubble
  '5111111500000000',
  '0444444400000000', // shirt
  '0444444400000000',
];

const ALEX_PAL  = ['','#E87722','#C68642','#1A1A1A','#2E8B57','#B85C0A','#8B6914'];
const ALEX_MAP  = [
  '1111115500000000', // orange hair
  '1211111500000000',
  '1323131500000000', // eyes
  '1211111500000000',
  '1211111500000000',
  '1111111500000000',
  '0444444400000000', // teal shirt
  '0444444400000000',
];

function CharacterSprite({ map, pal, px = 6, label, color }: {
  map: string[]; pal: string[]; px?: number; label: string; color: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 8 * px, H = map.length * px;
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    map.forEach((row, r) => {
      for (let c = 0; c < 8; c++) {
        const idx = parseInt(row[c]);
        if (!idx) continue;
        ctx.fillStyle = pal[idx];
        ctx.fillRect(c * px, r * px, px, px);
      }
    });
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={ref} width={W} height={H} style={{ imageRendering: 'pixelated' }} />
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const CLR = {
  steve:   "#7dd3fc",
  alex:    "#f0abfc",
  enchant: "#fbbf24",  // amber — rotation M
  result:  "#86efac",
  bg:      "#050510",
};
const C3 = (hex: string) => new THREE.Color(hex);

// ─── Chapters ─────────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    color: CLR.steve,
    label: "The World",
    title: "Imagine you're in Minecraft",
    body: "The Overworld has a standard coordinate system. Steve's map shows every block as (x, y): East is +x, North is +y. This is the standard basis — the one you're used to from math class.",
  },
  {
    color: CLR.alex,
    label: "Alex's Map",
    title: "Alex spawned in The Nether — different map",
    body: "Alex's coordinate system is rotated and scaled differently. Her \"East\" (b₁) and her \"North\" (b₂) point in different directions than Steve's. Same world — completely different map grid.",
  },
  {
    color: CLR.steve,
    label: "Same Block, Two Descriptions",
    title: "Diamond ore at position v",
    body: "There's a diamond ore at a specific location. Steve describes it as v on his map. Alex describes the EXACT SAME block on hers. Different numbers, same real-world block.",
  },
  {
    color: CLR.enchant,
    label: "Steve Rotates the Vector",
    title: "Steve rotates v toward Alex's direction",
    body: "Steve applies rotation M to the ore — it moves from v to M·v on his map. That's straightforward for Steve, because M is written in his coordinates. But Alex sees the same physical move and her numbers look completely different.",
  },
  {
    color: CLR.result,
    label: "Alex's Coordinates",
    title: "B⁻¹ · M · B — same rotation, Alex's numbers",
    body: "To rotate in Alex's coordinate system, you can't just use M directly. You need M_B = B⁻¹·M·B: convert from Alex's coords to Steve's (×B), apply the rotation (×M), convert back (×B⁻¹). Both POVs show the same physical result.",
  },
];

// ─── Arrow helper ─────────────────────────────────────────────────────────────
function makeArrow(dir2: Vec2, color: string, opacity = 1): THREE.Group {
  const group = new THREE.Group();
  const len = Math.hypot(dir2[0], dir2[1]);
  if (len < 0.05) return group;

  const dir3 = new THREE.Vector3(dir2[0], 0, -dir2[1]).normalize();
  const mat = new THREE.MeshStandardMaterial({ color: C3(color), emissive: C3(color), emissiveIntensity: 0.6, transparent: true, opacity });

  // Shaft
  const shaftLen = Math.max(0, len - 0.25);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, shaftLen, 8), mat);
  shaft.position.copy(dir3.clone().multiplyScalar(shaftLen / 2));
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir3);
  group.add(shaft);

  // Head
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), mat);
  head.position.copy(dir3.clone().multiplyScalar(len - 0.12));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir3);
  group.add(head);

  return group;
}

function makeDashedLine(from2: Vec2, to2: Vec2, color: string): THREE.Line {
  const points = [
    new THREE.Vector3(from2[0], 0.02, -from2[1]),
    new THREE.Vector3(to2[0],   0.02, -to2[1]),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({ color: C3(color), dashSize: 0.2, gapSize: 0.15, opacity: 0.5, transparent: true });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

// ─── Build scene objects ───────────────────────────────────────────────────────
function buildScene(
  v: Vec2, b1: Vec2, b2: Vec2, B: Mat2, Binv: Mat2, M: Mat2,
  chapterIdx: number,
): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = C3(CLR.bg);
  scene.fog = new THREE.Fog(CLR.bg, 18, 32);

  // Ambient + directional lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(4, 8, 4);
  scene.add(dir);

  // ── Steve's floor grid ──
  const gridHelper = new THREE.GridHelper(16, 16, 0x1c1c44, 0x0e0e25);
  scene.add(gridHelper);

  // ── Alex's basis grid (faint pink lines on the floor) ──
  if (chapterIdx >= 1) {
    const alexGrid = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: C3(CLR.alex), transparent: true, opacity: 0.18 });
    for (let i = -8; i <= 8; i++) {
      const addLine = (ax: number, ay: number, bx: number, by: number) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax, 0.01, -ay),
          new THREE.Vector3(bx, 0.01, -by),
        ]);
        alexGrid.add(new THREE.Line(geo, lineMat));
      };
      addLine(i*b1[0]-8*b2[0], i*b1[1]-8*b2[1], i*b1[0]+8*b2[0], i*b1[1]+8*b2[1]);
      addLine(i*b2[0]-8*b1[0], i*b2[1]-8*b1[1], i*b2[0]+8*b1[0], i*b2[1]+8*b1[1]);
    }
    scene.add(alexGrid);

    // Alex's basis arrows
    scene.add(makeArrow(b1, CLR.alex, 0.9));
    scene.add(makeArrow(b2, CLR.alex, 0.9));

    // b₁ / b₂ labels as small spheres at tips
    const dotGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const b1dot = new THREE.Mesh(dotGeo, new THREE.MeshStandardMaterial({ color: C3(CLR.alex), emissive: C3(CLR.alex), emissiveIntensity: 1 }));
    b1dot.position.set(b1[0], 0.1, -b1[1]);
    scene.add(b1dot);
    const b2dot = new THREE.Mesh(dotGeo, new THREE.MeshStandardMaterial({ color: C3(CLR.alex), emissive: C3(CLR.alex), emissiveIntensity: 1 }));
    b2dot.position.set(b2[0], 0.1, -b2[1]);
    scene.add(b2dot);
  }

  // ── The vector v ──
  if (chapterIdx >= 2) {
    scene.add(makeArrow(v, CLR.steve, 1));

    // Decomposition parallelogram along Alex's axes
    const vInB = mv(Binv, v);
    const comp1: Vec2 = [vInB[0]*b1[0], vInB[0]*b1[1]];
    const comp2: Vec2 = [vInB[1]*b2[0], vInB[1]*b2[1]];
    scene.add(makeDashedLine([0,0], comp1, CLR.alex));
    scene.add(makeDashedLine([0,0], comp2, CLR.alex));
    scene.add(makeDashedLine(comp1, v,   CLR.alex));
    scene.add(makeDashedLine(comp2, v,   CLR.alex));

    // Diamond ore marker at v tip
    const oreGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const oreMat = new THREE.MeshStandardMaterial({ color: 0x44d9e8, emissive: 0x44d9e8, emissiveIntensity: 0.5 });
    const ore = new THREE.Mesh(oreGeo, oreMat);
    ore.position.set(v[0], 0.15, -v[1]);
    scene.add(ore);
  }

  // ── Enchantment M·v ──
  if (chapterIdx >= 3) {
    const Mv = mv(M, v);
    scene.add(makeArrow(Mv, CLR.enchant, 0.95));

    // Arc curve from v to Mv
    const vLen = Math.hypot(v[0], v[1]);
    const arcPoints: THREE.Vector3[] = [];
    const vAngle = Math.atan2(v[1], v[0]);
    const MvAngle = Math.atan2(Mv[1], Mv[0]);
    let dAngle = MvAngle - vAngle;
    if (dAngle > Math.PI) dAngle -= 2*Math.PI;
    if (dAngle < -Math.PI) dAngle += 2*Math.PI;
    for (let t = 0; t <= 1; t += 0.04) {
      const a = vAngle + dAngle * t;
      arcPoints.push(new THREE.Vector3(vLen*Math.cos(a), 0.08, -vLen*Math.sin(a)));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineDashedMaterial({ color: C3(CLR.enchant), dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.7 });
    const arc = new THREE.Line(arcGeo, arcMat);
    arc.computeLineDistances();
    scene.add(arc);

    // Ore at M·v
    const oreGeo2 = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const oreMat2 = new THREE.MeshStandardMaterial({ color: C3(CLR.enchant), emissive: C3(CLR.enchant), emissiveIntensity: 0.6 });
    const ore2 = new THREE.Mesh(oreGeo2, oreMat2);
    ore2.position.set(Mv[0], 0.15, -Mv[1]);
    scene.add(ore2);
  }

  // ── Result [Mv]_B decomposition (lime) ──
  if (chapterIdx >= 4) {
    const Mv = mv(M, v);
    const MvInB = mv(Binv, Mv);
    const rComp1: Vec2 = [MvInB[0]*b1[0], MvInB[0]*b1[1]];
    const rComp2: Vec2 = [MvInB[1]*b2[0], MvInB[1]*b2[1]];
    scene.add(makeDashedLine([0,0], rComp1, CLR.result));
    scene.add(makeDashedLine([0,0], rComp2, CLR.result));
    scene.add(makeDashedLine(rComp1, Mv, CLR.result));
    scene.add(makeDashedLine(rComp2, Mv, CLR.result));
  }

  return scene;
}

// ─── Camera positions ──────────────────────────────────────────────────────────
// Steve: top-down-ish, looking along standard axes
// Alex: tilted toward her basis orientation
function steveCamera(b1: Vec2): { pos: THREE.Vector3; target: THREE.Vector3 } {
  return {
    pos: new THREE.Vector3(0, 10, 6),
    target: new THREE.Vector3(0, 0, 0),
  };
}
function alexCamera(b1: Vec2): { pos: THREE.Vector3; target: THREE.Vector3 } {
  // Position camera looking FROM Alex's b1 direction
  const angle = Math.atan2(b1[1], b1[0]);
  const dist = 10;
  return {
    pos: new THREE.Vector3(Math.cos(angle) * dist * 0.6, 7, -Math.sin(angle) * dist * 0.6 + 4),
    target: new THREE.Vector3(0, 0, 0),
  };
}

// ─── Renderer hook ─────────────────────────────────────────────────────────────
function useThreeViewport(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getCameraPos: () => { pos: THREE.Vector3; target: THREE.Vector3 },
  scene: THREE.Scene | null,
) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef      = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    const { pos, target } = getCameraPos();
    camera.position.copy(pos);
    camera.lookAt(target);
    cameraRef.current = camera;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const obs = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    obs.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      obs.disconnect();
      renderer.dispose();
    };
  }, [scene]);

  // Update camera when getCameraPos changes
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { pos, target } = getCameraPos();
    cam.position.copy(pos);
    cam.lookAt(target);
  });
}

// ─── Slider / Chip UI ─────────────────────────────────────────────────────────
function Slider({ id, label, value, min, max, step, onChange, color }: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color: string;
}) {
  return (
    <div className="flex flex-col gap-1 mb-3 last:mb-0">
      <div className="flex justify-between text-xs font-mono">
        <span style={{ color }}>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" id={id} min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color, width: "100%" }}
        className="h-1.5 rounded-full cursor-pointer" />
    </div>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
      style={{ background: color + "18", border: `1px solid ${color}40`, color }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChangeOfBasis() {
  const steveCanvasRef = useRef<HTMLCanvasElement>(null);
  const alexCanvasRef  = useRef<HTMLCanvasElement>(null);

  const [chapterIdx, setChapterIdx]   = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [coordMode, setCoordMode]     = useState<"steve" | "alex">("steve");
  const [rawX, setRawX]               = useState(2);
  const [rawY, setRawY]               = useState(1);
  const [basisAngle, setBasisAngle]   = useState(45);
  const [b1Scale, setB1Scale]         = useState(1.5);
  const [b2Scale, setB2Scale]         = useState(1.2);
  const [basisShear, setBasisShear]   = useState(0);
  const [enchantAngle, setEnchantAngle] = useState(90);

  // Build basis
  const bRad = basisAngle * Math.PI / 180;
  const shRad = basisShear * Math.PI / 180;
  const b1: Vec2 = [b1Scale * Math.cos(bRad), b1Scale * Math.sin(bRad)];
  const b2: Vec2 = [
    b2Scale * (-Math.sin(bRad) + Math.sin(shRad) * Math.cos(bRad)),
    b2Scale * ( Math.cos(bRad) + Math.sin(shRad) * Math.sin(bRad)),
  ];
  const B: Mat2 = [[b1[0], b2[0]], [b1[1], b2[1]]];
  const detB = math.det(B as number[][]) as number;
  const singular = Math.abs(detB) < 1e-6;
  const M = rotMat(enchantAngle);

  let Binv: Mat2 | null = null;
  let v: Vec2 = [rawX, rawY];
  if (!singular) {
    try { Binv = inv2(B); } catch { /**/ }
  }
  if (coordMode === "alex" && Binv) v = mv(B, [rawX, rawY]);

  let vInB: Vec2 | null = null, MInB: Mat2 | null = null;
  let Mv: Vec2 | null = null, MvInB: Vec2 | null = null;
  if (Binv) {
    vInB  = mv(Binv, v);
    MInB  = mm(mm(Binv, M), B);
    Mv    = mv(M, v);
    MvInB = mv(Binv, Mv);
  }

  const chapter = CHAPTERS[chapterIdx];

  // Build scene (memoised on the things that matter)
  const scene = Binv ? buildScene(v, b1, b2, B, Binv, M, chapterIdx) : null;

  const getSteveCamera = useCallback(() => steveCamera(b1), [b1[0], b1[1]]);
  const getAlexCamera  = useCallback(() => alexCamera(b1),  [b1[0], b1[1]]);

  useThreeViewport(steveCanvasRef, getSteveCamera, scene);
  useThreeViewport(alexCanvasRef,  getAlexCamera,  scene);

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

      {/* Legend + chapter progress */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Chip color={CLR.steve}   label="Steve = standard" />
          <Chip color={CLR.alex}    label="Alex = her basis" />
          <Chip color={CLR.enchant} label="M = rotation" />
          <Chip color={CLR.result}  label="Result" />
        </div>
        <div className="flex items-center gap-2">
          {CHAPTERS.map((_, i) => (
            <button key={i} onClick={() => setChapterIdx(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === chapterIdx ? 28 : 8, height: 8,
                background: i === chapterIdx ? chapter.color : i < chapterIdx ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
              }} />
          ))}
          <span className="text-xs font-mono ml-1" style={{ color: "rgba(255,255,255,0.25)" }}>
            {chapterIdx + 1} / {CHAPTERS.length}
          </span>
        </div>
      </div>

      {/* ── Dual 3D viewports ── */}
      <div className="grid grid-cols-2 gap-3">
        {(["Steve", "Alex"] as const).map((who) => {
          const color    = who === "Steve" ? CLR.steve : CLR.alex;
          const canRef   = who === "Steve" ? steveCanvasRef : alexCanvasRef;
          const sprMap   = who === "Steve" ? STEVE_MAP : ALEX_MAP;
          const sprPal   = who === "Steve" ? STEVE_PAL : ALEX_PAL;
          return (
            <div key={who} className="relative rounded-2xl overflow-hidden"
              style={{ height: 380, border: `1px solid ${color}28` }}>
              {/* POV label */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(5,5,16,0.8)", border: `1px solid ${color}40` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="text-xs font-mono font-semibold" style={{ color }}>{who}'s POV</span>
              </div>
              {/* Character sprite bottom-right */}
              <div className="absolute bottom-3 right-3 z-10 p-2 rounded-lg"
                style={{ background: "rgba(5,5,16,0.75)", border: `1px solid ${color}30` }}>
                <CharacterSprite map={sprMap} pal={sprPal} px={5} label={who} color={color} />
              </div>
              <canvas ref={canRef} style={{ width: "100%", height: "100%" }} />
              {singular && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "rgba(255,50,50,0.15)" }}>
                  <span className="font-mono text-sm" style={{ color: "#ff5555" }}>Singular basis — adjust angle.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Chapter card + controls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

        {/* Chapter card */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: "#0d0d1f", border: `1px solid ${chapter.color}28` }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: chapter.color, boxShadow: `0 0 8px ${chapter.color}` }} />
            <span className="text-xs font-mono tracking-widest uppercase" style={{ color: chapter.color }}>
              Chapter {chapterIdx + 1} — {chapter.label}
            </span>
          </div>
          <h3 className="text-[1.15rem] font-semibold leading-snug" style={{ color: "rgba(255,255,255,0.93)" }}>
            {chapter.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
            {chapter.body}
          </p>

          {/* Live values */}
          {chapterIdx >= 1 && (
            <div className="rounded-xl p-3.5 flex flex-col gap-2 font-mono text-xs"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {chapterIdx >= 1 && (
                <div className="flex flex-col gap-1">
                  <span style={{ color: CLR.alex }}>b₁ = {fv(b1)}</span>
                  <span style={{ color: CLR.alex }}>b₂ = {fv(b2)}</span>
                </div>
              )}
              {chapterIdx >= 2 && vInB && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.steve }}>Steve: v = {fv(v)}</span>
                  <span style={{ color: CLR.alex }}>Alex: [v]_B = {fv(vInB)}</span>
                </div>
              )}
              {chapterIdx >= 3 && Mv && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.enchant }}>M·v = {fv(Mv)} (rotated {enchantAngle}°)</span>
                </div>
              )}
              {chapterIdx >= 4 && MvInB && MInB && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.result }}>[Mv]_B = {fv(MvInB)}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>
                    M_B = [{f2(MInB[0][0])}, {f2(MInB[0][1])}; {f2(MInB[1][0])}, {f2(MInB[1][1])}]
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="flex gap-3">
            <button onClick={() => setChapterIdx(i => Math.max(0, i - 1))} disabled={chapterIdx === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: chapterIdx === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                cursor: chapterIdx === 0 ? "not-allowed" : "pointer",
              }}>← Back</button>
            <button onClick={() => setChapterIdx(i => Math.min(CHAPTERS.length - 1, i + 1))}
              disabled={chapterIdx === CHAPTERS.length - 1}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: chapterIdx === CHAPTERS.length - 1 ? "rgba(255,255,255,0.04)" : `${chapter.color}20`,
                border: `1px solid ${chapterIdx === CHAPTERS.length - 1 ? "rgba(255,255,255,0.08)" : chapter.color + "50"}`,
                color: chapterIdx === CHAPTERS.length - 1 ? "rgba(255,255,255,0.15)" : chapter.color,
                cursor: chapterIdx === CHAPTERS.length - 1 ? "not-allowed" : "pointer",
                boxShadow: chapterIdx !== CHAPTERS.length - 1 ? `0 0 20px ${chapter.color}15` : "none",
              }}>Next →</button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowControls(v => !v)}
            className="rounded-xl py-2.5 text-xs font-mono tracking-wide transition-all"
            style={{
              background: showControls ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.35)",
            }}>
            {showControls ? "▲ hide controls" : "▼ adjust the vectors & basis"}
          </button>

          {showControls && (
            <div className="rounded-2xl p-4 flex flex-col gap-4"
              style={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-xs font-mono mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Enter vector in whose coordinates?</p>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(["steve", "alex"] as const).map(mode => (
                    <button key={mode} onClick={() => setCoordMode(mode)}
                      className="flex-1 py-2 text-xs font-mono transition-all"
                      style={{
                        background: coordMode === mode ? (mode === "steve" ? CLR.steve+"25" : CLR.alex+"25") : "rgba(0,0,0,0.3)",
                        color: coordMode === mode ? (mode === "steve" ? CLR.steve : CLR.alex) : "rgba(255,255,255,0.3)",
                        borderRight: mode === "steve" ? "1px solid rgba(255,255,255,0.1)" : "none",
                      }}>
                      {mode === "steve" ? "Steve's coords" : "Alex's coords"}
                    </button>
                  ))}
                </div>
              </div>

              <Slider id="rx" label={coordMode === "steve" ? "v.x" : "[v]_B.x"} value={rawX} min={-4} max={4} step={0.1} onChange={setRawX} color={coordMode === "steve" ? CLR.steve : CLR.alex} />
              <Slider id="ry" label={coordMode === "steve" ? "v.y" : "[v]_B.y"} value={rawY} min={-4} max={4} step={0.1} onChange={setRawY} color={coordMode === "steve" ? CLR.steve : CLR.alex} />

              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-mono mb-2" style={{ color: CLR.alex+"aa" }}>Alex's Basis B</p>
                <Slider id="ba"  label="Rotation (°)"  value={basisAngle}  min={-180} max={180} step={1}    onChange={setBasisAngle}  color={CLR.alex} />
                <Slider id="bs1" label="b₁ length"     value={b1Scale}     min={0.3}  max={3}   step={0.05} onChange={setB1Scale}     color={CLR.alex} />
                <Slider id="bs2" label="b₂ length"     value={b2Scale}     min={0.3}  max={3}   step={0.05} onChange={setB2Scale}     color={CLR.alex} />
                <Slider id="bsh" label="Shear (°)"     value={basisShear}  min={-60}  max={60}  step={1}    onChange={setBasisShear}  color={CLR.alex} />
              </div>

              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-mono mb-2" style={{ color: CLR.enchant+"aa" }}>Rotation M</p>
                <Slider id="ea" label="Rotation (°)" value={enchantAngle} min={-180} max={180} step={1} onChange={setEnchantAngle} color={CLR.enchant} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula strip */}
      {chapterIdx >= 2 && Binv && vInB && (
        <div className="rounded-2xl p-5" style={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            The full pipeline — B⁻¹ · M · B · [v]_B = [Mv]_B
          </p>
          <div className="flex flex-wrap gap-3 items-end justify-center">
            <FormulaBlock active={chapterIdx >= 4} color={CLR.alex} label="B⁻¹">
              <MatRow vals={[f2(Binv[0][0]), f2(Binv[0][1])]} /><MatRow vals={[f2(Binv[1][0]), f2(Binv[1][1])]} />
            </FormulaBlock>
            <Dot />
            <FormulaBlock active={chapterIdx >= 3} color={CLR.enchant} label={`M (${enchantAngle}°)`}>
              <MatRow vals={[f2(M[0][0]), f2(M[0][1])]} /><MatRow vals={[f2(M[1][0]), f2(M[1][1])]} />
            </FormulaBlock>
            <Dot />
            <FormulaBlock active={chapterIdx >= 2} color={CLR.alex} label="B">
              <MatRow vals={[f2(B[0][0]), f2(B[0][1])]} /><MatRow vals={[f2(B[1][0]), f2(B[1][1])]} />
            </FormulaBlock>
            <Dot />
            <FormulaBlock active={chapterIdx >= 2} color={CLR.alex} label="[v]_B">
              <VecRow val={f2(vInB[0])} /><VecRow val={f2(vInB[1])} />
            </FormulaBlock>
            <span style={{ fontSize: 24, color: "rgba(255,255,255,0.2)", alignSelf: "center" }}>=</span>
            <FormulaBlock active={chapterIdx >= 4} color={CLR.result} label="[Mv]_B">
              {MvInB && <><VecRow val={f2(MvInB[0])} /><VecRow val={f2(MvInB[1])} /></>}
            </FormulaBlock>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formula helpers ──────────────────────────────────────────────────────────
function FormulaBlock({ active, color, label, children }: {
  active: boolean; color: string; label: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, opacity: active ? 1 : 0.15, transition:"opacity 0.45s" }}>
      <span style={{ fontSize:10, fontFamily:"monospace", color: active ? color : "rgba(255,255,255,0.25)", whiteSpace:"nowrap" }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center" }}>
        <span style={{ color: active ? color : "rgba(255,255,255,0.15)", fontSize:28, fontWeight:200 }}>[</span>
        <div style={{ fontFamily:"monospace", fontSize:12, color: active ? color : "rgba(255,255,255,0.15)", display:"flex", flexDirection:"column", gap:4 }}>
          {children}
        </div>
        <span style={{ color: active ? color : "rgba(255,255,255,0.15)", fontSize:28, fontWeight:200 }}>]</span>
      </div>
    </div>
  );
}
function MatRow({ vals }: { vals: [string, string] }) {
  return <div style={{ display:"flex", gap:6 }}><span style={{ minWidth:38, textAlign:"right" }}>{vals[0]}</span><span style={{ minWidth:38, textAlign:"right" }}>{vals[1]}</span></div>;
}
function VecRow({ val }: { val: string }) {
  return <div><span style={{ minWidth:38, textAlign:"right", display:"block" }}>{val}</span></div>;
}
function Dot() {
  return <span style={{ fontSize:22, color:"rgba(255,255,255,0.15)", alignSelf:"center" }}>·</span>;
}
