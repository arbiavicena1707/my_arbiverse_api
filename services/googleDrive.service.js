import { google } from "googleapis";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

// Path ke file JSON Service Account
// User harus meletakkan file service account di folder root dan menamainya 'service-account.json'
const KEYFILEPATH = path.join(process.cwd(), "service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

/**
 * Membuat folder di Google Drive
 * @param {string} folderName Nama folder
 * @param {string} parentId ID folder induk (opsional)
 * @returns {Promise<string>} ID folder yang baru dibuat
 */
export const createFolder = async (folderName, parentId = null) => {
    const fileMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) {
        fileMetadata.parents = [parentId];
    }

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id",
            supportsAllDrives: true,
        });
        return response.data.id;
    } catch (error) {
        console.error("Error creating folder on GDrive:", error);
        throw error;
    }
};

/**
 * Upload file ke Google Drive
 * @param {Object} file Object file dari multer (memoryStorage)
 * @param {string} parentId ID folder tempat file disimpan
 * @returns {Promise<Object>} Data file Drive
 */
export const uploadFile = async (file, parentId) => {
    // Pastikan parentId diisi dengan ID Folder yang sudah dishare tadi
    if (!parentId) {
        throw new Error("parentId (ID Folder) wajib diisi karena Service Account tidak punya ruang simpan sendiri.");
    }

    const fileMetadata = {
        name: file.originalname,
        parents: [parentId], // File akan disimpan menggunakan kuota pemilik folder
    };

    // Logika auto-convert (tetap sama)
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".docx" || ext === ".doc") fileMetadata.mimeType = "application/vnd.google-apps.document";
    else if (ext === ".xlsx" || ext === ".xls") fileMetadata.mimeType = "application/vnd.google-apps.spreadsheet";
    else if (ext === ".pptx" || ext === ".ppt") fileMetadata.mimeType = "application/vnd.google-apps.presentation";

    const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
    };

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: "id, name, webViewLink, webContentLink",
            supportsAllDrives: true, 
        });

        // Set izin agar file bisa diedit oleh siapa saja yang punya link
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: "writer",
                type: "anyone",
            },
            supportsAllDrives: true,
        });

        return response.data;
    } catch (error) {
        // Hapus baris 'res.data.files' yang salah di kode sebelumnya
        console.error("Error uploading file to GDrive:", error.message);
        throw error;
    }
};

export default drive;
