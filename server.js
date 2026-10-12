require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.warn("WARNING: Set JWT_SECRET to a random secret of at least 32 characters in .env");
}

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }));
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(path.join(dataDir, "auchp.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '',
  level TEXT NOT NULL, subject TEXT NOT NULL, paper_type TEXT DEFAULT 'Revision paper',
  price_kes INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT DEFAULT '',
  document_id INTEGER NOT NULL, amount_kes INTEGER NOT NULL,
  payment_method TEXT NOT NULL, status TEXT DEFAULT 'pending',
  provider_reference TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);
`);

const adminEmail = process.env.ADMIN_EMAIL || "admin@auchp.ltd";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-password-now";
const adminExists = db.prepare("SELECT id FROM admins WHERE email = ?").get(adminEmail);
if (!adminExists) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO admins(email, password_hash) VALUES(?, ?)").run(adminEmail, hash);
  console.log(`Initial admin created for ${adminEmail}. Change ADMIN_PASSWORD before deployment.`);
}

const levels = {
  "Play Group–PP2": 30,
  "Grade 1–3": 45,
  "Grade 4–6": 55,
  "Grade 7–9": 90
};
const subjects = {
  "Play Group–PP2": ["EYE activity papers"],
  "Grade 1–3": ["Mathematics", "English", "Kiswahili", "Environmental Activities", "Creative Arts"],
  "Grade 4–6": ["Mathematics", "Kiswahili", "English", "Creative Arts", "Social Studies", "Agriculture and Nutrition", "Science and Technology", "CRE"],
  "Grade 7–9": ["Mathematics", "English Paper 1", "English Paper 2", "Kiswahili Paper 1", "Kiswahili Paper 2", "Integrated Science", "CRE", "Pretechnical Studies", "Agriculture and Nutrition", "Creative Arts", "Social Studies"]
};

function auth(req, res, next) {
  const token = req.cookies.auchp_admin;
  if (!token) return res.status(401).json({ error: "Administrator login required." });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Allowed formats: PDF, DOC, DOCX, JPG, PNG."));
    cb(null, true);
  }
});

app.get("/api/catalog", (_req, res) => {
  res.json({ levels, subjects });
});
app.get("/api/documents", (_req, res) => {
  const rows = db.prepare(`SELECT id,title,description,level,subject,paper_type,price_kes,created_at
    FROM documents WHERE active=1 ORDER BY created_at DESC`).all();
  res.json(rows);
});
app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), (req, res) => {
  const { email, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(String(email || "").trim().toLowerCase());
  if (!admin || !bcrypt.compareSync(String(password || ""), admin.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  if (!SECRET || SECRET.length < 32) return res.status(500).json({ error: "Server JWT_SECRET is not configured securely." });
  const token = jwt.sign({ id: admin.id, email: admin.email }, SECRET, { expiresIn: "8h" });
  res.cookie("auchp_admin", token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 });
  res.json({ ok: true, email: admin.email });
});
app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie("auchp_admin", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
  res.json({ ok: true });
});
app.get("/api/admin/me", auth, (req, res) => res.json({ email: req.admin.email }));
app.get("/api/admin/documents", auth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM documents ORDER BY created_at DESC").all());
});
app.post("/api/admin/documents", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please select a document file." });
  const { title, description = "", level, subject, paper_type = "Revision paper" } = req.body;
  if (!title || !level || !subject) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Title, level and subject are required." });
  }
  const price = levels[level];
  if (!price) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Unknown class level." });
  }
  const result = db.prepare(`INSERT INTO documents(title,description,level,subject,paper_type,price_kes,filename,original_name)
    VALUES(?,?,?,?,?,?,?,?)`).run(title.trim(), description.trim(), level, subject, paper_type, price, req.file.filename, req.file.originalname);
  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});
app.patch("/api/admin/documents/:id", auth, (req, res) => {
  const { active } = req.body || {};
  if (![0, 1, false, true].includes(active)) return res.status(400).json({ error: "active must be true or false." });
  const result = db.prepare("UPDATE documents SET active=? WHERE id=?").run(active ? 1 : 0, Number(req.params.id));
  res.json({ ok: result.changes > 0 });
});
app.delete("/api/admin/documents/:id", auth, (req, res) => {
  const row = db.prepare("SELECT filename FROM documents WHERE id=?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Document not found." });
  db.prepare("DELETE FROM documents WHERE id=?").run(Number(req.params.id));
  const filePath = path.join(uploadDir, path.basename(row.filename));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});
app.get("/api/admin/orders", auth, (_req, res) => {
  res.json(db.prepare(`SELECT o.*, d.title AS document_title FROM orders o
    JOIN documents d ON d.id=o.document_id ORDER BY o.created_at DESC LIMIT 500`).all());
});

/*
 * Payment safety:
 * This starter creates a pending order but does NOT mark it paid.
 * Connect a real provider (e.g. Safaricom Daraja STK Push or a Kenyan payment gateway)
 * and verify the provider's signed/server-to-server callback before changing status to "paid".
 */
app.post("/api/checkout", (req, res) => {
  const { document_id, customer_name, phone, email = "", payment_method = "mpesa" } = req.body || {};
  if (!customer_name || !phone || !document_id) return res.status(400).json({ error: "Name, phone and document are required." });
  const doc = db.prepare("SELECT * FROM documents WHERE id=? AND active=1").get(Number(document_id));
  if (!doc) return res.status(404).json({ error: "This paper is unavailable." });
  const reference = `AUCHP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const result = db.prepare(`INSERT INTO orders(reference,customer_name,phone,email,document_id,amount_kes,payment_method,status)
    VALUES(?,?,?,?,?,?,?,'pending')`).run(reference, String(customer_name).trim(), String(phone).trim(), String(email).trim(), doc.id, doc.price_kes, String(payment_method));
  res.status(201).json({
    order_id: result.lastInsertRowid, reference, amount_kes: doc.price_kes, currency: "KES", status: "pending",
    message: "Order created. Payment provider is not yet connected, so no payment has been taken."
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || "Request failed." });
});
app.listen(PORT, () => console.log(`AuchP.ltd website running at http://localhost:${PORT}`));
