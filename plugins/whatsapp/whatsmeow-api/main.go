package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	_ "github.com/mattn/go-sqlite3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type serverConfig struct {
	BotID            string
	URI              string
	PortOffset       int
	ListenPort       int
	ListenHost       string
	NetworkIface     string
	TokenFolder      string
	SessionName      string
	PublicDir        string
	QRCodePost       bool
	QRCodeStatusPost bool
	UpdateBotPost    bool
}

type app struct {
	cfg        serverConfig
	client     *whatsmeow.Client
	httpClient *http.Client
	msgDB      *sql.DB

	s3Client   *s3.Client
	s3Bucket   string
	s3Endpoint string
	s3Region   string
}

func main() {
	cfg := loadConfig()
	a := &app{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
	a.initS3()

	if err := a.initWhatsApp(); err != nil {
		fmt.Println("Erro ao iniciar WhatsApp:", err)
	}

	a.startHTTP()
}

func loadConfig() serverConfig {
	portOffset := 0
	if p, ok := strconvAtoi(os.Getenv("PORTA")); ok {
		portOffset = p
	} else if p, ok := strconvAtoi(os.Getenv("PORT")); ok {
		portOffset = p
	}
	listenPort := 5000
	if portOffset > 0 {
		listenPort = 5000 + portOffset
	}
	botID := strings.TrimSpace(os.Getenv("BOT"))
	tokenFolderName := strings.TrimSpace(os.Getenv("TOKEN_FOLDE"))
	if tokenFolderName == "" {
		tokenFolderName = strings.TrimSpace(os.Getenv("SESSION"))
	}
	if tokenFolderName == "" {
		tokenFolderName = botID
	}
	if tokenFolderName == "" {
		tokenFolderName = "wapix"
	}
	tokenFolder := filepath.Join("tokens", tokenFolderName)
	return serverConfig{
		BotID:            botID,
		URI:              strings.TrimSpace(os.Getenv("URI")),
		PortOffset:       portOffset,
		ListenPort:       listenPort,
		ListenHost:       "0.0.0.0",
		NetworkIface:     strings.TrimSpace(os.Getenv("REDE")),
		TokenFolder:      tokenFolder,
		SessionName:      strings.TrimSpace(os.Getenv("SESSION")),
		PublicDir:        strings.TrimSpace(os.Getenv("DIRECTORY")),
		QRCodePost:       true,
		QRCodeStatusPost: true,
		UpdateBotPost:    true,
	}
}

func (a *app) initWhatsApp() error {
	dbLog := waLog.Stdout("Database", "WARN", false)
	cliLog := waLog.Stdout("Client", "INFO", false)
	ctx := context.Background()

	tokenDir := a.cfg.TokenFolder
	if tokenDir == "" {
		tokenDir = filepath.Join("tokens", "wapix")
	}
	if err := os.MkdirAll(tokenDir, 0o755); err != nil {
		return err
	}

	sessionName := a.cfg.SessionName
	if sessionName == "" {
		sessionName = a.cfg.BotID
	}
	if sessionName == "" {
		sessionName = "wapix"
	}

	dbPath := filepath.Join(tokenDir, sessionName+".db")
	store, err := sqlstore.New(ctx, "sqlite3", "file:"+dbPath+"?_foreign_keys=on", dbLog)
	if err != nil {
		return err
	}
	device, err := store.GetFirstDevice(ctx)
	if err != nil {
		return err
	}

	if err := a.initMessageDB(dbPath); err != nil {
		return err
	}

	a.client = whatsmeow.NewClient(device, cliLog)
	a.client.AddEventHandler(a.onEvent)

	if a.client.Store.ID == nil {
		qrChan, err := a.client.GetQRChannel(ctx)
		if err != nil {
			return err
		}
		go a.consumeQR(qrChan)
		a.postQRCodeStatus("qr")
	} else {
		a.postQRCodeStatus("restoring")
	}

	go func() {
		for {
			if err := a.client.Connect(); err != nil {
				a.postQRCodeStatus("connect_error")
				time.Sleep(3 * time.Second)
				continue
			}
			return
		}
	}()

	go func() {
		time.Sleep(2 * time.Second)
		a.postUpdateBot()
	}()

	return nil
}

func (a *app) consumeQR(ch <-chan whatsmeow.QRChannelItem) {
	for evt := range ch {
		if evt.Event == whatsmeow.QRChannelEventCode {
			png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			if err != nil {
				continue
			}
			b64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
			a.postQRCode(b64)
			continue
		}
		if evt.Event == whatsmeow.QRChannelEventError {
			a.postQRCodeStatus("qr_error")
			continue
		}
	}
}

func (a *app) onEvent(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		_ = e
		a.postQRCodeStatus("connected")
	case *events.Disconnected:
		_ = e
		a.postQRCodeStatus("disconnected")
	case *events.LoggedOut:
		_ = e
		a.postQRCodeStatus("logged_out")
	case *events.PairSuccess:
		_ = e
		a.postQRCodeStatus("paired")
	case *events.HistorySync:
		if e == nil {
			return
		}
		_ = a.persistHistorySync(e.Data)
	case *events.Message:
		if e == nil {
			return
		}
		e.UnwrapRaw()
		_ = a.persistIncomingMessage(e)
		_ = a.forwardIncomingMessage(e)
	}
}

func (a *app) startHTTP() {
	port := a.cfg.ListenPort
	if port <= 0 {
		port = 5000
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/check", a.handleCheck)
	mux.HandleFunc("/check-number", a.handleCheckNumber)
	mux.HandleFunc("/checkdb", a.handleCheckDB)
	mux.HandleFunc("/checkdb/", a.handleCheckDBByID)
	mux.HandleFunc("/bot-text-message", a.handleBotTextMessage)
	mux.HandleFunc("/bot-typing-status", a.handleTypingStatus)
	mux.HandleFunc("/bot-image-message", a.handleSendFile)
	mux.HandleFunc("/bot-file-message", a.handleSendFile)
	mux.HandleFunc("/bot-file-message64", a.handleSendFile)
	mux.HandleFunc("/bot-audio-message", a.handleBotAudio)
	mux.HandleFunc("/bot-button-message", a.handleButtonMessage)
	mux.HandleFunc("/bot-reply-message", a.handleReplyMessage)
	mux.HandleFunc("/bot-list-message", a.handleListMessage)

	mux.HandleFunc("/bot-grupo-fetch-messages", a.handleGroupFetchMessages)
	mux.HandleFunc("/bot-grupo-get-all", a.handleGroupGetAll)
	mux.HandleFunc("/bot-grupo-enter-link", a.handleGroupEnterLink)
	mux.HandleFunc("/bot-grupo-get-members", a.handleGroupMembers)
	mux.HandleFunc("/bot-grupo-text-message", a.handleGroupText)
	mux.HandleFunc("/bot-grupo-audio-message", a.handleGroupAudio)
	mux.HandleFunc("/bot-grupo-image-message", a.handleGroupFile)
	mux.HandleFunc("/bot-grupo-video-message", a.handleGroupFile)
	mux.HandleFunc("/bot-grupo-document-message", a.handleGroupFile)
	mux.HandleFunc("/bot-grupo-acces-group", a.handleGroupAccessGroup)
	mux.HandleFunc("/bot-grupo-create", a.handleGroupCreate)
	mux.HandleFunc("/bot-grupo-summary-button", a.handleGroupSummaryButton)

	selectedPort := port
	var ln net.Listener
	var err error
	for i := 0; i < 50; i++ {
		addr := fmt.Sprintf("%s:%d", a.cfg.ListenHost, selectedPort)
		ln, err = net.Listen("tcp", addr)
		if err == nil {
			break
		}
		if strings.Contains(err.Error(), "address already in use") {
			selectedPort++
			continue
		}
		fmt.Println("Erro ao iniciar servidor HTTP:", err)
		os.Exit(1)
	}
	if ln == nil {
		fmt.Println("Erro ao iniciar servidor HTTP:", err)
		os.Exit(1)
	}
	a.cfg.ListenPort = selectedPort
	addr := fmt.Sprintf("%s:%d", a.cfg.ListenHost, selectedPort)
	fmt.Println("Servidor WhatsMeow API:", addr)

	srv := &http.Server{Handler: mux}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Println("Erro no servidor HTTP:", err)
		os.Exit(1)
	}
}

func (a *app) handleCheck(w http.ResponseWriter, r *http.Request) {
	connected := a.client != nil && a.client.IsConnected()
	state := "disconnected"
	if connected {
		state = "connected"
	} else if a.client != nil && a.client.Store != nil && a.client.Store.ID != nil {
		state = "logged"
	} else {
		state = "unpaired"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"error":              false,
		"status":             true,
		"whatsapp_connected": connected,
		"connection_state":   state,
	})
}

type checkNumberReq struct {
	Fone string `json:"fone"`
}

func (a *app) handleCheckNumber(w http.ResponseWriter, r *http.Request) {
	var req checkNumberReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	phone := extractE164(req.Fone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_phone"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	resp, err := a.client.IsOnWhatsApp(ctx, []string{"+" + phone})
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "provider_error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

type textReq struct {
	Fone    string `json:"fone"`
	Message string `json:"message"`
	Type    string `json:"type"`
}

func (a *app) handleBotTextMessage(w http.ResponseWriter, r *http.Request) {
	var req textReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	msg := &waE2E.Message{Conversation: proto.String(req.Message)}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	resp, err := a.client.SendMessage(ctx, jid, msg)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

type typingReq struct {
	Fone     string `json:"fone"`
	Duration int    `json:"duration_ms"`
	Status   string `json:"status"`
}

func (a *app) handleTypingStatus(w http.ResponseWriter, r *http.Request) {
	var req typingReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}

	duration := req.Duration
	if duration <= 0 {
		duration = 2000
	}
	if duration < 300 {
		duration = 300
	}
	if duration > 10000 {
		duration = 10000
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	state := types.ChatPresenceComposing
	media := types.ChatPresenceMediaText
	if status == "recording" || status == "audio" {
		state = types.ChatPresenceComposing
		media = types.ChatPresenceMediaAudio
	}
	if status == "paused" || status == "stop" || status == "stopped" || status == "off" || status == "idle" {
		_ = a.client.SendChatPresence(context.Background(), jid, types.ChatPresencePaused, "")
		writeJSON(w, http.StatusOK, map[string]any{"st": 1})
		return
	}

	_ = a.client.SendChatPresence(context.Background(), jid, state, media)
	time.Sleep(time.Duration(duration) * time.Millisecond)
	_ = a.client.SendChatPresence(context.Background(), jid, types.ChatPresencePaused, "")
	writeJSON(w, http.StatusOK, map[string]any{"st": 1})
}

type fileReq struct {
	Fone      string `json:"fone"`
	Message   string `json:"message"`
	File      string `json:"file"`
	Extension string `json:"extension"`
	Name      string `json:"name"`
	Caption   string `json:"caption"`
	Type      string `json:"type"`
}

func (a *app) handleSendFile(w http.ResponseWriter, r *http.Request) {
	var req fileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}

	extFromExtension := strings.TrimSpace(req.Extension)
	if extFromExtension != "" && strings.Contains(extFromExtension, ".") {
		extFromExtension = strings.TrimPrefix(filepath.Ext(extFromExtension), ".")
	}
	filename := strings.TrimSpace(req.Name)
	if filename == "" && strings.TrimSpace(req.Extension) != "" {
		filename = strings.TrimSpace(req.Extension)
	}
	if filename == "" && extFromExtension != "" {
		filename = "file." + extFromExtension
	}
	data, mimeType, err := fetchFile(a.httpClient, req.File, extFromExtension)
	if err != nil || len(data) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "invalid_file"})
		return
	}
	if mimeType == "" {
		mimeType = inferMime(extFromExtension, "application/octet-stream")
	}
	caption := strings.TrimSpace(req.Caption)
	if caption == "" {
		caption = strings.TrimSpace(req.Message)
	}

	resp, err := sendMedia(a.client, jid, data, mimeType, caption, filename)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

func (a *app) sendAudioFromMultipart(r *http.Request, target types.JID) (any, error) {
	if a.client == nil {
		return nil, fmt.Errorf("not_ready")
	}
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		return nil, fmt.Errorf("invalid_multipart")
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		return nil, fmt.Errorf("missing_file")
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		return nil, fmt.Errorf("invalid_file")
	}
	mimeType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if mimeType == "" {
		mimeType = "audio/ogg"
	}
	return sendMedia(a.client, target, data, mimeType, "", header.Filename)
}

func (a *app) handleBotAudio(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	fone := r.FormValue("fone")
	jid, err := parseRecipient(fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	_, err = a.sendAudioFromMultipart(r, jid)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "arror": true})
}

type buttonReq struct {
	Fone      string `json:"fone"`
	Titulo    string `json:"titulo"`
	Buttons   []any  `json:"buttons"`
	Subtitulo string `json:"subtitulo"`
	Descricao string `json:"descricao"`
	List      []any  `json:"list"`
	GroupID   string `json:"group_id"`
	Message   string `json:"message"`
}

func (a *app) handleButtonMessage(w http.ResponseWriter, r *http.Request) {
	var req buttonReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	buttons := parseVenomButtons(req.Buttons)
	content := strings.TrimSpace(req.Titulo)
	if content != "" {
		content = "*" + content + "*"
	}
	footer := strings.TrimSpace(req.Subtitulo)
	msg := &waE2E.Message{
		ButtonsMessage: &waE2E.ButtonsMessage{
			ContentText: proto.String(content),
			FooterText:  proto.String(footer),
			Buttons:     buttons,
			HeaderType:  waE2E.ButtonsMessage_TEXT.Enum(),
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	_, err = a.client.SendMessage(ctx, jid, msg)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1})
}

func (a *app) handleReplyMessage(w http.ResponseWriter, r *http.Request) {
	var req buttonReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	buttons := parseVenomButtons(req.Buttons)
	headerText := strings.TrimSpace(req.Subtitulo)
	content := strings.TrimSpace(req.Titulo)
	if content != "" {
		content = "*" + content + "*"
	}
	desc := strings.TrimSpace(req.Descricao)
	if desc != "" {
		if content != "" {
			content += "\n\n"
		}
		content += desc
	}
	msg := &waE2E.Message{
		ButtonsMessage: &waE2E.ButtonsMessage{
			Header:      &waE2E.ButtonsMessage_Text{Text: headerText},
			ContentText: proto.String(content),
			Buttons:     buttons,
			HeaderType:  waE2E.ButtonsMessage_TEXT.Enum(),
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	_, err = a.client.SendMessage(ctx, jid, msg)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1})
}

func (a *app) handleListMessage(w http.ResponseWriter, r *http.Request) {
	var req buttonReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseRecipient(req.Fone)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_recipient"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	sections := parseVenomListSections(req.List)
	if len(sections) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_list"})
		return
	}
	msg := &waE2E.Message{
		ListMessage: &waE2E.ListMessage{
			Title:       proto.String(strings.TrimSpace(req.Titulo)),
			Description: proto.String(strings.TrimSpace(req.Descricao)),
			ButtonText:  proto.String("menu"),
			ListType:    waE2E.ListMessage_SINGLE_SELECT.Enum(),
			Sections:    sections,
			FooterText:  proto.String(strings.TrimSpace(req.Subtitulo)),
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	_, err = a.client.SendMessage(ctx, jid, msg)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1})
}

type venomChatID struct {
	Serialized string `json:"_serialized"`
}

type venomChatContact struct {
	ID   venomChatID `json:"id"`
	Name string      `json:"name"`
}

type venomChatMeta struct {
	Restrict bool `json:"restrict"`
}

type venomChat struct {
	ID            venomChatID      `json:"id"`
	Contact       venomChatContact `json:"contact"`
	GroupMetadata venomChatMeta    `json:"groupMetadata"`
}

func (a *app) handleGroupGetAll(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	groups, err := a.client.GetJoinedGroups(ctx)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "provider_error"})
		return
	}
	chats := make([]venomChat, 0, len(groups))
	for _, g := range groups {
		id := g.JID.String()
		chats = append(chats, venomChat{
			ID: venomChatID{Serialized: id},
			Contact: venomChatContact{
				ID:   venomChatID{Serialized: id},
				Name: g.Name,
			},
			GroupMetadata: venomChatMeta{Restrict: g.IsAnnounce},
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "chats": chats})
}

type groupLinkReq struct {
	Link string `json:"link"`
}

func (a *app) handleGroupEnterLink(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req groupLinkReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	code := strings.TrimSpace(req.Link)
	code = strings.TrimPrefix(code, whatsmeow.InviteLinkPrefix)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	jid, err := a.client.JoinGroupWithLink(ctx, code)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "join_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "chats": jid.String()})
}

type groupMembersReq struct {
	GroupID string `json:"group_id"`
}

func (a *app) handleGroupMembers(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req groupMembersReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseGroup(req.GroupID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_group"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	info, err := a.client.GetGroupInfo(ctx, jid)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "provider_error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "members": info.Participants})
}

type groupTextReq struct {
	GroupID string `json:"group_id"`
	Message string `json:"message"`
}

func (a *app) handleGroupText(w http.ResponseWriter, r *http.Request) {
	var req groupTextReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseGroup(req.GroupID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_group"})
		return
	}
	resp, err := a.sendText(jid, req.Message)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

func (a *app) handleGroupAudio(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	groupID := r.FormValue("group_id")
	jid, err := parseGroup(groupID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_group"})
		return
	}
	resp, err := a.sendAudioFromMultipart(r, jid)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

type groupFileReq struct {
	GroupID   string `json:"group_id"`
	Message   string `json:"message"`
	File      string `json:"file"`
	Extension string `json:"extension"`
}

func (a *app) handleGroupFile(w http.ResponseWriter, r *http.Request) {
	var req groupFileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseGroup(req.GroupID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_group"})
		return
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	data, mimeType, err := fetchFile(a.httpClient, req.File, req.Extension)
	if err != nil || len(data) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "invalid_file"})
		return
	}
	if mimeType == "" {
		mimeType = inferMime(req.Extension, "application/octet-stream")
	}
	resp, err := sendMedia(a.client, jid, data, mimeType, strings.TrimSpace(req.Message), "")
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": resp})
}

type groupSummaryReq struct {
	GroupID   string `json:"group_id"`
	Titulo    string `json:"titulo"`
	Subtitulo string `json:"subtitulo"`
}

func (a *app) handleGroupSummaryButton(w http.ResponseWriter, r *http.Request) {
	var req groupSummaryReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	jid, err := parseGroup(req.GroupID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_group"})
		return
	}
	title := strings.TrimSpace(req.Titulo)
	if title == "" {
		title = "Resumo"
	}
	sub := strings.TrimSpace(req.Subtitulo)
	if sub == "" {
		sub = "Clique para gerar o resumo de hoje"
	}
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	btnID := "WAPIX_RESUMO_HOJE"
	display := "Resumo do dia"
	msg := &waE2E.Message{
		ButtonsMessage: &waE2E.ButtonsMessage{
			ContentText: proto.String("*" + title + "*"),
			FooterText:  proto.String(sub),
			Buttons: []*waE2E.ButtonsMessage_Button{
				{
					ButtonID: proto.String(btnID),
					ButtonText: &waE2E.ButtonsMessage_Button_ButtonText{
						DisplayText: proto.String(display),
					},
					Type: waE2E.ButtonsMessage_Button_RESPONSE.Enum(),
				},
			},
			HeaderType: waE2E.ButtonsMessage_TEXT.Enum(),
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	_, err = a.client.SendMessage(ctx, jid, msg)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "send_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1})
}

func (a *app) sendText(jid types.JID, text string) (any, error) {
	if a.client == nil {
		return nil, fmt.Errorf("not_ready")
	}
	msg := &waE2E.Message{Conversation: proto.String(text)}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	return a.client.SendMessage(ctx, jid, msg)
}

func sendMedia(cli *whatsmeow.Client, jid types.JID, data []byte, mimeType string, caption string, filename string) (any, error) {
	if cli == nil {
		return nil, fmt.Errorf("not_ready")
	}
	mt := whatsmeow.MediaDocument
	if strings.HasPrefix(mimeType, "image/") {
		mt = whatsmeow.MediaImage
	} else if strings.HasPrefix(mimeType, "video/") {
		mt = whatsmeow.MediaVideo
	} else if strings.HasPrefix(mimeType, "audio/") {
		mt = whatsmeow.MediaAudio
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	up, err := cli.Upload(ctx, data, mt)
	if err != nil {
		return nil, err
	}

	var msg *waE2E.Message
	switch mt {
	case whatsmeow.MediaImage:
		imageMsg := &waE2E.ImageMessage{
			Caption:       proto.String(caption),
			Mimetype:      proto.String(mimeType),
			URL:           proto.String(up.URL),
			DirectPath:    proto.String(up.DirectPath),
			MediaKey:      up.MediaKey,
			FileEncSHA256: up.FileEncSHA256,
			FileSHA256:    up.FileSHA256,
			FileLength:    proto.Uint64(up.FileLength),
		}
		msg = &waE2E.Message{ImageMessage: imageMsg}
	case whatsmeow.MediaVideo:
		videoMsg := &waE2E.VideoMessage{
			Caption:       proto.String(caption),
			Mimetype:      proto.String(mimeType),
			URL:           proto.String(up.URL),
			DirectPath:    proto.String(up.DirectPath),
			MediaKey:      up.MediaKey,
			FileEncSHA256: up.FileEncSHA256,
			FileSHA256:    up.FileSHA256,
			FileLength:    proto.Uint64(up.FileLength),
		}
		msg = &waE2E.Message{VideoMessage: videoMsg}
	case whatsmeow.MediaAudio:
		audioMsg := &waE2E.AudioMessage{
			Mimetype:      proto.String(mimeType),
			URL:           proto.String(up.URL),
			DirectPath:    proto.String(up.DirectPath),
			MediaKey:      up.MediaKey,
			FileEncSHA256: up.FileEncSHA256,
			FileSHA256:    up.FileSHA256,
			FileLength:    proto.Uint64(up.FileLength),
			PTT:           proto.Bool(true),
		}
		msg = &waE2E.Message{AudioMessage: audioMsg}
	default:
		docMsg := &waE2E.DocumentMessage{
			Caption:       proto.String(caption),
			Mimetype:      proto.String(mimeType),
			FileName:      proto.String(filename),
			URL:           proto.String(up.URL),
			DirectPath:    proto.String(up.DirectPath),
			MediaKey:      up.MediaKey,
			FileEncSHA256: up.FileEncSHA256,
			FileSHA256:    up.FileSHA256,
			FileLength:    proto.Uint64(up.FileLength),
		}
		msg = &waE2E.Message{DocumentMessage: docMsg}
	}
	sendCtx, sendCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer sendCancel()
	return cli.SendMessage(sendCtx, jid, msg)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func parseRecipient(raw string) (types.JID, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return types.EmptyJID, fmt.Errorf("empty")
	}
	if strings.HasSuffix(s, "@c.us") {
		s = strings.TrimSuffix(s, "@c.us") + "@s.whatsapp.net"
	}
	if !strings.Contains(s, "@") {
		s = s + "@s.whatsapp.net"
	}
	return types.ParseJID(s)
}

func parseGroup(raw string) (types.JID, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return types.EmptyJID, fmt.Errorf("empty")
	}
	if !strings.HasSuffix(s, "@g.us") && !strings.HasSuffix(s, "@lid") && strings.Contains(s, "-") {
		s = s + "@g.us"
	}
	if strings.HasSuffix(s, "@c.us") {
		s = strings.TrimSuffix(s, "@c.us") + "@s.whatsapp.net"
	}
	if !strings.Contains(s, "@") {
		s = s + "@g.us"
	}
	return types.ParseJID(s)
}

func extractE164(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "@") {
		s = strings.Split(s, "@")[0]
	}
	s = strings.TrimPrefix(s, "+")
	b := make([]rune, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b = append(b, r)
		}
	}
	if len(b) < 9 || len(b) > 15 {
		return ""
	}
	return string(b)
}

func inferMime(ext string, fallback string) string {
	e := strings.TrimSpace(strings.TrimPrefix(ext, "."))
	if e == "" {
		return fallback
	}
	t := mime.TypeByExtension("." + e)
	if t == "" {
		return fallback
	}
	return strings.Split(t, ";")[0]
}

func fetchFile(httpClient *http.Client, file string, ext string) ([]byte, string, error) {
	v := strings.TrimSpace(file)
	if v == "" {
		return nil, "", fmt.Errorf("empty")
	}
	if strings.HasPrefix(v, "data:") {
		parts := strings.SplitN(v, ",", 2)
		if len(parts) != 2 {
			return nil, "", fmt.Errorf("invalid_data_url")
		}
		meta := parts[0]
		rawB64 := parts[1]
		mimeType := ""
		if strings.HasPrefix(meta, "data:") {
			meta = strings.TrimPrefix(meta, "data:")
			metaParts := strings.Split(meta, ";")
			if len(metaParts) > 0 {
				mimeType = metaParts[0]
			}
		}
		bin, err := base64.StdEncoding.DecodeString(rawB64)
		if err != nil {
			return nil, mimeType, err
		}
		return bin, mimeType, nil
	}
	if strings.HasPrefix(v, "http://") || strings.HasPrefix(v, "https://") {
		req, _ := http.NewRequest(http.MethodGet, v, nil)
		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, "", err
		}
		mimeType := strings.Split(resp.Header.Get("Content-Type"), ";")[0]
		return data, mimeType, nil
	}
	mimeType := inferMime(ext, "application/octet-stream")
	if strings.Contains(v, "base64,") {
		parts := strings.SplitN(v, "base64,", 2)
		if len(parts) == 2 {
			bin, err := base64.StdEncoding.DecodeString(parts[1])
			return bin, mimeType, err
		}
	}
	bin, err := base64.StdEncoding.DecodeString(v)
	return bin, mimeType, err
}

func (a *app) postQRCode(qrData string) {
	if !a.cfg.QRCodePost || a.cfg.URI == "" || a.cfg.BotID == "" {
		return
	}
	_ = a.postJSON(a.cfg.URI+"/qr-code", map[string]any{
		"qrcode": qrData,
		"bot_id": a.cfg.BotID,
	})
}

func (a *app) postQRCodeStatus(status string) {
	if !a.cfg.QRCodeStatusPost || a.cfg.URI == "" || a.cfg.BotID == "" {
		return
	}
	_ = a.postJSON(a.cfg.URI+"/qr-code-status", map[string]any{
		"qrcode_status": status,
		"bot_id":        a.cfg.BotID,
	})
}

func (a *app) postUpdateBot() {
	if !a.cfg.UpdateBotPost || a.cfg.URI == "" || a.cfg.BotID == "" {
		return
	}
	host := detectIP(a.cfg.NetworkIface)
	port := a.cfg.ListenPort
	if port <= 0 {
		port = 5000
	}
	_ = a.postJSON(a.cfg.URI+"/update-bot", map[string]any{
		"zap_server": host,
		"zap_port":   port,
		"bot_id":     a.cfg.BotID,
	})
}

func (a *app) initMessageDB(dbPath string) error {
	db, err := sql.Open("sqlite3", "file:"+dbPath+"?_foreign_keys=on&_busy_timeout=5000")
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	a.msgDB = db
	_, err = a.msgDB.Exec(`
		CREATE TABLE IF NOT EXISTS group_messages (
			id TEXT PRIMARY KEY,
			group_id TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			author TEXT,
			is_from_me INTEGER,
			type TEXT,
			body TEXT,
			caption TEXT,
			is_media INTEGER,
			mimetype TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_group_messages_group_ts ON group_messages(group_id, timestamp);
		CREATE TABLE IF NOT EXISTS numbers (
			id TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL
		);
	`)
	if err != nil {
		return err
	}
	return a.ensureGroupMessagesSchema()
}

func (a *app) ensureGroupMessagesSchema() error {
	if a.msgDB == nil {
		return nil
	}
	rows, err := a.msgDB.Query(`PRAGMA table_info(group_messages)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasIsFromMe := false
	for rows.Next() {
		var (
			cid        int
			name       string
			columnType string
			notNull    int
			dfltValue  sql.NullString
			pk         int
		)
		if scanErr := rows.Scan(&cid, &name, &columnType, &notNull, &dfltValue, &pk); scanErr != nil {
			return scanErr
		}
		if name == "is_from_me" {
			hasIsFromMe = true
		}
	}
	if hasIsFromMe {
		return nil
	}
	_, err = a.msgDB.Exec(`ALTER TABLE group_messages ADD COLUMN is_from_me INTEGER`)
	return err
}

func (a *app) persistIncomingMessage(e *events.Message) error {
	if a.msgDB == nil || e == nil || e.Info.ID == "" {
		return nil
	}
	groupID := e.Info.Chat.String()
	if !strings.HasSuffix(groupID, "@g.us") {
		return nil
	}
	author := e.Info.Sender.String()
	ts := e.Info.Timestamp.Unix()

	msgType, body, caption, isMedia, mimeType := extractMessageFields(e.Message)

	_, err := a.msgDB.Exec(
		`INSERT OR IGNORE INTO group_messages (id, group_id, timestamp, author, is_from_me, type, body, caption, is_media, mimetype)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		string(e.Info.ID),
		groupID,
		ts,
		author,
		boolToInt(e.Info.IsFromMe),
		msgType,
		body,
		caption,
		boolToInt(isMedia),
		mimeType,
	)
	return err
}

func (a *app) persistHistorySync(data *waHistorySync.HistorySync) error {
	if a.msgDB == nil || data == nil {
		return nil
	}
	for _, conv := range data.GetConversations() {
		if conv == nil {
			continue
		}
		groupID := strings.TrimSpace(conv.GetID())
		if groupID == "" || !strings.HasSuffix(groupID, "@g.us") {
			continue
		}
		for _, item := range conv.GetMessages() {
			if item == nil {
				continue
			}
			_ = a.persistHistorySyncMessage(groupID, item.GetMessage())
		}
	}
	return nil
}

func (a *app) persistHistorySyncMessage(groupID string, webMsg *waWeb.WebMessageInfo) error {
	if a.msgDB == nil || webMsg == nil {
		return nil
	}
	key := webMsg.GetKey()
	messageID := strings.TrimSpace(key.GetID())
	if messageID == "" {
		return nil
	}
	ts := int64(webMsg.GetMessageTimestamp())
	if ts <= 0 {
		ts = time.Now().Unix()
	}
	author := strings.TrimSpace(webMsg.GetParticipant())
	if author == "" {
		author = strings.TrimSpace(key.GetParticipant())
	}
	msgType, body, caption, isMedia, mimeType := extractMessageFields(webMsg.GetMessage())
	_, err := a.msgDB.Exec(
		`INSERT OR IGNORE INTO group_messages (id, group_id, timestamp, author, is_from_me, type, body, caption, is_media, mimetype)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		messageID,
		groupID,
		ts,
		author,
		boolToInt(key.GetFromMe()),
		msgType,
		body,
		caption,
		boolToInt(isMedia),
		mimeType,
	)
	return err
}

func (a *app) forwardIncomingMessage(e *events.Message) error {
	if e == nil || e.Info.ID == "" || a.cfg.URI == "" || a.cfg.BotID == "" {
		return nil
	}
	if e.Info.IsFromMe {
		return nil
	}
	chat := e.Info.Chat
	if chat.User == "status" && chat.Server == "broadcast" {
		return nil
	}

	from := toVenomJID(chat)
	senderID := toVenomJID(e.Info.Sender)
	pushName := strings.TrimSpace(e.Info.PushName)
	senderObj := map[string]any{
		"id":           senderID,
		"name":         pushName,
		"shortName":    pushName,
		"verifiedName": pushName,
	}

	ts := e.Info.Timestamp.Unix()
	filial := strings.TrimSpace(os.Getenv("FILIAL"))
	if filial == "" {
		filial = "default"
	}

	msgText, msgType, selectedId, listResponse := extractIncomingText(e.Message)
	if chat.Server == types.GroupServer {
		groupName := ""
		{
			ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
			if gi, err := a.client.GetGroupInfo(ctx, chat); err == nil && gi != nil {
				groupName = strings.TrimSpace(gi.Name)
			}
			cancel()
		}
		payload := map[string]any{
			"id":           e.Info.ID,
			"type":         "group",
			"bot_id":       a.cfg.BotID,
			"filial_id":    filial,
			"group_id":     from,
			"group_name":   groupName,
			"from":         from,
			"author":       senderID,
			"message":      msgText,
			"caption":      "",
			"message_type": msgType,
			"sender":       senderObj,
			"selectedId":   selectedId,
			"listResponse": listResponse,
			"self":         false,
			"timestamp":    ts,
		}
		_ = a.postJSON(a.cfg.URI+"/group-message", payload)
		if isSummaryTrigger(msgText, selectedId) {
			date := toLocalDateStringFromUnix(ts)
			var summaryResp struct {
				Summary any `json:"summary"`
				Data    any `json:"data"`
			}
			reqBody := map[string]any{
				"bot_id":       a.cfg.BotID,
				"group_id":     from,
				"message_date": date,
			}
			if err := a.postJSONWithResponse(a.cfg.URI+"/group-summary", reqBody, &summaryResp); err == nil {
				summaryText := pickSummaryText(summaryResp.Summary)
				if summaryText == "" {
					summaryText = pickSummaryText(summaryResp.Data)
				}
				if summaryText != "" {
					ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
					_, _ = a.client.SendMessage(ctx, chat, &waE2E.Message{
						Conversation: proto.String(summaryText),
					})
					cancel()
				}
			}
		}
		return nil
	}

	if msgType == "location" && listResponse != nil {
		payload := map[string]any{
			"id":           e.Info.ID,
			"type":         "location",
			"bot_id":       a.cfg.BotID,
			"filial_id":    filial,
			"from":         from,
			"message":      listResponse,
			"message_type": msgType,
			"sender":       senderObj,
			"selectedId":   selectedId,
			"listResponse": listResponse,
			"self":         false,
		}
		_ = a.postJSON(a.cfg.URI+"/text-message", payload)
		return nil
	}

	if msgType != "" && msgText != "" {
		payload := map[string]any{
			"id":           e.Info.ID,
			"type":         "text",
			"bot_id":       a.cfg.BotID,
			"filial_id":    filial,
			"from":         from,
			"message":      msgText,
			"message_type": msgType,
			"sender":       senderObj,
			"selectedId":   selectedId,
			"listResponse": listResponse,
			"self":         false,
		}
		_ = a.postJSON(a.cfg.URI+"/text-message", payload)
		return nil
	}

	if e.Message == nil || a.client == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var (
		data     []byte
		mimeType string
		typ      string
		caption  string
	)

	switch {
	case e.Message.GetImageMessage() != nil:
		typ = "image"
		caption = strings.TrimSpace(e.Message.GetImageMessage().GetCaption())
		mimeType = strings.TrimSpace(e.Message.GetImageMessage().GetMimetype())
		data, _ = a.client.Download(ctx, e.Message.GetImageMessage())
	case e.Message.GetVideoMessage() != nil:
		typ = "video"
		caption = strings.TrimSpace(e.Message.GetVideoMessage().GetCaption())
		mimeType = strings.TrimSpace(e.Message.GetVideoMessage().GetMimetype())
		data, _ = a.client.Download(ctx, e.Message.GetVideoMessage())
	case e.Message.GetAudioMessage() != nil:
		typ = "ptt"
		mimeType = strings.TrimSpace(e.Message.GetAudioMessage().GetMimetype())
		data, _ = a.client.Download(ctx, e.Message.GetAudioMessage())
	case e.Message.GetDocumentMessage() != nil:
		typ = "document"
		caption = strings.TrimSpace(e.Message.GetDocumentMessage().GetCaption())
		mimeType = strings.TrimSpace(e.Message.GetDocumentMessage().GetMimetype())
		data, _ = a.client.Download(ctx, e.Message.GetDocumentMessage())
	default:
		return nil
	}

	if len(data) == 0 {
		return nil
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	location := ""
	if a.s3Client != nil && a.s3Bucket != "" {
		if u, err := a.uploadToS3(ctx, filial, mimeType, data); err == nil {
			location = u
		}
	}
	if location == "" {
		b64 := base64.StdEncoding.EncodeToString(data)
		location = "data:" + mimeType + ";base64," + b64
	}
	payload := map[string]any{
		"id":        e.Info.ID,
		"type":      typ,
		"bot_id":    a.cfg.BotID,
		"filial_id": filial,
		"from":      from,
		"message":   location,
		"caption":   caption,
		"sender":    senderObj,
		"self":      false,
		"mimetype":  mimeType,
	}
	_ = a.postJSON(a.cfg.URI+"/file-message", payload)
	return nil
}

func toVenomJID(jid types.JID) string {
	if jid.User == "" || jid.Server == "" {
		return jid.String()
	}
	if jid.Server == types.DefaultUserServer {
		return jid.User + "@c.us"
	}
	return jid.User + "@" + jid.Server
}

func extractIncomingText(m *waE2E.Message) (message string, messageType string, selectedId string, listResponse any) {
	if m == nil {
		return "", "", "", nil
	}
	if txt := strings.TrimSpace(m.GetConversation()); txt != "" {
		return txt, "chat", "", nil
	}
	if ext := m.GetExtendedTextMessage(); ext != nil {
		t := strings.TrimSpace(ext.GetText())
		if t != "" {
			return t, "chat", "", nil
		}
	}
	if br := m.GetButtonsResponseMessage(); br != nil {
		display := strings.TrimSpace(br.GetSelectedDisplayText())
		sel := strings.TrimSpace(br.GetSelectedButtonID())
		if display == "" {
			display = sel
		}
		return display, "buttons_response", sel, nil
	}
	if lr := m.GetListResponseMessage(); lr != nil {
		row := ""
		if lr.GetSingleSelectReply() != nil {
			row = strings.TrimSpace(lr.GetSingleSelectReply().GetSelectedRowID())
		}
		title := strings.TrimSpace(lr.GetTitle())
		msg := title
		if msg == "" {
			msg = row
		}
		return msg, "list_response", row, map[string]any{
			"title":       title,
			"description": strings.TrimSpace(lr.GetDescription()),
		}
	}
	if tb := m.GetTemplateButtonReplyMessage(); tb != nil {
		display := strings.TrimSpace(tb.GetSelectedDisplayText())
		sel := strings.TrimSpace(tb.GetSelectedID())
		if display == "" {
			display = sel
		}
		return display, "template_button_reply", sel, nil
	}
	if loc := m.GetLocationMessage(); loc != nil {
		raw := map[string]any{
			"degreesLatitude":  loc.GetDegreesLatitude(),
			"degreesLongitude": loc.GetDegreesLongitude(),
			"name":             strings.TrimSpace(loc.GetName()),
			"address":          strings.TrimSpace(loc.GetAddress()),
		}
		return "", "location", "", raw
	}
	return "", "", "", nil
}

func isSummaryTrigger(message string, selectedId string) bool {
	text := strings.ToLower(strings.TrimSpace(message))
	sel := strings.ToLower(strings.TrimSpace(selectedId))
	if sel == "wapix_resumo_hoje" || sel == "wapix_summary_today" {
		return true
	}
	if text == "resumo" || text == "*resumo" || text == "/resumo" || text == "!resumo" {
		return true
	}
	if text == "resumo hoje" || text == "*resumo hoje" || text == "/resumo hoje" || text == "!resumo hoje" {
		return true
	}
	return false
}

func toLocalDateStringFromUnix(ts int64) string {
	t := time.Unix(ts, 0)
	local := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
	return local.Format("2006-01-02")
}

func pickSummaryText(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case map[string]any:
		if s, ok := t["summary"].(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func extractMessageFields(m *waE2E.Message) (msgType string, body string, caption string, isMedia bool, mimeType string) {
	if m == nil {
		return "unknown", "", "", false, ""
	}
	if txt := strings.TrimSpace(m.GetConversation()); txt != "" {
		return "chat", txt, "", false, ""
	}
	if ext := m.GetExtendedTextMessage(); ext != nil {
		return "chat", strings.TrimSpace(ext.GetText()), "", false, ""
	}
	if img := m.GetImageMessage(); img != nil {
		return "image", "", strings.TrimSpace(img.GetCaption()), true, strings.TrimSpace(img.GetMimetype())
	}
	if vid := m.GetVideoMessage(); vid != nil {
		return "video", "", strings.TrimSpace(vid.GetCaption()), true, strings.TrimSpace(vid.GetMimetype())
	}
	if aud := m.GetAudioMessage(); aud != nil {
		return "audio", "", "", true, strings.TrimSpace(aud.GetMimetype())
	}
	if doc := m.GetDocumentMessage(); doc != nil {
		return "document", "", strings.TrimSpace(doc.GetCaption()), true, strings.TrimSpace(doc.GetMimetype())
	}
	return "unknown", "", "", false, ""
}

type groupFetchReq struct {
	GroupID     string `json:"group_id"`
	MessageDate string `json:"message_date"`
	MaxMessages int    `json:"max_messages"`
}

func (a *app) handleGroupFetchMessages(w http.ResponseWriter, r *http.Request) {
	if a.msgDB == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req groupFetchReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	groupID := strings.TrimSpace(req.GroupID)
	if groupID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "group_id obrigatório"})
		return
	}
	max := req.MaxMessages
	if max <= 0 {
		max = 100
	}
	if max > 5000 {
		max = 5000
	}

	hasDate := strings.TrimSpace(req.MessageDate) != ""
	startTs := int64(0)
	endTs := int64(9_999_999_999)
	date := ""
	if hasDate {
		t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(req.MessageDate), time.Local)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_date"})
			return
		}
		start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
		end := start.Add(24 * time.Hour)
		date = start.Format("2006-01-02")
		startTs = start.Unix()
		endTs = end.Unix()
	}

	out, oldestTs, err := a.loadGroupMessages(groupID, hasDate, startTs, endTs, max)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "query_failed"})
		return
	}
	iterations := 0
	totalInRange := len(out)
	if a.shouldBackfillGroupHistory(hasDate, startTs, len(out), oldestTs, max) {
		iterations = a.backfillGroupHistory(groupID, hasDate, startTs, max)
		out, oldestTs, err = a.loadGroupMessages(groupID, hasDate, startTs, endTs, max)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "query_failed"})
			return
		}
		totalInRange = len(out)
		if !hasDate && oldestTs > 0 {
			totalInRange = len(out)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"st":       1,
		"messages": out,
		"meta": map[string]any{
			"message_date":   date,
			"total_scanned":  len(out),
			"total_in_range": totalInRange,
			"iterations":     iterations,
		},
	})
}

type groupMessageRow struct {
	ID        string
	Timestamp int64
	Author    sql.NullString
	IsFromMe  sql.NullInt64
	Type      sql.NullString
	Body      sql.NullString
	Caption   sql.NullString
	IsMedia   sql.NullInt64
	Mimetype  sql.NullString
}

func (a *app) loadGroupMessages(groupID string, hasDate bool, startTs, endTs int64, max int) ([]map[string]any, int64, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if hasDate {
		rows, err = a.msgDB.Query(
			`SELECT id, timestamp, author, is_from_me, type, body, caption, is_media, mimetype
			 FROM group_messages
			 WHERE group_id = ? AND timestamp >= ? AND timestamp < ?
			 ORDER BY timestamp ASC
			 LIMIT ?`,
			groupID, startTs, endTs, max,
		)
	} else {
		rows, err = a.msgDB.Query(
			`SELECT id, timestamp, author, is_from_me, type, body, caption, is_media, mimetype
			 FROM group_messages
			 WHERE group_id = ?
			 ORDER BY timestamp DESC
			 LIMIT ?`,
			groupID, max,
		)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]map[string]any, 0, max)
	oldestTs := int64(0)
	for rows.Next() {
		var r groupMessageRow
		if err := rows.Scan(&r.ID, &r.Timestamp, &r.Author, &r.IsFromMe, &r.Type, &r.Body, &r.Caption, &r.IsMedia, &r.Mimetype); err != nil {
			continue
		}
		if oldestTs == 0 || r.Timestamp < oldestTs {
			oldestTs = r.Timestamp
		}
		out = append(out, map[string]any{
			"id":        r.ID,
			"timestamp": r.Timestamp,
			"from":      groupID,
			"author":    nullString(r.Author),
			"type":      nullString(r.Type),
			"body":      nullString(r.Body),
			"caption":   nullString(r.Caption),
			"isMedia":   r.IsMedia.Valid && r.IsMedia.Int64 != 0,
			"mimetype":  nullString(r.Mimetype),
		})
	}
	if !hasDate {
		for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
			out[i], out[j] = out[j], out[i]
		}
	}
	return out, oldestTs, nil
}

func (a *app) shouldBackfillGroupHistory(hasDate bool, startTs int64, currentCount int, oldestTs int64, max int) bool {
	if a.client == nil || !a.client.IsConnected() || !a.client.IsLoggedIn() {
		return false
	}
	if currentCount == 0 {
		return true
	}
	if !hasDate {
		return currentCount < max
	}
	if currentCount < max {
		return true
	}
	return oldestTs > 0 && oldestTs > startTs
}

type groupHistoryAnchor struct {
	ID       string
	GroupID  string
	Author   string
	IsFromMe bool
	Time     time.Time
}

func (a *app) getOldestGroupAnchor(groupID string) (*groupHistoryAnchor, error) {
	if a.msgDB == nil {
		return nil, nil
	}
	row := a.msgDB.QueryRow(
		`SELECT id, group_id, author, is_from_me, timestamp
		 FROM group_messages
		 WHERE group_id = ?
		 ORDER BY timestamp ASC
		 LIMIT 1`,
		groupID,
	)
	var (
		id       string
		groupVal string
		author   sql.NullString
		isFromMe sql.NullInt64
		ts       int64
	)
	if err := row.Scan(&id, &groupVal, &author, &isFromMe, &ts); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &groupHistoryAnchor{
		ID:       id,
		GroupID:  groupVal,
		Author:   nullStringToString(author),
		IsFromMe: isFromMe.Valid && isFromMe.Int64 != 0,
		Time:     time.Unix(ts, 0),
	}, nil
}

func (a *app) requestGroupHistoryOnDemand(groupID string, count int) (bool, error) {
	anchor, err := a.getOldestGroupAnchor(groupID)
	if err != nil {
		return false, err
	}
	if anchor == nil || anchor.ID == "" {
		return false, nil
	}
	groupJID, err := parseGroup(anchor.GroupID)
	if err != nil {
		return false, err
	}
	var senderJID types.JID
	if anchor.IsFromMe {
		if a.client.Store.ID == nil {
			return false, fmt.Errorf("not_logged_in")
		}
		senderJID = a.client.Store.ID.ToNonAD()
	} else {
		senderJID, err = parseRecipient(anchor.Author)
		if err != nil {
			return false, err
		}
	}
	info := &types.MessageInfo{
		MessageSource: types.MessageSource{
			Chat:     groupJID,
			Sender:   senderJID,
			IsFromMe: anchor.IsFromMe,
			IsGroup:  true,
		},
		ID:        types.MessageID(anchor.ID),
		Timestamp: anchor.Time,
	}
	req := a.client.BuildHistorySyncRequest(info, count)
	_, err = a.client.SendPeerMessage(context.Background(), req)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (a *app) backfillGroupHistory(groupID string, hasDate bool, startTs int64, max int) int {
	chunkSize := max
	if chunkSize > 50 {
		chunkSize = 50
	}
	if chunkSize <= 0 {
		chunkSize = 50
	}
	iterations := 0
	for iterations < 4 {
		beforeCount, beforeOldest, err := a.getGroupMessageStats(groupID, hasDate, startTs)
		if err != nil {
			break
		}
		requested, err := a.requestGroupHistoryOnDemand(groupID, chunkSize)
		if err != nil || !requested {
			break
		}
		iterations++
		changed := a.waitForGroupHistory(groupID, beforeCount, beforeOldest, 10*time.Second)
		if !changed {
			break
		}
		afterCount, afterOldest, err := a.getGroupMessageStats(groupID, hasDate, startTs)
		if err != nil {
			break
		}
		if !hasDate && afterCount >= max {
			break
		}
		if hasDate && afterOldest > 0 && afterOldest <= startTs {
			break
		}
		if afterCount == beforeCount && afterOldest == beforeOldest {
			break
		}
	}
	return iterations
}

func (a *app) getGroupMessageStats(groupID string, hasDate bool, startTs int64) (int, int64, error) {
	if a.msgDB == nil {
		return 0, 0, nil
	}
	query := `SELECT COUNT(1), COALESCE(MIN(timestamp), 0) FROM group_messages WHERE group_id = ?`
	args := []any{groupID}
	if hasDate {
		query += ` AND timestamp >= ?`
		args = append(args, startTs)
	}
	row := a.msgDB.QueryRow(query, args...)
	var count int
	var minTs int64
	if err := row.Scan(&count, &minTs); err != nil {
		return 0, 0, err
	}
	return count, minTs, nil
}

func (a *app) waitForGroupHistory(groupID string, beforeCount int, beforeOldest int64, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		time.Sleep(500 * time.Millisecond)
		count, oldest, err := a.getGroupMessageStats(groupID, false, 0)
		if err != nil {
			return false
		}
		if count > beforeCount {
			return true
		}
		if oldest > 0 && (beforeOldest == 0 || oldest < beforeOldest) {
			return true
		}
	}
	return false
}

func nullString(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}

func nullStringToString(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}

func (a *app) handleGroupAccessGroup(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req groupLinkReq
	_ = json.NewDecoder(r.Body).Decode(&req)
	code := strings.TrimSpace(req.Link)
	if code == "" {
		code = "BIEhiAU9Cou43b5Eb3gjgn"
	}
	code = strings.TrimPrefix(code, whatsmeow.InviteLinkPrefix)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	jid, err := a.client.JoinGroupWithLink(ctx, code)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "join_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"st": 1, "result": jid.String()})
}

type groupCreateReq struct {
	Fone  string `json:"fone"`
	Name  string `json:"name"`
	BotID string `json:"bot_id"`
}

func (a *app) handleGroupCreate(w http.ResponseWriter, r *http.Request) {
	if a.client == nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "not_ready"})
		return
	}
	var req groupCreateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "invalid_json"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"st": 0, "error": "name obrigatório"})
		return
	}
	participants := make([]types.JID, 0, 1)
	if strings.TrimSpace(req.Fone) != "" {
		jid, err := parseRecipient(req.Fone)
		if err == nil {
			participants = append(participants, jid)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	info, err := a.client.CreateGroup(ctx, whatsmeow.ReqCreateGroup{
		Name:         name,
		Participants: participants,
	})
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"st": 0, "error": "create_failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"st": 1,
		"result": map[string]any{
			"user":        info.JID.User,
			"_serialized": info.JID.String(),
		},
	})
}

func parseVenomButtons(raw []any) []*waE2E.ButtonsMessage_Button {
	if len(raw) == 0 {
		return nil
	}
	out := make([]*waE2E.ButtonsMessage_Button, 0, len(raw))
	for i, it := range raw {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		btnID := strings.TrimSpace(anyString(m["buttonId"]))
		if btnID == "" {
			btnID = fmt.Sprintf("btn_%d", i+1)
		}
		displayText := ""
		if bt, ok := m["buttonText"].(map[string]any); ok {
			displayText = strings.TrimSpace(anyString(bt["displayText"]))
		}
		if displayText == "" {
			displayText = fmt.Sprintf("Opção %d", i+1)
		}
		out = append(out, &waE2E.ButtonsMessage_Button{
			ButtonID: proto.String(btnID),
			ButtonText: &waE2E.ButtonsMessage_Button_ButtonText{
				DisplayText: proto.String(displayText),
			},
			Type: waE2E.ButtonsMessage_Button_RESPONSE.Enum(),
		})
	}
	return out
}

func parseVenomListSections(raw []any) []*waE2E.ListMessage_Section {
	if len(raw) == 0 {
		return nil
	}
	sections := make([]*waE2E.ListMessage_Section, 0, len(raw))
	for _, it := range raw {
		sm, ok := it.(map[string]any)
		if !ok {
			continue
		}
		title := strings.TrimSpace(anyString(sm["title"]))
		rowsAny, _ := sm["rows"].([]any)
		rows := make([]*waE2E.ListMessage_Row, 0, len(rowsAny))
		for _, rit := range rowsAny {
			rm, ok := rit.(map[string]any)
			if !ok {
				continue
			}
			rowTitle := strings.TrimSpace(anyString(rm["title"]))
			rowDesc := strings.TrimSpace(anyString(rm["description"]))
			rowID := strings.TrimSpace(anyString(rm["rowId"]))
			if rowID == "" {
				rowID = strings.TrimSpace(anyString(rm["rowID"]))
			}
			if rowTitle == "" || rowID == "" {
				continue
			}
			rows = append(rows, &waE2E.ListMessage_Row{
				Title:       proto.String(rowTitle),
				Description: proto.String(rowDesc),
				RowID:       proto.String(rowID),
			})
		}
		if len(rows) == 0 {
			continue
		}
		sections = append(sections, &waE2E.ListMessage_Section{
			Title: proto.String(title),
			Rows:  rows,
		})
	}
	return sections
}

func anyString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case fmt.Stringer:
		return t.String()
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

func (a *app) handleCheckDB(w http.ResponseWriter, r *http.Request) {
	if a.msgDB == nil {
		writeJSON(w, http.StatusOK, map[string]any{"message": nil, "error": false, "status": true})
		return
	}
	id := "5588998002111"
	_, _ = a.msgDB.Exec(`INSERT OR IGNORE INTO numbers (id, created_at) VALUES (?, ?)`, id, time.Now().Unix())
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "ok",
		"error":   false,
		"status":  true,
	})
}

func (a *app) handleCheckDBByID(w http.ResponseWriter, r *http.Request) {
	if a.msgDB == nil {
		writeJSON(w, http.StatusOK, map[string]any{"message": nil, "error": false, "status": true})
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/checkdb/")
	id = strings.TrimSpace(id)
	rows, err := a.msgDB.Query(`SELECT id, created_at FROM numbers WHERE id = ?`, id)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"message": nil, "error": false, "status": true})
		return
	}
	defer rows.Close()
	out := make([]map[string]any, 0, 1)
	for rows.Next() {
		var nid string
		var created int64
		if err := rows.Scan(&nid, &created); err != nil {
			continue
		}
		out = append(out, map[string]any{"id": nid, "created_at": created})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message": out,
		"error":   false,
		"status":  true,
	})
}

func (a *app) postJSON(url string, payload any) error {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	return nil
}

func (a *app) postJSONWithResponse(url string, payload any, out any) error {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (a *app) initS3() {
	bucket := strings.TrimSpace(os.Getenv("AWS_BUCKET_NAME"))
	accessKey := strings.TrimSpace(os.Getenv("AWS_ACCESS_KEY_ID"))
	secretKey := strings.TrimSpace(os.Getenv("AWS_SECRET_ACCESS_KEY"))
	endpoint := strings.TrimSpace(os.Getenv("AWS_ENDPOINT"))
	region := strings.TrimSpace(os.Getenv("AWS_DEFAULT_REGION"))
	if region == "" {
		region = "us-east-1"
	}

	if bucket == "" || accessKey == "" || secretKey == "" {
		return
	}

	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		if service == s3.ServiceID && endpoint != "" {
			return aws.Endpoint{
				URL:               endpoint,
				HostnameImmutable: true,
				SigningRegion:     region,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		awsconfig.WithEndpointResolverWithOptions(resolver),
	)
	if err != nil {
		return
	}

	a.s3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})
	a.s3Bucket = bucket
	a.s3Endpoint = endpoint
	a.s3Region = region
}

func (a *app) uploadToS3(ctx context.Context, filial string, mimeType string, data []byte) (string, error) {
	if a.s3Client == nil || a.s3Bucket == "" || len(data) == 0 {
		return "", fmt.Errorf("s3_not_configured")
	}
	if filial == "" || filial == "undefined" || filial == "null" {
		filial = "default"
	}

	ext := ""
	if mimeType != "" {
		if exts, _ := mime.ExtensionsByType(mimeType); len(exts) > 0 {
			ext = exts[0]
		}
	}
	if ext == "" {
		ext = ".bin"
	}

	key := fmt.Sprintf("images/%s/%s%s", filial, randomHex(16), ext)

	_, err := a.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(a.s3Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(mimeType),
		ACL:         s3types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		_, err2 := a.s3Client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(a.s3Bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(data),
			ContentType: aws.String(mimeType),
		})
		if err2 != nil {
			return "", err
		}
	}

	if a.s3Endpoint != "" {
		base := strings.TrimRight(a.s3Endpoint, "/")
		return base + "/" + a.s3Bucket + "/" + key, nil
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", a.s3Bucket, a.s3Region, key), nil
}

func randomHex(n int) string {
	if n <= 0 {
		n = 16
	}
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		now := time.Now().UnixNano()
		return hex.EncodeToString([]byte(fmt.Sprintf("%d", now)))
	}
	return hex.EncodeToString(b)
}

func detectIP(ifaceName string) string {
	if ifaceName != "" {
		iface, err := net.InterfaceByName(ifaceName)
		if err == nil {
			addrs, _ := iface.Addrs()
			for _, a := range addrs {
				ip := addrToIP(a)
				if ip != "" {
					return ip
				}
			}
		}
	}
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		for _, a := range addrs {
			ip := addrToIP(a)
			if ip != "" {
				return ip
			}
		}
	}
	return "0"
}

func addrToIP(a net.Addr) string {
	switch v := a.(type) {
	case *net.IPNet:
		ip := v.IP.To4()
		if ip == nil {
			return ""
		}
		if ip.IsLoopback() {
			return ""
		}
		return ip.String()
	case *net.IPAddr:
		ip := v.IP.To4()
		if ip == nil {
			return ""
		}
		if ip.IsLoopback() {
			return ""
		}
		return ip.String()
	default:
		return ""
	}
}

func strconvAtoi(s string) (int, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return n, true
}
