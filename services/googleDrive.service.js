import { google } from "googleapis";
import path from "path";
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
 * Helper function to execute Google Drive API calls with retry logic
 * Particularly useful for 503 Service Unavailable and 429 Rate Limit errors
 */
const executeWithRetry = async (fn, maxRetries = 5) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.response ? error.response.status : error.code;

            // Retry on 429 (Rate Limit), 5xx (Server Error), and transient network errors
            const isRetryableNetworkError = !error.response &&
                ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"].includes(error.code);

            if (status === 429 || (status >= 500 && status <= 599) || isRetryableNetworkError) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`[GDrive] Attempt ${i + 1} failed with status/code ${status || error.code}. Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Re-throw if it's not a retryable error (e.g., 401, 403, 404)
        }
    }
    throw lastError;
};

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
        const response = await executeWithRetry(() =>
            drive.files.create({
                requestBody: fileMetadata,
                fields: "id",
                supportsAllDrives: true,
            })
        );
        return response.data.id;
    } catch (error) {
        console.error("Error creating folder on GDrive:", error.message);
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
        body: Readable.from(file.buffer), // GDrive multipart upload requires a stream
    };

    try {
        const response = await executeWithRetry(() =>
            drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, name, webViewLink, webContentLink",
                supportsAllDrives: true,
            })
        );

        // Set izin agar file bisa diedit oleh siapa saja yang punya link
        await executeWithRetry(() =>
            drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: "writer",
                    type: "anyone",
                },
                supportsAllDrives: true,
            })
        );

        return response.data;
    } catch (error) {
        console.error("Error uploading file to GDrive:", error.message);
        throw error;
    }
};

export default drive;
