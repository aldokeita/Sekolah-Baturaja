import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { fetchWebsiteContentMap, saveWebsiteContentItem, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { Tv, Save, Clock, Timer, Megaphone, CalendarDays, Image as GalleryIcon } from 'lucide-react';

// Panel yang tampil bergilir di layar lobi (mode TV). Absensi RFID berjalan di
// latar apa pun panelnya, jadi tidak ada pengaturan absensi di sini.
const PANELS = [
    { key: 'pengumuman', label: 'Pengumuman', icon: Megaphone, hint: 'Pengumuman terbit dari menu Konten.' },
    { key: 'jadwal', label: 'Jadwal Hari Ini', icon: CalendarDays, hint: 'Jadwal pelajaran periode aktif untuk hari berjalan.' },
    { key: 'galeri', label: 'Galeri Foto', icon: GalleryIcon, hint: 'Foto dari Media & Galeri di menu Konten.' },
];

const DEFAULT_CONFIG = {
    showSeconds: true,
    transitionTime: 18,
    enabledPanels: { pengumuman: true, jadwal: true, galeri: true },
    durations: { pengumuman: 20, jadwal: 20, galeri: 18 },
};

const TvDisplaySettings = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    useEffect(() => {
        let active = true;
        (async () => {
            setIsLoading(true);
            try {
                const map = await fetchWebsiteContentMap({ keys: ['tv_config'], publicOnly: false });
                const tv = map?.tv_config;
                if (tv && active) {
                    setConfig((prev) => ({
                        ...prev,
                        showSeconds: tv.showSeconds !== undefined ? tv.showSeconds : prev.showSeconds,
                        transitionTime: tv.transitionTime || prev.transitionTime,
                        enabledPanels: { ...prev.enabledPanels, ...(tv.enabledPanels || {}) },
                        durations: { ...prev.durations, ...(tv.durations || {}) },
                    }));
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (active) setIsLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const saveConfig = async () => {
        setIsLoading(true);
        try {
            await saveWebsiteContentItem({ key: 'tv_config', content: config, isPublic: true });
            toast({ title: 'Berhasil', description: 'Konfigurasi TV disimpan dan segera aktif di layar.' });
        } catch (error) {
            toast({ title: 'Gagal menyimpan', description: getPublicContentErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const setDuration = (key, value) => setConfig((prev) => ({ ...prev, durations: { ...prev.durations, [key]: Math.max(5, parseInt(value, 10) || 5) } }));
    const togglePanel = (key, checked) => setConfig((prev) => ({ ...prev, enabledPanels: { ...prev.enabledPanels, [key]: checked } }));

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Tv className="w-5 h-5" /> Konfigurasi Tampilan TV</CardTitle>
                    <CardDescription>Atur panel informasi yang bergilir di layar lobi. Absensi kartu (RFID) tetap berjalan otomatis di semua panel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
                        <div className="space-y-3">
                            {/* `text-primary` tidak dipakai: di mode gelap nilainya hanya
                                mencapai rasio 4.34 di atas kartu. Lihat --admin-aksen-teks. */}
                            <Label className="flex items-center gap-2 font-bold" style={{ color: 'var(--admin-aksen-teks)' }}><Clock className="w-4 h-4" /> Format Jam</Label>
                            <Select value={config.showSeconds ? 'yes' : 'no'} onValueChange={(val) => setConfig((prev) => ({ ...prev, showSeconds: val === 'yes' }))}>
                                <SelectTrigger className="bg-white dark:bg-black"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="yes">Tampilkan Detik (HH:MM:SS)</SelectItem>
                                    <SelectItem value="no">Jam &amp; Menit Saja (HH:MM)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2 font-bold" style={{ color: 'var(--admin-aksen-teks)' }}><Timer className="w-4 h-4" /> Durasi Default (Detik)</Label>
                            <Input type="number" min="5" className="text-lg font-mono font-bold bg-white dark:bg-black" value={config.transitionTime} onChange={(e) => setConfig((prev) => ({ ...prev, transitionTime: Math.max(5, parseInt(e.target.value, 10) || 18) }))} />
                            <p className="text-[10px] text-muted-foreground">Dipakai bila durasi panel tidak diatur.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="border-b pb-2"><Label className="text-lg font-black">Panel Informasi</Label></div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {PANELS.map((panel) => {
                                const on = config.enabledPanels?.[panel.key] !== false;
                                return (
                                    <div key={panel.key} className={`p-4 rounded-xl border-2 transition-all ${on ? 'border-primary/50 bg-primary/5' : 'border-dashed bg-slate-50 dark:bg-slate-900/40 opacity-70'}`}>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${on ? 'bg-white text-primary shadow-sm dark:bg-slate-800' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}><panel.icon className="w-5 h-5" /></div>
                                                <h4 className="font-bold text-sm">{panel.label}</h4>
                                            </div>
                                            <Switch checked={on} onCheckedChange={(checked) => togglePanel(panel.key, checked)} />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">{panel.hint}</p>
                                        {on && (
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-muted-foreground">Durasi Tampil (Detik)</Label>
                                                <Input type="number" min="5" className="h-8 text-xs font-mono text-right bg-white dark:bg-slate-900" value={config.durations?.[panel.key] ?? ''} onChange={(e) => setDuration(panel.key, e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={saveConfig} disabled={isLoading} className="w-full md:w-auto"><Save className="w-4 h-4 mr-2" /> Simpan Pengaturan</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TvDisplaySettings;
