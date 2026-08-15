package api

import "crypto/rand"

const idAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

// newID generates a short random id for server-created entities (joiners,
// bills, items, claims), mirroring the frontend's src/lib/generateId.ts.
func newID() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, len(buf))
	for i, b := range buf {
		out[i] = idAlphabet[int(b)%len(idAlphabet)]
	}
	return string(out), nil
}
