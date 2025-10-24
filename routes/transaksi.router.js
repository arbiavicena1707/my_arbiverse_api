import express from "express";
import multer from "multer";
import {
  createTransaksi,
  createTransaksiUser,
  getAllTransaksi,
  getTransaksiById,
  getTransaksiResume,
  updateTransaksiStatus,
} from "../controllers/transaksi.contoller.js";
import { verifyToken, verifyTokenOptional } from "../middleware/auth.js";

const router = express.Router();
const upload = multer();

// 🔹 Transaksi kasir (pakai token)
router.post("/", verifyTokenOptional, upload.none(), createTransaksi);
router.get("/", verifyToken, getAllTransaksi);
router.get("/resume", verifyToken, getTransaksiResume);
router.get("/:id", verifyToken, getTransaksiById);
router.put("/status/:id", verifyToken, upload.none(), updateTransaksiStatus);

// 🔹 Transaksi user (public)
router.post("/user", upload.none(), createTransaksiUser);

export default router;
