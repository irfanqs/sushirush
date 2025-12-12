// controllers/akreditasiController.js
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import XLSX from "xlsx";
import prisma from "../prismaClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templates = [
  { id: 1, nama_template: "Template BAN-PT", jenis_template: "PDF" },
  { id: 2, nama_template: "Template Internal", jenis_template: "Excel" },
];

// ---------- GET /api/akreditasi/stats ----------
export const getStats = (req, res) => {
  const totalBagian = bagianAkreditasi.length;
  const siapExport = bagianAkreditasi.filter(b => b.status === "Siap Export").length;
  const belumLengkap = bagianAkreditasi.filter(b => b.status === "Belum Lengkap").length;
  const kelengkapan = Math.round((siapExport / totalBagian) * 100);

  res.json({
    totalBagian,
    siapExport,
    belumLengkap,
    kelengkapan,
  });
};

// ---------- GET /api/akreditasi/items ----------
export const getItems = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Ambil data dari database menggunakan logic yang sama dengan getRekapBagian
    const items = await prisma.buktiPendukung.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    // Kelompokkan berdasarkan bagian
    const groups = new Map();

    for (const it of items) {
      let kode = 'UNK';
      let nama = 'Bagian Tidak Dikenal';
      let deskripsi = it.nama || 'Bukti pendukung';

      if (typeof it.nama === 'string' && it.nama.includes('-')) {
        const parts = it.nama.split('-').map(s => s.trim());
        if (parts.length >= 2) {
          kode = parts[0] || kode;
          nama = parts[1] || nama;
          deskripsi = parts.slice(2).join(' - ') || deskripsi;
        }
      }

      const key = `${kode}::${nama}`;
      const current = groups.get(key) || { 
        id: undefined, 
        kode_bagian: kode, 
        nama_bagian: nama, 
        deskripsi: '', 
        tanggal_update: undefined, 
        dokumen: [], 
        statusRaw: [] 
      };

      current.dokumen.push(it);
      current.statusRaw.push((it.status || '').toLowerCase());
      const ts = new Date(it.updatedAt || it.createdAt || Date.now()).toISOString();
      current.tanggal_update = !current.tanggal_update || ts > current.tanggal_update ? ts : current.tanggal_update;
      if (!current.deskripsi) current.deskripsi = deskripsi;

      groups.set(key, current);
    }

    // Tentukan status bagian
    const mapStatus = (statusList) => {
      if (!statusList || statusList.length === 0) return 'Kelengkapan';
      const allLower = statusList.map(s => String(s || '').toLowerCase());
      const allLengkap = allLower.every(s => s === 'lengkap' || s === 'complete' || s === 'siap export');
      return allLengkap ? 'Siap Export' : 'Belum Lengkap';
    };

    const result = [];
    let counter = 1;
    for (const [key, group] of groups) {
      result.push({
        id: counter++,
        kode_bagian: group.kode_bagian,
        nama_bagian: group.nama_bagian,
        deskripsi: group.deskripsi,
        tanggal_update: group.tanggal_update,
        status: mapStatus(group.statusRaw),
        dokumen: group.dokumen
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ message: 'Gagal mengambil data', error: error.message });
  }
};

// ---------- POST /api/akreditasi/export ----------
export const exportData = async (req, res) => {
  try {
    const { format, selectedIds } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User tidak terautentikasi' });
    }

    // Ambil data dari database
    const items = await prisma.buktiPendukung.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    // Kelompokkan berdasarkan bagian (sama seperti getItems)
    const groups = new Map();

    for (const it of items) {
      let kode = 'UNK';
      let nama = 'Bagian Tidak Dikenal';
      let deskripsi = it.nama || 'Bukti pendukung';

      if (typeof it.nama === 'string' && it.nama.includes('-')) {
        const parts = it.nama.split('-').map(s => s.trim());
        if (parts.length >= 2) {
          kode = parts[0] || kode;
          nama = parts[1] || nama;
          deskripsi = parts.slice(2).join(' - ') || deskripsi;
        }
      }

      const key = `${kode}::${nama}`;
      const current = groups.get(key) || { 
        id: undefined, 
        kode_bagian: kode, 
        nama_bagian: nama, 
        deskripsi: '', 
        tanggal_update: undefined, 
        dokumen: [], 
        statusRaw: [] 
      };

      current.dokumen.push(it);
      current.statusRaw.push((it.status || '').toLowerCase());
      const ts = new Date(it.updatedAt || it.createdAt || Date.now()).toISOString();
      current.tanggal_update = !current.tanggal_update || ts > current.tanggal_update ? ts : current.tanggal_update;
      if (!current.deskripsi) current.deskripsi = deskripsi;

      groups.set(key, current);
    }

    // Tentukan status bagian
    const mapStatus = (statusList) => {
      if (!statusList || statusList.length === 0) return 'Kelengkapan';
      const allLower = statusList.map(s => String(s || '').toLowerCase());
      const allLengkap = allLower.every(s => s === 'lengkap' || s === 'complete' || s === 'siap export');
      return allLengkap ? 'Siap Export' : 'Belum Lengkap';
    };

    const allData = [];
    let counter = 1;
    for (const [key, group] of groups) {
      allData.push({
        id: counter++,
        kode_bagian: group.kode_bagian,
        nama_bagian: group.nama_bagian,
        deskripsi: group.deskripsi,
        tanggal_update: group.tanggal_update,
        status: mapStatus(group.statusRaw),
      });
    }

    // Filter data berdasarkan ID yang dipilih
    const selected = allData.filter(b => selectedIds.includes(b.id));

    if (selected.length === 0) {
      return res.status(400).json({ message: "Tidak ada data yang dipilih untuk export" });
    }

    const fileName = `akreditasi-export-${Date.now()}`;
    const exportDir = path.join(__dirname, "../exports");
    
    // Buat folder exports kalau belum ada
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    if (format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx') {
      // Export ke Excel menggunakan XLSX
      const worksheet = XLSX.utils.json_to_sheet(selected);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Akreditasi");

      // Set column widths
      const cols = [
        { wch: 5 },   // id
        { wch: 15 },  // kode_bagian
        { wch: 30 },  // nama_bagian
        { wch: 50 },  // deskripsi
        { wch: 25 },  // tanggal_update
        { wch: 20 },  // status
      ];
      worksheet['!cols'] = cols;

      const filePath = path.join(exportDir, `${fileName}.xlsx`);
      XLSX.writeFile(workbook, filePath);

      res.download(filePath, `${fileName}.xlsx`, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Gagal mengirim file" });
          }
        }
        // Hapus file setelah dikirim
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      });
    } else if (format.toLowerCase() === 'pdf') {
      // Untuk PDF, sementara kirim JSON (nanti bisa implement PDF generator)
      const filePath = path.join(exportDir, `${fileName}.pdf`);
      
      // Simple PDF generation (placeholder - implement proper PDF later)
      const pdfContent = `DATA AKREDITASI\n\n${JSON.stringify(selected, null, 2)}`;
      fs.writeFileSync(filePath, pdfContent);

      res.download(filePath, `${fileName}.pdf`, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Gagal mengirim file" });
          }
        }
        // Hapus file setelah dikirim
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      });
    } else {
      res.status(400).json({ message: "Format tidak didukung. Gunakan Excel atau PDF." });
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ message: "Gagal export data", error: error.message });
  }
};

// ---------- Upload Config ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// ---------- POST /api/akreditasi/upload ----------
export const uploadMiddleware = upload.single("document");

export const uploadDocument = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Tidak ada file yang diupload" });
  }
  res.json({
    message: "File berhasil diupload",
    file: req.file.filename,
  });
};

// ---------- GET /api/akreditasi/bagian ----------
export const getBagian = (req, res) => {
  res.json([
    {
      id: 1,
      kode_bagian: "A1",
      nama_bagian: "Visi & Misi",
      deskripsi: "Menjelaskan visi dan misi institusi",
      tanggal_update: "2025-01-10",
      status: "Siap Export",
    },
    {
      id: 2,
      kode_bagian: "B1",
      nama_bagian: "Kurikulum",
      deskripsi: "Struktur kurikulum dan capaian pembelajaran",
      tanggal_update: "2025-02-05",
      status: "Belum Lengkap",
    },
  ]);
};

// ---------- GET /api/akreditasi/templates ----------
export const getTemplates = (req, res) => {
  res.json([
    { id: 1, nama_template: "Template BAN-PT", jenis_template: "PDF" },
    { id: 2, nama_template: "Template Internal", jenis_template: "Excel" },
  ]);
};

