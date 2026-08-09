package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"lpq-backend/internal/middleware"
)

func TestValidPaymentItemKeys(t *testing.T) {
	valid := []string{
		"sarpras",
		"seragam",
		"tas_murid",
		"id_card_murid",
		"buku_paket",
		"lks",
	}
	for _, key := range valid {
		if !isValidPaymentItemKey(key) {
			t.Errorf("isValidPaymentItemKey(%q) = false, want true", key)
		}
	}

	invalid := []string{"spp", "SPP", "custom", "uang_gedung", "", "sarpras/other"}
	for _, key := range invalid {
		if isValidPaymentItemKey(key) {
			t.Errorf("isValidPaymentItemKey(%q) = true, want false", key)
		}
	}
}

func TestValidatePaymentItemNominal(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want bool
	}{
		{"integer", "125000", true},
		{"two decimal places", "125000.50", true},
		{"smallest supported fraction", "0.01", true},
		{"numeric maximum", "9999999999.99", true},
		{"zero", "0", false},
		{"negative", "-1", false},
		{"three decimal places", "1.001", false},
		{"numeric overflow", "10000000000", false},
		{"quoted number", `"125000"`, false},
		{"exponent", "1e5", false},
		{"nan", "NaN", false},
		{"positive infinity", "Infinity", false},
		{"missing", "", false},
		{"null", "null", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, got := validatePaymentItemNominal(json.RawMessage(tc.raw))
			if got != tc.want {
				t.Errorf("validatePaymentItemNominal(%q) valid = %v, want %v", tc.raw, got, tc.want)
			}
		})
	}
}

func TestPaymentItemSettingsRoleBoundary(t *testing.T) {
	h := NewPaymentHandler(nil)

	for _, role := range []string{"", "guru", "santri", "pentashih"} {
		t.Run("rejects "+role, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/item-settings", nil)
			req = req.WithContext(context.WithValue(req.Context(), middleware.CtxRole, role))
			res := httptest.NewRecorder()

			h.Routes().ServeHTTP(res, req)

			if res.Code != http.StatusForbidden {
				t.Errorf("GET /item-settings as %q returned %d, want %d", role, res.Code, http.StatusForbidden)
			}
		})
	}
}

func TestPaymentItemSettingsRejectsSPPAndCustomBeforeDatabase(t *testing.T) {
	h := NewPaymentHandler(nil)

	for _, role := range []string{"admin", "superadmin", "tata_usaha"} {
		for _, key := range []string{"spp", "custom"} {
			t.Run(role+" rejects "+key, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodPut, "/item-settings/"+key, nil)
				req = req.WithContext(context.WithValue(req.Context(), middleware.CtxRole, role))
				res := httptest.NewRecorder()

				h.Routes().ServeHTTP(res, req)

				if res.Code != http.StatusBadRequest {
					t.Errorf("PUT /item-settings/%s as %q returned %d, want %d", key, role, res.Code, http.StatusBadRequest)
				}
			})
		}
	}
}
