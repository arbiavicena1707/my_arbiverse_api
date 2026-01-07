import express from "express";
import multer from "multer";
import * as fileController from "../controllers/fileManager.controller.js";

const router = express.Router();

// Gunakan memoryStorage agar file tidak tersimpan di disk server sementara
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route untuk upload (mendukung multiple files dari struktur folder)
router.post("/upload", upload.array("files"), fileController.uploadFilesAndFolders);

// Route untuk list & filter
router.get("/list", fileController.listFiles);

// Route untuk user management
router.put("/profile", fileController.updateProfile);

export default router;
