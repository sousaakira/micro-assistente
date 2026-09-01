package wa

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/types"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

// SendText envia mensagem de texto para telefone ou JID.
func (c *Client) SendText(ctx context.Context, to, text string) (any, error) {
	if c.wa == nil {
		return nil, fmt.Errorf("not_ready")
	}
	jid, err := parseRecipient(to)
	if err != nil {
		return nil, fmt.Errorf("invalid_recipient")
	}
	msg := &waE2E.Message{Conversation: proto.String(text)}
	resp, err := c.wa.SendMessage(ctx, jid, msg)
	if err != nil {
		return nil, fmt.Errorf("send_failed: %w", err)
	}
	return resp, nil
}

// IsOnWhatsApp verifica se um número está registrado no WhatsApp.
func (c *Client) IsOnWhatsApp(ctx context.Context, phone string) (any, error) {
	if c.wa == nil {
		return nil, fmt.Errorf("not_ready")
	}
	e164 := extractE164(phone)
	if e164 == "" {
		return nil, fmt.Errorf("invalid_phone")
	}
	return c.wa.IsOnWhatsApp(ctx, []string{"+" + e164})
}

// ConnectionState resume o estado da conexão para APIs externas.
func (c *Client) ConnectionState() (connected bool, state string) {
	st := c.Status()
	if st.LoggedOut {
		return false, "logged_out"
	}
	if c.wa != nil && c.wa.IsLoggedIn() {
		return true, "connected"
	}
	if st.Connected {
		return true, "connected"
	}
	if st.QRStatus == "code" {
		return false, "awaiting_qr"
	}
	if st.QRStatus == "timeout" {
		return false, "qr_timeout"
	}
	if c.wa != nil && c.wa.Store.ID != nil && c.wa.IsConnected() {
		return false, "connecting"
	}
	return false, "connecting"
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

func withTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	return context.WithTimeout(parent, d)
}
