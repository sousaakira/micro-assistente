// Package api exposes a small local-only HTTP JSON API over the akira-brain
// store, used by the Neutralino desktop UI (../../ui) to let the user pick
// which inbox chats to promote to a project and see what's been captured so
// far. It only ever binds to 127.0.0.1: this is a personal, single-user
// tool, not a network service.
package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/akira/akira-brain/internal/store"
	"github.com/akira/akira-brain/internal/wa"
)

type Server struct {
	store *store.Store
	wa    *wa.Client
	mux   *http.ServeMux
}

// New wires the API to store s and, when non-nil, to a live WhatsApp client
// so GET /api/status can expose pairing/QR state to the UI.
func New(s *store.Store, waClient *wa.Client) *Server {
	srv := &Server{store: s, wa: waClient, mux: http.NewServeMux()}
	srv.routes()
	return srv
}

func (srv *Server) routes() {
	srv.mux.HandleFunc("/api/health", srv.handleHealth)
	srv.mux.HandleFunc("/api/status", srv.handleStatus)
	srv.mux.HandleFunc("/api/check", srv.handleCheck)
	srv.mux.HandleFunc("/api/send", srv.handleSend)
	srv.mux.HandleFunc("/api/check-number", srv.handleCheckNumber)
	srv.mux.HandleFunc("/api/projects", srv.handleProjects)
	srv.mux.HandleFunc("/api/inbox", srv.handleInbox)
	srv.mux.HandleFunc("/api/map", srv.handleMap)
	srv.mux.HandleFunc("/api/messages", srv.handleMessages)
	srv.mux.HandleFunc("/api/search", srv.handleSearch)
}

// ListenAndServe binds to 127.0.0.1:port and serves the API.
func (srv *Server) ListenAndServe(port string) error {
	return http.ListenAndServe("127.0.0.1:"+port, withCORS(srv.mux))
}

// withCORS allows the Neutralino UI (served from its own internal port) to
// call this API's port via fetch. Both sides only ever listen on loopback,
// so a permissive origin doesn't expose anything beyond the local machine.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (srv *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (srv *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if srv.wa == nil {
		writeJSON(w, http.StatusOK, wa.Status{})
		return
	}
	writeJSON(w, http.StatusOK, srv.wa.Status())
}

func (srv *Server) handleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if srv.wa == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"whatsapp_connected": false,
			"connection_state":   "offline",
		})
		return
	}
	connected, state := srv.wa.ConnectionState()
	st := srv.wa.Status()
	writeJSON(w, http.StatusOK, map[string]any{
		"whatsapp_connected": connected,
		"connection_state":   state,
		"session_id":         st.SessionID,
		"session_label":      st.SessionLabel,
	})
}

type sendReq struct {
	To      string `json:"to"`
	Fone    string `json:"fone"`
	Message string `json:"message"`
}

func (srv *Server) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if srv.wa == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req sendReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	to := strings.TrimSpace(req.To)
	if to == "" {
		to = strings.TrimSpace(req.Fone)
	}
	if to == "" || strings.TrimSpace(req.Message) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "missing_fields"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	result, err := srv.wa.SendText(ctx, to, req.Message)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": result})
}

type checkNumberReq struct {
	Fone string `json:"fone"`
	To   string `json:"to"`
}

func (srv *Server) handleCheckNumber(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if srv.wa == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req checkNumberReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	phone := strings.TrimSpace(req.Fone)
	if phone == "" {
		phone = strings.TrimSpace(req.To)
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	result, err := srv.wa.IsOnWhatsApp(ctx, phone)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": result})
}

type projectDTO struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   int64  `json:"created_at"`
}

func (srv *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		projects, err := srv.store.ListProjects()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		out := make([]projectDTO, 0, len(projects))
		for _, p := range projects {
			out = append(out, projectDTO{ID: p.ID, Name: p.Name, Description: p.Description, CreatedAt: p.CreatedAt})
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		if body.Name == "" {
			writeError(w, http.StatusBadRequest, errMissingField("name"))
			return
		}
		id, err := srv.store.CreateProject(body.Name, body.Description)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusCreated, projectDTO{ID: id, Name: body.Name, Description: body.Description})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type inboxDTO struct {
	ChatJID       string `json:"chat_jid"`
	IsGroup       bool   `json:"is_group"`
	DisplayName   string `json:"display_name"`
	MessageCount  int    `json:"message_count"`
	LastTimestamp int64  `json:"last_timestamp"`
	LastPreview   string `json:"last_preview"`
}

func (srv *Server) handleInbox(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	summaries, err := srv.store.ListInboxSummaries()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	out := make([]inboxDTO, 0, len(summaries))
	for _, s := range summaries {
		out = append(out, inboxDTO{
			ChatJID:       s.ChatJID,
			IsGroup:       s.IsGroup,
			DisplayName:   s.DisplayName,
			MessageCount:  s.MessageCount,
			LastTimestamp: s.LastTimestamp,
			LastPreview:   s.LastPreview,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (srv *Server) handleMap(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		JID       string `json:"jid"`
		ProjectID int64  `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if body.JID == "" || body.ProjectID == 0 {
		writeError(w, http.StatusBadRequest, errMissingField("jid/project_id"))
		return
	}
	project, err := srv.store.ProjectByID(body.ProjectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, errMissingField("project"))
		return
	}
	isGroup := strings.HasSuffix(body.JID, "@g.us")
	if err := srv.store.MapContact(body.JID, isGroup, project.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"jid": body.JID, "project_id": project.ID, "project_name": project.Name,
	})
}

type messageDTO struct {
	ID        string `json:"id"`
	ChatJID   string `json:"chat_jid"`
	SenderJID string `json:"sender_jid"`
	IsFromMe  bool   `json:"is_from_me"`
	Timestamp int64  `json:"timestamp"`
	Type      string `json:"type"`
	Body      string `json:"body"`
	IsMedia   bool   `json:"is_media"`
}

func (srv *Server) handleMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	var msgs []store.Message
	var err error
	switch {
	case r.URL.Query().Get("project_id") != "":
		var id int64
		id, err = strconv.ParseInt(r.URL.Query().Get("project_id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		msgs, err = srv.store.ListMessagesByProject(id, limit)
	case r.URL.Query().Get("chat") != "":
		msgs, err = srv.store.ListMessagesByChat(r.URL.Query().Get("chat"), limit)
	default:
		writeError(w, http.StatusBadRequest, errMissingField("project_id or chat"))
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	out := make([]messageDTO, 0, len(msgs))
	for i := len(msgs) - 1; i >= 0; i-- {
		m := msgs[i]
		out = append(out, messageDTO{
			ID:        m.ID,
			ChatJID:   m.ChatJID,
			SenderJID: m.SenderJID,
			IsFromMe:  m.IsFromMe,
			Timestamp: m.Timestamp,
			Type:      m.Type,
			Body:      m.Body,
			IsMedia:   m.IsMedia,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

type searchHitDTO struct {
	MessageID string  `json:"message_id"`
	ChatJID   string  `json:"chat_jid"`
	Body      string  `json:"body"`
	Score     float64 `json:"score"`
}

func (srv *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeError(w, http.StatusBadRequest, errMissingField("q"))
		return
	}
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	hits, err := srv.store.SearchMessages(q, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	out := make([]searchHitDTO, 0, len(hits))
	for _, h := range hits {
		out = append(out, searchHitDTO{
			MessageID: h.MessageID,
			ChatJID:   h.ChatJID,
			Body:      h.Body,
			Score:     h.Score,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func errMissingField(name string) error {
	return &fieldError{name}
}

type fieldError struct{ field string }

func (e *fieldError) Error() string { return "campo obrigatório ausente: " + e.field }
