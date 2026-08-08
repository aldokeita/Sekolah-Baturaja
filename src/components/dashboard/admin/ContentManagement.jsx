import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit, Video, Users, BookCopy, MessageSquare, FileText, Library, Building, Mail, Info, Image as ImageIcon, Home, Save } from 'lucide-react';
import { fetchSantriList, fetchGuruList } from '@/lib/dataMasterAdapters';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Building2, BookMarked, Award, Sparkles, GraduationCap } from 'lucide-react';
import SchoolIdentitySettings from '@/components/dashboard/admin/SchoolIdentitySettings';
import HomeContentSettings from '@/components/dashboard/admin/HomeContentSettings';
import ProfileContentSettings from '@/components/dashboard/admin/ProfileContentSettings';
import PpdbContentSettings from '@/components/dashboard/admin/PpdbContentSettings';
import PrestasiContentSettings from '@/components/dashboard/admin/PrestasiContentSettings';
import EkskulContentSettings from '@/components/dashboard/admin/EkskulContentSettings';
import ProgramContentSettings from '@/components/dashboard/admin/ProgramContentSettings';
import SchoolInfoSettings from '@/components/dashboard/admin/SchoolInfoSettings';
import { useAuth } from '@/contexts/AuthContext';
import { getSchoolIdentity } from '@/lib/schoolIdentity';
import { motion } from 'framer-motion';
import HafalanDisplay from '@/components/dashboard/shared/HafalanDisplay';
import { createHafalanItem, deactivateHafalanItem, fetchHafalanItems, getAcademicErrorMessage, updateHafalanItem, HAFALAN_SCOPE_PER_KELAS, HAFALAN_SCOPE_PER_JUZ } from '@/lib/academicAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';
import { defaultContent, mergeHomepageContent } from '@/components/public/home/homeUtils';
import {
  archiveAnnouncement,
  archiveNews,
  deleteFeedback,
  fetchAdminAnnouncements,
  fetchAdminFeedbacks,
  fetchAdminNews,
  fetchWebsiteContentMap,
  getPublicContentErrorMessage,
  assertNonEmptyWebsiteContentString,
  saveAnnouncement,
  saveNews,
  saveWebsiteContentItem,
  saveWebsiteContentItems,
  slugify
} from '@/lib/publicContentAdapters';

// Enam tahap, dipakai sebagai Kelas 1-6 untuk sekolah dasar.
const KELAS_LEVELS = [1, 2, 3, 4, 5, 6].map(String);
const JUZ_LEVELS = ['Juz 1', 'Juz 2', 'Juz 28', 'Juz 29', 'Juz 30'];

const HafalanItemManager = ({
  category,
  programScope = HAFALAN_SCOPE_PER_KELAS,
  title = category,
  levels = KELAS_LEVELS,
  levelPrefix = 'Kelas'
}) => {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [targetJilid, setTargetJilid] = useState(String(levels[0]));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [category, programScope]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHafalanItems(category, programScope);
      setItems(data || []);
    } catch (error) {
      toast({ title: "Gagal memuat item hafalan", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await createHafalanItem({
        category,
        programScope,
        itemName: newItemName,
        itemOrder: items.length + 1,
        jilid: targetJilid
      });
      setNewItemName('');
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan baru ditambahkan." });
    } catch (error) {
      toast({ title: "Gagal menambah item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    try {
      await deactivateHafalanItem(id);
      fetchItems();
      toast({ title: "Berhasil", description: "Item hafalan telah dinonaktifkan." });
    } catch (error) {
      toast({ title: "Gagal menghapus item", description: getAcademicErrorMessage(error), variant: "destructive" });
    }
  };

  const handleItemDrop = async (itemId, newJilid) => {
    // Optimistic update
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, jilid: newJilid } : item));

    try {
        await updateHafalanItem(itemId, { jilid: newJilid });
      toast({ title: "Berhasil", description: `Item dipindahkan ke ${[levelPrefix, newJilid].filter(Boolean).join(' ')}` });
    } catch (error) {
        toast({ title: "Gagal memindahkan item", description: getAcademicErrorMessage(error), variant: "destructive" });
        fetchItems(); // Revert on error
    }
  };

  // Group items by Jilid for display
  const itemsByJilid = Object.fromEntries(levels.map((level, index) => [
    String(level),
    items.filter((item) => {
      const itemLevel = String(item.jilid || '');
      return itemLevel === String(level) || (index === 0 && !itemLevel);
    })
  ]));

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby={`hafalan-${programScope}-${category}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
          <div>
            <h4 id={`hafalan-${programScope}-${category}`} className="text-xl font-black text-foreground sm:text-2xl">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {programScope === HAFALAN_SCOPE_PER_JUZ
                ? 'Hafalan Al-Qur’an per juz, dinilai dengan skala 1–4. Terbuka untuk semua murid.'
                : 'Atur urutan hafalan bertahap berdasarkan kelas 1–6. Terbuka untuk semua murid.'}
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={targetJilid} onValueChange={setTargetJilid}>
                <SelectTrigger className="w-[120px] bg-background"><SelectValue placeholder={levelPrefix || 'Target'} /></SelectTrigger>
                <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {[levelPrefix, level].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input placeholder="Nama hafalan baru..." value={newItemName} onChange={e => setNewItemName(e.target.value)} className="min-w-[200px] flex-1 bg-background" />
            <Button onClick={handleAddItem}><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {levels.map(jilid => (
              <HafalanDisplay
                  key={jilid}
                  jilid={jilid}
                  titlePrefix={levelPrefix}
                  items={itemsByJilid[jilid]}
                  isDraggable={true}
                  onItemDrop={handleItemDrop}
                  onDeleteItem={handleDeleteItem}
                  isLoading={isLoading}
              />
          ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
          Tarik dan lepas item hafalan untuk memindahkannya ke target lain.
      </p>
    </section>
  );
};

const ContentManagement = () => {
  const { role } = useAuth();
  /* Sebagian kunci di bawah TIDAK punya kendali di panel lagi: slideshow
   * (`heroSlides`), latar CTA, kuota, jadwal pembelajaran, keunggulan, FAQ lama,
   * video qiroati, artikel parenting, diskusi wali murid, dan pengaturan model 3D.
   * Semuanya peninggalan desain beranda sebelumnya dan tidak dirender halaman
   * publik mana pun, jadi kendalinya dicabut — pembeli tidak lagi menyimpan
   * sesuatu yang tak mengubah apa pun.
   *
   * Kuncinya sengaja DIBIARKAN di bentuk data ini. Kalau dihapus, "Simpan Semua
   * Perubahan" akan menimpa isi tersimpan pembeli dengan kekosongan; dibiarkan,
   * data lama tetap utuh sampai ada keputusan memakainya lagi. */
  const [content, setContent] = useState({
    ...defaultContent, brochures: [], pustaka: [], news: [], announcements: [], qiroatiVideos: [], hafalanVideos: [], waliDiscussions: [], santriOfTheMonth: [], guruOfTheMonth: null, leaderboard: [], parentingArticles: [], model3dSettings: { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 }
  });

  const [feedbacks, setFeedbacks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalType, setModalType] = useState('');
  const [formState, setFormState] = useState({});
  const [santriList, setSantriList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [activeTab, setActiveTab] = useState("homepage");

  useEffect(() => { fetchContent(); fetchSantriAndGuru(); fetchFeedbacks(); }, []);

  const fetchFeedbacks = async () => {
    try {
      setFeedbacks(await fetchAdminFeedbacks());
    } catch (error) {
      toast({ title: "Gagal Memuat Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pesan ini?')) return;
    try {
      await deleteFeedback(id);
      toast({ title: "Pesan dihapus!" });
      fetchFeedbacks();
    } catch (error) {
      toast({ title: "Gagal Menghapus Pesan", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  }

  const fetchSantriAndGuru = async () => {
    try {
      const [santriData, guruData] = await Promise.all([
        fetchSantriList({ status: 'Aktif' }),
        fetchGuruList(),
      ]);
      setSantriList(santriData || []);
      setGuruList(guruData || []);
    } catch (error) {
      toast({ title: "Gagal Memuat Data Murid/Guru", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const fetchContent = async () => {
    let newContent = {};
    try {
      newContent = { ...(await fetchWebsiteContentMap({ publicOnly: false })) };
    } catch (error) {
      toast({ title: "Gagal Memuat Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
      return;
    }
    const arrayKeys = ['heroSlides', 'brochures', 'pustaka', 'facilities', 'qiroatiVideos', 'hafalanVideos', 'waliDiscussions', 'santriOfTheMonth', 'leaderboard', 'parentingArticles', 'galleryPhotos', 'schedules', 'faqs'];
    arrayKeys.forEach(key => { if (!newContent[key] || !Array.isArray(newContent[key])) newContent[key] = []; });
    if(!newContent.quotas) newContent.quotas = { pagi: 0, siang: 0, sore: 0, dewasaPagi: 0, dewasaSiang: 0, dewasaMalam: 0 };
    Object.assign(newContent, mergeHomepageContent(newContent));
    if(!newContent.model3dSettings || typeof newContent.model3dSettings !== 'object' || Array.isArray(newContent.model3dSettings)) {
      newContent.model3dSettings = { autoRotate: false, autoRotateSpeed: 0.34, rotationX: 0, rotationY: 0, rotationZ: 0 };
    }
    try {
      const [news, announcements] = await Promise.all([fetchAdminNews(), fetchAdminAnnouncements()]);
      setContent(prev => ({ ...prev, ...newContent, news, announcements }));
    } catch (contentError) {
      toast({ title: "Gagal Memuat Berita/Pengumuman", description: getPublicContentErrorMessage(contentError), variant: "destructive" });
      setContent(prev => ({ ...prev, ...newContent, news: [], announcements: [] }));
    }
  };

  const handleSaveAll = async () => {
    const excludedKeys = new Set(['news', 'announcements']);
    const dataToUpsert = Object.keys(content)
      .filter(key => !excludedKeys.has(key))
      .map(key => ({ key, content: content[key], is_public: true }));
    try {
      await saveWebsiteContentItems(dataToUpsert);
      toast({ title: "Konten Disimpan!", description: `Semua perubahan telah berhasil disimpan.` });
    } catch (error) {
      toast({ title: "Gagal Menyimpan!", description: getPublicContentErrorMessage(error), variant: "destructive" });
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    let folder = 'general';
    if (['news', 'announcements', 'parentingArticles'].includes(type)) folder = 'article-images';
    else if (type === 'facilities') folder = 'facilities-images';
    else if (['brochures', 'pustaka'].includes(type)) folder = type;
    else if (type === 'logoUrl') folder = 'logos';
    else if (type === 'ctaBackgroundUrl') folder = 'backgrounds';
    else if (type === 'heroSlides') folder = 'hero-slides';
    else if (type === 'galleryPhotos') folder = 'gallery';

    const assetKey = type === 'logoUrl' ? 'logo' : (type === 'ctaBackgroundUrl' ? 'cta-background' : null);
    let publicUrl = '';
    try {
      const result = await uploadWebsiteAsset({ folder, key: assetKey, file });
      publicUrl = result.publicUrl;
      if (!publicUrl || !String(publicUrl).trim()) {
        throw new Error('Upload berhasil, tetapi URL aset tidak tersedia.');
      }
    } catch (error) {
      toast({ title: "Upload Gagal!", description: getStorageErrorMessage(error), variant: "destructive" });
      return;
    }

    if (type === 'logoUrl') {
      try {
        const logoUrl = assertNonEmptyWebsiteContentString('logoUrl', publicUrl);
        const saved = await saveWebsiteContentItem({ key: 'logoUrl', content: logoUrl, isPublic: true });
        setContent(prev => ({ ...prev, logoUrl: saved.content || logoUrl }));
        toast({ title: "Logo Disimpan!", description: "Logo berhasil diunggah dan disimpan ke database." });
      } catch (error) {
        toast({ title: "Logo Gagal Disimpan", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    if (type === 'ctaBackgroundUrl') { setContent(prev => ({ ...prev, [type]: publicUrl })); }
    else if (['brochures', 'pustaka'].includes(type)) { const newFile = { id: Date.now(), name: file.name, url: publicUrl }; setContent(prev => ({...prev, [type]: [...(prev[type] || []), newFile]})); }
    else if (type === 'galleryPhotos') { setFormState(prev => ({ ...prev, url: publicUrl })); }
    else { setFormState(prev => ({ ...prev, image_url: publicUrl })); }
    toast({ title: "Upload Berhasil!", description: `${file.name} berhasil diunggah.` });
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) { setEditingItem(item); setFormState(item); }
    else { setEditingItem(null); setFormState({}); }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (modalType === 'news' || modalType === 'announcements') {
      try {
        if (!formState.slug) setFormState(prev => ({ ...prev, slug: slugify(prev.title) }));
        if (modalType === 'news') await saveNews({ ...formState, slug: formState.slug || slugify(formState.title) });
        else await saveAnnouncement({ ...formState, slug: formState.slug || slugify(formState.title) });
        toast({ title: "Konten Disimpan", description: modalType === 'news' ? "Berita telah diperbarui." : "Pengumuman telah diperbarui." });
        setIsModalOpen(false);
        fetchContent();
      } catch (error) {
        toast({ title: "Gagal Menyimpan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
      }
      return;
    }
    let updatedList;
    if (editingItem) updatedList = content[modalType].map(item => item.id === editingItem.id ? formState : item);
    else updatedList = [...(content[modalType] || []), { ...formState, id: Date.now() }];
    setContent(prev => ({ ...prev, [modalType]: updatedList }));
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (type, id) => {
    if (window.confirm('Anda yakin ingin menghapus item ini?')) {
      if (type === 'news' || type === 'announcements') {
        try {
          if (type === 'news') await archiveNews(id);
          else await archiveAnnouncement(id);
          toast({ title: "Konten Dinonaktifkan", description: "Konten tidak lagi tampil di halaman publik." });
          fetchContent();
        } catch (error) {
          toast({ title: "Gagal Menonaktifkan Konten", description: getPublicContentErrorMessage(error), variant: "destructive" });
        }
        return;
      }
      const updatedList = content[type].filter(item => item.id !== id);
      setContent(prev => ({ ...prev, [type]: updatedList }));
    }
  };


  // Identitas website hanya untuk superadmin (pemilik template). Pembeli berperan
  // admin dan tetap bebas mengelola seluruh konten di tab lain. Backend juga
  // menolaknya di sisi server, jadi menyembunyikan tab bukan satu-satunya
  // penjagaan — lihat brandKeys di content.go.
  const isSuperadmin = role === 'superadmin';

  const tabs = [
      ...(isSuperadmin ? [{ id: 'identitas', label: 'Identitas Sekolah', icon: Building2 }] : []),
      { id: 'info', label: 'Info Sekolah', icon: Info },
      { id: 'homepage', label: 'Halaman Depan', icon: Home },
      { id: 'profil', label: 'Halaman Profil', icon: BookMarked },
      { id: 'prestasi', label: 'Prestasi', icon: Award },
      { id: 'ekskul', label: 'Ekstrakurikuler', icon: Sparkles },
      { id: 'program', label: 'Program', icon: GraduationCap },
      { id: 'media', label: 'Media & Galeri', icon: ImageIcon },
      { id: 'enrollment', label: 'Informasi Pendaftaran', icon: ClipboardList },
      { id: 'pesan', label: 'Pesan Masuk', icon: Mail },
      { id: 'hafalan', label: 'Hafalan', icon: BookCopy },
  ];

  const renderModalContent = () => {
    if (!modalType) return null;
    return (
      <>
        <div className="space-y-4">
          {modalType === 'news' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten Lengkap" rows={10} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'news')} /></>)}
          {modalType === 'announcements' && (<><Input placeholder="Judul" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value, slug: p.slug || slugify(e.target.value)}))} /><Input placeholder="Slug" value={formState.slug || ''} onChange={e => setFormState(p => ({...p, slug: slugify(e.target.value)}))} /><Select value={formState.status || 'draft'} onValueChange={val => setFormState(p => ({...p, status: val}))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Nonaktif</SelectItem></SelectContent></Select><Select value={formState.priority || 'normal'} onValueChange={val => setFormState(p => ({...p, priority: val}))}><SelectTrigger><SelectValue placeholder="Prioritas" /></SelectTrigger><SelectContent><SelectItem value="low">Rendah</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Tinggi</SelectItem></SelectContent></Select><Input type="date" value={formState.valid_until || ''} onChange={e => setFormState(p => ({...p, valid_until: e.target.value}))} /><Textarea placeholder="Ringkasan" value={formState.summary || ''} onChange={e => setFormState(p => ({...p, summary: e.target.value}))} /><Textarea placeholder="Konten" rows={8} value={formState.content || ''} onChange={e => setFormState(p => ({...p, content: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'announcements')} /></>)}
          {modalType === 'facilities' && (<><Input placeholder="Nama Fasilitas" value={formState.name || ''} onChange={e => setFormState(p => ({...p, name: e.target.value}))} /><div className="grid grid-cols-2 gap-2"><Input placeholder="Kategori, mis. Belajar" value={formState.kategori || ''} onChange={e => setFormState(p => ({...p, kategori: e.target.value}))} /><Input placeholder="Luas, mis. 96 m²" value={formState.luas || ''} onChange={e => setFormState(p => ({...p, luas: e.target.value}))} /></div><Input placeholder="Ringkasan singkat (tampil di kartu)" value={formState.ringkas || ''} onChange={e => setFormState(p => ({...p, ringkas: e.target.value}))} /><Textarea placeholder="Deskripsi lengkap" value={formState.description || ''} onChange={e => setFormState(p => ({...p, description: e.target.value}))} /><Input placeholder="URL Gambar" value={formState.image_url || ''} onChange={e => setFormState(p => ({...p, image_url: e.target.value}))} /></>)}
          {modalType === 'hafalanVideos' && (<><Input placeholder="Judul Video" value={formState.title || ''} onChange={e => setFormState(p => ({...p, title: e.target.value}))} /><Input placeholder="URL Embed Video Youtube" value={formState.url || ''} onChange={e => setFormState(p => ({...p, url: e.target.value}))} />{modalType === 'hafalanVideos' && (<div className="space-y-2"><Textarea placeholder='Google Drive Embed Code' value={formState.google_drive_embed || ''} onChange={e => setFormState(p => ({...p, google_drive_embed: e.target.value}))} className="font-mono text-xs" rows={3}/><p className="text-[10px] text-muted-foreground">Isi salah satu: YouTube URL atau Google Drive Embed.</p></div>)}{modalType === 'hafalanVideos' && (<Select value={formState.jilid} onValueChange={val => setFormState(p => ({...p, jilid: val}))}><SelectTrigger><SelectValue placeholder="Pilih Jilid" /></SelectTrigger><SelectContent>{['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', 'Lainnya'].map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select>)}</>)}
          {modalType === 'galleryPhotos' && (<><Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'galleryPhotos')} /><Input placeholder="Judul Foto" value={formState.caption || ''} onChange={e => setFormState(p => ({...p, caption: e.target.value}))} /><Select value={formState.kategori || 'Belajar'} onValueChange={val => setFormState(p => ({...p, kategori: val}))}><SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger><SelectContent>{['Belajar', 'Ekstrakurikuler', 'Acara', 'Fasilitas', 'Prestasi'].map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select><Textarea placeholder="Keterangan singkat (opsional)" value={formState.keterangan || ''} onChange={e => setFormState(p => ({...p, keterangan: e.target.value}))} /><Input placeholder="Tanggal, mis. Agustus 2025 (opsional)" value={formState.tanggal || ''} onChange={e => setFormState(p => ({...p, tanggal: e.target.value}))} />{formState.url && <img src={formState.url} alt="Preview" className="w-full h-40 object-cover rounded-md mt-2" />}</>)}
        </div>
        <div className="flex justify-end mt-4"><Button onClick={handleModalSubmit}>Simpan</Button></div>
      </>
    );
  };

  const ContentSection = ({ title, modalType, data, icon, renderItem }) => (
    <div className="admin-card p-4">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl flex items-center gap-2">{icon} {title}</h3><Button onClick={() => openModal(modalType)}><Plus className="w-4 h-4 mr-2" />Tambah</Button></div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {data.map(item => (<div key={item.id} className="flex justify-between items-center p-2 border rounded-lg bg-background">{renderItem(item)}<div className="flex-shrink-0"><Button variant="ghost" size="icon" onClick={() => openModal(modalType, item)}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(modalType, item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></div>))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon">
            <FileText />
          </div>
          <div className="admin-panel-header-text">
            <h2>Manajemen Konten Website</h2>
            <p>Kelola konten yang tampil di halaman publik {getSchoolIdentity().shortName}.</p>
          </div>
        </div>
        <div className="admin-panel-header-actions">
          <button onClick={handleSaveAll} className="admin-panel-primary-btn">
            <Save className="w-4 h-4" /> Simpan Semua Perubahan
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-6">
            <div className="admin-segmented-control">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-out flex items-center gap-2 ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
                        {activeTab === tab.id && (<motion.div layoutId="content-pill" className="absolute inset-0 bg-blue-600 dark:bg-blue-500 shadow-sm rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />)}
                        <span className="relative z-10 flex items-center gap-2"><tab.icon className="w-4 h-4" />{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>

        <TabsContent value="identitas" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <SchoolIdentitySettings />

            {/* Logo ada di sini, bukan di tab Halaman Depan. `logoUrl` termasuk
                brandKeys di content.go, jadi hanya superadmin yang boleh
                menyimpannya — kalau kendalinya tampil untuk pembeli, ia akan
                mengunggah logo lalu ditolak server tanpa tahu sebabnya. */}
            <div className="admin-card p-4">
                <h3 className="font-bold text-xl mb-1">Logo Website</h3>
                <p className="text-xs text-muted-foreground mb-4">Dipakai di navigasi situs dan kuitansi pembayaran.</p>
                <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logoUrl')} />
                {content.logoUrl && <img src={content.logoUrl} alt="Pratinjau logo" className="w-24 h-24 mt-2 bg-gray-200 p-2 rounded-md" />}
            </div>
        </TabsContent>

<TabsContent value="info" className="animate-in fade-in slide-in-from-bottom-2">
            <SchoolInfoSettings />
        </TabsContent>

        <TabsContent value="homepage" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <HomeContentSettings />

        </TabsContent>

        <TabsContent value="profil" className="animate-in fade-in slide-in-from-bottom-2">
            <ProfileContentSettings />
        </TabsContent>

        <TabsContent value="prestasi" className="animate-in fade-in slide-in-from-bottom-2">
            <PrestasiContentSettings />
        </TabsContent>

        <TabsContent value="ekskul" className="animate-in fade-in slide-in-from-bottom-2">
            <EkskulContentSettings />
        </TabsContent>

        <TabsContent value="program" className="animate-in fade-in slide-in-from-bottom-2">
            <ProgramContentSettings />
        </TabsContent>

        <TabsContent value="media" className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="col-span-full"><ContentSection title="Galeri Kegiatan" modalType="galleryPhotos" data={content.galleryPhotos} icon={<ImageIcon/>} renderItem={item => <div className="flex items-center gap-2"><img src={item.url} className="w-12 h-12 object-cover rounded-md" /><p className="truncate">{item.caption}</p></div>} /></div>
            <div className="admin-card p-4 space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><FileText/> Brosur Pendaftaran</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'brochures')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.brochures.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('brochures', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <div className="admin-card p-4 space-y-4"><h3 className="font-bold text-xl flex items-center gap-2"><Library/> Pustaka Digital</h3><Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'pustaka')} /><div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{content.pustaka.map(file => (<div key={file.id} className="flex justify-between items-center p-2 border rounded-lg bg-background"><span>{file.name}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteItem('pustaka', file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>))}</div></div>
            <ContentSection title="Berita" modalType="news" data={content.news} icon={<BookCopy/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Pengumuman" modalType="announcements" data={content.announcements} icon={<MessageSquare/>} renderItem={item => <p className="truncate">{item.title}</p>} />
            <ContentSection title="Video Hafalan" modalType="hafalanVideos" data={content.hafalanVideos} icon={<Video/>} renderItem={item => <p className="truncate">{item.title}</p>} />
          <ContentSection title="Fasilitas" modalType="facilities" data={content.facilities} icon={<Building/>} renderItem={item => <p className="truncate">{item.name}</p>} />
        </TabsContent>
        <TabsContent value="enrollment" className="animate-in fade-in slide-in-from-bottom-2">
            <PpdbContentSettings />
        </TabsContent>

        <TabsContent value="pesan" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="font-bold text-xl flex items-center gap-2"><Mail />Pesan dari Pengunjung</h3>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {feedbacks.length > 0 ? feedbacks.map(fb => (<div key={fb.id} className="admin-card p-4 bg-background relative"><Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleDeleteFeedback(fb.id)}><Trash2 className="h-4 w-4" /></Button><p className="font-semibold text-lg">{fb.nama || 'Anonim'}</p><div className="text-sm text-muted-foreground mb-2"><span>{fb.email || '-'}</span> | <span>{fb.phone || '-'}</span> | <span>{new Date(fb.created_at).toLocaleString('id-ID')}</span></div><p className="whitespace-pre-wrap">{fb.message}</p></div>)) : (<p className="text-center text-muted-foreground py-4">Tidak ada pesan masuk.</p>)}
            </div>
        </TabsContent>
        <TabsContent value="hafalan" className="animate-in fade-in slide-in-from-bottom-2">
          <Tabs defaultValue="per-kelas" className="space-y-5">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg bg-muted p-1 sm:w-auto">
              <TabsTrigger value="per-kelas" className="min-w-[150px]">Hafalan per Kelas</TabsTrigger>
              <TabsTrigger value="per-juz" className="min-w-[150px]">Hafalan per Juz</TabsTrigger>
            </TabsList>
            <TabsContent value="per-kelas" className="space-y-6">
              <HafalanItemManager category="Doa" programScope={HAFALAN_SCOPE_PER_KELAS} />
              <HafalanItemManager category="Sholat" programScope={HAFALAN_SCOPE_PER_KELAS} />
              <HafalanItemManager category="Surat" programScope={HAFALAN_SCOPE_PER_KELAS} />
            </TabsContent>
            <TabsContent value="per-juz">
              <HafalanItemManager
                category="Tahfizh"
                programScope={HAFALAN_SCOPE_PER_JUZ}
                title="Hafalan Al-Qur'an per Juz"
                levels={JUZ_LEVELS}
                levelPrefix=""
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Tambah'} {modalType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</DialogTitle><DialogDescription>Pastikan untuk menyimpan semua perubahan setelah selesai mengedit.</DialogDescription></DialogHeader>{renderModalContent()}</DialogContent></Dialog>
    </div>
  );
};

export default ContentManagement;
