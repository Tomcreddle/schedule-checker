import { useState } from "react";

const WEBHOOK_URL = "https://infinityw.com/webhook/schedule-check";
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

const SHIFT_TIMES = {
  Morning:   { start: "7:30 AM",  end: "12:30 PM" },
  Afternoon: { start: "12:30 PM", end: "5:30 PM"  },
  Evening:   { start: "5:30 PM",  end: "10:00 PM" },
  OFF:       { start: "",         end: ""          },
};

export default function ScheduleChecker({ onBack }) {
  const [form, setForm] = useState({
    employee_id: "",
    date:        "",
    shift_type:  "Morning",
    start_time:  "7:30 AM",
    end_time:    "12:30 PM",
    room_id:     "",
    notes:       "",
  });
  const [loading,    setLoading]    = useState(false);
  const [alert,      setAlert]      = useState(null);
  const [focusField, setFocusField] = useState(null);
  const [history,    setHistory]    = useState([]);

  const stats = {
    clear:    history.filter(h => h.status === "Clear").length,
    conflict: history.filter(h => h.status === "Conflict").length,
    checked:  history.length,
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleShiftChange = (shiftType) => {
    const times = SHIFT_TIMES[shiftType] || { start: "", end: "" };
    setForm(f => ({ ...f, shift_type: shiftType, start_time: times.start, end_time: times.end }));
  };

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

  const handleCheck = async () => {
    if (!form.employee_id || !form.date) {
      setAlert({ type: "error", title: "Missing Fields", body: "Please fill in Employee ID and Date." });
      return;
    }
    setLoading(true);
    setAlert(null);
    try {
      const { data } = await safeFetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (data.success) {
        // CLEAR — no conflicts
        setAlert({
          type:      "success",
          title:     "Schedule is Clear ✅",
          aiMessage: data.message,
          reasoning: data.data?.ai_reasoning || null,
        });
        setHistory(h => [{
          date:       form.date,
          employee:   form.employee_id,
          shift:      form.shift_type,
          room:       form.room_id || "—",
          status:     "Clear",
        }, ...h]);

      } else {
        // CONFLICT
        const conflicts  = (data.data?.conflicts   || []).map(c =>
          typeof c === "string" ? { rule: c, severity: "Critical", detail: c } : c
        );
        const altRooms   = data.data?.alternatives?.rooms || [];
        const altDates   = data.data?.alternatives?.dates || [];
        const suggested  = data.data?.suggested_date || null;
        const suggestRoom= data.data?.suggested_room || null;

        setAlert({
          type:          "error",
          title:         "Schedule Conflict Found ⚠️",
          aiMessage:     data.message,
          reasoning:     data.data?.ai_reasoning || null,
          conflicts,
          altRooms,
          altDates,
          suggestedDate: suggested,
          suggestedRoom: suggestRoom,
        });
        setHistory(h => [{
          date:     form.date,
          employee: form.employee_id,
          shift:    form.shift_type,
          room:     form.room_id || "—",
          status:   "Conflict",
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
        .check-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(16,185,129,0.4) !important; }
        .check-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
        .stat-card:hover { transform: translateY(-2px); border-color: #2a4a6a !important; }
        .back-btn:hover { background: rgba(59,130,246,0.12) !important; color: #93c5fd !important; }
        .shift-chip:hover { border-color: #3b82f6 !important; color: #93c5fd !important; }
        .alt-chip:hover { background: rgba(34,197,94,0.2) !important; transform: translateY(-1px); }
        .room-chip:hover { background: rgba(99,102,241,0.2) !important; transform: translateY(-1px); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#060d18", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif", position: "relative" }}>

        {/* Background effects — same as dashboard */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "900px", height: "600px", background: "radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: "0", right: "0", width: "400px", height: "400px", background: "radial-gradient(ellipse, rgba(37,99,235,0.04) 0%, transparent 60%)" }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4 }}>
            <defs><pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(59,130,246,0.05)" strokeWidth="1"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
        </div>

        <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "0 28px 80px", position: "relative", zIndex: 1 }}>

          {/* ── HEADER ── */}
          <div style={{ padding: "36px 0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(30,58,90,0.8)", marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>

              {/* Back button */}
              {onBack && (
                <button className="back-btn" onClick={onBack}
                  style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "10px", padding: "8px 14px", color: "#60a5fa", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s", display: "flex", alignItems: "center", gap: "6px" }}>
                  ← Back
                </button>
              )}

              <div style={{ width: "46px", height: "46px", background: "linear-gradient(135deg, #065f46, #10b981)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", boxShadow: "0 0 28px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.15)" }}>🗓️</div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px", color: "#f1f5f9" }}>Schedule Checker</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "1px" }}>Conflict Detection & Resource Management</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "24px", padding: "7px 16px", fontSize: "12px", fontWeight: "600", color: "#34d399" }}>
              <span style={{ width: "7px", height: "7px", background: "#10b981", borderRadius: "50%", animation: "glow-pulse 2s infinite", display: "inline-block" }} />
              AI Conflict Detection
            </div>
          </div>

          {/* ── STATS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "28px" }}>
            {[
              { label: "Total Checked", val: stats.checked,  color: "#60a5fa", bg: "rgba(59,130,246,0.08)",   border: "rgba(59,130,246,0.2)",  icon: "🔍" },
              { label: "Clear",         val: stats.clear,    color: "#22c55e", bg: "rgba(34,197,94,0.08)",    border: "rgba(34,197,94,0.2)",   icon: "✓"  },
              { label: "Conflicts",     val: stats.conflict, color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)",   icon: "⚠"  },
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

          {/* ── MAIN GRID ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "20px", alignItems: "start" }}>

            {/* ── FORM CARD ── */}
            <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "20px", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2d45", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "30px", height: "30px", background: "rgba(16,185,129,0.12)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🔎</div>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#cbd5e1" }}>Check Schedule Conflict</span>
              </div>

              <div style={{ padding: "24px" }}>

                {/* Row 1: Employee ID + Date */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Employee ID <span style={{ color: "#ef4444" }}>*</span></label>
                    <input style={iStyle("employee_id")} placeholder="EMP-001" value={form.employee_id}
                      onChange={e => update("employee_id", e.target.value)}
                      onFocus={() => setFocusField("employee_id")} onBlur={() => setFocusField(null)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Date <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="date" style={iStyle("date")} min={today} value={form.date}
                      onChange={e => update("date", e.target.value)}
                      onFocus={() => setFocusField("date")} onBlur={() => setFocusField(null)} />
                  </div>
                </div>

                {/* Row 2: Shift Type chips */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "10px" }}>Shift Type</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.keys(SHIFT_TIMES).map(shift => (
                      <button key={shift} className="shift-chip"
                        onClick={() => handleShiftChange(shift)}
                        style={{
                          padding: "8px 18px", borderRadius: "8px", border: `1.5px solid ${form.shift_type === shift ? "#10b981" : "#1e3a5a"}`,
                          background: form.shift_type === shift ? "rgba(16,185,129,0.12)" : "#0c1525",
                          color: form.shift_type === shift ? "#34d399" : "#475569",
                          fontSize: "13px", fontWeight: "600", cursor: "pointer",
                          fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s"
                        }}>
                        {shift === "Morning" ? "🌅" : shift === "Afternoon" ? "☀️" : shift === "Evening" ? "🌙" : "🛌"} {shift}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 3: Start Time + End Time (auto-filled, editable) */}
                {form.shift_type !== "OFF" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>Start Time</label>
                      <input style={iStyle("start_time")} placeholder="7:30 AM" value={form.start_time}
                        onChange={e => update("start_time", e.target.value)}
                        onFocus={() => setFocusField("start_time")} onBlur={() => setFocusField(null)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>End Time</label>
                      <input style={iStyle("end_time")} placeholder="12:30 PM" value={form.end_time}
                        onChange={e => update("end_time", e.target.value)}
                        onFocus={() => setFocusField("end_time")} onBlur={() => setFocusField(null)} />
                    </div>
                  </div>
                )}

                {/* Row 4: Room ID + Notes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>
                      Room ID <span style={{ color: "#2a3a50", fontWeight: "500" }}>(optional)</span>
                    </label>
                    <input style={iStyle("room_id")} placeholder="ROOM-01" value={form.room_id}
                      onChange={e => update("room_id", e.target.value)}
                      onFocus={() => setFocusField("room_id")} onBlur={() => setFocusField(null)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "7px" }}>
                      Notes <span style={{ color: "#2a3a50", fontWeight: "500" }}>(optional)</span>
                    </label>
                    <input style={iStyle("notes")} placeholder="Additional details..." value={form.notes}
                      onChange={e => update("notes", e.target.value)}
                      onFocus={() => setFocusField("notes")} onBlur={() => setFocusField(null)} />
                  </div>
                </div>

                {/* CHECK BUTTON */}
                <button className="check-btn" onClick={handleCheck} disabled={loading}
                  style={{ width: "100%", background: "linear-gradient(135deg, #065f46, #10b981)", border: "none", borderRadius: "12px", padding: "14px", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 20px rgba(16,185,129,0.3)", letterSpacing: "0.2px" }}>
                  {loading
                    ? <><span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Checking…</>
                    : <><span style={{ fontSize: "16px" }}>🔍</span> Check Schedule</>}
                </button>

                {/* ── ALERT / AI RESULT ── */}
                {alert && (
                  <div style={{ marginTop: "16px", borderRadius: "14px", overflow: "hidden", animation: "slideDown 0.25s ease",
                    border: `1px solid ${alert.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>

                    {/* Header */}
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "9px",
                      background: alert.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                      <span style={{ fontSize: "18px" }}>{alert.type === "success" ? "✅" : "❌"}</span>
                      <span style={{ fontWeight: "700", fontSize: "14px", color: alert.type === "success" ? "#4ade80" : "#f87171" }}>
                        {alert.title}
                      </span>
                    </div>

                    <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.3)" }}>

                      {/* Plain error body */}
                      {alert.body && !alert.aiMessage && (
                        <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6" }}>{alert.body}</p>
                      )}

                      {/* AI message bubble */}
                      {alert.aiMessage && (
                        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: (alert.conflicts?.length || alert.altRooms?.length || alert.altDates?.length) ? "14px" : 0 }}>
                          <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #065f46, #10b981)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>🤖</div>
                          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", flex: 1 }}>
                            <div style={{ fontSize: "10px", color: "#10b981", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>AI Analysis</div>
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

                      {/* Alternative Rooms */}
                      {alert.altRooms && alert.altRooms.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "700", marginBottom: "8px" }}>🏠 Available Alternative Rooms</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {alert.altRooms.map((r, i) => (
                              <span key={i} className="room-chip"
                                onClick={() => { update("room_id", r.room_id); }}
                                style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s", display: "inline-block" }}>
                                🏠 {r.room_name} {r.capacity ? `· Cap: ${r.capacity}` : ""} {r.location ? `· ${r.location}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternative Dates */}
                      {alert.altDates && alert.altDates.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: "700", marginBottom: "8px" }}>📅 Available Alternative Dates</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {alert.altDates.map((a, i) => (
                              <span key={i} className="alt-chip"
                                onClick={() => { update("date", a.date || a); setAlert(prev => ({ ...prev, title: "Date Updated — Recheck to confirm" })); }}
                                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s", display: "inline-block" }}>
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

              {/* Check History */}
              <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "20px", overflow: "hidden" }}>
                <div style={{ padding: "18px 22px", borderBottom: "1px solid #1a2d45", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <div style={{ width: "28px", height: "28px", background: "rgba(16,185,129,0.12)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📋</div>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: "#cbd5e1" }}>Check History</span>
                  </div>
                  <span style={{ fontSize: "11px", background: "rgba(16,185,129,0.1)", color: "#34d399", padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(16,185,129,0.2)", fontWeight: "600" }}>
                    {history.length} checked
                  </span>
                </div>

                <div style={{ padding: "4px 0", maxHeight: "340px", overflowY: "auto" }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔍</div>
                      <div style={{ fontSize: "13px", color: "#334155" }}>No checks yet</div>
                      <div style={{ fontSize: "11px", color: "#1e3a5a", marginTop: "4px" }}>Results will appear here</div>
                    </div>
                  ) : history.map((h, i) => (
                    <div key={i} className="hist-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderBottom: i < history.length - 1 ? "1px solid #0f1e30" : "none", transition: "background 0.15s", gap: "10px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: "600", fontSize: "13px", color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          {h.employee}
                          <span style={{ fontSize: "10px", color: "#334155", fontWeight: "600", background: "#0f1e30", padding: "1px 7px", borderRadius: "4px", border: "1px solid #1e3a5a" }}>{h.shift}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{formatDate(h.date)} · Room: {h.room}</div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <span style={{
                          fontSize: "11px", fontWeight: "700",
                          color:      h.status === "Clear" ? "#22c55e" : "#ef4444",
                          background: h.status === "Clear" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                          border:    `1px solid ${h.status === "Clear" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                          borderRadius: "6px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap"
                        }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: h.status === "Clear" ? "#22c55e" : "#ef4444", display: "inline-block", boxShadow: `0 0 6px ${h.status === "Clear" ? "#22c55e" : "#ef4444"}` }} />
                          {h.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflict Rules Info */}
              <div style={{ background: "#0c1525", border: "1px solid #1e3a5a", borderRadius: "16px", padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <div style={{ width: "28px", height: "28px", background: "rgba(245,158,11,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>⚖️</div>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.8px" }}>Conflict Rules</span>
                </div>
                {[
                  { icon: "👤", text: "No employee double-booking" },
                  { icon: "🏠", text: "No room double-booking" },
                  { icon: "🚫", text: "No 2+ consecutive rest days" },
                  { icon: "💡", text: "AI suggests best alternatives" },
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
            <span style={{ fontSize: "12px", color: "#1e3a5a", fontWeight: "500" }}>⚡ JISCare AI Employee Scheduler · Schedule Conflict Checker</span>
          </div>
        </div>
      </div>
    </>
  );
}