package handler

import "testing"

// Avatar paths carry their own ownership ("<guru|santri>/<ownerId>/profile.webp"),
// so this table is the only thing standing between a santri and someone else's
// profile photo. Keep the traversal and cross-folder cases.
func TestOwnsAvatarPath(t *testing.T) {
	const self = "11111111-1111-1111-1111-111111111111"
	const other = "22222222-2222-2222-2222-222222222222"

	cases := []struct {
		name string
		role string
		uid  string
		path string
		want bool
	}{
		{"santri owns their own", "santri", self, "santri/" + self + "/profile.webp", true},
		{"guru owns their own", "guru", self, "guru/" + self + "/profile.webp", true},
		{"pentashih lives in guru tree", "pentashih", self, "guru/" + self + "/profile.webp", true},
		{"admin may touch anyone", "admin", self, "santri/" + other + "/profile.webp", true},

		{"santri may not touch another santri", "santri", self, "santri/" + other + "/profile.webp", false},
		{"guru may not touch another guru", "guru", self, "guru/" + other + "/profile.webp", false},
		{"santri may not write into guru tree", "santri", self, "guru/" + self + "/profile.webp", false},
		{"guru may not write into santri tree", "guru", self, "santri/" + self + "/profile.webp", false},

		{"traversal rejected even when id matches", "santri", self, "santri/" + self + "/../" + other + "/profile.webp", false},
		{"unknown folder rejected", "guru", self, "website-assets/" + self + "/logo.webp", false},
		{"too few segments rejected", "guru", self, self, false},
		{"anonymous rejected", "", self, "guru/" + self + "/profile.webp", false},
		{"empty subject rejected", "guru", "", "guru//profile.webp", false},
	}

	for _, c := range cases {
		if got := ownsAvatarPath(c.role, c.uid, c.path); got != c.want {
			t.Errorf("%s: ownsAvatarPath(%q, %q, %q) = %v, want %v",
				c.name, c.role, c.uid, c.path, got, c.want)
		}
	}
}
