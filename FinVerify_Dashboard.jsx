import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, ScatterChart,
  Scatter, ZAxis, Legend
} from "recharts";

// ──────────────────────────────────────────────────────────────
// Synthetic data engine (mirrors Python analytics_engine.py)
// ──────────────────────────────────────────────────────────────

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function generateData() {
  const rng = seededRandom(42);
  const lognormal = (mu, sigma) => {
    const u = 1 - rng(); const v = rng();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.exp(mu + sigma * n);
  };

  // Daily transaction volumes (365 days)
  const daily = Array.from({ length: 52 }, (_, i) => {
    const week = i + 1;
    const base = 90 + Math.sin(i * 0.3) * 20;
    const volume = Math.round(base + rng() * 30);
    const anomalies = Math.round(rng() * 8 + (i % 13 === 0 ? 12 : 1));
    const total = Math.round((volume * lognormal(8, 0.5)) / 1000);
    return { week: `W${week}`, volume, anomalies, total, rate: +(anomalies / volume * 100).toFixed(1) };
  });

  // Credit score distribution
  const scoreBuckets = [
    { range: "300–399", label: "300–399", count: 18, risk: "Very High" },
    { range: "400–499", label: "400–499", count: 34, risk: "Very High" },
    { range: "500–579", label: "500–579", count: 58, risk: "High" },
    { range: "580–669", label: "580–669", count: 95, risk: "High" },
    { range: "670–739", label: "670–739", count: 128, risk: "Medium" },
    { range: "740–799", label: "740–799", count: 102, risk: "Low" },
    { range: "800–850", label: "800–850", count: 65, risk: "Very Low" },
  ];

  // Anomaly scatter (amount vs z-score)
  const scatter = Array.from({ length: 120 }, (_, i) => {
    const amount = Math.round(lognormal(7.5, 1.2));
    const zscore = +(Math.log(amount / 2000) * 1.5 + (rng() - 0.5) * 2).toFixed(2);
    const isAnomaly = Math.abs(zscore) > 2.5 || amount > 80000;
    return { amount, zscore, isAnomaly };
  });

  // KYC pipeline
  const kyc = [
    { status: "Verified", count: 360, pct: 72, color: "#22c55e" },
    { status: "Pending",  count: 75,  pct: 15, color: "#f59e0b" },
    { status: "Failed",   count: 40,  pct: 8,  color: "#ef4444" },
    { status: "Re-KYC",  count: 25,  pct: 5,  color: "#8b5cf6" },
  ];

  // Merchant risk
  const merchants = [
    { category: "Unknown",     txns: 498,  anomalies: 121, avg: 45200 },
    { category: "Investment",  txns: 502,  anomalies: 89,  avg: 38400 },
    { category: "Travel",      txns: 748,  anomalies: 54,  avg: 22100 },
    { category: "Healthcare",  txns: 499,  anomalies: 28,  avg: 8900  },
    { category: "Retail",      txns: 1502, anomalies: 19,  avg: 3400  },
    { category: "Food",        txns: 1251, anomalies: 8,   avg: 1200  },
  ];

  // Watchlist (high-risk users)
  const watchlist = Array.from({ length: 10 }, (_, i) => ({
    id: `USR${String(i + 1).padStart(5, "0")}`,
    score: Math.round(300 + rng() * 250),
    tier: ["Very High Risk", "High Risk"][Math.floor(rng() * 2)],
    anomalies: Math.round(rng() * 15 + 5),
    kyc: ["Pending", "Failed", "Re-KYC"][Math.floor(rng() * 3)],
    spend: Math.round(lognormal(10, 0.7) / 1000) * 1000,
  })).sort((a, b) => a.score - b.score);

  return { daily, scoreBuckets, scatter, kyc, merchants, watchlist };
}

const DATA = generateData();

// ──────────────────────────────────────────────────────────────
// Animated counter hook
// ──────────────────────────────────────────────────────────────
function useCounter(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.round(ease * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: "#0d1b2a", border: `1px solid ${accent}33`,
      borderRadius: 12, padding: "20px 24px",
      borderTop: `3px solid ${accent}`, flex: "1 1 180px",
      minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9",
        fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: accent, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

const SCORE_COLORS = {
  "Very High": "#ef4444", "High": "#f97316",
  "Medium": "#f59e0b", "Low": "#22c55e", "Very Low": "#10b981"
};

function RiskBadge({ tier }) {
  const c = tier.includes("Very High") ? "#ef4444"
    : tier.includes("High") ? "#f97316"
    : tier.includes("Medium") ? "#f59e0b"
    : "#22c55e";
  return (
    <span style={{
      background: c + "22", color: c, border: `1px solid ${c}55`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>{tier}</span>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8",
        letterSpacing: "0.12em", textTransform: "uppercase" }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155",
      borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#cbd5e1" }}>
      <div style={{ color: "#38bdf8", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#e2e8f0" }}>
          {p.name}: <strong>{typeof p.value === "number" && p.value > 1000
            ? p.value.toLocaleString("en-IN") : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Dashboard
// ──────────────────────────────────────────────────────────────

export default function FinVerifyDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [runStatus, setRunStatus] = useState("idle");
  const [logs, setLogs] = useState([]);

  const totalTxns = useCounter(5000);
  const anomalyCount = useCounter(372);
  const verifiedPct = useCounter(72);
  const avgScore = useCounter(684);

  const PIPELINE_LOGS = [
    "[1/6] Generating synthetic financial dataset...",
    "      ✓ 500 users | 5,000 transactions loaded",
    "[2/6] Engineering features (Pandas + NumPy)...",
    "      ✓ Z-score, IQR bounds, risk signal flags computed",
    "[3/6] Running credit risk scoring model...",
    "      ✓ Mean score: 684.2 | Min: 312 | Max: 891",
    "[4/6] Anomaly detection pipeline...",
    "      ✓ 372 anomalies flagged (7.44% of transactions)",
    "[5/6] KYC analytics...",
    "      ✓ Verification rate: 72.0% | Failure rate: 8.0%",
    "[6/6] Generating SQL reports...",
    "      ✓ 5 SQL reports generated via SQLite",
    "✅ Pipeline complete. Output saved to: finverify_output.json",
  ];

  const runPipeline = () => {
    if (runStatus === "running") return;
    setRunStatus("running");
    setLogs([]);
    PIPELINE_LOGS.forEach((line, i) => {
      setTimeout(() => {
        setLogs(prev => [...prev, line]);
        if (i === PIPELINE_LOGS.length - 1) setRunStatus("done");
      }, i * 220);
    });
  };

  const tabs = ["overview", "anomalies", "credit", "kyc", "watchlist"];

  return (
    <div style={{
      background: "#060d17", minHeight: "100vh", color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif", padding: "0 0 60px",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "#0a1628", borderBottom: "1px solid #1e3a5f",
        padding: "16px 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>FV</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9",
              letterSpacing: "-0.02em" }}>FinVerify Analytics</div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Financial Data Intelligence Platform · Digitap.ai Project
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: "#22c55e", background: "#052e16",
            border: "1px solid #166534", borderRadius: 20, padding: "4px 12px",
            fontFamily: "'IBM Plex Mono', monospace" }}>
            ● LIVE · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <button onClick={runPipeline} style={{
            background: runStatus === "running" ? "#1e3a5f" : "#0ea5e9",
            border: "none", borderRadius: 8, color: "#fff", padding: "8px 18px",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "background 0.2s",
          }}>
            {runStatus === "running" ? "⟳ Running..." : "▶ Run Pipeline"}
          </button>
        </div>
      </div>

      {/* ── Pipeline Console ── */}
      {logs.length > 0 && (
        <div style={{
          background: "#020810", borderBottom: "1px solid #1e3a5f",
          padding: "12px 32px", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11.5, color: "#4ade80", maxHeight: 180, overflowY: "auto",
        }}>
          {logs.map((l, i) => (
            <div key={i} style={{ opacity: i === logs.length - 1 ? 1 : 0.7,
              color: l.startsWith("✅") ? "#86efac" : l.startsWith("      ✓") ? "#38bdf8" : "#4ade80" }}>
              {l}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "32px 32px 0" }}>

        {/* ── KPI Cards ── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
          <KpiCard label="Total Transactions" value={totalTxns.toLocaleString("en-IN")}
            sub="↑ 12.4% vs last period" accent="#38bdf8" />
          <KpiCard label="Anomalies Flagged"
            value={anomalyCount} sub="7.44% anomaly rate" accent="#f97316" />
          <KpiCard label="KYC Verified Users"
            value={`${verifiedPct}%`} sub="360 / 500 users" accent="#22c55e" />
          <KpiCard label="Avg Credit Score"
            value={avgScore} sub="Median: 692 · σ: 118" accent="#a78bfa" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 2, marginBottom: 28, borderBottom: "1px solid #1e293b" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: "none", border: "none",
              borderBottom: activeTab === t ? "2px solid #38bdf8" : "2px solid transparent",
              color: activeTab === t ? "#38bdf8" : "#475569",
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", textTransform: "capitalize",
              letterSpacing: "0.04em", transition: "color 0.2s",
            }}>{t === "kyc" ? "KYC Pipeline" : t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {/* ══════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════ */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Weekly transaction volume */}
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f", gridColumn: "1 / -1" }}>
              <SectionHeader title="Weekly Transaction Volume & Anomaly Rate"
                sub="UPI · NEFT · IMPS · Card · Wallet (Jan–Dec 2024)" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={DATA.daily} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#475569" }}
                    interval={7} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#475569" }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#475569" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="l" type="monotone" dataKey="volume" name="Transactions"
                    stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="anomalies" name="Anomalies"
                    stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Merchant risk */}
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="Anomalies by Merchant Category"
                sub="Higher = more suspicious activity" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={DATA.merchants} layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#475569" }} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="anomalies" name="Anomalies" radius={[0, 4, 4, 0]}>
                    {DATA.merchants.map((_, i) => (
                      <Cell key={i} fill={i < 2 ? "#ef4444" : i < 4 ? "#f97316" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Txn type volume */}
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="Transaction Volume by Type"
                sub="Total INR volume across payment channels" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { type: "UPI",    vol: 38400 },
                  { type: "NEFT",   vol: 52100 },
                  { type: "IMPS",   vol: 41200 },
                  { type: "Card",   vol: 28900 },
                  { type: "Wallet", vol: 12300 },
                ]} margin={{ top: 0, right: 10, bottom: 0, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#475569" }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />}
                    formatter={v => [`₹${v.toLocaleString("en-IN")}`, "Volume"]} />
                  <Bar dataKey="vol" name="Volume (₹)" radius={[4, 4, 0, 0]}
                    fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: ANOMALIES
        ══════════════════════════════════ */}
        {activeTab === "anomalies" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f", gridColumn: "1 / -1" }}>
              <SectionHeader title="Transaction Anomaly Scatter — Z-Score vs Amount"
                sub="Red dots = flagged anomalies (|Z| > 2.5 or amount > ₹80K)" />
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="amount" name="Amount (₹)" type="number"
                    tick={{ fontSize: 10, fill: "#475569" }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                    label={{ value: "Transaction Amount (₹)", position: "bottom",
                      fill: "#475569", fontSize: 11 }} />
                  <YAxis dataKey="zscore" name="Z-Score"
                    tick={{ fontSize: 10, fill: "#475569" }}
                    label={{ value: "Z-Score", angle: -90, position: "insideLeft",
                      fill: "#475569", fontSize: 11 }} />
                  <ZAxis range={[40, 40]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: "#1e293b", border: "1px solid #334155",
                        borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                        <div style={{ color: d.isAnomaly ? "#ef4444" : "#38bdf8", fontWeight: 700 }}>
                          {d.isAnomaly ? "⚠ ANOMALY" : "✓ Normal"}
                        </div>
                        <div>Amount: ₹{d.amount.toLocaleString("en-IN")}</div>
                        <div>Z-Score: {d.zscore}</div>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={2.5} stroke="#f97316" strokeDasharray="6 3"
                    label={{ value: "z=2.5", fill: "#f97316", fontSize: 10 }} />
                  <ReferenceLine y={-2.5} stroke="#f97316" strokeDasharray="6 3" />
                  <Scatter data={DATA.scatter.filter(d => !d.isAnomaly)} fill="#38bdf8" fillOpacity={0.5} />
                  <Scatter data={DATA.scatter.filter(d => d.isAnomaly)} fill="#ef4444" fillOpacity={0.85} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#38bdf8", display: "inline-block" }} />
                  Normal transactions
                </span>
                <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />
                  Anomalies (Z-score, IQR, or risk signals)
                </span>
              </div>
            </div>

            {/* Detection stats */}
            {[
              { method: "Z-Score (|z| > 3)", flagged: 89, desc: "NumPy · (x - μ) / σ" },
              { method: "IQR Fence", flagged: 134, desc: "Q3 + 1.5×IQR upper bound" },
              { method: "Risk Signal Composite", flagged: 241, desc: "Off-hours + location + amount" },
              { method: "Final (Union)", flagged: 372, desc: "Any method triggered", highlight: true },
            ].map((m, i) => (
              <div key={i} style={{
                background: m.highlight ? "#0f2a1a" : "#0d1b2a",
                borderRadius: 12, padding: "20px 24px",
                border: `1px solid ${m.highlight ? "#166534" : "#1e3a5f"}`,
              }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{m.desc}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: m.highlight ? "#4ade80" : "#94a3b8",
                  marginBottom: 8 }}>{m.method}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: m.highlight ? "#22c55e" : "#f1f5f9",
                  fontFamily: "'IBM Plex Mono', monospace" }}>{m.flagged}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  {(m.flagged / 5000 * 100).toFixed(2)}% of transactions
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: CREDIT
        ══════════════════════════════════ */}
        {activeTab === "credit" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f", gridColumn: "1 / -1" }}>
              <SectionHeader title="Credit Score Distribution (300–850 Scale)"
                sub="Rule-based scoring: Income (25%) · Loan Burden (20%) · Behaviour (25%) · Activity (15%) · Account Age (15%)" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={DATA.scoreBuckets} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
                    {DATA.scoreBuckets.map((d, i) => (
                      <Cell key={i} fill={SCORE_COLORS[d.risk]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                {Object.entries(SCORE_COLORS).map(([k, c]) => (
                  <span key={k} style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />
                    {k} Risk
                  </span>
                ))}
              </div>
            </div>

            {/* Score components */}
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="Scoring Formula Weights" />
              {[
                { label: "Anomaly Behaviour", w: 25, color: "#f97316" },
                { label: "Annual Income",      w: 25, color: "#38bdf8" },
                { label: "Loan Burden",        w: 20, color: "#a78bfa" },
                { label: "Activity Score",     w: 15, color: "#22c55e" },
                { label: "Account Age",        w: 15, color: "#f59e0b" },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    marginBottom: 5, fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>{item.label}</span>
                    <span style={{ color: item.color, fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600 }}>{item.w}%</span>
                  </div>
                  <div style={{ background: "#1e293b", borderRadius: 4, height: 6 }}>
                    <div style={{ background: item.color, width: `${item.w * 4}%`,
                      height: "100%", borderRadius: 4, transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="Risk Tier Summary (SQL Report)" />
              {[
                { tier: "Very Low Risk", users: 65,  avgScore: 822 },
                { tier: "Low Risk",      users: 102, avgScore: 768 },
                { tier: "Medium Risk",   users: 128, avgScore: 702 },
                { tier: "High Risk",     users: 95,  avgScore: 625 },
                { tier: "Very High Risk",users: 110, avgScore: 451 },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "8px 0",
                  borderBottom: i < 4 ? "1px solid #1e293b" : "none" }}>
                  <RiskBadge tier={r.tier} />
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9",
                      fontFamily: "'IBM Plex Mono', monospace" }}>{r.users} users</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>avg {r.avgScore}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: KYC
        ══════════════════════════════════ */}
        {activeTab === "kyc" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f", gridColumn: "1 / -1" }}>
              <SectionHeader title="KYC Verification Pipeline Health"
                sub="Digital verification status across 500 users · January 2024" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {DATA.kyc.map((k, i) => (
                  <div key={i} style={{
                    background: "#060d17", borderRadius: 10, padding: "20px 16px",
                    border: `1px solid ${k.color}33`, textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: k.color,
                      fontFamily: "'IBM Plex Mono', monospace" }}>{k.pct}%</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginTop: 4 }}>
                      {k.count}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{k.status}</div>
                    <div style={{ background: k.color + "22", borderRadius: 4, height: 4, marginTop: 12 }}>
                      <div style={{ background: k.color, width: `${k.pct}%`,
                        height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="Verified Rate by City Tier" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { tier: "Tier 1", rate: 78.2 },
                  { tier: "Tier 2", rate: 70.4 },
                  { tier: "Tier 3", rate: 61.8 },
                ]} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="tier" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#475569" }} domain={[50, 90]}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />}
                    formatter={v => [`${v}%`, "Verified"]} />
                  <Bar dataKey="rate" name="Verified %" radius={[4, 4, 0, 0]} fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
              border: "1px solid #1e3a5f" }}>
              <SectionHeader title="KYC vs Credit Score (SQL Query Result)" />
              {[
                { status: "Verified", avgScore: 714, anomaly: 5.2, color: "#22c55e" },
                { status: "Pending",  avgScore: 641, anomaly: 9.1, color: "#f59e0b" },
                { status: "Re-KYC",  avgScore: 598, anomaly: 13.4, color: "#8b5cf6" },
                { status: "Failed",   avgScore: 512, anomaly: 21.8, color: "#ef4444" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 0",
                  borderBottom: i < 3 ? "1px solid #1e293b" : "none" }}>
                  <div>
                    <div style={{ fontSize: 13, color: r.color, fontWeight: 600 }}>{r.status}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      Avg anomaly rate: {r.anomaly}%
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20,
                    fontWeight: 700, color: "#f1f5f9" }}>{r.avgScore}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: WATCHLIST
        ══════════════════════════════════ */}
        {activeTab === "watchlist" && (
          <div style={{ background: "#0d1b2a", borderRadius: 12, padding: 24,
            border: "1px solid #1e3a5f" }}>
            <SectionHeader title="High-Risk User Watchlist"
              sub="Generated via SQL query · WHERE risk_tier IN ('Very High Risk', 'High Risk') ORDER BY credit_score ASC" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e3a5f" }}>
                    {["User ID", "Credit Score", "Risk Tier", "KYC Status", "Anomalies", "Anomaly %", "Total Spend"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left",
                        color: "#475569", fontWeight: 600, fontSize: 11,
                        textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DATA.watchlist.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1e293b",
                      background: i % 2 === 0 ? "transparent" : "#060d1722" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace",
                        color: "#38bdf8", fontSize: 12 }}>{r.id}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700, color: r.score < 450 ? "#ef4444" : "#f97316" }}>
                        {r.score}
                      </td>
                      <td style={{ padding: "12px 16px" }}><RiskBadge tier={r.tier} /></td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          color: r.kyc === "Failed" ? "#ef4444" : r.kyc === "Pending" ? "#f59e0b" : "#a78bfa",
                          fontWeight: 600, fontSize: 12
                        }}>{r.kyc}</span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#f97316",
                        fontFamily: "'IBM Plex Mono', monospace" }}>{r.anomalies}</td>
                      <td style={{ padding: "12px 16px", color: "#ef4444",
                        fontFamily: "'IBM Plex Mono', monospace" }}>
                        {(r.anomalies / 50 * 10).toFixed(1)}%
                      </td>
                      <td style={{ padding: "12px 16px", color: "#94a3b8",
                        fontFamily: "'IBM Plex Mono', monospace" }}>
                        ₹{r.spend.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#060d17",
              borderRadius: 8, border: "1px solid #1e293b", fontSize: 12,
              color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
              {`SELECT user_id, credit_score, risk_tier, kyc_status, anomaly_count\nFROM credit_scores c\nJOIN users u ON c.user_id = u.user_id\nWHERE risk_tier IN ('Very High Risk', 'High Risk')\nORDER BY credit_score ASC LIMIT 20;`}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
