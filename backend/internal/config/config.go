package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	JWTRefreshSecret string
	AccessTokenTTL   int // minutes
	RefreshTokenTTL  int // days
	UploadDir        string
	MaxUploadBytes   int64
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      mustEnv("DATABASE_URL"),
		JWTSecret:        mustEnv("JWT_SECRET"),
		JWTRefreshSecret: mustEnv("JWT_REFRESH_SECRET"),
		AccessTokenTTL:   getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 15),
		RefreshTokenTTL:  getEnvInt("REFRESH_TOKEN_TTL_DAYS", 30),
		UploadDir:        getEnv("UPLOAD_DIR", "/app/uploads"),
		MaxUploadBytes:   int64(getEnvInt("MAX_UPLOAD_MB", 20)) * 1024 * 1024,
	}
	return cfg, nil
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s not set", key))
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
