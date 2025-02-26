// server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const pool = require("../database");

console.log("Server boshlanmoqda...");

const app = express();

console.log("Express ilovasi yaratildi");

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["*"],
    allowedHeaders: ["*"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("Middleware sozlamalari qo‘shildi");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

console.log("Uploads papkasi tayyor");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

// Foydalanuvchilarni qidirish
app.get("/api/users/search", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ detail: "So'rov kiritilmadi" });
  }

  const sql = `
    SELECT * FROM users 
    WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR nationality ILIKE $1
  `;
  try {
    const { rows } = await pool.query(sql, [`%${query}%`]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ detail: "Server xatosi" });
  }
});

// Yangi foydalanuvchi yaratish
app.post("/api/users", upload.single("photo"), async (req, res) => {
  const {
    first_name,
    last_name,
    middle_name,
    birth_date,
    nationality,
    citizenship,
    address,
    passport_id,
  } = req.body;

  let photo_filename = null;

  if (req.file) {
    const original_path = req.file.path; // Asl fayl yo‘li
    photo_filename = `processed-${uuidv4()}${path.extname(req.file.originalname)}`; // Yangi nom
    const processed_path = path.join(UPLOAD_DIR, photo_filename);

    // Suratni 4:3 formatga o‘zgartirish
    const img = await sharp(original_path);
    const { width, height } = await img.metadata();
    let new_width = width;
    let new_height = Math.round((width * 3) / 4);

    if (new_height > height) {
      new_height = height;
      new_width = Math.round((height * 4) / 3);
    }

    const left = Math.round((width - new_width) / 2);
    const top = Math.round((height - new_height) / 2);

    await img
      .extract({ left, top, width: new_width, height: new_height })
      .toFile(processed_path); // Yangi faylga saqlash
  }

  const sql = `
    INSERT INTO users (first_name, last_name, middle_name, birth_date, nationality, citizenship, address, passport_id, photo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  try {
    const { rows } = await pool.query(sql, [
      first_name,
      last_name,
      middle_name,
      birth_date,
      nationality,
      citizenship,
      address,
      passport_id,
      photo_filename,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({
        detail: `Passport ID ${passport_id} allaqachon mavjud`,
      });
    }
    res.status(500).json({ detail: "Server xatosi" });
  }
});

// Barcha foydalanuvchilarni olish
app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ detail: "Server xatosi" });
  }
});

// Foydalanuvchi ma'lumotlarini olish (ID bo'yicha)
app.get("/api/users/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ detail: "Foydalanuvchi topilmadi" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ detail: "Server xatosi" });
  }
});

// Foydalanuvchini yangilash
app.put("/api/users/:user_id", upload.single("photo"), async (req, res) => {
  const { user_id } = req.params;
  const {
    first_name,
    last_name,
    middle_name,
    birth_date,
    nationality,
    citizenship,
    address,
    passport_id,
  } = req.body;

  try {
    const { rows: existing } = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [user_id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ detail: "Foydalanuvchi topilmadi" });
    }

    let photo_filename = existing[0].photo;
    if (req.file) {
      const original_path = req.file.path; // Asl fayl yo‘li
      photo_filename = `${user_id}-processed${path.extname(req.file.originalname)}`; // Yangi nom
      const processed_path = path.join(UPLOAD_DIR, photo_filename);

      // Suratni qayta ishlash
      await sharp(original_path)
        .extract({
          left: Math.round((req.file.width - req.file.width) / 2),
          top: Math.round((req.file.height - Math.round((req.file.width * 3) / 4)) / 2),
          width: req.file.width,
          height: Math.round((req.file.width * 3) / 4),
        })
        .toFile(processed_path); // Yangi faylga saqlash

      fs.unlinkSync(original_path); // Asl faylni o‘chirish
    }

    const sql = `
      UPDATE users SET 
        first_name = $1, last_name = $2, middle_name = $3, birth_date = $4, 
        nationality = $5, citizenship = $6, address = $7, passport_id = $8, photo = $9
      WHERE id = $10
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [
      first_name,
      last_name,
      middle_name,
      birth_date,
      nationality,
      citizenship,
      address,
      passport_id,
      photo_filename,
      user_id,
    ]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ detail: "Server xatosi" });
  }
});

// Foydalanuvchini o‘chirish
app.delete("/api/users/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const { rows } = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ detail: "Foydalanuvchi topilmadi" });
    }
    res.json({ message: "Foydalanuvchi o‘chirildi" });
  } catch (err) {
    res.status(500).json({ detail: "Server xatosi" });
  }
});

module.exports = app;

if (process.env.NODE_ENV !== "production") {
  app.listen(5000, () => {
    console.log("Server http://localhost:5000 da ishlamoqda");
  });
}
module.exports = app;