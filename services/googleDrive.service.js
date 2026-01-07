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
            resource: fileMetadata,
            fields: "id",
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
export const uploadFile = async (file, parentId = null) => {
    const fileMetadata = {
        name: file.originalname,
    };
    if (parentId) {
        fileMetadata.parents = [parentId];
    }

    const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
    };

    try {
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id, name, webViewLink, webContentLink",
        });

        // Beri izin publik (opsional, tergantung kebutuhan - user minta bisa diedit via iframe)
        // Untuk edit via iframe Google Docs, file harus dibagikan atau didelegasikan.
        // Di sini kita set sebagai 'reader' publik sebagai default, 
        // tapi untuk 'writer' butuh akun spesifik atau domain.
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error uploading file to GDrive:", error);
        throw error;
    }
};

export default drive;
