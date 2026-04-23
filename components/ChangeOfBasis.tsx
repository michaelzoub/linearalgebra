"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import * as math from "mathjs";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vec2 = [number, number];
type Mat2 = [[number, number], [number, number]];

// ─── Math helpers ─────────────────────────────────────────────────────────────
const mat2Inv = (m: Mat2): Mat2 => math.inv(m as number[][]) as Mat2;
const mat2MulVec = (m: Mat2, v: Vec2): Vec2 => math.multiply(m as number[][], v as number[]) as Vec2;
const mat2Mul = (a: Mat2, b: Mat2): Mat2 => math.multiply(a as number[][], b as number[][]) as Mat2;
const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const fmtVec = (v: Vec2) => `[${fmt(v[0])}, ${fmt(v[1])}]`;

// ─── Design token colors (from maximeheckel dark theme) ───────────────────────
const CLR = {
  b1:     "#f472b6",  // pink  — basis vector 1 / B matrix
  b2:     "#fb923c",  // orange — basis vector 2
  v:      "#4ade80",  // green  — vector v
  M:      "#22d3ee",  // cyan   — transformation M
  Binv:   "#c084fc",  // purple — B⁻¹
  result: "#facc15",  // yellow — [Mv]_B
};

// ─── Canvas ───────────────────────────────────────────────────────────────────
function worldToCanvas(wx: number, wy: number, w: number, h: number, scale: number) {
  return { x: w / 2 + wx * scale, y: h / 2 - wy * scale };
}

function arrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  width = 2,
  label?: string,
  dashed = false,
) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 2) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(dy, dx), hl = 11;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - hl * Math.cos(a - 0.4), to.y - hl * Math.sin(a - 0.4));
  ctx.lineTo(to.x - hl * Math.cos(a + 0.4), to.y - hl * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
  if (label) {
    ctx.font = "bold 13px monospace";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6;
    ctx.fillText(label, to.x + 9, to.y - 7);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  v: Vec2, b1: Vec2, b2: Vec2, B: Mat2, Binv: Mat2, M: Mat2, step: number, scale: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const cx = W / 2, cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = "#08080f";
  ctx.fillRect(0, 0, W, H);

  // standard grid
  ctx.strokeStyle = "#111122"; ctx.lineWidth = 1;
  for (let x = cx % scale; x < W; x += scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = cy % scale; y < H; y += scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "#1e1e3a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  ctx.fillStyle = "#2d2d50"; ctx.font = "11px monospace";
  for (let i = -6; i <= 6; i++) {
    if (i === 0) continue;
    const px = worldToCanvas(i, 0, W, H, scale); ctx.fillText(String(i), px.x - 5, cy + 14);
    const py = worldToCanvas(0, i, W, H, scale); ctx.fillText(String(i), cx + 5, py.y + 4);
  }

  // custom basis grid (faint)
  ctx.save(); ctx.globalAlpha = 0.12; ctx.lineWidth = 1;
  const rng = 9;
  for (let i = -rng; i <= rng; i++) {
    ctx.strokeStyle = CLR.b1;
    const s1 = worldToCanvas(i*b1[0]-rng*b2[0], i*b1[1]-rng*b2[1], W, H, scale);
    const e1 = worldToCanvas(i*b1[0]+rng*b2[0], i*b1[1]+rng*b2[1], W, H, scale);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(e1.x, e1.y); ctx.stroke();
    ctx.strokeStyle = CLR.b2;
    const s2 = worldToCanvas(i*b2[0]-rng*b1[0], i*b2[1]-rng*b1[1], W, H, scale);
    const e2 = worldToCanvas(i*b2[0]+rng*b1[0], i*b2[1]+rng*b1[1], W, H, scale);
    ctx.beginPath(); ctx.moveTo(s2.x, s2.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
  }
  ctx.restore();

  const O = worldToCanvas(0, 0, W, H, scale);
  const vInB = mat2MulVec(Binv, v);
  const vC = worldToCanvas(v[0], v[1], W, H, scale);

  // [v]_B parallelogram
  const tip1 = worldToCanvas(vInB[0]*b1[0], vInB[0]*b1[1], W, H, scale);
  const tip2 = worldToCanvas(vInB[1]*b2[0], vInB[1]*b2[1], W, H, scale);
  arrow(ctx, O, tip1, CLR.b1, 1.5, undefined, true);
  arrow(ctx, O, tip2, CLR.b2, 1.5, undefined, true);
  arrow(ctx, tip2, vC, CLR.b1, 1.5, undefined, true);
  arrow(ctx, tip1, vC, CLR.b2, 1.5, undefined, true);

  // basis vectors
  arrow(ctx, O, worldToCanvas(b1[0], b1[1], W, H, scale), CLR.b1, 2.5, "b₁");
  arrow(ctx, O, worldToCanvas(b2[0], b2[1], W, H, scale), CLR.b2, 2.5, "b₂");

  // v
  arrow(ctx, O, vC, CLR.v, 3, "v");

  if (step >= 1) {
    const Mv = mat2MulVec(M, v);
    const MvC = worldToCanvas(Mv[0], Mv[1], W, H, scale);
    // arc hint
    ctx.save(); ctx.strokeStyle = CLR.M; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(vC.x, vC.y);
    const mid = { x: (vC.x+MvC.x)/2 - (MvC.y-vC.y)*0.3, y: (vC.y+MvC.y)/2 + (MvC.x-vC.x)*0.3 };
    ctx.quadraticCurveTo(mid.x, mid.y, MvC.x, MvC.y);
    ctx.stroke(); ctx.restore();
    arrow(ctx, O, MvC, CLR.M, 3, "M·v");

    if (step >= 2) {
      const MvInB = mat2MulVec(Binv, Mv);
      const rt1 = worldToCanvas(MvInB[0]*b1[0], MvInB[0]*b1[1], W, H, scale);
      const rt2 = worldToCanvas(MvInB[1]*b2[0], MvInB[1]*b2[1], W, H, scale);
      arrow(ctx, O, rt1, CLR.Binv, 1.5, undefined, true);
      arrow(ctx, O, rt2, CLR.Binv, 1.5, undefined, true);
      arrow(ctx, rt2, MvC, CLR.Binv, 1.5, undefined, true);
      arrow(ctx, rt1, MvC, CLR.Binv, 1.5, undefined, true);
      arrow(ctx, O, MvC, CLR.result, 3.5, "[Mv]_B→std");
    }
  }
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-[#0f0f1a] ${className}`}>
      {children}
    </div>
  );
}
function PanelHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white/90">{children}</div>;
}
function PanelBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

function Slider({
  id, label, value, min, max, step, onChange, color,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 mb-3 last:mb-0">
      <div className="flex justify-between text-xs font-mono">
        <span style={color ? { color } : { color: "#94a3b8" }}>{label}</span>
        <span className="text-white/70">{value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color ?? "#6366f1" }}
      />
    </div>
  );
}

function StepBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
        active
          ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
          : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

// Inline colored code span
function C({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <code
      className="text-xs px-1.5 py-0.5 rounded font-mono"
      style={{ background: "rgba(255,255,255,0.07)", color: color ?? "#94a3b8" }}
    >
      {children}
    </code>
  );
}

// Formula matrix block
function MatBox({ rows, color, label }: { rows: [string, string][]; color: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>}
      <div className="flex items-center gap-0.5">
        <span style={{ color, fontSize: 30, lineHeight: 1, fontWeight: 200 }}>[</span>
        <div className="font-mono text-sm flex flex-col gap-1">
          <div className="flex gap-2">
            <span style={{ color, minWidth: 38, textAlign: "right" }}>{rows[0][0]}</span>
            <span style={{ color, minWidth: 38, textAlign: "right" }}>{rows[0][1]}</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color, minWidth: 38, textAlign: "right" }}>{rows[1][0]}</span>
            <span style={{ color, minWidth: 38, textAlign: "right" }}>{rows[1][1]}</span>
          </div>
        </div>
        <span style={{ color, fontSize: 30, lineHeight: 1, fontWeight: 200 }}>]</span>
      </div>
    </div>
  );
}

function VecBox({ vals, color, label }: { vals: [string, string]; color: string; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>}
      <div className="flex items-center gap-0.5">
        <span style={{ color, fontSize: 30, lineHeight: 1, fontWeight: 200 }}>[</span>
        <div className="font-mono text-sm flex flex-col gap-1">
          <span style={{ color, minWidth: 38, textAlign: "right" }}>{vals[0]}</span>
          <span style={{ color, minWidth: 38, textAlign: "right" }}>{vals[1]}</span>
        </div>
        <span style={{ color, fontSize: 30, lineHeight: 1, fontWeight: 200 }}>]</span>
      </div>
    </div>
  );
}

function StepRow({ n, color, children }: { n: number; color: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 items-start">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-mono text-xs"
        style={{ border: `2px solid ${color}`, color }}
      >{n}</div>
      <div className="pt-0.5 flex-1 text-sm text-white/70 leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChangeOfBasis() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SCALE = 72;

  const [vx, setVx] = useState(-1);
  const [vy, setVy] = useState(2);
  const [b1x, setB1x] = useState(2);
  const [b1y, setB1y] = useState(1);
  const [b2x, setB2x] = useState(-1);
  const [b2y, setB2y] = useState(1);
  const [rotAngle, setRotAngle] = useState(90);
  const [step, setStep] = useState(0);

  const v: Vec2 = [vx, vy];
  const b1: Vec2 = [b1x, b1y];
  const b2: Vec2 = [b2x, b2y];
  const B: Mat2 = [[b1[0], b2[0]], [b1[1], b2[1]]];
  const det = math.det(B as number[][]) as number;
  const singular = Math.abs(det) < 1e-6;

  const theta = (rotAngle * Math.PI) / 180;
  const M: Mat2 = [[Math.cos(theta), -Math.sin(theta)], [Math.sin(theta), Math.cos(theta)]];

  let Binv: Mat2 | null = null;
  let vInB: Vec2 | null = null;
  let MInB: Mat2 | null = null;
  let Mv: Vec2 | null = null;
  let MvInB: Vec2 | null = null;

  if (!singular) {
    try {
      Binv = mat2Inv(B);
      vInB = mat2MulVec(Binv, v);
      MInB = mat2Mul(mat2Mul(Binv, M), B);
      Mv = mat2MulVec(M, v);
      MvInB = mat2MulVec(Binv, Mv);
    } catch { /* skip */ }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !Binv) return;
    renderCanvas(canvas, v, b1, b2, B, Binv, M, step, SCALE);
  }, [v[0], v[1], b1[0], b1[1], b2[0], b2[1], rotAngle, step, singular]);

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

  const verified = Mv && MvInB
    ? Math.abs(mat2MulVec(B, MvInB)[0] - Mv[0]) < 1e-5 &&
      Math.abs(mat2MulVec(B, MvInB)[1] - Mv[1]) < 1e-5
    : false;

  return (
    <div className="max-w-[1280px] mx-auto flex flex-col gap-6">

      {/* Callout */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-white/75 leading-relaxed">
        A vector <C color={CLR.v}>v</C> lives in standard coordinates. A new basis <C color={CLR.b1}>B</C>{" "}
        defines a different "language" with rulers <C color={CLR.b1}>b₁</C> and <C color={CLR.b2}>b₂</C>.
        To apply transformation <C color={CLR.M}>M</C> and express the result in{" "}
        <C color={CLR.b1}>B</C>'s language, compute{" "}
        <C color={CLR.Binv}>B⁻¹</C><C color={CLR.M}>·M·</C><C color={CLR.b1}>B</C>
        <C color={CLR.v}>·[v]_B</C>.{" "}
        The conjugated matrix <C>M_B = B⁻¹·M·B</C> is the <strong className="text-white">same geometric action</strong>,
        just described with B's rulers.
      </div>

      {/* Formula */}
      <Panel>
        <PanelHeader>
          The Formula — Transformed vector in <span style={{ color: CLR.b1 }}>her</span> language
        </PanelHeader>
        <PanelBody>
          <div className="flex flex-wrap gap-3 items-end justify-center">
            {Binv ? (
              <MatBox rows={[[fmt(Binv[0][0]), fmt(Binv[0][1])], [fmt(Binv[1][0]), fmt(Binv[1][1])]]} color={CLR.Binv} label="B⁻¹" />
            ) : <span className="text-red-400 text-sm">singular</span>}
            <span className="text-white/30 text-2xl self-center pb-1">·</span>
            <MatBox rows={[[fmt(M[0][0]), fmt(M[0][1])], [fmt(M[1][0]), fmt(M[1][1])]]} color={CLR.M} label={`M (${rotAngle}°)`} />
            <span className="text-white/30 text-2xl self-center pb-1">·</span>
            <MatBox rows={[[fmt(B[0][0]), fmt(B[0][1])], [fmt(B[1][0]), fmt(B[1][1])]]} color={CLR.b1} label="B" />
            <span className="text-white/30 text-2xl self-center pb-1">·</span>
            {vInB ? <VecBox vals={[fmt(vInB[0]), fmt(vInB[1])]} color={CLR.v} label="[v]_B" /> : <span>—</span>}
            <span className="text-white/30 text-2xl self-center pb-1">=</span>
            {MvInB ? <VecBox vals={[fmt(MvInB[0]), fmt(MvInB[1])]} color={CLR.result} label="[Mv]_B" /> : <span>—</span>}
          </div>
          {Mv && MvInB && (
            <p className="text-center text-xs text-white/40 font-mono mt-4">
              Verify: <span style={{ color: CLR.result }}>B·[Mv]_B</span> = {fmtVec(mat2MulVec(B, MvInB))}{" · "}
              <span style={{ color: CLR.M }}>M·v</span> = {fmtVec(Mv)}{" → "}
              <span className={verified ? "text-green-400" : "text-red-400"}>
                {verified ? "same vector ✓" : "mismatch ✗"}
              </span>
            </p>
          )}
        </PanelBody>
      </Panel>

      {/* Canvas + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Canvas */}
        <div className="relative rounded-xl border border-white/10 overflow-hidden" style={{ minHeight: 520 }}>
          <canvas ref={canvasRef} className="w-full h-full" />
          {singular && (
            <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
              <span className="font-mono text-red-300 text-sm">Singular basis — det(B) = 0</span>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2.5">
            {[
              { color: CLR.v,      label: "v" },
              { color: CLR.b1,     label: "b₁" },
              { color: CLR.b2,     label: "b₂" },
              { color: CLR.M,      label: "M·v" },
              { color: CLR.result, label: "[Mv]_B" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-mono text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Steps */}
          <Panel>
            <PanelHeader>Pipeline steps</PanelHeader>
            <PanelBody>
              <div className="flex flex-wrap gap-2">
                {["v only", "+ apply M", "+ show [Mv]_B"].map((label, i) => (
                  <StepBtn key={i} active={step === i} onClick={() => setStep(i)}>{label}</StepBtn>
                ))}
              </div>
            </PanelBody>
          </Panel>

          {/* Vector v */}
          <Panel>
            <PanelHeader><span style={{ color: CLR.v }}>Vector v</span> (standard coords)</PanelHeader>
            <PanelBody>
              <Slider id="vx" label="vx" value={vx} min={-4} max={4} step={0.1} onChange={setVx} color={CLR.v} />
              <Slider id="vy" label="vy" value={vy} min={-4} max={4} step={0.1} onChange={setVy} color={CLR.v} />
              {vInB && <p className="font-mono text-xs text-white/40 mt-2">[v]_B = {fmtVec(vInB)}</p>}
            </PanelBody>
          </Panel>

          {/* Basis B */}
          <Panel>
            <PanelHeader>Basis B</PanelHeader>
            <PanelBody>
              <Slider id="b1x" label="b₁x" value={b1x} min={-3} max={3} step={0.1} onChange={setB1x} color={CLR.b1} />
              <Slider id="b1y" label="b₁y" value={b1y} min={-3} max={3} step={0.1} onChange={setB1y} color={CLR.b1} />
              <Slider id="b2x" label="b₂x" value={b2x} min={-3} max={3} step={0.1} onChange={setB2x} color={CLR.b2} />
              <Slider id="b2y" label="b₂y" value={b2y} min={-3} max={3} step={0.1} onChange={setB2y} color={CLR.b2} />
              <p className="font-mono text-xs text-white/40 mt-2">det(B) = {fmt(det)}</p>
            </PanelBody>
          </Panel>

          {/* Transformation M */}
          <Panel>
            <PanelHeader><span style={{ color: CLR.M }}>Transformation M</span></PanelHeader>
            <PanelBody>
              <Slider id="rot" label="θ (degrees)" value={rotAngle} min={-180} max={180} step={1} onChange={setRotAngle} color={CLR.M} />
              {MInB && (
                <p className="font-mono text-[11px] text-white/40 mt-2 leading-relaxed">
                  M_B = [{fmt(MInB[0][0])}, {fmt(MInB[0][1])}]<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[{fmt(MInB[1][0])}, {fmt(MInB[1][1])}]
                </p>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* Step walkthrough */}
      <Panel>
        <PanelHeader>Step-by-step computation</PanelHeader>
        <PanelBody className="flex flex-col gap-4">
          <StepRow n={1} color={CLR.v}>
            <C color={CLR.v}>[v]_B = {vInB ? fmtVec(vInB) : "?"}</C> — how <C>v = {fmtVec(v)}</C> looks from
            inside B. Go {vInB ? fmt(vInB[0]) : "?"} steps along <C color={CLR.b1}>b₁</C> and{" "}
            {vInB ? fmt(vInB[1]) : "?"} steps along <C color={CLR.b2}>b₂</C>.
            The dashed parallelogram on the canvas shows this decomposition.
          </StepRow>
          <StepRow n={2} color={CLR.b1}>
            <C color={CLR.b1}>B · [v]_B = {fmtVec(v)}</C> — multiplying by B converts from B's language back
            to standard coords. B's columns <em>are</em> the basis vectors, so this is literally
            summing {vInB ? fmt(vInB[0]) : "?"} × b₁ + {vInB ? fmt(vInB[1]) : "?"} × b₂.
          </StepRow>
          <StepRow n={3} color={CLR.M}>
            <C color={CLR.M}>M · v = {Mv ? fmtVec(Mv) : "?"}</C> — apply the {rotAngle}° rotation in
            standard coordinates. The <span style={{ color: CLR.M }}>cyan arrow</span> on the canvas shows
            this result.
          </StepRow>
          <StepRow n={4} color={CLR.Binv}>
            <C color={CLR.Binv}>B⁻¹ · (M·v) = {MvInB ? fmtVec(MvInB) : "?"}</C> — translate the result
            back into B's language. This is <C color={CLR.result}>[Mv]_B</C>: "the transformed vector in{" "}
            <span style={{ color: CLR.b1 }}>her</span> language."
          </StepRow>
          <StepRow n={5} color={CLR.result}>
            Shortcut: <C color={CLR.result}>M_B = B⁻¹·M·B
            {MInB ? ` = [[${fmt(MInB[0][0])}, ${fmt(MInB[0][1])}], [${fmt(MInB[1][0])}, ${fmt(MInB[1][1])}]]` : ""}
            </C>. Apply it directly to <C color={CLR.v}>[v]_B</C> to get{" "}
            <C color={CLR.result}>[Mv]_B</C> — same geometry, different ruler system.
          </StepRow>
        </PanelBody>
      </Panel>
    </div>
  );
}
