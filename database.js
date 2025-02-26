// db.js
const { Pool } = require("pg");

console.log("DB ulanishi boshlanmoqda...");

const pool = new Pool({
  host: "ep-restless-dawn-a80hwsr5-pooler.eastus2.azure.neon.tech",
  user: "neondb_owner",
  password: "npg_IvTi7DPg2wOt",
  database: "persons",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

// Jadvalni yaratish
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    nationality VARCHAR(50) NOT NULL,
    citizenship VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    passport_id VARCHAR(20) NOT NULL UNIQUE,
    photo VARCHAR(255)
  );
`;

pool
  .query(createTableQuery)
  .then(() => console.log("Users jadvali yaratildi yoki mavjud"))
  .catch((err) => console.error("Jadval yaratishda xato:", err.message));

// Poolni eksport qilish
module.exports = pool;