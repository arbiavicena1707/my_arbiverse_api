import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import projectRoutes from "./routes/project.router.js";
import kasirRoutes from "./routes/kasir.router.js";
import transaksiRoutes from "./routes/transaksi.router.js";
import { fileURLToPath } from "url";

// setup dasar
dotenv.config();
const app = express();
app.use(cors());

// ✅ Tambahkan parser global
app.use(express.json()); // untuk JSON
app.use(express.urlencoded({ extended: true })); // untuk form HTML biasa
app.use(multer().none()); // 🔥 supaya semua route bisa baca FormData tanpa file

// 📂 Setup penyimpanan file (untuk upload gambar)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ✅ Routes
app.use("/api/list/project", projectRoutes);
app.use("/api/kasir", kasirRoutes);
app.use("/api/transaksi", transaksiRoutes);

// ✅ Folder static untuk akses gambar
app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.send("🚀 API Arbiverse aktif!");
});

// ✅ Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
