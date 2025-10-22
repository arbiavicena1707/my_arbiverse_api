import express from "express";
import {
  createTransaksi,
  getAllTransaksi,
  getTransaksiById,
} from "../controllers/transaksi.contoller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/", verifyToken, createTransaksi); // kasir
router.get("/", verifyToken, getAllTransaksi); // admin
router.get("/:id", verifyToken, getTransaksiById); // admin/kasir

export default router;
