"use client";

import { useState, useEffect, useRef } from "react";
import type { ScreeningResult, RubricCriteria, Verdict } from "@/types";

// --- Types --------------------------------------------------------------------

interface LocalCandidate {
  name: string;
  email: string;
  jobId: string;
  jobTitle: string;
  resumeText: string;
}

// --- Helpers ------------------------------------------------------------------

function verdictColor(v: Verdict): string {
  return v === "pass" ? "var(--pass)" : v === "review" ? "var(--review)" : "var(--reject)";
}

function verdictBg(v: Verdict): string {
  return v === "pass" ? "var(--pass-bg)" : v === "review" ? "var(--review-bg)" : "var(--reject-bg)";
}

function ScoreArc({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const color = score >= 70 ? "var(--pass)" : score >= 40 ? "var(--review)" : "var(--reject)";
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
      <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <circle
        cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
        transform="rotate(-90 45 45)" style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="45" y="49" textAnchor="middle" fill={color}
        style={{ fontFamily: "var(--mono)", fontSize: "16px", fontWeight: 500 }}>
        {score}
      </text>
    </svg>
  );
}

function TagInput({
  tags, setTags, placeholder,
}: { tags: string[]; setTags: (t: string[]) => void; placeholder: string }) {
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setVal("");
  };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {tags.map((t) => (
          <span key={t} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 12, padding: "3px 10px", borderRadius: 20,
            background: "rgba(255,255,255,0.05)", border: "1px solid var(--border2)",
            color: "var(--text2)",
          }}>
            {t}
            <button onClick={() => setTags(tags.filter((x) => x !== t))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, lineHeight: 1, padding: 0 }}>
              x
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          style={{
            flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
            borderRadius: "var(--radius-sm)", padding: "7px 10px",
            color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
          }} />
        <button onClick={add} style={{
          padding: "7px 14px", background: "var(--bg3)", border: "1px solid var(--border2)",
          borderRadius: "var(--radius-sm)", color: "var(--text2)", fontSize: 12,
          cursor: "pointer", fontFamily: "var(--font)",
        }}>Add</button>
      </div>
    </div>
  );
}

// --- Result card --------------------------------------------------------------

function ResultCard({ r, active, onClick }: { r: ScreeningResult; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: "14px 16px", borderRadius: "var(--radius)", cursor: "pointer",
      border: `1px solid ${active ? verdictColor(r.verdict) + "44" : "var(--border)"}`,
      background: active ? verdictBg(r.verdict) : "var(--bg2)",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 2 }}>
            {r.candidateName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>
            {r.jobTitle}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 20,
          background: verdictBg(r.verdict), color: verdictColor(r.verdict),
          border: `1px solid ${verdictColor(r.verdict)}33`, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>{r.verdict}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
          <div style={{
            width: `${r.overallScore}%`, height: "100%", borderRadius: 2,
            background: verdictColor(r.verdict), transition: "width 0.6s ease",
          }} />
        </div>
        <span style={{ fontSize: 12, color: "var(--text2)", fontFamily: "var(--mono)", minWidth: 28, textAlign: "right" }}>
          {r.overallScore}
        </span>
      </div>
    </div>
  );
}

// --- Detail panel -------------------------------------------------------------

function DetailPanel({ r }: { r: ScreeningResult }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <ScoreArc score={r.overallScore} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
            {r.candidateName}
          </div>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>
            {r.candidateEmail}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20,
            background: verdictBg(r.verdict), color: verdictColor(r.verdict),
            border: `1px solid ${verdictColor(r.verdict)}33`, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {r.dealbreakerHit ? "Dealbreaker hit  -  " : ""}{r.verdict}
          </span>
        </div>
      </div>

      {/* Dimensions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 10 }}>
          Scoring breakdown
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.dimensions.map((d) => (
            <div key={d.name} style={{
              display: "grid", gridTemplateColumns: "160px 1fr auto",
              alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 12, color: "var(--text2)" }}>{d.name}</span>
              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                <div style={{
                  width: `${d.score}%`, height: "100%", borderRadius: 2,
                  background: d.score >= 70 ? "var(--pass)" : d.score >= 40 ? "var(--review)" : "var(--reject)",
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text2)", minWidth: 24, textAlign: "right" }}>
                {d.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: "14px 16px", background: "var(--bg3)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)", marginBottom: r.rejectionReason ? 12 : 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 8 }}>
          AI summary
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65 }}>{r.summary}</p>
      </div>

      {/* Rejection note */}
      {r.rejectionReason && (
        <div style={{
          padding: "14px 16px", background: "var(--reject-bg)", borderRadius: "var(--radius)",
          border: "1px solid var(--reject)22",
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--reject)", marginBottom: 8, opacity: 0.7 }}>
            Draft rejection note
          </div>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65 }}>{r.rejectionReason}</p>
        </div>
      )}

      {/* Dimension notes */}
      <div style={{ marginTop: 16 }}>
        {r.dimensions.map((d) => (
          <div key={d.name} style={{
            display: "flex", gap: 10, padding: "8px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 160 }}>{d.name}</span>
            <span style={{ fontSize: 12, color: "var(--text2)" }}>{d.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main page ----------------------------------------------------------------

const INITIAL_RUBRIC: RubricCriteria = {
  mustHaves: ["5+ years React", "TypeScript", "Team leadership"],
  niceToHaves: ["Next.js", "GraphQL", "Figma"],
  dealbreakers: [],
};

const INITIAL_CANDIDATE: LocalCandidate = {
  name: "Jane Smith",
  email: "jane@example.com",
  jobId: "manual",
  jobTitle: "Senior Frontend Engineer",
  resumeText: `Jane Smith  -  Senior Software Engineer
jane@example.com | Warsaw, Poland

Experience
----------
FinTech Startup  -  Lead Frontend Engineer (2020-2024, 4 years)
- Architected React + TypeScript frontend serving 200k users
- Led team of 4 engineers, ran sprint planning and code reviews
- Delivered 3 major product launches on schedule
- Introduced GraphQL, cutting API calls by 40%

Agency Co  -  Frontend Developer (2018-2020, 2 years)
- Built React SPAs for 8 enterprise clients
- Worked closely with design team using Figma

Education
----------
BSc Computer Science  -  Warsaw University of Technology (2018)

Skills: React, TypeScript, Next.js, Node.js, GraphQL, Figma, Jest, Tailwind`,
};

export default function Home() {
  const [tab, setTab] = useState<"screen" | "results">("screen");
  const [rubric, setRubric] = useState<RubricCriteria>(INITIAL_RUBRIC);
  const [candidate, setCandidate] = useState<LocalCandidate>(INITIAL_CANDIDATE);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [selected, setSelected] = useState<ScreeningResult | null>(null);
  const [latestResult, setLatestResult] = useState<ScreeningResult | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [passThreshold, setPassThreshold] = useState(70);
  const [reviewThreshold, setReviewThreshold] = useState(40);

  // Poll results
  const fetchResults = async () => {
    const res = await fetch("/api/results");
    const data = await res.json();
    if (data.results) setResults(data.results);
  };

  useEffect(() => {
    fetchResults();
    pollingRef.current = setInterval(fetchResults, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const runScreening = async () => {
    setLoading(true);
    setLatestResult(null);
    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: {
            name: candidate.name,
            email: candidate.email,
            jobId: candidate.jobId || "manual",
            jobTitle: candidate.jobTitle,
            resumeText: candidate.resumeText,
          },
          rubric,
          passThreshold,
          reviewThreshold,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setLatestResult(data.result);
        setResults((prev) => [data.result, ...prev.filter((r) => r.candidateId !== data.result.candidateId)]);
        setSelected(data.result);
        setTab("results");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const counts = {
    pass: results.filter((r) => r.verdict === "pass").length,
    review: results.filter((r) => r.verdict === "review").length,
    reject: results.filter((r) => r.verdict === "reject").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top nav */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "var(--bg)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg,var(--accent2),#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>Screening</span>
          <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>+ Ashby</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {(["screen", "results"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: "var(--radius-sm)",
              background: tab === t ? "var(--bg3)" : "transparent",
              border: `1px solid ${tab === t ? "var(--border2)" : "transparent"}`,
              color: tab === t ? "var(--text)" : "var(--text3)",
              fontSize: 13, cursor: "pointer", fontFamily: "var(--font)",
              textTransform: "capitalize",
            }}>{t}{t === "results" && results.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 10,
                background: "var(--bg)", color: "var(--text2)",
              }}>{results.length}</span>
            )}</button>
          ))}
        </div>
      </header>

      {/* -- SCREEN TAB -------------------------------------------------------- */}
      {tab === "screen" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
              Screen a candidate
            </h1>
            <p style={{ fontSize: 14, color: "var(--text3)" }}>
              Configure the role rubric, paste a resume, and run the AI filter.
              Ashby inbounds are screened automatically via webhook.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Rubric */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 16 }}>
                Role rubric
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>Job title</label>
                  <input value={candidate.jobTitle}
                    onChange={(e) => setCandidate({ ...candidate, jobTitle: e.target.value })}
                    style={{
                      width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: "var(--radius-sm)", padding: "8px 10px",
                      color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
                    }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>Job ID</label>
                  <input value={candidate.jobId}
                    onChange={(e) => setCandidate({ ...candidate, jobId: e.target.value })}
                    style={{
                      width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: "var(--radius-sm)", padding: "8px 10px",
                      color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
                    }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>Pass threshold</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(Number(e.target.value))}
                    style={{
                      width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: "var(--radius-sm)", padding: "8px 10px",
                      color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>Review threshold</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={reviewThreshold}
                    onChange={(e) => setReviewThreshold(Number(e.target.value))}
                    style={{
                      width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
                      borderRadius: "var(--radius-sm)", padding: "8px 10px",
                      color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
                    }}
                  />
                </div>
              </div>

              {[
                { label: "Must-haves", key: "mustHaves" as const, placeholder: "e.g. 5+ years React" },
                { label: "Nice-to-haves", key: "niceToHaves" as const, placeholder: "e.g. GraphQL" },
                { label: "Dealbreakers", key: "dealbreakers" as const, placeholder: "e.g. No remote work" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>{label}</label>
                  <TagInput
                    tags={rubric[key]}
                    setTags={(t) => setRubric({ ...rubric, [key]: t })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Candidate */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: 20,
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
                Candidate resume
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Name", key: "name" as const, placeholder: "Jane Smith" },
                  { label: "Email", key: "email" as const, placeholder: "jane@example.com" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>{label}</label>
                    <input value={candidate[key]}
                      onChange={(e) => setCandidate({ ...candidate, [key]: e.target.value })}
                      placeholder={placeholder}
                      style={{
                        width: "100%", background: "var(--bg)", border: "1px solid var(--border2)",
                        borderRadius: "var(--radius-sm)", padding: "8px 10px",
                        color: "var(--text)", fontSize: 13, fontFamily: "var(--font)", outline: "none",
                      }} />
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6 }}>Resume text</label>
                <textarea value={candidate.resumeText}
                  onChange={(e) => setCandidate({ ...candidate, resumeText: e.target.value })}
                  style={{
                    flex: 1, minHeight: 260, width: "100%",
                    background: "var(--bg)", border: "1px solid var(--border2)",
                    borderRadius: "var(--radius-sm)", padding: "10px 12px",
                    color: "var(--text)", fontSize: 12, fontFamily: "var(--mono)",
                    outline: "none", resize: "vertical", lineHeight: 1.6,
                  }} />
              </div>
            </div>
          </div>

          <button onClick={runScreening} disabled={loading} style={{
            width: "100%", marginTop: 16, padding: "13px 20px",
            background: loading ? "var(--bg3)" : "var(--accent2)",
            border: "none", borderRadius: "var(--radius)", cursor: loading ? "not-allowed" : "pointer",
            color: loading ? "var(--text3)" : "#022c22",
            fontSize: 14, fontWeight: 500, fontFamily: "var(--font)",
            transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: "spin 0.7s linear infinite" }}>
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="22 10"/>
                </svg>
                Screening...
              </>
            ) : "Screen candidate"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* -- RESULTS TAB ------------------------------------------------------- */}
      {tab === "results" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 57px)" }}>
          {/* Sidebar */}
          <div style={{
            borderRight: "1px solid var(--border)", overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            {/* Stats */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom: "1px solid var(--border)",
            }}>
              {([
                { label: "Pass", count: counts.pass, color: "var(--pass)" },
                { label: "Review", count: counts.review, color: "var(--review)" },
                { label: "Reject", count: counts.reject, color: "var(--reject)" },
              ] as const).map(({ label, count, color }) => (
                <div key={label} style={{
                  padding: "14px 12px", textAlign: "center",
                  borderRight: label !== "Reject" ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color, fontFamily: "var(--mono)" }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {results.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                  No results yet. Screen a candidate to get started.
                </div>
              ) : results.map((r) => (
                <ResultCard key={r.candidateId} r={r} active={selected?.candidateId === r.candidateId} onClick={() => setSelected(r)} />
              ))}
            </div>
          </div>

          {/* Detail */}
          <div style={{ overflowY: "auto" }}>
            {selected ? (
              <DetailPanel r={selected} />
            ) : (
              <div style={{
                height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text3)", fontSize: 14,
              }}>
                Select a candidate to see details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
