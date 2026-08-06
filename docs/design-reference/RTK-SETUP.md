# RTK (rtk-lite-cc) — Setup untuk Claude Code

`rtk-lite-cc` = CLI proxy ringan untuk Claude Code yang memangkas output command
sebelum sampai ke LLM (hemat token 60-90% pada command bising seperti git/npm/ls).

> Jalankan langkah ini DI TERMINAL / Claude Code pada mesin tempat Claude Code
> berjalan. Tidak bisa dari sesi Cowork cloud.

## 1. Install (pilih salah satu)

```bash
# a) binary pre-built (paling cepat)
curl -fsSL https://raw.githubusercontent.com/sderosiaux/rtk-lite-cc/master/install.sh | sh

# b) via cargo (butuh Rust toolchain)
cargo install rtk-lite-cc

# c) dari source
cargo install --git https://github.com/sderosiaux/rtk-lite-cc
```

Versi saat dicek: 0.2.2 · Lisensi MIT · repo: https://github.com/sderosiaux/rtk-lite-cc

## 2. Integrasikan ke Claude Code

```bash
rtk init -g               # pasang hook + patch settings.json (dengan prompt)
rtk init -g --auto-patch  # sama, tanpa prompt
```

Ini akan:
- membuat hook `~/.claude/hooks/rtk-rewrite.sh`
- menambah entri `PreToolUse` ke `~/.claude/settings.json`

Cara kerja: saat Claude Code menjalankan command, hook mencegatnya, menambah
prefix `rtk`, lalu memfilter output sebelum dikembalikan ke model.

## 3. Verifikasi

```bash
rtk --version
# pastikan hook terdaftar:
cat ~/.claude/settings.json   # cek ada blok PreToolUse untuk rtk-rewrite.sh
```

## Uninstall (bila perlu)

```bash
rtk init -g --uninstall
```
