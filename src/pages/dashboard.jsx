import { useState } from "react";

const WEBHOOK_URL = "https://infinityw.com/webhook/dayoff-submit";
const today = new Date().toISOString().split("T")[0];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

async function safeFetch(url, options) {
  let res;
  try { res = await fetch(url, options); }
  catch (e) { throw new Error("Cannot reach server. Make sure the n8n workflow is ACTIVE."); }
  let rawText = "";
  try { rawText = await res.text(); } catch { throw new Error("Could not read server response."); }
  if (!rawText || rawText.trim() === "")
    throw new Error(`n8n returned an empty response (HTTP ${res.status}). Make sure: (1) workflow is ACTIVE, (2) last node is Respond to Webhook.`);
  if (rawText.trim().startsWith("<"))
    throw new Error("n8n returned an HTML error page. Check the n8n execution log.");
  let data;
  try { data = JSON.parse(rawText); }
  catch { throw new Error("Response is not valid JSON: " + rawText.substring(0, 150)); }
  return { status: res.status, ok: res.ok, data };
}

const STATUS_COLOR  = { Approved: "#22c55e", Pending: "#f59e0b", Rejected: "#ef4444" };
const STATUS_BG     = { Approved: "rgba(34,197,94,0.08)", Pending: "rgba(245,158,11,0.08)", Rejected: "rgba(239,68,68,0.08)" };
const STATUS_BORDER = { Approved: "rgba(34,197,94,0.2)", Pending: "rgba(245,158,11,0.2)", Rejected: "rgba(239,68,68,0.2)" };

export default function Dashboard() {
  const [form, setForm] = useState({ employee_id: "", employee_name: "", request_date: "", reason: "Personal", notes: "" });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [focusField, setFocusField] = useState(null);
  // Start with empty history — gets populated from real submissions
  const [history, setHistory] = useState([]);

  const stats = {
    approved:  history.filter(h => h.status === "Approved").length,
    rejected:  history.filter(h => h.status === "Rejected").length,
    pending:   history.filter(h => h.status === "Pending").length,
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const iStyle = (field) => ({
    width: "100%", boxSizing: "border-box",
    background: focusField === field ? "#0f1d2e" : "#0c1525",
    border: `1.5px solid ${focusField === field ? "#3b82f6" : "#1e3a5a"}`,
    borderRadius: "10px", padding: "11px 14px",
    color: "#e2e8f0", fontSize: "14px", outline: "none",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "all 0.18s",
    boxShadow: focusField === field ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
  });

  const handleSubmit = async () => {
    if (!form.employee_id || !form.request_date || !form.employee_name) {
      setAlert({ type: "error", title: "Missing Fields", body: "Please fill in Employee ID, Full Name, and Request Date." });
      return;
    }
    setLoading(true);
    setAlert(null);
    try {
      const { data } = await safeFetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", ...form, requested_on: today }),
      });

      // ── APPROVED ──────────────────────────────────────────────
      if (data.success) {
        const empName = data.data?.employee_name || form.employee_name;
        const status  = data.data?.status || "Approved";
        const aiMsg   = data.message || "Your day-off request has been approved.";
        const reasoning = data.data?.ai_reasoning || null;

        setAlert({
          type: "success",
          title: status === "Approved" ? "Request Approved! 🎉" : "Request Submitted",
          aiMessage: aiMsg,
          reasoning,
        });
        setHistory(h => [{
          date: form.request_date,
          name: empName,
          id: form.employee_id,
          status,
          reason: form.reason,
        }, ...h]);
        setForm({ employee_id: "", employee_name: "", request_date: "", reason: "Personal", notes: "" });

      // ── REJECTED ──────────────────────────────────────────────
      } else {
        const aiMsg      = data.message || "Your request could not be approved.";
        const reasoning  = data.data?.ai_reasoning || null;
        const alts       = data.data?.alternatives || [];
        const suggested  = data.data?.suggested_date || null;
        const conflicts  = (data.data?.conflicts || []).map(c =>
          typeof c === "string" ? { rule: c, severity: "Critical", detail: c } : c
        );

        setAlert({
          type: "error",
          title: "Request Rejected",
          aiMessage: aiMsg,
          reasoning,
          conflicts,
          alternatives: alts,
          suggestedDate: suggested,
        });
        setHistory(h => [{
          date: form.request_date,
          name: form.employee_name,
          id: form.employee_id,
          status: "Rejected",
          reason: form.reason,
        }, ...h]);
      }
    } catch (e) {
      setAlert({ type: "error", title: "Connection Error", body: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060d18; font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #1e3a5a; border-radius: 3px; }
        select option { background: #0c1525; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4) brightness(0.9); cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow-pulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        .hist-row:hover { background: rgba(59,130,246,0.04) !important; }
        .alt-chip:hover { background: rgba(34,197,94,0.2) !important; transform: translateY(-1px); }
        .submit-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(59,130,246,0.4) !important; }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
        .stat-card:hover { transform: translateY(-2px); border-color: #2a4a6a !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060d18", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative" }}>

        {/* BG effects */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "900px", height: "600px", background: "radial-gradient(ellipse, rgba(37,99,235,0.07) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: "0", right: "0", width: "400px", height: "400px", background: "radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4 }}>
            <defs><pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
        </div>

        <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "0 28px 80px", position: "relative", zIndex: 1 }}>

          {/* HEADER */}
          <div style={{ padding: "36px 0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(30,58,90,0.8)", marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "46px", height: "46px", background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", boxShadow: "0 0 28px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)" }}>🏥</div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px", color: "#f1f5f9" }}>JISCare Portal</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "1px" }}>Employee Day-Off Management System</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "24px", padding: "7px 16px", fontSize: "12px", fontWeight: "600", color: "#60a5fa" }}>
              <span style={{ width: "7px", height: "7px", background: "#3b82f6", borderRadius: "50%", animation: "glow-pulse 2s infinite", display: "inline-block" }} />
              AI-Powered Scheduling
            </div>
          </div>

          {/* STATS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "28px" }}>
            {[
              { label: "Approved", val: stats.approved, color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",  icon: "✓" },
              { label: "Pending",  val: stats.pending,  color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", icon: "◷" },
              { label: "Rejected", val: stats.rejected, color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  icon: "✕" },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ background: "#0c1525", border: `1px solid ${s.border}`, borderRadius: "16px", padding: "22px 24px", display: "flex", alignItems: "center", gap: "18px", transition: "all 0.2s", cursor: "default" }}>
                <div style={{ width: "50px", height: "50px", background: s.bg, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: s.color, fontWeight: "800", flexShrink: 0, border: `1px solid ${s.border}` }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: "34px", fontWeight: "800", color: s.color, letterSpacing: "-1.5px", lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "600" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "20px", alignItems: "start" }}>

            {/* ── FORM CARD ── */}
            <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "20px", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2d45", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "30px", height: "30px", background: "rgba(59,130,246,0.12)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>📝</div>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#cbd5e1" }}>Submit Day-Off Request</span>
              </div>

              <div style={{ padding: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Employee ID <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={iStyle("employee_id")} placeholder="EMP-001" value={form.employee_id}
                      onChange={e => update("employee_id", e.target.value)}
                      onFocus={() => setFocusField("employee_id")} onBlur={() => setFocusField(null)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={iStyle("employee_name")} placeholder="Juan Dela Cruz" value={form.employee_name}
                      onChange={e => update("employee_name", e.target.value)}
                      onFocus={() => setFocusField("employee_name")} onBlur={() => setFocusField(null)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Request Date <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="date" style={iStyle("request_date")} min={today} value={form.request_date}
                      onChange={e => update("request_date", e.target.value)}
                      onFocus={() => setFocusField("request_date")} onBlur={() => setFocusField(null)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Reason</label>
                    <select style={{ ...iStyle("reason"), cursor: "pointer" }}
                      value={form.reason} onChange={e => update("reason", e.target.value)}
                      onFocus={() => setFocusField("reason")} onBlur={() => setFocusField(null)}>
                      {["Personal","Medical","Family","Vacation","Emergency","Other"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Notes <span style={{ color: "#2a3a50", fontWeight: "500" }}>(optional)</span></label>
                  <textarea style={{ ...iStyle("notes"), resize: "none", height: "76px" }} placeholder="Additional details..."
                    value={form.notes} onChange={e => update("notes", e.target.value)}
                    onFocus={() => setFocusField("notes")} onBlur={() => setFocusField(null)} />
                </div>

                {/* SUBMIT BUTTON ONLY */}
                <button className="submit-btn" onClick={handleSubmit} disabled={loading}
                  style={{ width: "100%", background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: "12px", padding: "14px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 20px rgba(59,130,246,0.3)", letterSpacing: "0.2px" }}>
                  {loading
                    ? <><span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Submitting…</>
                    : <><span style={{ fontSize: "16px" }}>🚀</span> Submit Day-Off Request</>}
                </button>

                {/* ── ALERT / AI MESSAGE ── */}
                {alert && (
                  <div style={{ marginTop: "16px", borderRadius: "14px", overflow: "hidden", animation: "slideDown 0.25s ease",
                    border: `1px solid ${alert.type === "success" ? "rgba(34,197,94,0.3)" : alert.type === "warning" ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}` }}>

                    {/* Header stripe */}
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "9px",
                      background: alert.type === "success" ? "rgba(34,197,94,0.12)" : alert.type === "warning" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)" }}>
                      <span style={{ fontSize: "18px" }}>{alert.type === "success" ? "✅" : alert.type === "warning" ? "⚠️" : "❌"}</span>
                      <span style={{ fontWeight: "700", fontSize: "14px", color: alert.type === "success" ? "#4ade80" : alert.type === "warning" ? "#fbbf24" : "#f87171" }}>
                        {alert.title}
                      </span>
                    </div>

                    {/* AI Message — main content */}
                    <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.3)" }}>
                      {/* Plain error body (connection errors etc) */}
                      {alert.body && !alert.aiMessage && (
                        <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6" }}>{alert.body}</p>
                      )}

                      {/* AI message bubble */}
                      {alert.aiMessage && (
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: (alert.conflicts?.length || alert.alternatives?.length) ? "14px" : 0 }}>
                          <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>🤖</div>
                          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", flex: 1 }}>
                            <div style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>AI Decision</div>
                            <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.65" }}>{alert.aiMessage}</p>
                            {alert.reasoning && (
                              <p style={{ fontSize: "11px", color: "#475569", marginTop: "6px", fontStyle: "italic" }}>Reason: {alert.reasoning}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conflicts list */}
                      {alert.conflicts && alert.conflicts.length > 0 && (
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "700", marginBottom: "2px" }}>⚠️ Conflict Details</div>
                          {alert.conflicts.map((c, i) => (
                            <div key={i} style={{ background: "rgba(239,68,68,0.05)", borderRadius: "8px", padding: "9px 12px", border: "1px solid rgba(239,68,68,0.12)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 7px", borderRadius: "4px", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{c.severity}</span>
                                <span style={{ fontSize: "12px", fontWeight: "600", color: "#cbd5e1" }}>{c.rule}</span>
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>{c.detail}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Alternative dates */}
                      {alert.alternatives && alert.alternatives.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "700", marginBottom: "8px" }}>📅 Available Alternative Dates</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {alert.alternatives.map((a, i) => (
                              <span key={i} className="alt-chip"
                                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s", display: "inline-block" }}
                                onClick={() => { const d = a.date || a; update("request_date", d); setAlert({ type: "warning", title: "Date Updated", body: null, aiMessage: `Date changed to ${formatDate(d)}. Fill in the form and submit again.` }); }}>
                                {formatDate(a.date || a)}{a.weekday ? ` · ${a.weekday}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Recent Requests */}
              <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "20px", overflow: "hidden" }}>
                <div style={{ padding: "18px 22px", borderBottom: "1px solid #1a2d45", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <div style={{ width: "28px", height: "28px", background: "rgba(99,102,241,0.12)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📋</div>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: "#cbd5e1" }}>Recent Requests</span>
                  </div>
                  <span style={{ fontSize: "11px", background: "rgba(59,130,246,0.1)", color: "#60a5fa", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(59,130,246,0.2)", fontWeight: "600" }}>
                    {history.length} total
                  </span>
                </div>

                <div style={{ padding: "4px 0", maxHeight: "340px", overflowY: "auto" }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
                      <div style={{ fontSize: "13px", color: "#334155" }}>No requests yet</div>
                      <div style={{ fontSize: "11px", color: "#1e3a5a", marginTop: "4px" }}>Submissions will appear here</div>
                    </div>
                  ) : history.map((h, i) => (
                    <div key={i} className="hist-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderBottom: i < history.length - 1 ? "1px solid #0f1e30" : "none", transition: "background 0.15s", gap: "10px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: "600", fontSize: "13px", color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          {h.name}
                          <span style={{ fontSize: "10px", color: "#334155", fontWeight: "600", background: "#0f1e30", padding: "1px 7px", borderRadius: "4px", border: "1px solid #1e3a5a" }}>{h.id}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{formatDate(h.date)} · {h.reason}</div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: STATUS_COLOR[h.status], background: STATUS_BG[h.status], border: `1px solid ${STATUS_BORDER[h.status]}`, borderRadius: "6px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: STATUS_COLOR[h.status], display: "inline-block", boxShadow: `0 0 6px ${STATUS_COLOR[h.status]}` }} />
                          {h.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduling Rules */}
              <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "16px", padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ width: "28px", height: "28px", background: "rgba(245,158,11,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚖️</div>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.8px" }}>Scheduling Rules</span>
                </div>
                {[
                  { icon: "🚫", text: "No consecutive days off" },
                  { icon: "📅", text: "Max 1 day off per week" },
                  { icon: "🔁", text: "No same weekday repeat" },
                  { icon: "👥", text: "Max 2 employees off per day" },
                ].map(r => (
                  <div key={r.text} style={{ display: "flex", alignItems: "center", gap: "9px", padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", background: "rgba(255,255,255,0.015)" }}>
                    <span style={{ fontSize: "14px" }}>{r.icon}</span>
                    <span style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>{r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #0f1e30" }}>
            <span style={{ fontSize: "12px", color: "#1e3a5a", fontWeight: "500" }}>⚡ JISCare AI Employee Scheduler · Day-Off Request Portal</span>
          </div>
        </div>
      </div>
    </>
  );
}