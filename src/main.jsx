import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  Check,
  Dumbbell,
  History,
  LogOut,
  Minus,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const storageKey = "qwl-auth";

function apiClient(token, onUnauthorized) {
  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) onUnauthorized?.();
    if (response.status === 204) return null;
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  }
  return {
    request,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: "DELETE" }),
  };
}

function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem(storageKey) || "null"));
  const [tab, setTab] = useState("log");
  const [toast, setToast] = useState("");
  const api = useMemo(
    () =>
      apiClient(auth?.token, () => {
        localStorage.removeItem(storageKey);
        setAuth(null);
      }),
    [auth?.token],
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  function saveAuth(nextAuth) {
    localStorage.setItem(storageKey, JSON.stringify(nextAuth));
    setAuth(nextAuth);
  }

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  if (!auth) return <AuthScreen api={api} onAuth={saveAuth} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Quick Workout Logger</p>
          <h1>{tab === "log" ? "Log Set" : navItems.find((item) => item.id === tab)?.label}</h1>
        </div>
        <button
          className="icon-button"
          title="Sign out"
          onClick={() => {
            localStorage.removeItem(storageKey);
            setAuth(null);
          }}
        >
          <LogOut size={20} />
        </button>
      </header>

      <main>
        {tab === "log" && <LogView api={api} flash={flash} />}
        {tab === "exercises" && <ExercisesView api={api} flash={flash} />}
        {tab === "history" && <HistoryView api={api} flash={flash} />}
        {tab === "progress" && <ProgressView api={api} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            <item.icon size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const navItems = [
  { id: "log", label: "Log", icon: Dumbbell },
  { id: "exercises", label: "Library", icon: Star },
  { id: "history", label: "History", icon: History },
  { id: "progress", label: "Progress", icon: BarChart3 },
];

function AuthScreen({ api, onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const body = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, form);
      onAuth(body);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-screen">
      <div className="brand-mark">
        <Dumbbell size={38} />
      </div>
      <h1>Quick Workout Logger</h1>
      <form className="auth-form" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>
            Sign in
          </button>
          <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>
            Create
          </button>
        </div>
        {mode === "register" && (
          <input
            value={form.name}
            placeholder="Name"
            autoComplete="name"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        )}
        <input
          value={form.email}
          placeholder="Email"
          type="email"
          autoComplete="email"
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          value={form.password}
          placeholder="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        {error && <p className="error">{error}</p>}
        <button className="primary-action" type="submit">
          <Check size={22} />
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

function LogView({ api, flash }) {
  const [exercises, setExercises] = useState([]);
  const [sets, setSets] = useState([]);
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [weight, setWeight] = useState(45);
  const [reps, setReps] = useState(8);
  const [editingSet, setEditingSet] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [today, library] = await Promise.all([api.get("/sessions/today"), api.get("/exercises")]);
    setSession(today.session);
    setSets(today.sets);
    setExercises(library.exercises);
    if (!selected && library.exercises[0]) selectExercise(library.exercises[0]);
  }

  function selectExercise(exercise) {
    setSelected(exercise);
    if (exercise.last_set) {
      setWeight(Number(exercise.last_set.weight));
      setReps(Number(exercise.last_set.reps));
    }
  }

  async function addExercise() {
    const name = search.trim();
    if (!name) return;
    const { exercise } = await api.post("/exercises", { name });
    const fullExercise = { ...exercise, last_set: null };
    setExercises([fullExercise, ...exercises.filter((item) => item.id !== exercise.id)]);
    setSearch("");
    selectExercise(fullExercise);
    flash("Exercise added");
  }

  async function logSet() {
    if (!selected) return;
    const body = await api.post("/sets", {
      session_id: session?.id,
      exercise_id: selected.id,
      weight,
      reps,
    });
    const nextSet = { ...body.set, exercise_name: selected.name };
    setSets([nextSet, ...sets]);
    setExercises((items) =>
      items.map((item) => (item.id === selected.id ? { ...item, last_set: { weight, reps } } : item)),
    );
    flash("Set logged");
  }

  async function saveSet() {
    const updated = await api.patch(`/sets/${editingSet.id}`, {
      weight: Number(editingSet.weight),
      reps: Number(editingSet.reps),
    });
    setSets(sets.map((set) => (set.id === editingSet.id ? { ...set, ...updated.set } : set)));
    setEditingSet(null);
  }

  async function deleteSet(id) {
    await api.delete(`/sets/${id}`);
    setSets(sets.filter((set) => set.id !== id));
  }

  const filtered = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const exactMatch = exercises.some((exercise) => exercise.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <section className="stack">
      <div className="search-row">
        <Search size={20} />
        <input value={search} placeholder="Find or add exercise" onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="exercise-strip">
        {filtered.map((exercise) => (
          <button
            key={exercise.id}
            className={selected?.id === exercise.id ? "exercise-chip selected" : "exercise-chip"}
            onClick={() => selectExercise(exercise)}
          >
            <span>{exercise.name}</span>
            {exercise.is_favorite && <Star size={16} fill="currentColor" />}
          </button>
        ))}
        {search.trim() && !exactMatch && (
          <button className="exercise-chip add" onClick={addExercise}>
            <Plus size={18} />
            {search.trim()}
          </button>
        )}
      </div>

      <div className="logger-panel">
        <div>
          <p className="eyebrow">Selected</p>
          <h2>{selected?.name || "Choose exercise"}</h2>
        </div>
        <Stepper label="Weight" value={weight} unit="lb" step={5} min={0} onChange={setWeight} />
        <Stepper label="Reps" value={reps} step={1} min={1} onChange={setReps} />
        <button className="primary-action log-button" disabled={!selected} onClick={logSet}>
          <Check size={24} />
          Log Set
        </button>
      </div>

      <div className="list-header">
        <h2>Current Session</h2>
        <span>{sets.length} sets</span>
      </div>
      <SetList sets={sets} onEdit={setEditingSet} onDelete={deleteSet} />

      {editingSet && (
        <EditSetModal
          set={editingSet}
          onChange={setEditingSet}
          onSave={saveSet}
          onCancel={() => setEditingSet(null)}
        />
      )}
    </section>
  );
}

function Stepper({ label, value, unit = "", step, min, onChange }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button title={`Decrease ${label}`} onClick={() => onChange(Math.max(min, Number(value) - step))}>
        <Minus size={25} />
      </button>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      <button title={`Increase ${label}`} onClick={() => onChange(Number(value) + step)}>
        <Plus size={25} />
      </button>
    </div>
  );
}

function SetList({ sets, onEdit, onDelete }) {
  if (!sets.length) return <p className="empty-state">No sets logged yet.</p>;
  return (
    <div className="set-list">
      {sets.map((set) => (
        <article key={set.id} className="set-row">
          <div>
            <strong>{set.exercise_name}</strong>
            <span>
              {formatWeight(set.weight)} x {set.reps}
            </span>
          </div>
          <div className="row-actions">
            <button title="Edit set" onClick={() => onEdit(set)}>
              <Pencil size={19} />
            </button>
            <button title="Delete set" onClick={() => onDelete(set.id)}>
              <Trash2 size={19} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function EditSetModal({ set, onChange, onSave, onCancel }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{set.exercise_name}</h2>
        <Stepper label="Weight" value={Number(set.weight)} unit="lb" step={5} min={0} onChange={(weight) => onChange({ ...set, weight })} />
        <Stepper label="Reps" value={Number(set.reps)} step={1} min={1} onChange={(reps) => onChange({ ...set, reps })} />
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary-action" onClick={onSave}>
            <Check size={20} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ExercisesView({ api, flash }) {
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    api.get("/exercises").then((body) => setExercises(body.exercises));
  }, []);

  async function createExercise() {
    if (!name.trim()) return;
    const { exercise } = await api.post("/exercises", { name });
    setExercises([exercise, ...exercises.filter((item) => item.id !== exercise.id)]);
    setName("");
  }

  async function patchExercise(id, patch) {
    const { exercise } = await api.patch(`/exercises/${id}`, patch);
    setExercises(exercises.map((item) => (item.id === id ? { ...item, ...exercise } : item)));
  }

  async function deleteExercise(id) {
    await api.delete(`/exercises/${id}`);
    setExercises(exercises.filter((item) => item.id !== id));
    flash("Exercise deleted");
  }

  return (
    <section className="stack">
      <div className="inline-create">
        <input value={name} placeholder="New exercise" onChange={(event) => setName(event.target.value)} />
        <button onClick={createExercise}>
          <Plus size={21} />
        </button>
      </div>
      <div className="set-list">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="set-row">
            <input
              className="rename-input"
              value={exercise.name}
              onChange={(event) =>
                setExercises(exercises.map((item) => (item.id === exercise.id ? { ...item, name: event.target.value } : item)))
              }
              onBlur={(event) => patchExercise(exercise.id, { name: event.target.value })}
            />
            <div className="row-actions">
              <button
                className={exercise.is_favorite ? "favorite active" : "favorite"}
                title="Favorite"
                onClick={() => patchExercise(exercise.id, { is_favorite: !exercise.is_favorite })}
              >
                <Star size={19} fill={exercise.is_favorite ? "currentColor" : "none"} />
              </button>
              <button title="Delete exercise" onClick={() => deleteExercise(exercise.id)}>
                <Trash2 size={19} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryView({ api, flash }) {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [editingSet, setEditingSet] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const body = await api.get("/sessions");
    setSessions(body.sessions);
  }

  async function openSession(id) {
    setActive(await api.get(`/sessions/${id}`));
  }

  async function deleteSession(id) {
    await api.delete(`/sessions/${id}`);
    setSessions(sessions.filter((session) => session.id !== id));
    setActive(null);
    flash("Session deleted");
  }

  async function deleteSet(id) {
    await api.delete(`/sets/${id}`);
    setActive({ ...active, sets: active.sets.filter((set) => set.id !== id) });
  }

  async function saveSet() {
    const updated = await api.patch(`/sets/${editingSet.id}`, {
      weight: Number(editingSet.weight),
      reps: Number(editingSet.reps),
    });
    setActive({
      ...active,
      sets: active.sets.map((set) => (set.id === editingSet.id ? { ...set, ...updated.set } : set)),
    });
    setEditingSet(null);
  }

  return (
    <section className="stack">
      {!active ? (
        <div className="set-list">
          {sessions.map((session) => (
            <article key={session.id} className="session-row" onClick={() => openSession(session.id)}>
              <div>
                <strong>{formatDate(session.started_at)}</strong>
                <span>{session.set_count} sets</span>
              </div>
              <span>{formatWeight(session.volume)} volume</span>
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="list-header">
            <button onClick={() => setActive(null)}>Sessions</button>
            <button className="danger" onClick={() => deleteSession(active.session.id)}>
              <Trash2 size={18} />
              Delete
            </button>
          </div>
          <h2>{formatDate(active.session.started_at)}</h2>
          <SetList sets={active.sets} onEdit={setEditingSet} onDelete={deleteSet} />
        </>
      )}
      {editingSet && <EditSetModal set={editingSet} onChange={setEditingSet} onSave={saveSet} onCancel={() => setEditingSet(null)} />}
    </section>
  );
}

function ProgressView({ api }) {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState({ series: [], pr: {} });
  const [frequency, setFrequency] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/exercises"), api.get("/progress/frequency/heatmap")]).then(([library, heatmap]) => {
      setExercises(library.exercises);
      setFrequency(heatmap.days);
      if (library.exercises[0]) setSelected(library.exercises[0]);
    });
  }, []);

  useEffect(() => {
    if (selected) api.get(`/progress/${selected.id}`).then(setProgress);
  }, [selected?.id]);

  return (
    <section className="stack progress-view">
      <div className="exercise-strip">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            className={selected?.id === exercise.id ? "exercise-chip selected" : "exercise-chip"}
            onClick={() => setSelected(exercise)}
          >
            {exercise.name}
          </button>
        ))}
      </div>
      <div className="metric-grid">
        <div>
          <span>Max Weight PR</span>
          <strong>{formatWeight(progress.pr?.max_weight || 0)}</strong>
        </div>
        <div>
          <span>Sessions</span>
          <strong>{progress.series.length}</strong>
        </div>
      </div>
      <Chart title="Max Weight" data={progress.series} dataKey="max_weight" />
      <Chart title="Estimated 1RM" data={progress.series} dataKey="estimated_1rm" />
      <Chart title="Volume" data={progress.series} dataKey="volume" />
      <div className="chart-panel">
        <div className="list-header">
          <h2>Workout Frequency</h2>
          <CalendarDays size={20} />
        </div>
        <div className="heatmap">
          {frequency.slice(-84).map((day) => (
            <span key={day.date} title={`${formatDate(day.date)}: ${day.count}`} data-count={Math.min(day.count, 4)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Chart({ title, data, dataKey }) {
  return (
    <div className="chart-panel">
      <h2>{title}</h2>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#e4ded3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke="#e84855" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatWeight(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

createRoot(document.getElementById("root")).render(<App />);
