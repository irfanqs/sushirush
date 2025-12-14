// app/dashboard/tim-akreditasi/lkps/page.tsx
'use client';
import Link from "next/link";
import React, { useEffect, useState } from 'react';
import { FileText, Upload, Download, Save, Plus, Edit, Trash2, X, CheckCircle, AlertCircle, Info, MessageSquare } from 'lucide-react';
import { usePathname, useRouter } from "next/navigation";
import { getReviews as fetchReviews } from '@/services/reviewService';

import NotificationBell from '../NotificationBell';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL.replace('/api', '')}/api/budaya-mutu` : 'http://localhost:5001/api/budaya-mutu'; 

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  nama_lengkap: string;
  prodi: string;
};

export default function LKPSPage() {
  const router = useRouter();
  type SubTab = 'tupoksi' | 'pendanaan' | 'penggunaan-dana' | 'ewmp' | 'ktk' | 'spmi';

  const tableTitles: Record<SubTab, string> = {
    tupoksi: 'Tabel 1.A.1 Tabel Pimpinan dan Tupoksi UPPS dan PS',
    pendanaan: 'Tabel 1.A.2 Sumber Pendanaan UPPS/PS',
    'penggunaan-dana': 'Tabel 1.A.3 Penggunaan Dana UPPS/PS',
    ewmp: 'Tabel 1.A.4 Rata-rata Beban DTPR per semester (EWMP) pada TS',
    ktk: 'Tabel 1.A.5 Kualifikasi Tenaga Kependidikan',
    spmi: 'Tabel 1.B Tabel Unit SPMI dan SDM',
  };

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('tupoksi');
  const [tabData, setTabData] = useState<Record<SubTab, any[]>>({
    tupoksi: [],
    pendanaan: [],
    'penggunaan-dana': [],
    ewmp: [],
    ktk: [],
    spmi: [],
  });
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // User state
  const [user, setUser] = useState<User | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  // Initialize user from sessionStorage
  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setUserLoaded(true);
  }, []);

  // State untuk modal catatan P4M
  const [showP4MNotes, setShowP4MNotes] = useState(false);
  const [selectedItemForNotes, setSelectedItemForNotes] = useState<any>(null);
  const [p4mNotes, setP4mNotes] = useState<any[]>([]);
  const [loadingP4mNotes, setLoadingP4mNotes] = useState(false);

  // State untuk import Excel dengan preview
  const [importing, setImporting] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // State untuk popup notifikasi
  const [popup, setPopup] = useState<{ 
    show: boolean; 
    message: string; 
    type: 'success' | 'error' | 'info' 
  }>({
    show: false,
    message: '',
    type: 'success',
  });

  // State untuk modal konfirmasi
  const [modal, setModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // State untuk struktur organisasi
  const [strukturFileName, setStrukturFileName] = useState('');
  const [strukturFileId, setStrukturFileId] = useState<string | null>(null);
  const [strukturFileUrl, setStrukturFileUrl] = useState('');

  // API_BASE sudah didefinisikan di atas

  const tabs = [
    { label: 'Budaya Mutu', href: '/dashboard/tim-akreditasi/lkps' },
    { label: 'Relevansi Pendidikan', href: '/dashboard/tim-akreditasi/lkps/relevansi-pendidikan' },
    { label: 'Relevansi Penelitian', href: '/dashboard/tim-akreditasi/lkps/relevansi-penelitian' },
    { label: 'Relevansi Pkm', href: '/dashboard/tim-akreditasi/lkps/relevansi-pkm' },
    { label: 'Akuntabilitas', href: '/dashboard/tim-akreditasi/lkps/akuntabilitas' },
    { label: 'Diferensiasi Misi', href: '/dashboard/tim-akreditasi/lkps/diferensiasi-misi' },
  ];

  // Fungsi untuk menampilkan popup
  const showPopup = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setPopup({ show: true, message, type });
    setTimeout(() => setPopup({ show: false, message: '', type: 'success' }), 3000);
  };

  // Fungsi untuk menampilkan modal konfirmasi
  const showModal = (title: string, message: string, onConfirm: () => void) => {
    setModal({ show: true, title, message, onConfirm });
  };

  const closeModal = () => {
    setModal({ show: false, title: '', message: '', onConfirm: () => {} });
  };

  const handleModalConfirm = () => {
    modal.onConfirm();
    closeModal();
  };

  const handleSaveDraft = async () => {
    showPopup('Menyimpan draft...', 'info');
    try {
      await fetch(`${API_BASE}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nama: `LKPS - Budaya Mutu`,
          path: `/dashboard/tim-akreditasi/lkps`, // Current page path, used for bukti pendukung reference
          status: 'Draft',
          type: activeSubTab, // Send activeSubTab as 'type'
          currentData: tabData[activeSubTab], // Send the detailed data
        }),
        credentials: 'include',
      });

      showPopup('Draft berhasil disimpan. Mengalihkan...', 'success');

      setTimeout(() => {
        router.push('/dashboard/tim-akreditasi/bukti-pendukung');
      }, 1500);

    } catch (error: any) {
      console.error('Gagal menyimpan draft:', error);
      showPopup(error.message || 'Gagal menyimpan draft. Lihat konsol untuk detail.', 'error');
    }
  };


  // Komponen Popup
  const PopupNotification = () => {
    if (!popup.show) return null;

    const bgColor = popup.type === 'success' ? 'bg-green-50 border-green-500' : 
                    popup.type === 'error' ? 'bg-red-50 border-red-500' : 
                    'bg-blue-50 border-blue-500';
    const textColor = popup.type === 'success' ? 'text-green-800' : 
                      popup.type === 'error' ? 'text-red-800' : 
                      'text-blue-800';
    const Icon = popup.type === 'success' ? CheckCircle : 
                 popup.type === 'error' ? AlertCircle : 
                 Info;

    return (
      <div className="fixed top-0 left-0 right-0 flex justify-center z-[60] pt-4">
        <div className={`${bgColor} ${textColor} border-l-4 rounded-lg shadow-2xl p-5 flex items-center gap-4 min-w-[350px] max-w-md animate-slideDown`}>
          <Icon size={28} className={popup.type === 'success' ? 'text-green-500' : 
                                     popup.type === 'error' ? 'text-red-500' : 
                                     'text-blue-500'} />
          <div className="flex-1">
            <p className="font-bold text-base mb-1">
              {popup.type === 'success' ? 'Berhasil!' : 
               popup.type === 'error' ? 'Error!' : 
               'Info'}
            </p>
            <p className="text-sm">{popup.message}</p>
          </div>
          <button 
            onClick={() => setPopup({ show: false, message: '', type: 'success' })}
            className="hover:opacity-70 transition-opacity"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  };

  // Komponen Modal Konfirmasi
  const ConfirmModal = () => {
    if (!modal.show) return null;

    const isDeleteAction = modal.title.includes('Hapus');
    const isImportAction = modal.title.includes('Import');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] animate-fadeIn">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scaleIn">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              isDeleteAction ? 'bg-red-100' : isImportAction ? 'bg-blue-100' : 'bg-yellow-100'
            }`}>
              <AlertCircle className={`${
                isDeleteAction ? 'text-red-600' : isImportAction ? 'text-blue-600' : 'text-yellow-600'
              }`} size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {modal.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {modal.message}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              onClick={handleModalConfirm}
              className={`px-4 py-2 text-white rounded-lg transition ${
                isDeleteAction
                  ? 'bg-red-600 hover:bg-red-700'
                  : isImportAction
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              {isDeleteAction ? 'Hapus' : isImportAction ? 'Import' : 'Ya, Lanjutkan'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Komponen Modal Preview Import
  const PreviewModal = () => {
    if (!showPreviewModal) return null;

    const handleMappingChange = (field: string, value: string) => {
      setMapping(prev => ({ ...prev, [field]: value }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] animate-fadeIn p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-scaleIn">
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-xl font-semibold text-gray-900">Preview Import Excel</h3>
            <button
              onClick={() => setShowPreviewModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Mapping Section */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-800 mb-4">Mapping Kolom</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFormFields(activeSubTab).map(field => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {field.label}
                    </label>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                    >
                      <option value="">Pilih Kolom Excel</option>
                      {previewHeaders.map((header, index) => (
                        <option key={index} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    {suggestions[field.key] && (
                      <p className="text-xs text-blue-600">
                        Saran: {suggestions[field.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-800 mb-4">Preview Data (5 baris pertama)</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewHeaders.map((header, index) => (
                        <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewRows.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {previewHeaders.map((header, colIndex) => (
                          <td key={colIndex} className="px-4 py-2 text-sm text-gray-900">
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 5 && (
                <p className="text-sm text-gray-600 mt-2">
                  ... dan {previewRows.length - 5} baris lainnya
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={() => setShowPreviewModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              onClick={handleCommitImport}
              disabled={importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Mengimport...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Import Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Fungsi validasi form
  const validateForm = () => {
    const errors: Record<string, string> = {};
    const fields = getFormFields(activeSubTab);
    
    fields.forEach(field => {
      const value = formData[field.key];
      if (!value || value.trim() === '') {
        errors[field.key] = `${field.label} harus diisi`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    if (!userLoaded || !user) return; // Ensure user is loaded and not null
    fetchData();
  }, [activeSubTab, user, userLoaded]); // Added user and userLoaded to dependencies

  // ...

  const fetchData = async () => {
    try {
      const prodiFilter = user.prodi ? `&prodi=${user.prodi}` : ''; // Get prodi from user
      const res = await fetch(`${API_BASE}?type=${activeSubTab}${prodiFilter}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        console.error(`HTTP error! status: ${res.status}`);
        setTabData(prev => ({ ...prev, [activeSubTab]: [] }));
        return;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Response bukan JSON:', await res.text());
        setTabData(prev => ({ ...prev, [activeSubTab]: [] }));
        return;
      }

      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setTabData(prev => ({
          ...prev,
          [activeSubTab]: json.data.map(item => ({
            id: item.id,
            data: item.data
          }))
        }));
      } else {
        setTabData(prev => ({ ...prev, [activeSubTab]: [] }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setTabData(prev => ({ ...prev, [activeSubTab]: [] }));
    }
  };

  const fetchStrukturOrganisasi = async () => {
    try {
      const res = await fetch(`${API_BASE}/struktur`, {
        credentials: 'include',
      });
      const json = await res.json();

      if (json.success && json.file) {
        setStrukturFileName(json.file.fileName);
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
        setStrukturFileUrl(`${baseUrl}${json.file.fileUrl}`);
        setStrukturFileId(json.file.id);
      }
    } catch (err) {
      console.error('Fetch struktur error:', err);
    }
  };

  // Fungsi untuk handle file change dan preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewFile(file);
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const mappingImport = {
        'tupoksi': {
          unitKerja: 'Unit Kerja',
          namaKetua: 'Nama Ketua',
          periode: 'Periode',
          pendidikanTerakhir: 'Pendidikan Terakhir',
          jabatanFungsional: 'Jabatan Fungsional',
          tugasPokokDanFungsi: 'Tugas Pokok dan Fungsi',
        },
        'pendanaan': {
          sumberPendanaan: 'Sumber Pendanaan',
          ts2: 'TS-2',
          ts1: 'TS-1',
          ts: 'TS',
          linkBukti: 'Link Bukti',
        },
        'penggunaan-dana': {
          penggunaanDana: 'Penggunaan Dana',
          ts2: 'TS-2',
          ts1: 'TS-1',
          ts: 'TS',
          linkBukti: 'Link Bukti',
        },
        'ewmp': {
          no: 'No',
          namaDTPR: 'Nama DTPR',
          psSendiri: 'PS Sendiri',
          psLainPTSendiri: 'PS Lain PT Sendiri',
          ptLain: 'PT Lain',
          sksPenelitian: 'SKS Penelitian',
          sksPengabdian: 'SKS Pengabdian',
          manajemenPTSendiri: 'Manajemen PT Sendiri',
          manajemenPTLain: 'Manajemen PT Lain',
          totalSKS: 'Total SKS',
        },
        'ktk': {
          no: 'No',
          jenisTenagaKependidikan: 'Jenis Tenaga',
          s3: 'S3',
          s2: 'S2',
          s1: 'S1',
          d4: 'D4',
          d3: 'D3',
          d2: 'D2',
          d1: 'D1',
          sma: 'SMA',
          unitKerja: 'Unit Kerja',
        },
        'spmi': {
          unitSPMI: 'Unit SPMI',
          namaUnitSPMI: 'Nama Unit',
          dokumenSPMI: 'Dokumen SPMI',
          jumlahAuditorMutuInternal: 'Jumlah Auditor',
          certified: 'Certified',
          nonCertified: 'Non Certified',
          frekuensiAudit: 'Frekuensi Audit',
          buktiCertifiedAuditor: 'Bukti Certified',
          laporanAudit: 'Laporan Audit',
        }
      };
      fd.append('mapping', JSON.stringify(mappingImport[activeSubTab] || {}));
      // fd.append('mapping', JSON.stringify(getFormFields(activeSubTab)));
      console.log(activeSubTab)
      const res = await fetch(`${API_BASE}/import/${activeSubTab}`, { method: 'POST', body: fd, credentials: 'include' });

      if (!res.ok) {
        showPopup('Gagal memproses file', 'error');
        return;
      }

      const json = await res.json();

      if (json.success) {
        setPreviewHeaders(json.headers || []);
        setPreviewRows(json.rows || []);
        setSuggestions(json.suggestions || {});

        // Initialize mapping with suggestions
        const initialMapping: Record<string, string> = {};
        Object.entries(json.suggestions || {}).forEach(([field, suggestion]) => {
          initialMapping[field] = suggestion as string;
        });
        setMapping(initialMapping);
        console.log(initialMapping);

        setShowPreviewModal(true);
      } else {
        showPopup(json.message || 'Gagal memproses file', 'error');
      }
      fetchData();
    } catch (err) {
      console.error('Preview error:', err);
      showPopup('Gagal memproses file', 'error');
    } finally {
      setImporting(false);
      
    }

    e.target.value = '';
  };

  // Fungsi untuk commit import setelah mapping
  const handleCommitImport = async () => {
    if (!previewFile) return;

    setImporting(true);

    try {
      const fd = new FormData();
      fd.append('file', previewFile);
      fd.append('mapping', JSON.stringify(mapping));

      const res = await fetch(`${API_BASE}/import/${activeSubTab}`, { method: 'POST', body: fd, credentials: 'include' });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        showPopup('Server error - bukan JSON response', 'error');
        console.error('Response:', await res.text());
        return;
      }

      const json = await res.json();

      if (res.ok && json.success) {
        showPopup(`Import ${activeSubTab} berhasil`, 'success');
        fetchData();
        setShowPreviewModal(false);
        setPreviewFile(null);
        setPreviewHeaders([]);
        setPreviewRows([]);
        setMapping({});
      } else {
        showPopup(json.message || 'Gagal import file', 'error');
      }
    } catch (err) {
      console.error('Import error:', err);
      showPopup('Gagal import file', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleUploadStruktur = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showPopup('Ukuran file maksimal 10MB', 'error');
      e.target.value = '';
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showPopup('Format file harus JPG, PNG, atau PDF', 'error');
      e.target.value = '';
      return;
    }

    const fd = new FormData();
    fd.append('file', file);

    try {
      showPopup('Sedang mengupload struktur organisasi...', 'info');

      const url = strukturFileId 
        ? `${API_BASE}/struktur/${strukturFileId}` 
        : `${API_BASE}/upload-struktur`;
      
      const method = strukturFileId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: fd, credentials: 'include' });

      const contentType = res.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error("Response bukan JSON:", text);
        showPopup("Server tidak mengembalikan JSON. Cek console untuk detail.", "error");
        return;
      }

      const json = await res.json();

      if (res.ok && json.success) {
        setStrukturFileName(json.fileName || file.name);
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
        setStrukturFileUrl(`${baseUrl}${json.fileUrl}`);
        setStrukturFileId(json.fileId);
        showPopup(strukturFileId ? 'Struktur organisasi berhasil diupdate!' : 'Upload struktur organisasi berhasil!', 'success');
      } else {
        showPopup(json.message || 'Upload gagal', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      showPopup(`Terjadi kesalahan: ${err.message}`, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteStruktur = async () => {
    if (!strukturFileId) {
      showPopup("ID file tidak ditemukan", "error");
      return;
    }

    showModal(
      "Konfirmasi Hapus",
      "Apakah Anda yakin ingin menghapus file struktur organisasi ini?",
      async () => {
        try {
          const res = await fetch(`${API_BASE}/struktur/${strukturFileId}`, {
            method: "DELETE",
          });
          const json = await res.json();

          if (res.ok && json.success) {
            setStrukturFileUrl("");
            setStrukturFileName("");
            setStrukturFileId(null);
            showPopup("File berhasil dihapus", "success");
          } else {
            showPopup(json.message || "Gagal menghapus file", "error");
          }
        } catch (err) {
          console.error(err);
          showPopup("Terjadi kesalahan saat menghapus", "error");
        }
      }
    );
  };

  const openAdd = () => {
    setFormData(getEmptyFormData(activeSubTab));
    setEditIndex(null);
    setFormErrors({});
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditIndex(null);
    setFormData({});
    setFormErrors({});
  };

  const handleSave = async () => {
    // Validasi form sebelum menyimpan
    if (!validateForm()) {
      showModal(
        'Data Tidak Lengkap',
        'Mohon lengkapi semua field yang wajib diisi sebelum menyimpan data.',
        () => {}
      );
      return;
    }

    try {
      const { id: itemId, ...dataToSave } = formData;
      
      const method = editIndex !== null && itemId ? 'PUT' : 'POST';
      const url = editIndex !== null && itemId ? `${API_BASE}/${itemId}` : API_BASE;

      // ✅ PERBAIKAN: Kirim data sebagai array agar konsisten dengan struktur database
      // Backend akan menerima data dalam format yang sama dengan import Excel
      const body = JSON.stringify({ 
        type: activeSubTab, 
        data: [dataToSave]  // Wrap dalam array
      });
      
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body, credentials: 'include' });
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await res.text();
        showPopup('Server error - response bukan JSON', 'error');
        console.error('Response:', responseText);
        return;
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        showPopup(json.message || 'Gagal menyimpan data', 'error');
        return;
      }

      setTabData(prev => {
        const prevData = prev[activeSubTab] || [];
        let newData;
        
        if (editIndex !== null) {
          newData = prevData.map((d, i) => 
            i === editIndex ? { ...d, id: itemId, data: dataToSave } : d
          );
        } else {
          newData = [...prevData, { id: json.data.id, data: dataToSave }];
        }
        
        return { ...prev, [activeSubTab]: newData };
      });

      showPopup('Data berhasil disimpan', 'success');
      setShowForm(false);
      setEditIndex(null);
      setFormData({});
      setFormErrors({});
    } catch (err) {
      console.error('Save error:', err);
      showPopup('Gagal menyimpan data', 'error');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({ ...item.data, id: item.id });
    const idx = tabData[activeSubTab].findIndex(d => d.id === item.id);
    setEditIndex(idx !== -1 ? idx : null);
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    showModal(
      'Konfirmasi Hapus',
      'Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.',
      async () => {
        try {
          const res = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            showPopup('Server error - response bukan JSON', 'error');
            console.error('Response:', await res.text());
            return;
          }

          const json = await res.json();

          if (res.ok) {
            setTabData(prev => {
              const prevData = prev[activeSubTab] || [];
              return { ...prev, [activeSubTab]: prevData.filter(d => d.id !== id) };
            });
            showPopup('Data berhasil dihapus', 'success');
          } else {
            showPopup(json.message || 'Gagal menghapus', 'error');
          }
        } catch (err) {
          console.error('Delete error:', err);
          showPopup('Gagal menghapus data', 'error');
        }
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error untuk field yang sedang diisi
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const getEmptyFormData = (subTab: SubTab) => {
    switch (subTab) {
      case 'tupoksi':
        return { unitKerja: '', namaKetua: '', periode: '', pendidikanTerakhir: '', jabatanFungsional: '', tugasPokokDanFungsi: '' };
      case 'pendanaan':
        return { sumberPendanaan: '', ts2: '', ts1: '', ts: '', linkBukti: '' };
      case 'penggunaan-dana':
        return { penggunaanDana: '', ts2: '', ts1: '', ts: '', linkBukti: '' };
      case 'ewmp':
        return { namaDTPR: '', psSendiri: '', psLainPTSendiri: '', ptLain: '', sksPenelitian: '', sksPengabdian: '', manajemenPTSendiri: '', manajemenPTLain: '', totalSKS: '' };
      case 'ktk':
        return { jenisTenagaKependidikan: '', s3: '', s2: '', s1: '', d4: '', d3: '', d2: '', d1: '', sma: '', unitKerja: '' };
      case 'spmi':
        return { unitSPMI: '', namaUnitSPMI: '', dokumenSPMI: '', jumlahAuditorMutuInternal: '', certified: '', nonCertified: '', frekuensiAudit: '', buktiCertifiedAuditor: '', laporanAudit: '' };
    }
  };

  const subTabFields: Record<SubTab, { label: string; key: string }[]> = {
    tupoksi: [
      { key: 'unitKerja', label: 'Unit Kerja' },
      { key: 'namaKetua', label: 'Nama Ketua' },
      { key: 'periode', label: 'Periode' },
      { key: 'pendidikanTerakhir', label: 'Pendidikan' },
      { key: 'jabatanFungsional', label: 'Jabatan' },
      { key: 'tugasPokokDanFungsi', label: 'Tupoksi' },
    ],
    pendanaan: [
      { key: 'sumberPendanaan', label: 'Sumber Pendanaan' },
      { key: 'ts2', label: 'TS-2' },
      { key: 'ts1', label: 'TS-1' },
      { key: 'ts', label: 'TS' },
      { key: 'linkBukti', label: 'Link Bukti' },
    ],
    'penggunaan-dana': [
      { key: 'penggunaanDana', label: 'Penggunaan Dana' },
      { key: 'ts2', label: 'TS-2' },
      { key: 'ts1', label: 'TS-1' },
      { key: 'ts', label: 'TS' },
      { key: 'linkBukti', label: 'Link Bukti' },
    ],
    ewmp: [
      { key: 'no', label: 'No' },
      { key: 'namaDTPR', label: 'Nama DTPR' },
      { key: 'psSendiri', label: 'PS Sendiri' },
      { key: 'psLainPTSendiri', label: 'PS Lain PT Sendiri' },
      { key: 'ptLain', label: 'PT Lain' },
      { key: 'sksPenelitian', label: 'SKS Penelitian' },
      { key: 'sksPengabdian', label: 'SKS Pengabdian' },
      { key: 'manajemenPTSendiri', label: 'Manajemen PT Sendiri' },
      { key: 'manajemenPTLain', label: 'Manajemen PT Lain' },
      { key: 'totalSKS', label: 'Total SKS' },
    ],
    ktk: [
      { key: 'no', label: 'No' },
      { key: 'jenisTenagaKependidikan', label: 'Jenis Tenaga' },
      { key: 's3', label: 'S3' },
      { key: 's2', label: 'S2' },
      { key: 's1', label: 'S1' },
      { key: 'd4', label: 'D4' },
      { key: 'd3', label: 'D3' },
      { key: 'd2', label: 'D2' },
      { key: 'd1', label: 'D1' },
      { key: 'sma', label: 'SMA' },
      { key: 'unitKerja', label: 'Unit Kerja' },
    ],
    spmi: [
      { key: 'unitSPMI', label: 'Unit SPMI' },
      { key: 'namaUnitSPMI', label: 'Nama Unit' },
      { key: 'dokumenSPMI', label: 'Dokumen' },
      { key: 'jumlahAuditorMutuInternal', label: 'Jumlah Auditor' },
      { key: 'certified', label: 'Certified' },
      { key: 'nonCertified', label: 'Non Certified' },
      { key: 'frekuensiAudit', label: 'Frekuensi Audit' },
      { key: 'buktiCertifiedAuditor', label: 'Bukti Certified' },
      { key: 'laporanAudit', label: 'Laporan Audit' },
    ],
  };

  const getFormFields = (subTab: SubTab) => {
    return subTabFields[subTab].filter(field => field.key !== 'no');
  };

  // Fungsi untuk melihat catatan P4M
  const handleViewP4mNotes = async (item: any) => {
    setSelectedItemForNotes(item);
    setShowP4MNotes(true);
    setLoadingP4mNotes(true);
    
    try {
      const notes = await fetchReviews('budaya-mutu', item.id);
      setP4mNotes(notes || []);
    } catch (err) {
      console.error('Error fetching P4M notes:', err);
      setP4mNotes([]);
      showPopup('Gagal memuat catatan P4M', 'error');
    } finally {
      setLoadingP4mNotes(false);
    }
  };

  const data = tabData[activeSubTab];

  const renderColumns = () => (
    <tr>
      {subTabFields[activeSubTab].map(col => (
        <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          {col.label}
        </th>
      ))}
      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
    </tr>
  );

  const renderRows = () => {
    if (!data.length)
      return (
        <tr>
          <td colSpan={subTabFields[activeSubTab].length + 1} className="text-center py-6 text-gray-500">
            Belum ada data
          </td>
        </tr>
      );

    return data.map((item, index) => (
      <tr key={item.id} className="bg-white rounded-lg shadow-sm hover:bg-gray-50 border-b">
        {subTabFields[activeSubTab].map(col => (
          <td key={col.key} className="px-6 py-4 text-gray-800">
            {col.key === 'no' ? (
              index + 1
            ) : col.key === 'linkBukti' || col.key === 'dokumenSPMI' || col.key === 'buktiCertifiedAuditor' || col.key === 'laporanAudit' ? (
              item.data?.[col.key] ? (
                <a href={item.data[col.key]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Lihat
                </a>
              ) : (
                '-'
              )
            ) : (
              item.data?.[col.key] ?? '-'
            )}
          </td>
        ))}
        <td className="px-6 py-4 text-center">
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => handleViewP4mNotes(item)}
              className="text-purple-600 hover:text-purple-800 transition"
              title="Lihat Catatan P4M"
            >
              <MessageSquare size={16} />
            </button>
            <button 
              onClick={() => handleEdit(item)} 
              className="text-blue-600 hover:text-blue-800 transition"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={() => handleDelete(item.id)} 
              className="text-red-600 hover:text-red-800 transition"
              title="Hapus"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="flex w-full bg-gray-100">
      <PopupNotification />
      <ConfirmModal />

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scaleIn {
          animation: scaleIn 0.25s ease-out;
        }
      `}</style>

      <div className="flex-1 w-full">
        <main className="w-full p-4 md:p-6 max-w-full overflow-x-hidden">

          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-900" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Laporan Kinerja Program Studi (LKPS)</h1>
                <p className="text-sm text-gray-600">Kelola data kuantitatif berdasarkan kriteria akreditasi</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBell />
              <button onClick={handleSaveDraft} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Save size={16} /> Save Draft
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800">
                <FileText size={16} /> Submit
              </button>
            </div>
          </div>

          {/* Tabs utama */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((tab) => (
              <a
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                  ${window.location.pathname === tab.href 
                    ? 'bg-[#183A64] text-[#ADE7F7]' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </a>
            ))}
          </div>

          {/* Budaya Mutu Tab */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            
            {/* Struktur Organisasi */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Struktur Organisasi</h3>

                <label
                  htmlFor="strukturFile"
                  className="px-3 py-1 bg-blue-900 text-white text-sm rounded hover:bg-blue-800 cursor-pointer flex items-center gap-2"
                >
                  <Upload size={16} />
                  {strukturFileUrl ? "Ganti File" : "Upload Struktur Organisasi"}
                </label>
                <input
                  id="strukturFile"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={handleUploadStruktur}
                />
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center relative">
                {strukturFileUrl ? (
                  <>
                    <div className="absolute top-3 right-3 flex gap-2">
                      <label
                        htmlFor="strukturFile"
                        className="p-2 bg-blue-100 rounded-full hover:bg-blue-200 cursor-pointer"
                        title="Ganti File"
                      >
                        <Edit size={16} className="text-blue-700" />
                      </label>

                      <button
                        onClick={handleDeleteStruktur}
                        className="p-2 bg-red-100 rounded-full hover:bg-red-200"
                        title="Hapus File"
                      >
                        <Trash2 size={16} className="text-red-700" />
                      </button>
                    </div>

                    <div className="mt-4">
                      {strukturFileUrl.endsWith('.pdf') ? (
                        <iframe
                          src={strukturFileUrl}
                          className="w-full h-96 border rounded-lg"
                          title="Struktur Organisasi PDF"
                        />
                      ) : (
                        <img
                          src={strukturFileUrl}
                          alt="Struktur Organisasi"
                          className="mx-auto max-h-96 object-contain rounded-lg shadow"
                        />
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-600 italic">
                      {strukturFileName}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500">Belum ada file struktur organisasi yang diupload.</p>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b pb-2 mb-4 overflow-x-auto">
              {['tupoksi','pendanaan','penggunaan-dana','ewmp','ktk','spmi'].map(sub => (
                <button
                  key={sub}
                  onClick={() => setActiveSubTab(sub as SubTab)}
                  className={`px-4 py-2 text-sm rounded-t-lg whitespace-nowrap font-medium transition ${
                    activeSubTab === sub
                      ? 'bg-[#183A64] text-[#ADE7F7]'
                      : 'bg-[#ADE7F7] text-[#183A64] hover:bg-[#90d8ee]'
                  }`}
                >
                  {sub.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-4 border-b bg-gray-50 gap-2 md:gap-0">
                <h3 className="text-lg font-semibold text-gray-900 capitalize">Data {activeSubTab}</h3>
                <h2 className="text-sm text-gray-600">{tableTitles[activeSubTab]}</h2>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-700 rounded-lg hover:bg-blue-800"><Plus size={16} /> Tambah Data</button>
                  <div className="relative">
                    <input type="file" accept=".xlsx, .xls" id="importExcel" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                    <label htmlFor="importExcel" className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <Upload size={16} /> Import Excel
                    </label>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto px-4 py-2">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    {renderColumns()}
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {renderRows()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Input dengan Validasi */}
            {showForm && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-start md:items-center overflow-auto z-50 p-4">
                <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg w-full max-w-xl md:max-w-lg max-h-[85vh] overflow-y-auto transition-transform">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-semibold text-gray-800">
                      {editIndex !== null ? 'Edit Data' : 'Tambah Data Baru'}
                    </h2>
                    <button onClick={handleCloseForm} className="text-gray-500 hover:text-gray-700">
                      <X size={24} />
                    </button>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getFormFields(activeSubTab).map(field => (
                      <div
                        key={field.key}
                        className={field.key === 'tugasPokokDanFungsi' || field.key === 'dokumenSPMI' ? 'md:col-span-2' : ''}
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name={field.key}
                          value={formData[field.key] || ''}
                          onChange={handleChange}
                          placeholder={`Masukkan ${field.label}`}
                          className="border border-gray-300 p-2.5 rounded-lg w-full text-gray-800 focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end mt-6 gap-2">
                    <button
                    onClick={handleCloseForm}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg shadow-md transition-all duration-200 hover:bg-red-600 hover:shadow-lg hover:scale-105 focus:ring-2 focus:ring-red-300"
                  >
                    Batal
                  </button>

                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-900 text-white rounded-lg shadow-md transition-all duration-200 hover:bg-blue-800 hover:shadow-lg hover:scale-105 focus:ring-2 focus:ring-blue-300"
                  >
                    Simpan
                  </button>

                  </div>
                </div>
              </div>
            )}

            {/* Modal Catatan P4M */}
            {showP4MNotes && selectedItemForNotes && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-start md:items-center overflow-auto z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Catatan dari P4M Reviewer
                    </h2>
                    <button 
                      onClick={() => setShowP4MNotes(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {loadingP4mNotes ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : p4mNotes.length === 0 ? (
                    <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                      Belum ada catatan dari P4M reviewer untuk item ini.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {p4mNotes.map((note, index) => (
                        <div key={index} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-blue-900">Catatan #{index + 1}</h4>
                            <span className="text-xs text-gray-600">
                              {note.created_at ? new Date(note.created_at).toLocaleDateString('id-ID', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : '-'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{note.note}</p>
                          {note.reviewer_id && (
                            <p className="text-xs text-gray-600">
                              Oleh: Reviewer #{note.reviewer_id}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button
                      onClick={() => setShowP4MNotes(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
