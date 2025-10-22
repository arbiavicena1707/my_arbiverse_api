import db from "../config/db.js"

// 🔹 Ambil semua project
export const getProjects = (req, res) => {
  db.query("SELECT * FROM projects", (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

    // ubah tech dari string ke array JSON
    const formatted = results.map((item) => ({
      ...item,
      tech: item.tech ? JSON.parse(item.tech) : [],
    }));

    res.json({ status: 200, data: formatted });
  });
};

// 🔹 Ambil 1 project berdasarkan id
export const getProjectById = (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM projects WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0)
      return res.status(404).json({ message: "Project tidak ditemukan" });
    res.json({ status: 200, data: results[0] });
  });
};

// 🔹 Tambah project baru
export const addProject = (req, res) => {
  const { title, description, tech, link } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      status: 400,
      message: "Title dan description wajib diisi",
    });
  }

  const sql =
    "INSERT INTO projects (title, description, tech, link) VALUES (?, ?, ?, ?)";

  db.query(sql, [title, description, JSON.stringify(tech || []), link || null], (err, result) => {
    if (err) {
      console.error("❌ MySQL Error:", err);
      return res.status(500).json({ message: "Gagal menambah project", error: err.message });
    }

    res.status(201).json({
      status: 201,
      message: "✅ Project berhasil ditambahkan",
      data: {
        id: result.insertId,
        title,
        description,
        tech: tech || [],
        link: link || null,
      },
    });
  });
};

// 🔹 Hapus project
export const deleteProject = (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM projects WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Project tidak ditemukan" });
    res.json({ status: 200, message: "Project berhasil dihapus" });
  });
};
