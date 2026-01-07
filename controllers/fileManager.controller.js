import db from "../config/db.js";
import * as driveService from "../services/googleDrive.service.js";
import path from "path";

// Fungsi pembantu untuk menentukan kategori berdasarkan ekstensi
const getCategory = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    const docs = [".doc", ".docx", ".odt", ".txt"];
    const sheets = [".xls", ".xlsx", ".ods", ".csv"];
    const pdfs = [".pdf"];
    const slides = [".ppt", ".pptx"];
    const images = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (docs.includes(ext)) return "document";
    if (sheets.includes(ext)) return "spreadsheet";
    if (pdfs.includes(ext)) return "pdf";
    if (slides.includes(ext)) return "presentation";
    if (images.includes(ext)) return "image";
    return "other";
};

export const uploadFilesAndFolders = async (req, res) => {
    try {
        const { userId } = req.body;
        const files = req.files;
        const structures = JSON.parse(req.body.structures || "[]");

        if (!files || files.length === 0) {
            return res.status(400).json({ message: "Tidak ada file yang diupload" });
        }

        const driveFolderCache = {};
        const results = [];

        for (const file of files) {
            const structure = structures.find((s) => s.originalname === file.originalname);
            let parentDriveId = process.env.GD_ROOT_FOLDER_ID || null;

            if (structure && structure.relativePath) {
                const folderPath = path.dirname(structure.relativePath);
                if (folderPath !== ".") {
                    // Normalize separators to forward slash
                    const normalizedPath = folderPath.replace(/\\/g, "/");
                    const parts = normalizedPath.split("/");

                    let currentPath = "";
                    let currentParentId = parentDriveId;

                    for (const part of parts) {
                        currentPath = currentPath ? `${currentPath}/${part}` : part;

                        if (!driveFolderCache[currentPath]) {
                            const [existingFolder] = await db.promise().query(
                                "SELECT drive_folder_id FROM google_drive_folders WHERE folder_name = ? AND user_id = ? AND parent_drive_id = ?",
                                [part, userId, currentParentId || "root"]
                            );

                            if (existingFolder.length > 0) {
                                driveFolderCache[currentPath] = existingFolder[0].drive_folder_id;
                            } else {
                                const newFolderId = await driveService.createFolder(part, currentParentId);
                                await db.promise().query(
                                    "INSERT INTO google_drive_folders (folder_name, drive_folder_id, parent_drive_id, user_id) VALUES (?, ?, ?, ?)",
                                    [part, newFolderId, currentParentId || "root", userId]
                                );
                                driveFolderCache[currentPath] = newFolderId;
                            }
                        }
                        currentParentId = driveFolderCache[currentPath];
                    }
                    parentDriveId = currentParentId;
                }
            }

            const driveFile = await driveService.uploadFile(file, parentDriveId);
            const category = getCategory(file.originalname);

            const [insertResult] = await db.promise().query(
                "INSERT INTO files (filename, drive_file_id, web_view_link, drive_folder_id, category, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    file.originalname,
                    driveFile.id,
                    driveFile.webViewLink,
                    parentDriveId,
                    category,
                    userId
                ]
            );

            results.push({
                id: insertResult.insertId,
                filename: file.originalname,
                drive_file_id: driveFile.id,
                category,
                webViewLink: driveFile.webViewLink
            });
        }

        res.status(200).json({
            message: "Berhasil upload file dan struktur folder",
            data: results
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Gagal upload file", error: error.message });
    }
};

export const listFiles = async (req, res) => {
    try {
        const { userId, category, search, folderId } = req.query;
        let query = "SELECT * FROM files WHERE user_id = ?";
        const params = [userId];

        if (category) {
            query += " AND category = ?";
            params.push(category);
        }
        if (search) {
            query += " AND filename LIKE ?";
            params.push(`%${search}%`);
        }
        if (folderId) {
            query += " AND drive_folder_id = ?";
            params.push(folderId);
        }

        query += " ORDER BY uploaded_at DESC";
        const [rows] = await db.promise().query(query, params);
        res.status(200).json({ data: rows });
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data file", error: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { userId, username, password } = req.body;
        res.status(200).json({ message: "Profile updated" });
    } catch (error) {
        res.status(500).json({ message: "Gagal update profile", error: error.message });
    }
};
