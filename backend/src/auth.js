import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import database from "./database.js";

const scryptAsync = promisify(scrypt);

const SESSION_DURATION = {
  normal: 8 * 60 * 60 * 1000,       // 8 hours
  remembered: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// Hash passwords securely before saving them.
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

// Verify a password against its stored hash.
async function verifyPassword(password, storedHash) {
  const [algorithm, salt, originalHash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !originalHash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, "hex");

  return (
    originalBuffer.length === derivedKey.length &&
    timingSafeEqual(originalBuffer, derivedKey)
  );
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.substring(name.length + 1)) : null;
}

function setSessionCookie(res, token, rememberMe) {
  const secure = process.env.NODE_ENV === "production";

  let cookie = `floodwatch_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`;

  if (rememberMe) {
    cookie += `; Max-Age=${SESSION_DURATION.remembered / 1000}`;
  }

  if (secure) {
    cookie += "; Secure";
  }

  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "floodwatch_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
}

// Create a new session and save only its hashed token.
function createSession(userId, rememberMe) {
  const token = randomBytes(32).toString("hex");
  const duration = rememberMe
    ? SESSION_DURATION.remembered
    : SESSION_DURATION.normal;

  const expiresAt = new Date(Date.now() + duration).toISOString();

  database.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, hashToken(token), expiresAt);

  return token;
}

// Remove expired sessions.
function removeExpiredSessions() {
  database.prepare(`
    DELETE FROM sessions
    WHERE expires_at <= ?
  `).run(new Date().toISOString());
}

// REGISTER
export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = database.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await hashPassword(password);

    const result = database.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run(name.trim(), normalizedEmail, passwordHash);

    return res.status(201).json({
      message: "Account created successfully.",
      userId: result.lastInsertRowid
    });

  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Unable to create your account."
    });
  }
}

// LOGIN
export async function login(req, res) {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = database.prepare(`
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    removeExpiredSessions();

    const token = createSession(user.id, rememberMe === true);

    setSessionCookie(res, token, rememberMe === true);

    return res.json({
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in."
    });
  }
}

// AUTHENTICATION MIDDLEWARE
export function requireAuth(req, res, next) {
  try {
    removeExpiredSessions();

    const token = getCookie(req, "floodwatch_session");

    if (!token) {
      return res.status(401).json({
        message: "Please log in to continue."
      });
    }

    const session = database.prepare(`
      SELECT users.id, users.name, users.email, users.role
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND sessions.expires_at > ?
    `).get(hashToken(token), new Date().toISOString());

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        message: "Your session has expired. Please log in again."
      });
    }

    req.user = session;
    next();

  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(500).json({
      message: "Authentication failed."
    });
  }
}

// CURRENT USER
export function getCurrentUser(req, res) {
  return res.json({ user: req.user });
}

// LOGOUT
export function logout(req, res) {
  const token = getCookie(req, "floodwatch_session");

  if (token) {
    database.prepare(`
      DELETE FROM sessions WHERE token_hash = ?
    `).run(hashToken(token));
  }

  clearSessionCookie(res);

  return res.json({
    message: "Logged out successfully."
  });
}
