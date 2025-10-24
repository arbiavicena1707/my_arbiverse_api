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
// === SETUP ===
const uploadFile = multer({ storage }); // untuk file
const uploadNone = multer(); // untuk form tanpa file

// === AUTH ===
router.post("/register",  registerKasir);
router.post("/login", loginKasir);

// === USERS ===
router.get("/users", verifyToken, getAllUsers);
router.put("/users/:id", verifyToken, uploadNone.none(), updateUser);
router.delete("/users/:id", verifyToken, deleteUser);

// === ITEMS ===
router.post("/item", verifyToken, uploadFile.single("gambar"), addItem);
router.put("/item/:id", verifyToken, uploadFile.single("gambar"), updateItem);
router.delete("/item/:id", verifyToken, deleteItem);

export default router;
