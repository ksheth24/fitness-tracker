import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Dumbbell,
  History,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Search,
  Share2,
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
const muscleGroupOptions = ["legs", "shoulders", "biceps", "triceps", "back", "chest", "abs"];

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
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetLink, setResetLink] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setResetLink("");
    try {
      if (mode === "forgot") {
        const body = await api.post("/auth/forgot-password", { email: form.email });
        setNotice(body.message);
        if (body.reset_url) setResetLink(body.reset_url);
        return;
      }
      if (mode === "reset") {
        const body = await api.post("/auth/reset-password", { token: resetToken, password: form.password });
        window.history.replaceState({}, "", window.location.pathname);
        onAuth(body);
        return;
      }
      const body = await api.post(`/auth/${mode === "login" ? "login" : "register"}`, form);
      onAuth(body);
    } catch (err) {
      setError(err.message);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setResetLink("");
  }

  const title =
    mode === "forgot" ? "Reset password" : mode === "reset" ? "Choose new password" : "Quick Workout Logger";

  return (
    <div className="auth-screen">
      <div className="brand-mark">
        <Dumbbell size={38} />
      </div>
      <h1>{title}</h1>
      <form className="auth-form" onSubmit={submit}>
        {mode !== "forgot" && mode !== "reset" && (
          <div className="segmented">
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>
              Sign in
            </button>
            <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => switchMode("register")}>
              Create
            </button>
          </div>
        )}
        {mode === "register" && (
          <input
            value={form.name}
            placeholder="Name"
            autoComplete="name"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        )}
        {mode !== "reset" && (
          <input
            value={form.email}
            placeholder="Email"
            type="email"
            autoComplete="email"
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        )}
        {mode !== "forgot" && (
          <input
            value={form.password}
            placeholder={mode === "reset" ? "New password" : "Password"}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        )}
        {notice && <p className="success">{notice}</p>}
        {resetLink && (
          <a className="reset-link" href={resetLink}>
            Open reset link
          </a>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary-action" type="submit">
          {mode === "forgot" ? (
            <Mail size={22} />
          ) : mode === "reset" ? (
            <KeyRound size={22} />
          ) : (
            <Check size={22} />
          )}
          {mode === "forgot"
            ? "Send reset link"
            : mode === "reset"
              ? "Update password"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
        </button>
        {mode === "login" && (
          <button className="text-action" type="button" onClick={() => switchMode("forgot")}>
            Forgot password?
          </button>
        )}
        {mode === "forgot" && (
          <button className="text-action" type="button" onClick={() => switchMode("login")}>
            Back to sign in
          </button>
        )}
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
  const [newExerciseGroup, setNewExerciseGroup] = useState("");
  const [expandedExerciseGroups, setExpandedExerciseGroups] = useState({});
  const [weight, setWeight] = useState(45);
  const [reps, setReps] = useState(8);
  const [editingSet, setEditingSet] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [previousWorkout, setPreviousWorkout] = useState({ loading: false, session: null, sets: [] });
  const previousRequestRef = useRef(0);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [activeWorkout, library] = await Promise.all([api.get("/sessions/active"), api.get("/exercises")]);
    setSession(activeWorkout.session);
    setSets(activeWorkout.sets);
    setExercises(library.exercises);
    if (!selected && library.exercises[0]) selectExercise(library.exercises[0], activeWorkout.session?.id);
  }

  async function startWorkout() {
    try {
      const body = await api.post("/sessions", {});
      setSession(body.session);
      setSets([]);
      if (selected) selectExercise(selected, body.session.id);
      flash("Workout started");
    } catch (err) {
      flash(err.message);
      await load();
    }
  }

  async function endWorkout() {
    if (!session) return;
    try {
      const body = await api.patch(`/sessions/${session.id}/end`, {});
      setSession(null);
      setSets([]);
      setRecapOpen(false);
      setPreviousWorkout({ loading: false, session: null, sets: [] });
      flash(`Workout ended: ${formatDate(body.session.started_at)}`);
      await load();
    } catch (err) {
      flash(err.message);
      await load();
    }
  }

  async function selectExercise(exercise, currentSessionId = session?.id) {
    setSelected(exercise);
    if (exercise.last_set) {
      setWeight(Number(exercise.last_set.weight));
      setReps(Number(exercise.last_set.reps));
    }

    const requestId = previousRequestRef.current + 1;
    previousRequestRef.current = requestId;
    setPreviousWorkout({ loading: true, session: null, sets: [] });

    try {
      const query = currentSessionId ? `?current_session_id=${encodeURIComponent(currentSessionId)}` : "";
      const body = await api.get(`/exercises/${exercise.id}/previous-session${query}`);
      if (previousRequestRef.current === requestId) {
        setPreviousWorkout({ loading: false, session: body.session, sets: body.sets });
      }
    } catch {
      if (previousRequestRef.current === requestId) {
        setPreviousWorkout({ loading: false, session: null, sets: [] });
      }
    }
  }

  async function addExercise() {
    const name = search.trim();
    if (!name) return;
    const { exercise } = await api.post("/exercises", { name, muscle_group: newExerciseGroup || null });
    const fullExercise = { ...exercise, last_set: null };
    setExercises([fullExercise, ...exercises.filter((item) => item.id !== exercise.id)]);
    setSearch("");
    setNewExerciseGroup("");
    selectExercise(fullExercise);
    flash("Exercise added");
  }

  async function logSet() {
    if (!selected || !session) return;
    try {
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
    } catch (err) {
      flash(err.message);
      await load();
    }
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

  function toggleExerciseGroup(groupId) {
    setExpandedExerciseGroups((groups) => ({ ...groups, [groupId]: !groups[groupId] }));
  }

  const filtered = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const exactMatch = exercises.some((exercise) => exercise.name.toLowerCase() === search.trim().toLowerCase());
  const groupedExercises = groupExercisesByMuscle(filtered);

  return (
    <section className="stack">
      <div className="search-row">
        <Search size={20} />
        <input value={search} placeholder="Find or add exercise" onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="exercise-groups">
        {groupedExercises.map((group) => {
          const isExpanded = Boolean(expandedExerciseGroups[group.id]);
          return (
            <section key={group.id} className="set-group exercise-picker-group">
              <button
                className="set-group-header"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleExerciseGroup(group.id)}
              >
                <span className="collapse-icon">
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </span>
                <h3>{group.label}</h3>
                <span>{group.exercises.length} exercises</span>
              </button>
              {isExpanded && (
                <div className="exercise-strip grouped-picker">
                  {group.exercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      className={selected?.id === exercise.id ? "exercise-chip selected" : "exercise-chip"}
                      onClick={() => selectExercise(exercise)}
                    >
                      <span>{exercise.name}</span>
                      {exercise.is_favorite && <Star size={16} fill="currentColor" />}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {search.trim() && !exactMatch && (
          <div className="add-exercise-panel">
            <select value={newExerciseGroup} onChange={(event) => setNewExerciseGroup(event.target.value)}>
              <option value="">No muscle group</option>
              {muscleGroupOptions.map((group) => (
                <option key={group} value={group}>
                  {formatMuscleGroup(group)}
                </option>
              ))}
            </select>
            <button className="exercise-chip add" onClick={addExercise}>
              <Plus size={18} />
              {search.trim()}
            </button>
          </div>
        )}
      </div>

      <div className="logger-panel">
        <div>
          <p className="eyebrow">{session ? `Started ${formatDateTime(session.started_at)}` : "No active workout"}</p>
          <h2>{session ? selected?.name || "Choose exercise" : "Start a workout first"}</h2>
        </div>
        {session ? (
          <>
            <Stepper label="Weight" value={weight} unit="lb" step={5} min={0} onChange={setWeight} />
            <Stepper label="Reps" value={reps} step={1} min={1} onChange={setReps} />
            <div className="workout-actions">
              <button className="primary-action log-button" disabled={!selected} onClick={logSet}>
                <Check size={24} />
                Log Set
              </button>
              <button className="end-workout" onClick={endWorkout}>
                End Workout
              </button>
            </div>
          </>
        ) : (
          <button className="primary-action log-button" onClick={startWorkout}>
            <Plus size={24} />
            Start Workout
          </button>
        )}
      </div>

      {selected && <PreviousWorkoutPanel workout={previousWorkout} />}

      <div className="list-header">
        <h2>Active Workout</h2>
        <div className="header-actions">
          <span>{sets.length} sets</span>
          <button className="share-trigger" disabled={!sets.length} onClick={() => setRecapOpen(true)}>
            <Share2 size={18} />
            Share
          </button>
        </div>
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
      {recapOpen && (
        <WorkoutRecapModal
          api={api}
          session={session}
          sets={sets}
          flash={flash}
          onClose={() => setRecapOpen(false)}
        />
      )}
    </section>
  );
}

function PreviousWorkoutPanel({ workout }) {
  const volume = workout.sets.reduce((total, set) => total + Number(set.weight) * Number(set.reps), 0);
  const bestSet = workout.sets.reduce((best, set) => {
    if (!best || Number(set.weight) > Number(best.weight)) return set;
    return best;
  }, null);

  return (
    <div className="previous-panel">
      <div className="list-header">
        <div>
          <p className="eyebrow">Previous Workout</p>
          <h2>{workout.session ? formatDate(workout.session.started_at) : "No prior sets"}</h2>
        </div>
        {workout.sets.length > 0 && <span>{workout.sets.length} sets</span>}
      </div>

      {workout.loading && <p className="empty-state">Loading previous workout...</p>}
      {!workout.loading && workout.sets.length === 0 && (
        <p className="empty-state">This exercise has no previous workout yet.</p>
      )}
      {!workout.loading && workout.sets.length > 0 && (
        <>
          <div className="previous-summary">
            <div>
              <span>Best</span>
              <strong>{formatLoad(bestSet)}</strong>
            </div>
            <div>
              <span>Volume</span>
              <strong>{formatWeight(volume)}</strong>
            </div>
          </div>
          <div className="previous-sets">
            {workout.sets.map((set) => (
              <div key={set.id}>
                <span>Set {set.set_order}</span>
                <strong>{formatLoad(set)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({ label, value, unit = "", step, min, onChange }) {
  const [draft, setDraft] = useState(String(value));
  const inputLabel = unit ? `${label} (${unit})` : label;

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitInput(rawValue) {
    setDraft(rawValue);
    if (rawValue === "") return;

    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue < min) return;

    onChange(unit ? nextValue : Math.round(nextValue));
  }

  function resetInvalidInput() {
    const nextValue = Number(draft);
    if (!Number.isFinite(nextValue) || draft === "" || nextValue < min) {
      setDraft(String(value));
    }
  }

  return (
    <div className="stepper">
      <span>{label}</span>
      <button title={`Decrease ${label}`} onClick={() => onChange(Math.max(min, Number(value) - step))}>
        <Minus size={25} />
      </button>
      <label className="stepper-value">
        <input
          aria-label={inputLabel}
          inputMode={unit ? "decimal" : "numeric"}
          min={min}
          step={step}
          type="number"
          value={draft}
          onBlur={resetInvalidInput}
          onChange={(event) => commitInput(event.target.value)}
        />
        {unit && <small>{unit}</small>}
      </label>
      <button title={`Increase ${label}`} onClick={() => onChange(Number(value) + step)}>
        <Plus size={25} />
      </button>
    </div>
  );
}

function SetList({ sets, onEdit, onDelete, onMove }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  if (!sets.length) return <p className="empty-state">No sets logged yet.</p>;
  const groupedSets = sets.reduce((groups, set) => {
    const exerciseName = set.exercise_name || "Exercise";
    if (!groups.has(exerciseName)) groups.set(exerciseName, []);
    groups.get(exerciseName).push(set);
    return groups;
  }, new Map());

  function toggleGroup(exerciseName) {
    setExpandedGroups((groups) => ({ ...groups, [exerciseName]: !groups[exerciseName] }));
  }

  return (
    <div className="set-list">
      {[...groupedSets.entries()].map(([exerciseName, exerciseSets]) => {
        const isExpanded = Boolean(expandedGroups[exerciseName]);
        return (
          <section key={exerciseName} className="set-group">
            <button
              className="set-group-header"
              type="button"
              aria-expanded={isExpanded}
              onClick={() => toggleGroup(exerciseName)}
            >
              <span className="collapse-icon">
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </span>
              <h3>{exerciseName}</h3>
              <span>{exerciseSets.length} sets</span>
            </button>
            {isExpanded &&
              exerciseSets.map((set) => (
                <article key={set.id} className="set-row grouped">
                  <div>
                    <strong>Set {set.set_order}</strong>
                    <span>{formatLoad(set)}</span>
                  </div>
                  <div className="row-actions">
                    {onMove && (
                      <button title="Move set" onClick={() => onMove(set)}>
                        <History size={19} />
                      </button>
                    )}
                    <button title="Edit set" onClick={() => onEdit(set)}>
                      <Pencil size={19} />
                    </button>
                    <button title="Delete set" onClick={() => onDelete(set.id)}>
                      <Trash2 size={19} />
                    </button>
                  </div>
                </article>
              ))}
          </section>
        );
      })}
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

function MoveSetModal({ set, sessions, currentSessionId, onMove, onCancel }) {
  const targets = sessions.filter((session) => session.id !== currentSessionId);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div>
          <p className="eyebrow">Move Set</p>
          <h2>{set.exercise_name}</h2>
        </div>
        <div className="set-list">
          {targets.map((session) => (
            <button key={session.id} className="session-target" onClick={() => onMove(session.id)}>
              <span>{formatDate(session.started_at)}</span>
              <strong>{formatSessionRange(session)}</strong>
            </button>
          ))}
          {!targets.length && <p className="empty-state">No other workouts yet.</p>}
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ExercisesView({ api, flash }) {
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    api.get("/exercises").then((body) => setExercises(body.exercises));
  }, []);

  async function createExercise() {
    if (!name.trim()) return;
    const { exercise } = await api.post("/exercises", { name, muscle_group: muscleGroup || null });
    setExercises([exercise, ...exercises.filter((item) => item.id !== exercise.id)]);
    setName("");
    setMuscleGroup("");
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

  function toggleGroup(groupId) {
    setExpandedGroups((groups) => ({ ...groups, [groupId]: !groups[groupId] }));
  }

  function renderExerciseRow(exercise) {
    return (
      <article key={exercise.id} className="set-row grouped">
        <input
          className="rename-input"
          value={exercise.name}
          onChange={(event) =>
            setExercises(exercises.map((item) => (item.id === exercise.id ? { ...item, name: event.target.value } : item)))
          }
          onBlur={(event) => patchExercise(exercise.id, { name: event.target.value })}
        />
        <select
          className="muscle-select"
          value={exercise.muscle_group || ""}
          onChange={(event) => patchExercise(exercise.id, { muscle_group: event.target.value || null })}
        >
          <option value="">No group</option>
          {muscleGroupOptions.map((group) => (
            <option key={group} value={group}>
              {formatMuscleGroup(group)}
            </option>
          ))}
        </select>
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
    );
  }

  const groupedExercises = groupExercisesByMuscle(exercises);

  return (
    <section className="stack">
      <div className="inline-create">
        <input value={name} placeholder="New exercise" onChange={(event) => setName(event.target.value)} />
        <select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)}>
          <option value="">Group</option>
          {muscleGroupOptions.map((group) => (
            <option key={group} value={group}>
              {formatMuscleGroup(group)}
            </option>
          ))}
        </select>
        <button onClick={createExercise}>
          <Plus size={21} />
        </button>
      </div>
      <div className="set-list">
        {groupedExercises.map((group) => {
          const isExpanded = Boolean(expandedGroups[group.id]);
          return (
            <section key={group.id} className="set-group">
              <button
                className="set-group-header"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="collapse-icon">
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </span>
                <h3>{group.label}</h3>
                <span>{group.exercises.length} exercises</span>
              </button>
              {isExpanded && group.exercises.map(renderExerciseRow)}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function HistoryView({ api, flash }) {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [editingSet, setEditingSet] = useState(null);
  const [movingSet, setMovingSet] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const body = await api.get("/sessions");
    setSessions(body.sessions);
  }

  async function openSession(id) {
    setActive(await api.get(`/sessions/${id}`));
    setRecapOpen(false);
  }

  async function deleteSession(id) {
    await api.delete(`/sessions/${id}`);
    setSessions(sessions.filter((session) => session.id !== id));
    setActive(null);
    setRecapOpen(false);
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

  async function moveSet(targetSessionId) {
    if (!movingSet || !active || targetSessionId === active.session.id) {
      setMovingSet(null);
      return;
    }

    await api.patch(`/sets/${movingSet.id}`, { session_id: targetSessionId });
    const nextSets = active.sets.filter((set) => set.id !== movingSet.id);
    setActive({ ...active, sets: nextSets });
    setSessions(
      sessions.map((session) => {
        if (session.id === active.session.id) {
          return {
            ...session,
            set_count: Math.max(0, Number(session.set_count) - 1),
            volume: Number(session.volume) - Number(movingSet.weight) * Number(movingSet.reps),
          };
        }
        if (session.id === targetSessionId) {
          return {
            ...session,
            set_count: Number(session.set_count) + 1,
            volume: Number(session.volume) + Number(movingSet.weight) * Number(movingSet.reps),
          };
        }
        return session;
      }),
    );
    setMovingSet(null);
    flash("Set moved");
  }

  return (
    <section className="stack">
      {!active ? (
        <div className="set-list">
          {sessions.map((session) => (
            <article key={session.id} className="session-row" onClick={() => openSession(session.id)}>
              <div>
                <strong>{formatDate(session.started_at)}</strong>
                <span>{formatSessionRange(session)}</span>
              </div>
              <span>
                {session.set_count} sets · {formatWeight(session.volume)} volume
              </span>
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="list-header">
            <button onClick={() => setActive(null)}>Sessions</button>
            <div className="header-actions">
              <button className="share-trigger" disabled={!active.sets.length} onClick={() => setRecapOpen(true)}>
                <Share2 size={18} />
                Share
              </button>
              <button className="danger" onClick={() => deleteSession(active.session.id)}>
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>
          <div>
            <p className="eyebrow">{formatSessionRange(active.session)}</p>
            <h2>{formatDate(active.session.started_at)}</h2>
          </div>
          <SetList sets={active.sets} onEdit={setEditingSet} onDelete={deleteSet} onMove={setMovingSet} />
        </>
      )}
      {editingSet && <EditSetModal set={editingSet} onChange={setEditingSet} onSave={saveSet} onCancel={() => setEditingSet(null)} />}
      {movingSet && (
        <MoveSetModal
          set={movingSet}
          sessions={sessions}
          currentSessionId={active?.session.id}
          onMove={moveSet}
          onCancel={() => setMovingSet(null)}
        />
      )}
      {recapOpen && active && (
        <WorkoutRecapModal
          api={api}
          session={active.session}
          sets={active.sets}
          flash={flash}
          onClose={() => setRecapOpen(false)}
        />
      )}
    </section>
  );
}

function WorkoutRecapModal({ api, session, sets, flash, onClose }) {
  const [recapData, setRecapData] = useState({ sets, achievements: [] });
  const [loading, setLoading] = useState(false);
  const recap = useMemo(
    () => buildWorkoutRecap(recapData.session || session, recapData.sets, recapData.achievements),
    [recapData, session],
  );
  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  useEffect(() => {
    let isCurrent = true;
    if (!session?.id) return undefined;

    setLoading(true);
    api
      .get(`/sessions/${session.id}/recap`)
      .then((body) => {
        if (isCurrent) setRecapData(body);
      })
      .catch(() => {
        if (isCurrent) flash("Using basic recap");
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [api, session?.id]);

  async function sharePdf() {
    const file = recapFile(recap);
    if (canNativeShare && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: recap.title, text: recap.summary, files: [file] });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    downloadPdf(file);
    flash("PDF downloaded");
  }

  async function shareText() {
    if (canNativeShare) {
      try {
        await navigator.share({ title: recap.title, text: recap.message });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    await copyRecap();
  }

  async function copyRecap() {
    if (!navigator.clipboard) {
      flash("Copy unavailable");
      return;
    }
    await navigator.clipboard.writeText(recap.message);
    flash("Recap copied");
  }

  return (
    <div className="modal-backdrop">
      <div className="modal recap-modal">
        <div className="list-header">
          <div>
            <p className="eyebrow">Workout Recap</p>
            <h2>{recap.title}</h2>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="recap-stats">
          <div>
            <span>Sets</span>
            <strong>{recap.setCount}</strong>
          </div>
          <div>
            <span>Exercises</span>
            <strong>{recap.exerciseCount}</strong>
          </div>
          <div>
            <span>Volume</span>
            <strong>{formatWeight(recap.volume)}</strong>
          </div>
        </div>

        {recap.newExercises.length > 0 && (
          <div className="recap-highlights">
            <div>
              <span>New Work</span>
              {recap.newExercises.map((name) => (
                <strong key={name}>{name}</strong>
              ))}
            </div>
          </div>
        )}

        <div className="recap-preview" aria-label="Workout recap preview">
          {recap.groupedExercises.map((exercise) => (
            <section key={exercise.name} className="recap-exercise">
              <div className="list-header">
                <h3>{exercise.name}</h3>
                <span>{exercise.sets.length} sets</span>
              </div>
              <div className="recap-set-list">
                {exercise.sets.map((set) => (
                  <div key={set.id} className="recap-set-row">
                    <span>Set {set.set_order}</span>
                    <strong>{formatLoad(set)}</strong>
                    {set.prBadges.length > 0 && <b>PR</b>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="recap-actions">
          <button className="primary-action" disabled={loading || !sets.length} onClick={sharePdf}>
            <Share2 size={20} />
            PDF
          </button>
          <button className="message-action" disabled={loading || !sets.length} onClick={sharePdf}>
            <MessageCircle size={20} />
            Message
          </button>
          <button onClick={shareText}>
            <Copy size={20} />
            Text
          </button>
        </div>
      </div>
    </div>
  );
}

function buildWorkoutRecap(session, sets, achievements = []) {
  const achievementByExercise = new Map(achievements.map((item) => [item.exercise_id, item]));
  const setsWithBadges = sets.map((set) => {
    const achievement = achievementByExercise.get(set.exercise_id);
    const hasPriorWork = Number(achievement?.previous_set_count) > 0;
    const estimatedOneRepMax = Number(set.weight) * (1 + Number(set.reps) / 30);
    const prBadges = [];

    if (hasPriorWork && Number(set.weight) > Number(achievement.previous_max_weight || 0)) {
      prBadges.push("Weight PR");
    }
    if (hasPriorWork && estimatedOneRepMax > Number(achievement.previous_estimated_1rm || 0)) {
      prBadges.push("Est. 1RM PR");
    }

    return { ...set, prBadges };
  });
  const grouped = sets.reduce((map, set) => {
    const name = set.exercise_name || "Exercise";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(setsWithBadges.find((item) => item.id === set.id));
    return map;
  }, new Map());
  const volume = sets.reduce((total, set) => total + Number(set.weight) * Number(set.reps), 0);
  const bestSet = sets.reduce((best, set) => {
    const score = Number(set.weight) * Number(set.reps);
    if (!best || score > Number(best.weight) * Number(best.reps)) return set;
    return best;
  }, null);
  const title = `${formatDate(session?.started_at || new Date())} workout`;
  const newExercises = achievements
    .filter((item) => Number(item.previous_set_count) === 0)
    .map((item) => item.exercise_name);
  const groupedExercises = [...grouped.entries()].map(([name, exerciseSets]) => ({
    name,
    sets: [...exerciseSets].sort((a, b) => Number(a.set_order) - Number(b.set_order)),
  }));
  const prs = setsWithBadges
    .filter((set) => set.prBadges.length > 0)
    .map((set) => `${set.exercise_name} set ${set.set_order}: ${formatWeight(set.weight)} lb x ${set.reps}`);
  const exerciseLines = groupedExercises.map(({ name, sets: exerciseSets }) => {
    const topSet = exerciseSets.reduce((best, set) => {
      if (!best || Number(set.weight) > Number(best.weight)) return set;
      return best;
    }, null);
    return `- ${name}: ${exerciseSets.length} sets, best ${formatWeight(topSet.weight)} x ${topSet.reps}`;
  });
  const highlight = bestSet
    ? `Top set: ${bestSet.exercise_name} ${formatWeight(bestSet.weight)} x ${bestSet.reps}`
    : "Top set: none yet";

  return {
    title,
    setCount: sets.length,
    exerciseCount: grouped.size,
    volume,
    message: [
      `Workout recap - ${title}`,
      `${sets.length} sets across ${grouped.size} exercises`,
      `Total volume: ${formatWeight(volume)} lb`,
      highlight,
      newExercises.length ? `New exercises: ${newExercises.join(", ")}` : "",
      "",
      ...groupedExercises.flatMap((exercise) => [
        exercise.name,
        ...exercise.sets.map(
          (set) =>
            `- Set ${set.set_order}: ${formatWeight(set.weight)} lb x ${set.reps}${set.prBadges.length ? " PR" : ""}`,
        ),
      ]),
    ].filter(Boolean).join("\n"),
    summary: `${sets.length} sets, ${grouped.size} exercises, ${formatWeight(volume)} lb volume`,
    prs,
    newExercises,
    groupedExercises,
    exerciseLines,
  };
}

function recapFile(recap) {
  const blob = createWorkoutRecapPdf(recap);
  const datePart = new Date().toISOString().slice(0, 10);
  return new File([blob], `workout-recap-${datePart}.pdf`, { type: "application/pdf" });
}

function downloadPdf(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createWorkoutRecapPdf(recap) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const pages = [];
  let commands = [];
  let y = pageHeight - margin;

  function add(command) {
    commands.push(command);
  }

  function finishPage() {
    pages.push(commands.join("\n"));
    commands = [];
    y = pageHeight - margin;
  }

  function ensureSpace(height) {
    if (y - height < margin) {
      finishPage();
      drawPageHeader(true);
      y -= 24;
    }
  }

  function rect(x, rectY, width, height, color, strokeColor = null) {
    const fill = `${pdfColor(color)} rg ${x} ${rectY} ${width} ${height} re f`;
    add(strokeColor ? `q ${fill} ${pdfColor(strokeColor)} RG ${x} ${rectY} ${width} ${height} re S Q` : `q ${fill} Q`);
  }

  function text(value, x, textY, size, color = [16, 24, 32], font = "F1") {
    add(`q ${pdfColor(color)} rg BT /${font} ${size} Tf ${x} ${textY} Td (${escapePdfText(value)}) Tj ET Q`);
  }

  function drawPageHeader(continued = false) {
    rect(0, pageHeight - 124, pageWidth, 124, [16, 24, 32]);
    rect(0, pageHeight - 124, 8, 124, [232, 72, 85]);
    text("Quick Workout Logger", margin, pageHeight - 54, 12, [214, 220, 219], "F2");
    text(continued ? `${recap.title} continued` : recap.title, margin, pageHeight - 84, 24, [255, 253, 249], "F2");
    text(recap.summary, margin, pageHeight - 108, 12, [214, 220, 219], "F1");
    y = pageHeight - 154;
  }

  function drawStatCard(x, label, value, width = 156) {
    rect(x, y - 54, width, 54, [255, 253, 249], [222, 214, 200]);
    text(label.toUpperCase(), x + 12, y - 20, 9, [104, 113, 116], "F2");
    text(value, x + 12, y - 40, 18, [16, 24, 32], "F2");
  }

  function drawNewWork() {
    if (!recap.newExercises.length) return;
    ensureSpace(78);
    rect(margin, y - 66, pageWidth - margin * 2, 66, [255, 244, 224], [235, 201, 134]);
    text("NEW WORK", margin + 14, y - 22, 10, [115, 81, 0], "F2");
    wrapPdfText(recap.newExercises.join("  |  "), 11, pageWidth - margin * 2 - 28).forEach((line, index) => {
      text(line, margin + 14, y - 42 - index * 15, 11, [16, 24, 32], "F2");
    });
    y -= 82;
  }

  function drawExercise(exercise) {
    const rowHeight = 28;
    const sectionHeight = 46 + exercise.sets.length * rowHeight;
    ensureSpace(sectionHeight);
    text(exercise.name, margin, y, 16, [16, 24, 32], "F2");
    text(`${exercise.sets.length} sets`, pageWidth - margin - 52, y, 10, [104, 113, 116], "F2");
    y -= 18;
    rect(margin, y - 20, pageWidth - margin * 2, 20, [236, 229, 218]);
    text("SET", margin + 12, y - 14, 9, [89, 97, 100], "F2");
    text("LOAD", margin + 94, y - 14, 9, [89, 97, 100], "F2");
    text("REPS", margin + 194, y - 14, 9, [89, 97, 100], "F2");
    text("NOTES", margin + 286, y - 14, 9, [89, 97, 100], "F2");
    y -= 20;

    exercise.sets.forEach((set, index) => {
      const rowY = y - rowHeight;
      rect(margin, rowY, pageWidth - margin * 2, rowHeight, index % 2 === 0 ? [255, 253, 249] : [247, 244, 239], [229, 222, 211]);
      text(String(set.set_order), margin + 12, rowY + 10, 11, [16, 24, 32], "F2");
      text(`${formatWeight(set.weight)} lb`, margin + 94, rowY + 10, 11, [16, 24, 32], "F2");
      text(String(set.reps), margin + 194, rowY + 10, 11, [16, 24, 32], "F2");
      if (set.prBadges.length > 0) {
        rect(margin + 286, rowY + 6, 34, 16, [232, 72, 85]);
        text("PR", margin + 297, rowY + 11, 8, [255, 255, 255], "F2");
        text(set.prBadges.join(", "), margin + 328, rowY + 10, 10, [89, 97, 100], "F1");
      } else {
        text("Solid work", margin + 286, rowY + 10, 10, [104, 113, 116], "F1");
      }
      y -= rowHeight;
    });
    y -= 20;
  }

  drawPageHeader();
  drawStatCard(margin, "Sets", String(recap.setCount));
  drawStatCard(margin + 170, "Exercises", String(recap.exerciseCount));
  drawStatCard(margin + 340, "Volume", `${formatWeight(recap.volume)} lb`);
  y -= 78;
  drawNewWork();
  text("Workout Details", margin, y, 18, [16, 24, 32], "F2");
  y -= 28;
  recap.groupedExercises.forEach(drawExercise);
  if (commands.length) finishPage();

  const pageCount = pages.length;
  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2);
  const contentObjectIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2);
  const regularFontId = 3 + pageCount * 2;
  const boldFontId = regularFontId + 1;
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  pages.forEach((stream, index) => {
    objects[pageObjectIds[index]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`;
    objects[contentObjectIds[index]] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[regularFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[boldFontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function pdfColor([red, green, blue]) {
  return `${(red / 255).toFixed(3)} ${(green / 255).toFixed(3)} ${(blue / 255).toFixed(3)}`;
}

function wrapPdfText(text, size, maxWidth) {
  if (!text) return [""];
  const approxChars = Math.max(24, Math.floor(maxWidth / (size * 0.52)));
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > approxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

function formatLoad(set) {
  return `${formatWeight(set.weight)} lb x ${set.reps} reps`;
}

function formatMuscleGroup(group) {
  return group ? group.charAt(0).toUpperCase() + group.slice(1) : "No group";
}

function groupExercisesByMuscle(exercises) {
  const groups = muscleGroupOptions
    .map((group) => ({
      id: group,
      label: formatMuscleGroup(group),
      exercises: exercises.filter((exercise) => exercise.muscle_group === group),
    }))
    .filter((group) => group.exercises.length > 0);
  const ungrouped = exercises.filter((exercise) => !exercise.muscle_group);
  if (ungrouped.length > 0) groups.push({ id: "ungrouped", label: "Ungrouped", exercises: ungrouped });
  return groups;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSessionRange(session) {
  const started = new Date(session.started_at);
  const startTime = started.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!session.ended_at) return `${startTime} - active`;
  const ended = new Date(session.ended_at);
  const endTime = ended.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startTime} - ${endTime}`;
}

createRoot(document.getElementById("root")).render(<App />);
