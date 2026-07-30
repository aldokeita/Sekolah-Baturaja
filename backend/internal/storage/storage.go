package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalidPath      = errors.New("path tidak valid")
	ErrInvalidMime      = errors.New("tipe file tidak diizinkan")
	ErrFileTooLarge     = errors.New("ukuran file melebihi batas")
	ErrSignatureExpired = errors.New("link sudah kedaluwarsa")
)

// Bucket adalah direktori root di dalam UploadDir.
const (
	BucketAvatars       = "avatars"
	BucketWebsiteAssets = "website-assets"
	BucketMusic         = "music-files"
)

var allowedMIME = map[string]map[string]bool{
	BucketAvatars:       {"image/jpeg": true, "image/png": true, "image/webp": true},
	BucketWebsiteAssets: {"image/jpeg": true, "image/png": true, "image/webp": true, "application/pdf": true},
	BucketMusic:         {"audio/mpeg": true, "audio/wav": true, "audio/ogg": true},
}

type Store struct {
	root     string // e.g. /app/uploads
	signKey  []byte
	maxBytes int64
}

func New(uploadDir, signSecret string, maxBytes int64) *Store {
	return &Store{root: uploadDir, signKey: []byte(signSecret), maxBytes: maxBytes}
}

// Save menyimpan file ke disk. Path harus relative dan aman.
func (s *Store) Save(bucket, path string, r io.Reader, mimeType string, size int64) error {
	if err := s.validatePath(path); err != nil {
		return err
	}
	if allowed := allowedMIME[bucket]; allowed != nil && !allowed[mimeType] {
		return ErrInvalidMime
	}
	if size > s.maxBytes {
		return ErrFileTooLarge
	}
	dest := filepath.Join(s.root, bucket, path)
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, io.LimitReader(r, s.maxBytes+1))
	return err
}

// Delete menghapus file dari disk.
func (s *Store) Delete(bucket, path string) error {
	if err := s.validatePath(path); err != nil {
		return err
	}
	return os.Remove(filepath.Join(s.root, bucket, path))
}

// SignedURL membuat URL bertanda-tangan yang kedaluwarsa setelah ttl.
func (s *Store) SignedURL(bucket, path string, ttl time.Duration, baseURL string) string {
	exp := strconv.FormatInt(time.Now().Add(ttl).Unix(), 10)
	sig := s.sign(bucket, path, exp)
	return fmt.Sprintf("%s/files/%s/%s?exp=%s&sig=%s", baseURL, bucket, path, exp, sig)
}

// VerifySignedURL memvalidasi signature dan expiry dari request.
func (s *Store) VerifySignedURL(r *http.Request, bucket, path string) error {
	exp := r.URL.Query().Get("exp")
	sig := r.URL.Query().Get("sig")
	expUnix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || time.Now().Unix() > expUnix {
		return ErrSignatureExpired
	}
	expected := s.sign(bucket, path, exp)
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return errors.New("signature tidak valid")
	}
	return nil
}

// PublicPath mengembalikan path yang bisa diakses publik (tanpa tanda tangan).
func (s *Store) PublicPath(bucket, path string) string {
	return fmt.Sprintf("/files/%s/%s", bucket, path)
}

// ServeFile adalah handler untuk melayani file publik dan privat.
// Privat (avatars): wajib signature. Publik (website-assets, music): langsung serve.
func (s *Store) ServeFile(w http.ResponseWriter, r *http.Request, bucket, path string) {
	privateBuckets := map[string]bool{BucketAvatars: true}
	if privateBuckets[bucket] {
		if err := s.VerifySignedURL(r, bucket, path); err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
	}
	full := filepath.Join(s.root, bucket, path)
	if err := s.validatePath(path); err != nil {
		http.NotFound(w, r)
		return
	}
	ext := filepath.Ext(path)
	if ct := mime.TypeByExtension(ext); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeFile(w, r, full)
}

func (s *Store) sign(bucket, path, exp string) string {
	h := hmac.New(sha256.New, s.signKey)
	h.Write([]byte(bucket + ":" + path + ":" + exp))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Store) validatePath(path string) error {
	clean := filepath.Clean(path)
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return ErrInvalidPath
	}
	return nil
}
