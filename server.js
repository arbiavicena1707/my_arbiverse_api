import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import projectRoutes from "./routes/project.router.js";
import kasirRoutes from "./routes/kasir.router.js";
import transaksiRoutes from "./routes/transaksi.router.js";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());

// ✅ Middleware parser universal
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📂 Setup penyimpanan file (jika ada upload)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// ✅ Routes
app.use("/api/list/project", projectRoutes);
app.use("/api/kasir", kasirRoutes);
app.use("/api/transaksi", transaksiRoutes);

// ✅ Static folder
app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.send("🚀 API Arbiverse aktif dan bisa terima JSON & FormData!");
});

// ✅ Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
