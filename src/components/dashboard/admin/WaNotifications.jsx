import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchWaOutbox, retryWaMessage, sendWaTest, sendWaBroadcast,
} from '@/lib/waNotifyAdapters';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Clock, RefreshCw, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PURPOSE_LABEL = {
  absensi: 'Absensi',
  pembayaran: 'Kwitansi',
  ppdb: 'PPDB',
  test: 'Uji Kirim',
  broadcast: 'Broadcast',
};

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'sent', label: 'Terkirim' },
  { value: 'failed', label: 'Gagal' },
];

const ITEMS_PER_PAGE = 15;

/**
 * Panel Notifikasi WA — log outbox + uji gateway + broadcast.
 * Pengiriman sesungguhnya dikerjakan pekerja backend; panel ini hanya
 * membaca hasil, mengulang yang gagal, dan membuat pesan baru.
 */
const WaNotifications = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [retryingId, setRetryingId] = useState(null);

  // Form uji kirim
  const [testTarget, setTestTarget] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testing, setTesting] = useState(false);

  // Form broadcast — nomor dipisah koma atau baris baru
  const [broadcastNumbers, setBroadcastNumbers] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchLogs = useCallback(async (reset = false, overridePage) => {
    setLoading(true);
    const targetPage = reset ? 0 : (overridePage ?? page);
    try {
      const data = await fetchWaOutbox({ page: targetPage, pageSize: ITEMS_PER_PAGE, status: statusFilter });
      setLogs(prev => {
        if (reset) return data;
        return [...prev, ...data.filter(d => !prev.some(p => p.id === d.id))];
      });
      if (data.length < ITEMS_PER_PAGE) setHasMore(false);
      else { setHasMore(true); if (!reset) setPage(targetPage + 1); }
    } catch (err) {
      toast({ title: 'Gagal memuat log notifikasi', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    setPage(0);
    fetchLogs(true, 0);
  }, [statusFilter]);

  const handleRetry = async (id) => {
    setRetryingId(id);
    try {
      await retryWaMessage(id);
      toast({ title: 'Berhasil', description: 'Pesan dijadwalkan ulang.' });
      setLogs(prev => prev.map(l => (l.id === id ? { ...l, status: 'pending', attempts: 0, last_error: null } : l)));
    } catch (err) {
      toast({ title: 'Gagal menjadwalkan ulang', description: err.message, variant: 'destructive' });
    }
    setRetryingId(null);
  };

  const handleTestSend = async () => {
    if (!testTarget.trim() || !testMessage.trim()) {
      toast({ title: 'Lengkapi dulu', description: 'Nomor dan isi pesan wajib diisi.', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      await sendWaTest(testTarget.trim(), testMessage.trim());
      toast({ title: 'Masuk antrean', description: 'Pesan uji akan dikirim beberapa detik lagi.' });
      setTestMessage('');
      fetchLogs(true, 0);
    } catch (err) {
      toast({ title: 'Gagal mengantre pesan uji', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  const parseNumbers = () =>
    broadcastNumbers
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(no => ({ nama: '', no_hp: no }));

  const handleBroadcast = async () => {
    const recipients = parseNumbers();
    if (recipients.length === 0 || !broadcastMessage.trim()) {
      toast({ title: 'Lengkapi dulu', description: 'Minimal satu nomor dan isi pesan wajib ada.', variant: 'destructive' });
      return;
    }
    setBroadcasting(true);
    try {
      const res = await sendWaBroadcast(recipients, broadcastMessage.trim());
      toast({ title: 'Broadcast masuk antrean', description: `${res?.queued ?? recipients.length} pesan dijadwalkan.` });
      setBroadcastNumbers('');
      setBroadcastMessage('');
      fetchLogs(true, 0);
    } catch (err) {
      toast({ title: 'Gagal mengantre broadcast', description: err.message, variant: 'destructive' });
    }
    setBroadcasting(false);
  };

  const statusBadge = (status) => {
    if (status === 'sent') {
      return <span className="admin-status-badge admin-status-badge--success"><CheckCircle className="w-3 h-3" /> Terkirim</span>;
    }
    if (status === 'failed') {
      return <span className="admin-status-badge admin-status-badge--danger"><XCircle className="w-3 h-3" /> Gagal</span>;
    }
    return (
      <span className="admin-status-badge" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
        <Clock className="w-3 h-3" /> Menunggu
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon"><MessageSquare /></div>
          <div className="admin-panel-header-text">
            <h2>Notifikasi WhatsApp</h2>
            <p>Kabar otomatis ke orang tua: absensi, kwitansi, dan hasil PPDB.</p>
          </div>
        </div>
      </div>

      {/* Uji kirim & broadcast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="admin-card p-4 space-y-3">
          <h3 className="font-bold">Uji Gateway</h3>
          <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Kirim pesan coba ke nomor sendiri sebelum fitur dipakai sungguhan.
          </p>
          <Input placeholder="Nomor tujuan, mis. 08123456789" value={testTarget} onChange={e => setTestTarget(e.target.value)} />
          <Textarea rows={3} placeholder="Isi pesan uji..." value={testMessage} onChange={e => setTestMessage(e.target.value)} />
          <Button onClick={handleTestSend} disabled={testing} className="w-full">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Kirim Pesan Uji
          </Button>
        </div>

        <div className="admin-card p-4 space-y-3">
          <h3 className="font-bold">Broadcast Pengumuman</h3>
          <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Nomor ditulis per baris atau dipisah koma. Maksimal 500 penerima.
          </p>
          <Textarea
            rows={3}
            placeholder={'08123456789\n08987654321'}
            value={broadcastNumbers}
            onChange={e => setBroadcastNumbers(e.target.value)}
          />
          <Textarea rows={3} placeholder="Isi pengumuman..." value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} />
          <Button onClick={handleBroadcast} disabled={broadcasting} className="w-full">
            {broadcasting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Antrekan Broadcast
          </Button>
        </div>
      </div>

      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => (
          <Button
            key={f.value || 'all'}
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => fetchLogs(true, 0)} className="ml-auto">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Muat Ulang
        </Button>
      </div>

      {/* Log outbox */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="admin-card p-4 group">
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div className="flex items-center gap-3">
                {statusBadge(log.status)}
                <span className="admin-status-badge">{PURPOSE_LABEL[log.purpose] || log.purpose}</span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                <Clock className="w-3.5 h-3.5" />
                {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                {log.status !== 'sent' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 ml-1"
                    disabled={retryingId === log.id}
                    onClick={() => handleRetry(log.id)}
                  >
                    {retryingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Kirim Ulang
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-2 text-sm" style={{ color: 'hsl(var(--admin-text-primary))' }}>
              Ke: <span className="font-medium">{log.target_phone}</span>
              <span className="ml-3 text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                percobaan ke-{log.attempts ?? 0}
              </span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap line-clamp-3" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
              {log.message}
            </p>
            {log.last_error && (
              <p className="mt-1 text-xs text-destructive">Error terakhir: {log.last_error}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="admin-table-loading-spinner" />
            <p className="text-sm ml-3" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Memuat...</p>
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="admin-table-empty">
            <MessageSquare />
            <p>Belum ada pesan pada filter ini.</p>
          </div>
        )}
      </div>
      {hasMore && !loading && (
        <div className="text-center mt-6">
          <Button onClick={() => fetchLogs()} variant="outline">Muat Lebih Banyak</Button>
        </div>
      )}
    </div>
  );
};

export default WaNotifications;
