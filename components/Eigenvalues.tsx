"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import * as math from "mathjs";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vec2 = [number, number];
type Mat2 = [[number, number], [number, number]];

// ─── Math ─────────────────────────────────────────────────────────────────────
const mv   = (m: Mat2, v: Vec2) => math.multiply(m as number[][], v as number[]) as Vec2;
const f2   = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const norm = (v: Vec2): Vec2 => { const l = Math.hypot(v[0], v[1]); return l < 1e-9 ? [1, 0] : [v[0]/l, v[1]/l]; };
const scale = (s: number, v: Vec2): Vec2 => [s * v[0], s * v[1]];

type EigenResult =
  | { kind: "real";     λ1: number; λ2: number; e1: Vec2; e2: Vec2 }
  | { kind: "repeated"; λ: number;  e1: Vec2; e2: Vec2 }
  | { kind: "complex";  re: number; im: number };        // no real eigenvectors

function eigenvec(A: Mat2, λ: number): Vec2 {
  const [a, b, c, d] = [A[0][0], A[0][1], A[1][0], A[1][1]];
  if (Math.abs(b) > 1e-8) return norm([b, λ - a]);
  if (Math.abs(c) > 1e-8) return norm([λ - d, c]);
  if (Math.abs(λ - a) < 1e-8) return [1, 0];
  return [0, 1];
}

function computeEigen(A: Mat2): EigenResult {
  const tr  = A[0][0] + A[1][1];
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const disc = tr * tr - 4 * det;

  if (disc < -1e-8) {
    return { kind: "complex", re: tr / 2, im: Math.sqrt(-disc) / 2 };
  }
  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const λ1 = (tr + sqrtDisc) / 2;
  const λ2 = (tr - sqrtDisc) / 2;

  if (Math.abs(disc) < 1e-6) {
    const e1 = eigenvec(A, λ1);
    const e2: Vec2 = [-e1[1], e1[0]]; // perpendicular
    return { kind: "repeated", λ: λ1, e1, e2 };
  }
  return { kind: "real", λ1, λ2, e1: eigenvec(A, λ1), e2: eigenvec(A, λ2) };
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const CLR = {
  unit:    "rgba(255,255,255,0.18)",  // unit circle reference
  ellipse: "#a78bfa",                 // A(unit circle) — the transformed shape
  test:    "#7dd3fc",                 // test vector v (user drags)
  testImg: "#fb923c",                 // Av — where v lands
  e1:      "#fbbf24",                 // eigenvector 1 (gold)
  e2:      "#86efac",                 // eigenvector 2 (lime)
  noEig:   "#f87171",                 // complex eigenvalue — no real axes
};

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS: { label: string; A: Mat2; note: string }[] = [
  { label: "Stretch",    A: [[2, 0],  [0, 0.5]], note: "Eigenvectors along the axes — clear stretch & shrink" },
  { label: "Symmetric",  A: [[3, 1],  [1, 2]],   note: "Eigenvectors at ~45° — not axis-aligned" },
  { label: "Rotation",   A: [[0, -1], [1, 0]],   note: "Pure rotation — NO real eigenvectors (complex)" },
  { label: "Shear",      A: [[1, 1],  [0, 1]],   note: "One eigenvector only (λ=1, x-axis)" },
  { label: "Reflection", A: [[1, 0],  [0, -1]],  note: "λ=1 (x-axis stays), λ=-1 (y-axis flips)" },
  { label: "Projection", A: [[1, 0],  [0, 0]],   note: "λ=1 (x preserved), λ=0 (y collapses to 0)" },
];

// ─── Chapters ─────────────────────────────────────────────────────────────────
type Show = { unit: boolean; ellipse: boolean; test: boolean; eigenLines: boolean; eigenVecs: boolean; lambdaLabel: boolean };

const CHAPTERS: { color: string; label: string; title: string; body: string; show: Show }[] = [
  {
    color: CLR.ellipse,
    label: "The World Bends",
    title: "Matrix A warps every direction",
    body: "Imagine dropping a diamond item on the ground. Matrix A describes how the game world itself stretches and bends. The dashed white circle = every possible unit direction. The purple ellipse = where A sends each of those directions. A squishes some, stretches others.",
    show: { unit: true, ellipse: true, test: false, eigenLines: false, eigenVecs: false, lambdaLabel: false },
  },
  {
    color: CLR.test,
    label: "The Diamond Spins",
    title: "Drop the diamond — watch it spin",
    body: "The diamond (sky blue = where it is, orange = where A sends it) gets ROTATED and scaled. It doesn't just slide — it physically spins to a new direction. Drag the angle slider: no matter where you point it, the diamond always ends up spinning somewhere else.",
    show: { unit: true, ellipse: true, test: true, eigenLines: false, eigenVecs: false, lambdaLabel: false },
  },
  {
    color: CLR.e1,
    label: "Magic Axes",
    title: "Two directions where the diamond never spins",
    body: "There exist special directions — eigenvectors — where A only scales the diamond, never rotates it. Drop the diamond along the gold or lime axis: it slides straight forward or backward, without spinning at all. The structure of the object is preserved. Only its size changes.",
    show: { unit: true, ellipse: true, test: true, eigenLines: true, eigenVecs: true, lambdaLabel: false },
  },
  {
    color: CLR.e1,
    label: "A·v = λ·v",
    title: "Av = λv — scaling, not rotating",
    body: "For an eigenvector v: A·v = λ·v. The matrix A is equivalent to just multiplying by a single number λ. That's why the direction doesn't change. To find these axes: det(A − λI) = 0 gives you λ, then (A − λI)v = 0 gives you v. λ > 1 stretches, 0 < λ < 1 shrinks, λ < 0 flips.",
    show: { unit: true, ellipse: true, test: true, eigenLines: true, eigenVecs: true, lambdaLabel: true },
  },
  {
    color: "#c084fc",
    label: "Why It Matters",
    title: "Eigenvectors are the skeleton of every transformation",
    body: "In 3D games, the rotation axis IS the eigenvector with λ=1 — it doesn't move. Physics engines decompose forces along eigenvectors of the stress matrix to find where objects crack. PCA in ML finds the eigenvectors of the data's covariance matrix. Eigenvalues tell you how much each axis matters.",
    show: { unit: true, ellipse: true, test: false, eigenLines: true, eigenVecs: true, lambdaLabel: true },
  },
];

// ─── Minecraft diamond pixel sprite ──────────────────────────────────────────
const DIA_PAL = [
  '',          // 0 transparent
  '#074040',   // 1 outline
  '#1dbfb5',   // 2 main teal
  '#8ff5f0',   // 3 highlight
  '#0d8880',   // 4 mid-shadow
  '#074f4b',   // 5 dark shadow
];
const DIA_MAP = [
  '0000000000000000',
  '0000011111100000',
  '0001123332211000',
  '0012233333221100',
  '0122333332222110',
  '1223332222222211',
  '1223222222224411',
  '1222222224444511',
  '1222224445554511',
  '0122244555554410',
  '0122445555444110',
  '0012445554441000',
  '0001244444110000',
  '0000124411100000',
  '0000011100000000',
  '0000000000000000',
];

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number, rotation: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  const off = -8 * px;
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const idx = parseInt(DIA_MAP[r][c]);
      if (!idx) continue;
      ctx.fillStyle = DIA_PAL[idx];
      ctx.fillRect(off + c * px, off + r * px, px, px);
    }
  }
  ctx.restore();
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
const w2c = (wx: number, wy: number, W: number, H: number, sc: number) =>
  ({ x: W / 2 + wx * sc, y: H / 2 - wy * sc });

function glowArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string, lineW = 3, label?: string, dashed = false, glow = 14,
) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 3) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineW;
  if (!dashed && glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  if (dashed) ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.setLineDash([]); ctx.shadowBlur = 0;
  const a = Math.atan2(dy, dx), hl = 12;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - hl * Math.cos(a - 0.4), to.y - hl * Math.sin(a - 0.4));
  ctx.lineTo(to.x - hl * Math.cos(a + 0.4), to.y - hl * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  if (label) {
    ctx.shadowColor = "rgba(0,0,0,1)"; ctx.shadowBlur = 8;
    ctx.font = "bold 13px monospace"; ctx.fillStyle = color;
    ctx.fillText(label, to.x + 10, to.y - 8);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  A: Mat2, testVec: Vec2, eigen: EigenResult,
  show: Show, sc: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const cx = W / 2, cy = H / 2;

  ctx.fillStyle = "#050510"; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "#0e0e25"; ctx.lineWidth = 1;
  for (let x = cx % sc; x < W; x += sc) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = cy % sc; y < H; y += sc) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "#1a1a40"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  ctx.fillStyle = "#252550"; ctx.font = "11px monospace";
  for (let i = -7; i <= 7; i++) {
    if (i === 0) continue;
    const p = w2c(i, 0, W, H, sc); ctx.fillText(String(i), p.x - 4, cy + 14);
    const q = w2c(0, i, W, H, sc); ctx.fillText(String(i), cx + 5, q.y + 4);
  }

  const O = w2c(0, 0, W, H, sc);

  // Unit circle (reference)
  if (show.unit) {
    ctx.save();
    ctx.strokeStyle = CLR.unit; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const θ = (i / 64) * 2 * Math.PI;
      const p = w2c(Math.cos(θ), Math.sin(θ), W, H, sc);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = CLR.unit; ctx.font = "11px monospace";
    const rl = w2c(1.05, 0.1, W, H, sc);
    ctx.fillText("unit circle", rl.x, rl.y);
  }

  // A(unit circle) = transformed shape (ellipse for linear map)
  if (show.ellipse) {
    ctx.save();
    ctx.strokeStyle = CLR.ellipse; ctx.lineWidth = 2;
    ctx.shadowColor = CLR.ellipse; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const θ = (i / 80) * 2 * Math.PI;
      const unitPt: Vec2 = [Math.cos(θ), Math.sin(θ)];
      const img = mv(A, unitPt);
      const p = w2c(img[0], img[1], W, H, sc);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    const labelPt = mv(A, [1, 0]);
    const lc = w2c(labelPt[0] + 0.1, labelPt[1] + 0.1, W, H, sc);
    ctx.fillStyle = CLR.ellipse; ctx.font = "11px monospace";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 5;
    ctx.fillText("A × unit circle", lc.x, lc.y);
    ctx.shadowBlur = 0;

    // Diamonds on unit circle + their transformed positions on the ellipse
    const N = 8;
    for (let i = 0; i < N; i++) {
      const θ = (i / N) * 2 * Math.PI;
      const u: Vec2 = [Math.cos(θ), Math.sin(θ)];
      const Au = mv(A, u);

      // Diamond on unit circle — upright (all same rotation = 0 = "just dropped")
      const uC = w2c(u[0], u[1], W, H, sc);
      drawDiamond(ctx, uC.x, uC.y, 3, 0, 0.55);

      // Diamond on ellipse — rotated by how much the direction changed
      const origAngle = Math.atan2(-u[0],   u[1]);   // "upright" relative to radial
      const newAngle  = Math.atan2(-Au[0], Au[1]);
      const AuC = w2c(Au[0], Au[1], W, H, sc);
      drawDiamond(ctx, AuC.x, AuC.y, 3, newAngle - origAngle, 0.9);
    }
  }

  // Eigenvector LINES (infinite dashed lines through origin)
  if (show.eigenLines) {
    if (eigen.kind === "real" || eigen.kind === "repeated") {
      const drawEigenLine = (e: Vec2, color: string) => {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
        ctx.setLineDash([6, 6]);
        const far = 12;
        const s = w2c(-far * e[0], -far * e[1], W, H, sc);
        const end = w2c( far * e[0],  far * e[1], W, H, sc);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.restore();
      };
      drawEigenLine(eigen.e1, CLR.e1);
      if (eigen.kind === "real") drawEigenLine(eigen.e2, CLR.e2);
    }
    if (eigen.kind === "complex") {
      ctx.save();
      ctx.fillStyle = CLR.noEig; ctx.font = "bold 12px monospace";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6;
      ctx.fillText("⚠ No real Power Axes — this is a pure rotation!", 16, H - 20);
      ctx.restore();
    }
  }

  // Eigenvectors as arrows + their images A·e = λ·e
  if (show.eigenVecs) {
    if (eigen.kind === "real") {
      // e1 → A·e1 = λ1·e1
      const Ae1 = scale(eigen.λ1, eigen.e1);
      glowArrow(ctx, O, w2c(eigen.e1[0], eigen.e1[1], W, H, sc), CLR.e1, 3, "e₁", false, 12);
      glowArrow(ctx, O, w2c(Ae1[0], Ae1[1], W, H, sc), CLR.e1, 4, `A·e₁ = ${f2(eigen.λ1)}·e₁`, false, 18);
      // e2 → A·e2 = λ2·e2
      const Ae2 = scale(eigen.λ2, eigen.e2);
      glowArrow(ctx, O, w2c(eigen.e2[0], eigen.e2[1], W, H, sc), CLR.e2, 3, "e₂", false, 12);
      glowArrow(ctx, O, w2c(Ae2[0], Ae2[1], W, H, sc), CLR.e2, 4, `A·e₂ = ${f2(eigen.λ2)}·e₂`, false, 18);
    }
    if (eigen.kind === "repeated") {
      glowArrow(ctx, O, w2c(eigen.e1[0], eigen.e1[1], W, H, sc), CLR.e1, 3.5, `e₁ (λ = ${f2(eigen.λ)})`, false, 15);
      glowArrow(ctx, O, w2c(eigen.e2[0], eigen.e2[1], W, H, sc), CLR.e2, 3.5, "e₂ (perp.)", false, 15);
    }
  }

  // Test vector v and A·v
  if (show.test) {
    const Av = mv(A, testVec);
    glowArrow(ctx, O, w2c(testVec[0], testVec[1], W, H, sc), CLR.test, 3.5, `v = (${f2(testVec[0])}, ${f2(testVec[1])})`, false, 14);
    // Dashed arc hint
    const vC = w2c(testVec[0], testVec[1], W, H, sc);
    const AvC = w2c(Av[0], Av[1], W, H, sc);
    ctx.save(); ctx.strokeStyle = CLR.testImg; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.4;
    ctx.setLineDash([4, 5]); ctx.shadowColor = CLR.testImg; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(vC.x, vC.y);
    const mid = { x: (vC.x+AvC.x)/2-(AvC.y-vC.y)*0.3, y: (vC.y+AvC.y)/2+(AvC.x-vC.x)*0.3 };
    ctx.quadraticCurveTo(mid.x, mid.y, AvC.x, AvC.y);
    ctx.stroke(); ctx.restore();
    glowArrow(ctx, O, AvC, CLR.testImg, 3.5, `A·v = (${f2(Av[0])}, ${f2(Av[1])})`, false, 14);

    // Rotation delta label
    const dotProd = testVec[0]*Av[0] + testVec[1]*Av[1];
    const lenV = Math.hypot(testVec[0], testVec[1]);
    const lenAv = Math.hypot(Av[0], Av[1]);
    if (lenV > 0.01 && lenAv > 0.01) {
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, dotProd / (lenV * lenAv)))) * 180 / Math.PI;
      ctx.save();
      ctx.font = "bold 11px monospace";
      const isEigen = angleDeg < 5;
      ctx.fillStyle = isEigen ? CLR.e1 : "rgba(255,255,255,0.4)";
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;
      ctx.fillText(
        isEigen ? `✓ no spin — eigenvector direction!` : `diamond spins ${angleDeg.toFixed(1)}°`,
        12, H - 20
      );
      ctx.restore();
    }
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Slider({ id, label, value, min, max, step, onChange, color }: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color: string;
}) {
  return (
    <div className="flex flex-col gap-1 mb-3 last:mb-0">
      <div className="flex justify-between text-xs font-mono">
        <span style={{ color }}>{label}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{value.toFixed(2)}</span>
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
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      {label}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Eigenvalues() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SCALE = 72;

  const [chapterIdx, setChapterIdx] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);

  // Matrix A entries (initialised from first preset)
  const [a11, setA11] = useState(PRESETS[0].A[0][0]);
  const [a12, setA12] = useState(PRESETS[0].A[0][1]);
  const [a21, setA21] = useState(PRESETS[0].A[1][0]);
  const [a22, setA22] = useState(PRESETS[0].A[1][1]);

  // Test vector angle (user rotates it around the circle)
  const [testAngle, setTestAngle] = useState(30);

  const A: Mat2 = [[a11, a12], [a21, a22]];
  const testVec: Vec2 = [1.5 * Math.cos(testAngle * Math.PI / 180), 1.5 * Math.sin(testAngle * Math.PI / 180)];
  const eigen = computeEigen(A);
  const chapter = CHAPTERS[chapterIdx];

  function applyPreset(idx: number) {
    const p = PRESETS[idx];
    setA11(p.A[0][0]); setA12(p.A[0][1]);
    setA21(p.A[1][0]); setA22(p.A[1][1]);
    setPresetIdx(idx);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas(canvas, A, testVec, eigen, chapter.show, SCALE);
  }, [a11, a12, a21, a22, testAngle, chapterIdx]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      const p = canvas.parentElement;
      if (!p) return;
      canvas.width = p.clientWidth;
      canvas.height = p.clientHeight;
      draw();
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, [draw]);

  const tr = A[0][0] + A[1][1];
  const det = A[0][0]*A[1][1] - A[0][1]*A[1][0];
  const disc = tr*tr - 4*det;

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-5">

      {/* Legend chips */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip color={CLR.ellipse} label="A(circle) = image" />
          <Chip color={CLR.test}    label="v = test vector" />
          <Chip color={CLR.testImg} label="A·v" />
          <Chip color={CLR.e1}      label="eigenvector e₁" />
          <Chip color={CLR.e2}      label="eigenvector e₂" />
        </div>
        {/* Chapter dots */}
        <div className="flex items-center gap-2">
          {CHAPTERS.map((ch, i) => (
            <button key={i} onClick={() => setChapterIdx(i)} title={ch.label}
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

      {/* Main */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* Canvas */}
        <div className="relative rounded-2xl overflow-hidden"
          style={{ minHeight: 560, border: "1px solid rgba(255,255,255,0.06)" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Chapter card */}
        <div className="flex flex-col gap-4">
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

            {/* Live math panel */}
            <div className="rounded-xl p-3.5 font-mono text-xs flex flex-col gap-2"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Matrix A */}
              <div style={{ color: CLR.ellipse }}>
                A = [{f2(a11)}, {f2(a12)}; {f2(a21)}, {f2(a22)}]
                <span style={{ color: "rgba(255,255,255,0.2)" }}> | tr={f2(tr)} det={f2(det)}</span>
              </div>

              {/* Eigenvalue status */}
              {eigen.kind === "real" && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.e1 }}>λ₁ = {f2(eigen.λ1)}, e₁ = ({f2(eigen.e1[0])}, {f2(eigen.e1[1])})</span>
                  <span style={{ color: CLR.e2 }}>λ₂ = {f2(eigen.λ2)}, e₂ = ({f2(eigen.e2[0])}, {f2(eigen.e2[1])})</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>disc = {f2(disc)} ≥ 0 → real axes ✓</span>
                </div>
              )}
              {eigen.kind === "repeated" && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.e1 }}>λ = {f2(eigen.λ)} (repeated)</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>disc ≈ 0 — one unique direction</span>
                </div>
              )}
              {eigen.kind === "complex" && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: CLR.noEig }}>
                    λ = {f2(eigen.re)} ± {f2(eigen.im)}i — complex eigenvalues
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>
                    disc = {f2(disc)} &lt; 0 → no real Power Axes
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>
                    In 3D, the rotation axis WOULD be the real eigenvector (λ=1)
                  </span>
                </div>
              )}

              {/* det(A - λI) = 0 */}
              {chapterIdx >= 3 && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>Find λ: det(A − λI) = 0</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>→ λ² − {f2(tr)}λ + {f2(det)} = 0</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>→ disc = tr² − 4det = {f2(disc)}</span>
                </div>
              )}

              {/* Av = λv verification */}
              {chapterIdx >= 3 && eigen.kind === "real" && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>Verify A·e₁ = λ₁·e₁:</span>
                  <span style={{ color: CLR.e1 }}>
                    A·e₁ = ({f2(mv(A, eigen.e1)[0])}, {f2(mv(A, eigen.e1)[1])})
                  </span>
                  <span style={{ color: CLR.e1 }}>
                    λ₁·e₁ = ({f2(eigen.λ1 * eigen.e1[0])}, {f2(eigen.λ1 * eigen.e1[1])}) ✓
                  </span>
                </div>
              )}
            </div>

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

          {/* Controls toggle */}
          <button onClick={() => setShowControls(v => !v)}
            className="rounded-xl py-2.5 text-xs font-mono tracking-wide transition-all"
            style={{
              background: showControls ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.35)",
            }}>
            {showControls ? "▲ hide controls" : "▼ adjust the matrix A"}
          </button>

          {showControls && (
            <div className="rounded-2xl p-4 flex flex-col gap-4"
              style={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Presets */}
              <div>
                <p className="text-xs font-mono mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Matrix presets</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p, i) => (
                    <button key={i} onClick={() => applyPreset(i)}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono transition-all"
                      style={{
                        background: presetIdx === i ? CLR.ellipse + "25" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${presetIdx === i ? CLR.ellipse + "60" : "rgba(255,255,255,0.1)"}`,
                        color: presetIdx === i ? CLR.ellipse : "rgba(255,255,255,0.45)",
                      }}>{p.label}</button>
                  ))}
                </div>
                <p className="text-[10px] font-mono mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {PRESETS[presetIdx].note}
                </p>
              </div>

              {/* Matrix sliders */}
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-mono mb-2" style={{ color: CLR.ellipse + "aa" }}>
                  Matrix A = [[a, b], [c, d]]
                </p>
                <div className="grid grid-cols-2 gap-x-4">
                  <Slider id="a11" label="a (top-left)"    value={a11} min={-4} max={4} step={0.1} onChange={v => { setA11(v); setPresetIdx(-1); }} color={CLR.ellipse} />
                  <Slider id="a12" label="b (top-right)"   value={a12} min={-4} max={4} step={0.1} onChange={v => { setA12(v); setPresetIdx(-1); }} color={CLR.ellipse} />
                  <Slider id="a21" label="c (bot-left)"    value={a21} min={-4} max={4} step={0.1} onChange={v => { setA21(v); setPresetIdx(-1); }} color={CLR.ellipse} />
                  <Slider id="a22" label="d (bot-right)"   value={a22} min={-4} max={4} step={0.1} onChange={v => { setA22(v); setPresetIdx(-1); }} color={CLR.ellipse} />
                </div>
              </div>

              {/* Test vector angle */}
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-mono mb-2" style={{ color: CLR.test + "aa" }}>Test vector v direction</p>
                <Slider id="ta" label="angle (°)" value={testAngle} min={-180} max={180} step={1} onChange={setTestAngle} color={CLR.test} />
                <p className="text-[10px] font-mono mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Rotate v to any direction — watch how Av always points elsewhere (except eigenvector directions)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: the Av = λv equation panel */}
      {chapterIdx >= 3 && (
        <div className="rounded-2xl p-5" style={{ background: "#0d0d1f", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            The master equation — A · v = λ · v (eigenvectors only)
          </p>

          {eigen.kind === "real" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {([
                { e: eigen.e1, λ: eigen.λ1, color: CLR.e1, label: "Power Axis 1" },
                { e: eigen.e2, λ: eigen.λ2, color: CLR.e2, label: "Power Axis 2" },
              ] as const).map(({ e, λ, color, label }) => (
                <div key={label} className="rounded-xl p-4 font-mono text-xs flex flex-col gap-2"
                  style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${color}30` }}>
                  <span style={{ color, opacity: 0.7 }}>{label}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span style={{ color }}>e = ({f2((e as Vec2)[0])}, {f2((e as Vec2)[1])})</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>λ = {f2(λ)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span style={{ color }}>A·e = ({f2(mv(A, e as Vec2)[0])}, {f2(mv(A, e as Vec2)[1])})</span>
                    <span>=</span>
                    <span style={{ color }}>λ·e = ({f2(λ * (e as Vec2)[0])}, {f2(λ * (e as Vec2)[1])})</span>
                    <span style={{ color: "#86efac" }}>✓</span>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.25)" }}>
                    {Math.abs(λ) > 1 ? `Stretch ×${f2(Math.abs(λ))}` :
                     Math.abs(λ) < 1 && λ > 0 ? `Shrink ×${f2(λ)}` :
                     λ < 0 ? `Flip + scale ×${f2(Math.abs(λ))}` :
                     λ === 0 ? "Collapses to origin" : "No change (λ=1)"}
                    {λ < 0 ? " — reversed direction" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {eigen.kind === "complex" && (
            <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: CLR.noEig }}>
              <strong>No real eigenvectors.</strong> This matrix rotates every vector — there's no "sacred direction"
              that escapes rotation in 2D. The eigenvalues are complex numbers: λ = {f2(eigen.re)} ± {f2(eigen.im)}i.
              <br /><br />
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                In 3D: if you rotate around the Z-axis, the Z-axis itself IS the eigenvector (λ=1) because it doesn't
                move. That's why eigenvectors are key to 3D game engine rotations — they tell you what axis to spin around.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
