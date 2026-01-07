/**
 * Contoh Implementasi Frontend (Vanilla JS) untuk Drag and Drop Folder
 * Fitur: Membaca struktur folder dan mengirimkannya ke Backend
 */

const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const items = e.dataTransfer.items;
    const filesToUpload = [];
    const structures = [];

    // Fungsi rekursif untuk membaca file dan folder
    const traverseFileTree = (item, path = '') => {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    filesToUpload.push(file);
                    structures.push({
                        originalname: file.name,
                        relativePath: path + file.name
                    });
                    resolve();
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                dirReader.readEntries(async (entries) => {
                    for (const entry of entries) {
                        await traverseFileTree(entry, path + item.name + '/');
                    }
                    resolve();
                });
            }
        });
    };

    // Jalankan scan
    const scanPromises = [];
    for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
            scanPromises.push(traverseFileTree(entry));
        }
    }

    await Promise.all(scanPromises);

    // Kirim ke Backend
    uploadToServer(filesToUpload, structures);
});

async function uploadToServer(files, structures) {
    const formData = new FormData();

    files.forEach((file) => {
        formData.append('files', file);
    });

    // Kirim struktur folder dalam bentuk JSON string
    formData.append('structures', JSON.stringify(structures));
    formData.append('userId', '1'); // Sesuaikan dengan User ID yang aktif

    try {
        const response = await fetch('/api/file-manager/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        console.log('Upload sukses:', result);
        alert('Upload berhasil!');
    } catch (error) {
        console.error('Upload gagal:', error);
    }
}
