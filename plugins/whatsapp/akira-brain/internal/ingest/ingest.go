package ingest

import (
	"strings"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/akira/akira-brain/internal/store"
)

// Store is the subset of store.Store that the ingestion pipeline needs. Kept as an
// interface so ingest logic can be unit tested without a real SQLite file.
type Store interface {
	ProjectLookup
	UpsertContact(jid, displayName string, isGroup bool) error
	InsertMessage(m store.Message) error
	MaxInboxMessages() (int, error)
	TrimInbox(chatJID string, max int) error
}

// PersistIncoming classifies and stores a live incoming message (DM or group,
// text or media). Media bytes themselves are handled separately (Fase 2); here we
// only record metadata plus, for audio in a mapped project, note that a media path
// is still pending.
func PersistIncoming(s Store, e *events.Message) error {
	return PersistIncomingNamed(s, e, "")
}

// PersistIncomingNamed is like PersistIncoming but accepts a pre-resolved chat display name
// (ex.: nome do grupo via GetGroupInfo ou contato do cache whatsmeow).
func PersistIncomingNamed(s Store, e *events.Message, chatDisplayName string) error {
	if s == nil || e == nil || e.Info.ID == "" {
		return nil
	}
	chatJID := e.Info.Chat.String()
	isGroup := strings.HasSuffix(chatJID, "@g.us")

	displayName := strings.TrimSpace(chatDisplayName)
	if displayName == "" {
		displayName = DisplayNameFromMessage(e, chatJID, isGroup)
	}

	if err := s.UpsertContact(chatJID, displayName, isGroup); err != nil {
		return err
	}

	projectID, class, err := Classify(s, chatJID)
	if err != nil {
		return err
	}

	msgType, body, caption, isMedia, mimeType := extractMessageFields(e.Message)

	// Don't bother downloading/keeping media metadata for unmapped chats beyond
	// what's needed to show a text preview in the inbox.
	if class == ClassInbox && isMedia && msgType != "chat" {
		body = ""
		caption = ""
	}

	msg := store.Message{
		ID:             string(e.Info.ID),
		ChatJID:        chatJID,
		ProjectID:      projectID,
		SenderJID:      e.Info.Sender.String(),
		IsFromMe:       e.Info.IsFromMe,
		Timestamp:      e.Info.Timestamp.Unix(),
		Type:           msgType,
		Body:           body,
		Caption:        caption,
		IsMedia:        isMedia,
		Mimetype:       mimeType,
		RetentionClass: string(class),
	}
	if err := s.InsertMessage(msg); err != nil {
		return err
	}

	if class == ClassInbox {
		return trimInbox(s, chatJID)
	}
	return nil
}

// PersistHistorySync stores messages delivered via WhatsApp's history sync (both the
// passive dump on first login and, later, on-demand backfill responses), applying the
// same project/inbox classification as live messages.
func PersistHistorySync(s Store, data *waHistorySync.HistorySync) error {
	if s == nil || data == nil {
		return nil
	}
	for _, conv := range data.GetConversations() {
		if conv == nil {
			continue
		}
		chatJID := strings.TrimSpace(conv.GetID())
		if chatJID == "" {
			continue
		}
		isGroup := strings.HasSuffix(chatJID, "@g.us")
		displayName := DisplayNameFromHistory(conv.GetName(), conv.GetDisplayName())
		if displayName == "" && !isGroup {
			displayName = JIDLocalPart(chatJID)
		}
		if err := s.UpsertContact(chatJID, displayName, isGroup); err != nil {
			return err
		}
		for _, item := range conv.GetMessages() {
			if item == nil {
				continue
			}
			if err := persistHistoryMessage(s, chatJID, item.GetMessage()); err != nil {
				return err
			}
		}
	}
	return nil
}

func persistHistoryMessage(s Store, chatJID string, webMsg *waWeb.WebMessageInfo) error {
	if webMsg == nil {
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
	sender := strings.TrimSpace(webMsg.GetParticipant())
	if sender == "" {
		sender = strings.TrimSpace(key.GetParticipant())
	}

	projectID, class, err := Classify(s, chatJID)
	if err != nil {
		return err
	}

	msgType, body, caption, isMedia, mimeType := extractMessageFields(webMsg.GetMessage())
	if class == ClassInbox && isMedia && msgType != "chat" {
		body = ""
		caption = ""
	}

	msg := store.Message{
		ID:             messageID,
		ChatJID:        chatJID,
		ProjectID:      projectID,
		SenderJID:      sender,
		IsFromMe:       key.GetFromMe(),
		Timestamp:      ts,
		Type:           msgType,
		Body:           body,
		Caption:        caption,
		IsMedia:        isMedia,
		Mimetype:       mimeType,
		RetentionClass: string(class),
	}
	if err := s.InsertMessage(msg); err != nil {
		return err
	}
	if class == ClassInbox {
		return trimInbox(s, chatJID)
	}
	return nil
}

func trimInbox(s Store, chatJID string) error {
	max, err := s.MaxInboxMessages()
	if err != nil {
		return err
	}
	return s.TrimInbox(chatJID, max)
}

// extractMessageFields mirrors the field extraction used by the sibling whatsmeow-api
// project (whatsmeow-api/main.go:extractMessageFields) so both projects agree on how a
// waE2E.Message maps to (type, body, caption, isMedia, mimetype).
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
		return "audio", "[áudio]", "", true, strings.TrimSpace(aud.GetMimetype())
	}
	if doc := m.GetDocumentMessage(); doc != nil {
		return "document", "", strings.TrimSpace(doc.GetCaption()), true, strings.TrimSpace(doc.GetMimetype())
	}
	return "unknown", "", "", false, ""
}
