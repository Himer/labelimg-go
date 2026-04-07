package libs

import (
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Struct is a generic struct for dynamic attributes.
type Struct struct {
	Attrs map[string]interface{}
}

// NewStruct creates a Struct with the given key-value pairs.
func NewStruct(attrs map[string]interface{}) *Struct {
	return &Struct{Attrs: attrs}
}

// GenerateColorByText generates a deterministic color from text using SHA256.
// Matches the Python implementation: hash_code / 255 % 255, etc.
func GenerateColorByText(text string) Color {
	s := Ustr(text)
	hash := sha256.Sum256([]byte(s))
	hashHex := hex.EncodeToString(hash[:])
	hashInt := new(big.Int)
	hashInt.SetString(hashHex, 16)

	mod255 := big.NewInt(255)

	// r = int((hash_code / 255) % 255)
	r := new(big.Int).Mod(new(big.Int).Div(new(big.Int).Set(hashInt), big.NewInt(255)), mod255)
	// g = int((hash_code / 65025) % 255)
	g := new(big.Int).Mod(new(big.Int).Div(new(big.Int).Set(hashInt), big.NewInt(65025)), mod255)
	// b = int((hash_code / 16581375) % 255)
	b := new(big.Int).Mod(new(big.Int).Div(new(big.Int).Set(hashInt), big.NewInt(16581375)), mod255)

	return NewColor(uint8(r.Int64()), uint8(g.Int64()), uint8(b.Int64()), 100)
}

// FormatShortcut formats a shortcut string like "Ctrl+S" to "<b>Ctrl</b>+<b>S</b>".
func FormatShortcut(text string) string {
	parts := strings.SplitN(text, "+", 2)
	if len(parts) != 2 {
		return text
	}
	return "<b>" + parts[0] + "</b>+<b>" + parts[1] + "</b>"
}

// Distance computes the Euclidean distance of a point from the origin.
func Distance(x, y float64) float64 {
	return (x*x + y*y)
}

// NaturalSort sorts a slice of strings in natural alphanumeric order.
// e.g., ["f1", "f11", "f3"] -> ["f1", "f3", "f11"]
func NaturalSort(list []string) {
	re := regexp.MustCompile(`([0-9]+)`)
	sort.Slice(list, func(i, j int) bool {
		return naturalLess(list[i], list[j], re)
	})
}

func naturalLess(a, b string, re *regexp.Regexp) bool {
	aParts := splitAlphaNum(a, re)
	bParts := splitAlphaNum(b, re)

	for i := 0; i < len(aParts) && i < len(bParts); i++ {
		aNum, aErr := strconv.Atoi(aParts[i])
		bNum, bErr := strconv.Atoi(bParts[i])

		if aErr == nil && bErr == nil {
			if aNum != bNum {
				return aNum < bNum
			}
		} else {
			if aParts[i] != bParts[i] {
				return aParts[i] < bParts[i]
			}
		}
	}
	return len(aParts) < len(bParts)
}

// splitAlphaNum splits a string into alternating text/number parts.
// e.g., "f11" -> ["f", "11"], "abc123def456" -> ["abc", "123", "def", "456"]
func splitAlphaNum(s string, re *regexp.Regexp) []string {
	// Find all number positions
	indices := re.FindAllStringIndex(s, -1)
	if len(indices) == 0 {
		return []string{s}
	}

	var parts []string
	last := 0
	for _, idx := range indices {
		if idx[0] > last {
			parts = append(parts, s[last:idx[0]])
		}
		parts = append(parts, s[idx[0]:idx[1]])
		last = idx[1]
	}
	if last < len(s) {
		parts = append(parts, s[last:])
	}
	return parts
}

// Trimmed strips whitespace from both ends of a string.
func Trimmed(text string) string {
	return strings.TrimSpace(text)
}
