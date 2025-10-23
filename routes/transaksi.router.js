import express from "express";
import multer from "multer";
import {
  createTransaksi,
  getAllTransaksi,
  getTransaksiById,
  getTransaksiResume,
} from "../controllers/transaksi.contoller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
const upload = multer(); // <--- Tambahkan ini

router.post("/", verifyToken, upload.none(), createTransaksi); // kasir
router.get("/", verifyToken, getAllTransaksi); // admin
router.get("/resume", verifyToken, getTransaksiResume); // admin
router.get("/:id", verifyToken, getTransaksiById); // admin/kasir

export default router;
