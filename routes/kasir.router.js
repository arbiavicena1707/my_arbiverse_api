import express from "express";
import {
  registerKasir,
  loginKasir,
  addItem,
  getItems,
  updateItem,
  deleteItem,
  getAllUsers,
  updateUser,
  deleteUser
} from "../controllers/kasir.controller.js";
import { verifyToken } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// === 📦 Setup Multer untuk upload gambar ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// === 🔐 ROUTES ===

// Auth routes
router.post("/register", upload.none(), registerKasir);
router.post("/login", upload.none(), loginKasir);


// === 👑 ADMIN USER MANAGEMENT ===
router.get("/users", verifyToken, getAllUsers);
router.put("/users/:id", verifyToken, upload.none(), updateUser);
router.delete("/users/:id", verifyToken, deleteUser);

// Item routes (admin only)
router.post("/item", verifyToken, upload.single("gambar"), addItem);
router.get("/item", verifyToken, getItems);
router.put("/item/:id", verifyToken, upload.single("gambar"), updateItem);
router.delete("/item/:id", verifyToken, deleteItem);

export default router;
