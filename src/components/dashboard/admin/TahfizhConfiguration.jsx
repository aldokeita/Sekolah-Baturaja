import React, { useEffect, useState } from 'react';
import { BookOpen, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { fetchAppConfig, upsertAppConfig, APP_CONFIG_KEYS, getAppConfigErrorMessage } from '@/lib/appConfigAdapters';
import {
  METHOD_OPTIONS,
  TAHFIZH_METHODS,
  DEFAULT_TAHFIZH_CONFIG,
  getTahfizhConfig,
  applyTahfizhConfig,
} from '@/lib/tahfizhLevels';

const TahfizhConfiguration = () => {
  const [method, setMethod] = useState(getTahfizhConfig().method);
  const [customText, setCustomText] = useState(getTahfizhConfig().customLevels.join('\n'));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchAppConfig(APP_CONFIG_KEYS.TAHFIZH);
        if (!active) return;
        const applied = applyTahfizhConfig(stored || DEFAULT_TAHFIZH_CONFIG);
        setMethod(applied.method);
        setCustomText(applied.customLevels.join('\n'));
      } catch (error) {
        if (active) {
          toast({
            title: 'Gagal memuat konfigurasi',
            description: getAppConfigErrorMessage(error),
            variant: 'destructive',
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const presetLevels = TAHFIZH_METHODS[method]?.levels || [];
  const customLevels = customText.split('\n').map((line) => line.trim()).filter(Boolean);
  const effectiveLevels = method === 'kustom' || customLevels.length > 0 ? customLevels : presetLevels;

  const handleSave = async () => {
    if (method === 'kustom' && customLevels.length === 0) {
      toast({
        title: 'Daftar tingkat kosong',
        description: 'Isi minimal satu tingkat, satu baris satu tingkat.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const payload = { method, customLevels };
      await upsertAppConfig(APP_CONFIG_KEYS.TAHFIZH, payload);
      applyTahfizhConfig(payload);
      toast({ title: 'Tersimpan', description: 'Metode mengaji sekolah diperbarui.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getAppConfigErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsePreset = () => {
    setCustomText(presetLevels.join('\n'));
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon"><BookOpen /></div>
          <div className="admin-panel-header-text">
            <h2>Metode Mengaji</h2>
            <p>Pilih metode yang dipakai sekolah. Tingkat murid mengikuti pilihan ini.</p>
          </div>
        </div>
      </div>

      <div className="admin-edit-section">
        <div className="admin-edit-field-grid">
          <div className="admin-edit-field">
            <label>Metode</label>
            <Select value={method} onValueChange={setMethod} disabled={isLoading}>
              <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="admin-edit-field mt-4">
          <div className="flex items-center justify-between gap-2">
            <label>
              Daftar Tingkat
              <span className="normal-case text-[10px] ml-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                (satu baris satu tingkat, urut dari terendah)
              </span>
            </label>
            {method !== 'kustom' && (
              <Button type="button" variant="outline" size="sm" onClick={handleUsePreset}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Pakai bawaan {TAHFIZH_METHODS[method]?.label}
              </Button>
            )}
          </div>
          <Textarea
            rows={10}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={presetLevels.slice(0, 4).join('\n') || 'Iqro 1\nIqro 2\nIqro 3'}
            disabled={isLoading}
          />
          <span className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Kosongkan untuk memakai daftar bawaan metode. Saat ini berlaku {effectiveLevels.length} tingkat.
          </span>
        </div>

        <div className="admin-edit-footer-actions mt-4">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TahfizhConfiguration;
