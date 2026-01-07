-- Skema Database untuk File Management System

CREATE TABLE IF NOT EXISTS google_drive_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folder_name VARCHAR(255) NOT NULL,
    drive_folder_id VARCHAR(255) NOT NULL,
    parent_drive_id VARCHAR(255) DEFAULT 'root',
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    web_view_link TEXT,
    drive_folder_id VARCHAR(255) DEFAULT NULL, -- Ini menyimpan drive_folder_id dari GDrive
    category ENUM('document', 'spreadsheet', 'pdf', 'presentation', 'image', 'other') DEFAULT 'other',
    user_id INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: user_id di sini harus disesuaikan dengan tabel user yang sudah ada di database-mu.
-- Jika belum ada tabel users, tambahkan ini:
-- CREATE TABLE users (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     username VARCHAR(255) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
