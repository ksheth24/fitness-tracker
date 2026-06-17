import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(cors());
app.use(express.json());

function tokenFor(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: "30d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function toNumberRows(rows) {
  return rows.map((row) => ({
    ...row,
    weight: row.weight === undefined ? row.weight : Number(row.weight),
    max_weight: row.max_weight === undefined ? row.max_weight : Number(row.max_weight),
    estimated_1rm: row.estimated_1rm === undefined ? row.estimated_1rm : Number(row.estimated_1rm),
    volume: row.volume === undefined ? row.volume : Number(row.volume),
  }));
}

async function getOrCreateTodaySession(userId) {
  const existing = await query(
    `SELECT id, user_id, started_at, notes
     FROM sessions
     WHERE user_id = $1 AND started_at::date = CURRENT_DATE
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await query(
    "INSERT INTO sessions (user_id) VALUES ($1) RETURNING id, user_id, started_at, notes",
    [userId],
  );
  return created.rows[0];
}

async function ensureOwnExercise(userId, exerciseId) {
  const result = await query("SELECT id FROM exercises WHERE id = $1 AND user_id = $2", [
    exerciseId,
    userId,
  ]);
  return result.rows[0];
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id, name, email",
      [name || "", email, passwordHash],
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: tokenFor(user) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Email already exists" });
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await query("SELECT id, name, email, password_hash FROM users WHERE email = lower($1)", [
    email,
  ]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token: tokenFor(user) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const result = await query("SELECT id, name, email FROM users WHERE id = $1", [req.user.id]);
  res.json({ user: result.rows[0] });
});

app.get("/api/exercises", requireAuth, async (req, res) => {
  const search = `%${(req.query.search || "").toString().trim()}%`;
  const result = await query(
    `SELECT e.id, e.name, e.is_favorite, e.created_at,
      MAX(s.created_at) AS last_logged_at,
      (
        SELECT json_build_object('weight', s2.weight, 'reps', s2.reps)
        FROM sets s2
        JOIN sessions se2 ON se2.id = s2.session_id
        WHERE s2.exercise_id = e.id AND se2.user_id = $1
        ORDER BY s2.created_at DESC
        LIMIT 1
      ) AS last_set
     FROM exercises e
     LEFT JOIN sets s ON s.exercise_id = e.id
     LEFT JOIN sessions se ON se.id = s.session_id AND se.user_id = e.user_id
     WHERE e.user_id = $1 AND ($2 = '%%' OR e.name ILIKE $2)
     GROUP BY e.id
     ORDER BY e.is_favorite DESC, last_logged_at DESC NULLS LAST, e.name ASC`,
    [req.user.id, search],
  );
  res.json({ exercises: result.rows });
});

app.post("/api/exercises", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Exercise name is required" });

  const result = await query(
    `INSERT INTO exercises (user_id, name, is_favorite)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, (lower(name))) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, is_favorite, created_at`,
    [req.user.id, name, Boolean(req.body.is_favorite)],
  );
  res.status(201).json({ exercise: result.rows[0] });
});

app.patch("/api/exercises/:id", requireAuth, async (req, res) => {
  const result = await query(
    `UPDATE exercises
     SET name = COALESCE(NULLIF($3, ''), name),
         is_favorite = COALESCE($4, is_favorite)
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, is_favorite, created_at`,
    [req.params.id, req.user.id, req.body.name?.trim() || null, req.body.is_favorite],
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Exercise not found" });
  res.json({ exercise: result.rows[0] });
});

app.delete("/api/exercises/:id", requireAuth, async (req, res) => {
  await query("DELETE FROM exercises WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.status(204).end();
});

app.get("/api/exercises/:id/previous-session", requireAuth, async (req, res) => {
  if (!(await ensureOwnExercise(req.user.id, req.params.id))) {
    return res.status(404).json({ error: "Exercise not found" });
  }

  const currentSessionId = req.query.current_session_id || null;
  const session = await query(
    `SELECT se.id, se.started_at
     FROM sets st
     JOIN sessions se ON se.id = st.session_id
     WHERE se.user_id = $1
       AND st.exercise_id = $2
       AND ($3::uuid IS NULL OR se.id <> $3::uuid)
     GROUP BY se.id
     ORDER BY se.started_at DESC
     LIMIT 1`,
    [req.user.id, req.params.id, currentSessionId],
  );

  if (!session.rows[0]) return res.json({ session: null, sets: [] });

  const sets = await query(
    `SELECT st.id, st.session_id, st.exercise_id, e.name AS exercise_name,
            st.weight, st.reps, st.set_order, st.created_at
     FROM sets st
     JOIN sessions se ON se.id = st.session_id
     JOIN exercises e ON e.id = st.exercise_id
     WHERE se.user_id = $1 AND st.session_id = $2 AND st.exercise_id = $3
     ORDER BY st.set_order ASC`,
    [req.user.id, session.rows[0].id, req.params.id],
  );

  res.json({ session: session.rows[0], sets: toNumberRows(sets.rows) });
});

app.get("/api/sessions/today", requireAuth, async (req, res) => {
  const session = await getOrCreateTodaySession(req.user.id);
  const sets = await setsForSession(req.user.id, session.id);
  res.json({ session, sets });
});

app.get("/api/sessions", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT se.id, se.started_at, se.notes, COUNT(st.id)::int AS set_count,
            COALESCE(SUM(st.weight * st.reps), 0)::numeric AS volume
     FROM sessions se
     LEFT JOIN sets st ON st.session_id = se.id
     WHERE se.user_id = $1
     GROUP BY se.id
     ORDER BY se.started_at DESC`,
    [req.user.id],
  );
  res.json({ sessions: toNumberRows(result.rows) });
});

app.get("/api/sessions/:id", requireAuth, async (req, res) => {
  const session = await query("SELECT id, started_at, notes FROM sessions WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.user.id,
  ]);
  if (!session.rows[0]) return res.status(404).json({ error: "Session not found" });
  res.json({ session: session.rows[0], sets: await setsForSession(req.user.id, req.params.id) });
});

app.get("/api/sessions/:id/recap", requireAuth, async (req, res) => {
  const session = await query("SELECT id, started_at, notes FROM sessions WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.user.id,
  ]);
  if (!session.rows[0]) return res.status(404).json({ error: "Session not found" });

  const sets = await setsForSession(req.user.id, req.params.id);
  const achievements = await query(
    `WITH current_exercises AS (
       SELECT st.exercise_id, e.name AS exercise_name,
              MAX(st.weight)::numeric AS max_weight,
              MAX(st.weight * (1 + st.reps / 30.0))::numeric AS estimated_1rm,
              SUM(st.weight * st.reps)::numeric AS volume,
              COUNT(st.id)::int AS set_count
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.session_id = $1
       GROUP BY st.exercise_id, e.name
     ),
     prior AS (
       SELECT st.exercise_id,
              MAX(st.weight)::numeric AS previous_max_weight,
              MAX(st.weight * (1 + st.reps / 30.0))::numeric AS previous_estimated_1rm,
              COUNT(st.id)::int AS previous_set_count
       FROM sets st
       JOIN sessions se ON se.id = st.session_id
       JOIN sessions current_session ON current_session.id = $1
       WHERE se.user_id = $2
         AND se.id <> $1
         AND se.started_at < current_session.started_at
       GROUP BY st.exercise_id
     ),
     prior_volume AS (
       SELECT exercise_id, MAX(volume)::numeric AS previous_max_volume
       FROM (
         SELECT st.exercise_id, se.started_at::date AS workout_date,
                SUM(st.weight * st.reps)::numeric AS volume
         FROM sets st
         JOIN sessions se ON se.id = st.session_id
         JOIN sessions current_session ON current_session.id = $1
         WHERE se.user_id = $2
           AND se.id <> $1
           AND se.started_at < current_session.started_at
         GROUP BY st.exercise_id, se.started_at::date
       ) daily_volume
       GROUP BY exercise_id
     )
     SELECT ce.exercise_id, ce.exercise_name, ce.max_weight, ce.estimated_1rm,
            ce.volume, ce.set_count,
            prior.previous_max_weight, prior.previous_estimated_1rm,
            prior_volume.previous_max_volume,
            COALESCE(prior.previous_set_count, 0)::int AS previous_set_count
     FROM current_exercises ce
     LEFT JOIN prior ON prior.exercise_id = ce.exercise_id
     LEFT JOIN prior_volume ON prior_volume.exercise_id = ce.exercise_id
     ORDER BY ce.exercise_name ASC`,
    [req.params.id, req.user.id],
  );

  res.json({
    session: session.rows[0],
    sets,
    achievements: toNumberRows(achievements.rows),
  });
});

app.patch("/api/sessions/:id", requireAuth, async (req, res) => {
  const result = await query(
    "UPDATE sessions SET notes = $3 WHERE id = $1 AND user_id = $2 RETURNING id, started_at, notes",
    [req.params.id, req.user.id, req.body.notes || null],
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Session not found" });
  res.json({ session: result.rows[0] });
});

app.delete("/api/sessions/:id", requireAuth, async (req, res) => {
  await query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.status(204).end();
});

app.post("/api/sets", requireAuth, async (req, res) => {
  const { exercise_id: exerciseId } = req.body;
  const weight = Number(req.body.weight);
  const reps = Number.parseInt(req.body.reps, 10);
  if (!exerciseId || !Number.isFinite(weight) || !Number.isInteger(reps) || reps < 1) {
    return res.status(400).json({ error: "Exercise, weight, and reps are required" });
  }
  if (!(await ensureOwnExercise(req.user.id, exerciseId))) {
    return res.status(404).json({ error: "Exercise not found" });
  }

  const session = req.body.session_id
    ? (await query("SELECT id FROM sessions WHERE id = $1 AND user_id = $2", [req.body.session_id, req.user.id]))
        .rows[0]
    : await getOrCreateTodaySession(req.user.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const orderResult = await query(
    "SELECT COALESCE(MAX(set_order), 0) + 1 AS next_order FROM sets WHERE session_id = $1",
    [session.id],
  );
  const result = await query(
    `INSERT INTO sets (session_id, exercise_id, weight, reps, set_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, session_id, exercise_id, weight, reps, set_order, created_at`,
    [session.id, exerciseId, weight, reps, Number(orderResult.rows[0].next_order)],
  );
  res.status(201).json({ set: toNumberRows(result.rows)[0] });
});

app.patch("/api/sets/:id", requireAuth, async (req, res) => {
  const result = await query(
    `UPDATE sets st
     SET weight = COALESCE($3, st.weight),
         reps = COALESCE($4, st.reps)
     FROM sessions se
     WHERE st.session_id = se.id AND st.id = $1 AND se.user_id = $2
     RETURNING st.id, st.session_id, st.exercise_id, st.weight, st.reps, st.set_order, st.created_at`,
    [req.params.id, req.user.id, req.body.weight ?? null, req.body.reps ?? null],
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Set not found" });
  res.json({ set: toNumberRows(result.rows)[0] });
});

app.delete("/api/sets/:id", requireAuth, async (req, res) => {
  await query(
    `DELETE FROM sets st USING sessions se
     WHERE st.session_id = se.id AND st.id = $1 AND se.user_id = $2`,
    [req.params.id, req.user.id],
  );
  res.status(204).end();
});

app.get("/api/progress/frequency/heatmap", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT started_at::date AS date, COUNT(*)::int AS count
     FROM sessions
     WHERE user_id = $1
     GROUP BY started_at::date
     ORDER BY date ASC`,
    [req.user.id],
  );
  res.json({ days: result.rows });
});

app.get("/api/progress/:exerciseId", requireAuth, async (req, res) => {
  if (!(await ensureOwnExercise(req.user.id, req.params.exerciseId))) {
    return res.status(404).json({ error: "Exercise not found" });
  }

  const series = await query(
    `SELECT se.started_at::date AS date,
            MAX(st.weight)::numeric AS max_weight,
            MAX(st.weight * (1 + st.reps / 30.0))::numeric AS estimated_1rm,
            SUM(st.weight * st.reps)::numeric AS volume
     FROM sets st
     JOIN sessions se ON se.id = st.session_id
     WHERE se.user_id = $1 AND st.exercise_id = $2
     GROUP BY se.started_at::date
     ORDER BY date ASC`,
    [req.user.id, req.params.exerciseId],
  );
  const pr = await query(
    `SELECT MAX(st.weight)::numeric AS max_weight
     FROM sets st
     JOIN sessions se ON se.id = st.session_id
     WHERE se.user_id = $1 AND st.exercise_id = $2`,
    [req.user.id, req.params.exerciseId],
  );
  res.json({ series: toNumberRows(series.rows), pr: toNumberRows(pr.rows)[0] });
});

async function setsForSession(userId, sessionId) {
  const result = await query(
    `SELECT st.id, st.session_id, st.exercise_id, e.name AS exercise_name,
            st.weight, st.reps, st.set_order, st.created_at
     FROM sets st
     JOIN sessions se ON se.id = st.session_id
     JOIN exercises e ON e.id = st.exercise_id
     WHERE se.user_id = $1 AND st.session_id = $2
     ORDER BY st.set_order DESC`,
    [userId, sessionId],
  );
  return toNumberRows(result.rows);
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
