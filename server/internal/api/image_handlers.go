package api

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"billsplitter/server/internal/models"
	"billsplitter/server/internal/sse"
)

// UploadImage handles POST /api/sessions/{code}/bills/{billId}/images —
// stores the resized receipt image (already resized client-side, see
// src/lib/imageResize.ts) to disk and records its metadata.
func (a *API) UploadImage(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	billID := r.PathValue("billId")

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart form")
		return
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "image field is required")
		return
	}
	defer file.Close()

	refKey, err := newID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store image")
		return
	}

	if err := os.MkdirAll(a.imageDir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store image")
		return
	}

	filePath := filepath.Join(a.imageDir, refKey+".jpg")
	dst, err := os.Create(filePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store image")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store image")
		return
	}

	width, _ := strconv.Atoi(r.FormValue("width"))
	height, _ := strconv.Atoi(r.FormValue("height"))

	meta := models.ImageMeta{RefKey: refKey, BillID: billID, FilePath: filePath, Width: width, Height: height}
	if err := a.store.SaveImageMeta(code, meta); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store image")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusCreated, map[string]string{"refKey": refKey})
}

// ServeImage handles GET /api/images/{refKey}.
func (a *API) ServeImage(w http.ResponseWriter, r *http.Request) {
	refKey := r.PathValue("refKey")
	filePath, err := a.store.ImageFilePath(refKey)
	if err != nil {
		writeError(w, http.StatusNotFound, "image not found")
		return
	}
	http.ServeFile(w, r, filePath)
}
