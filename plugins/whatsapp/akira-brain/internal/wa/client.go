// Package wa wires a single personal WhatsApp session (pairing, connection,
// event dispatch) using whatsmeow. It's adapted from the pairing/connection
// pattern in ../../whatsmeow-api/main.go, stripped of the multi-tenant bot
// concepts (BotID, HTTP forwarding, S3) that don't apply to a personal tool.
package wa

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	"github.com/akira/akira-brain/internal/ingest"
	"github.com/akira/akira-brain/internal/store"
)

type Client struct {
	wa           *whatsmeow.Client
	store        *store.Store
	sessionID    string
	sessionLabel string

	mu        sync.Mutex
	qrCode    string
	qrStatus  string // "", "code", "success", "timeout", "error"
	connected bool
	loggedOut bool

	pairingMu   sync.Mutex
	pairingDone chan struct{}
}

// Status is a point-in-time, thread-safe snapshot of the pairing/connection
// state, polled by the local API (GET /api/status) so the Neutralino UI can
// render the live QR code instead of the terminal-only ASCII version.
type Status struct {
	SessionID    string `json:"session_id"`
	SessionLabel string `json:"session_label"`
	Connected    bool   `json:"connected"`
	LoggedOut    bool   `json:"logged_out"`
	QRCode       string `json:"qr_code"`
	QRStatus     string `json:"qr_status"`
}

func (c *Client) Status() Status {
	c.mu.Lock()
	defer c.mu.Unlock()
	connected := c.connected
	if c.wa != nil && c.wa.IsLoggedIn() {
		connected = true
	}
	return Status{
		SessionID:    c.sessionID,
		SessionLabel: c.sessionLabel,
		Connected:    connected,
		LoggedOut:    c.loggedOut,
		QRCode:       c.qrCode,
		QRStatus:     c.qrStatus,
	}
}

func (c *Client) setQR(code, status string) {
	c.mu.Lock()
	c.qrCode = code
	c.qrStatus = status
	c.mu.Unlock()
}

func (c *Client) setConnected(v bool) {
	c.mu.Lock()
	c.connected = v
	c.mu.Unlock()
}

func (c *Client) setLoggedOut(v bool) {
	c.mu.Lock()
	c.loggedOut = v
	c.mu.Unlock()
}

// Connect opens (or creates) the local session in dataDir/session.db, pairs via a
// terminal QR code if needed, and starts dispatching incoming messages into s.
func Connect(ctx context.Context, dataDir string, s *store.Store, sessionID, sessionLabel string) (*Client, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}

	dbLog := waLog.Stdout("Database", "WARN", false)
	cliLog := waLog.Stdout("Client", "INFO", false)

	dbPath := filepath.Join(dataDir, "session.db")
	container, err := sqlstore.New(ctx, "sqlite3", "file:"+dbPath+"?_foreign_keys=on", dbLog)
	if err != nil {
		return nil, err
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, err
	}

	waClient := whatsmeow.NewClient(device, cliLog)
	c := &Client{
		wa:           waClient,
		store:        s,
		sessionID:    sessionID,
		sessionLabel: sessionLabel,
	}
	waClient.AddEventHandler(c.onEvent)

	if waClient.Store.ID != nil {
		fmt.Println("Sessão existente encontrada, reconectando...")
	}

	go c.runConnectLoop(ctx)

	return c, nil
}

func (c *Client) runConnectLoop(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}

		needsPairing := c.wa.Store.ID == nil

		if needsPairing {
			if err := c.beginPairingRound(ctx); err != nil {
				fmt.Println("Erro ao iniciar pareamento:", err)
				c.setQR("", "error")
				time.Sleep(10 * time.Second)
				continue
			}
		}

		if err := c.connectOnce(); err != nil {
			fmt.Println("Erro ao conectar:", err)
			if !c.wa.IsConnected() {
				c.setConnected(false)
			}
			time.Sleep(3 * time.Second)
			continue
		}

		if !needsPairing {
			return
		}

		c.waitPairingRound(ctx)

		if c.wa.Store.ID != nil {
			return
		}

		st := c.Status()
		if st.QRStatus == "timeout" {
			fmt.Println("Rodada de QR expirou; nova rodada em 15 segundos...")
			time.Sleep(15 * time.Second)
		} else if st.QRStatus == "error" {
			time.Sleep(10 * time.Second)
		}
	}
}

func (c *Client) connectOnce() error {
	if c.wa == nil {
		return fmt.Errorf("client not initialized")
	}
	if c.wa.IsConnected() {
		return nil
	}
	err := c.wa.Connect()
	if err == nil {
		return nil
	}
	if errors.Is(err, whatsmeow.ErrAlreadyConnected) {
		return nil
	}
	return err
}

func (c *Client) beginPairingRound(ctx context.Context) error {
	c.pairingMu.Lock()
	if c.pairingDone != nil {
		c.pairingMu.Unlock()
		return nil
	}
	c.pairingDone = make(chan struct{})
	c.pairingMu.Unlock()

	if c.wa.IsConnected() {
		c.wa.Disconnect()
		time.Sleep(1 * time.Second)
	}

	qrChan, err := c.wa.GetQRChannel(ctx)
	if err != nil {
		c.clearPairingDone()
		return err
	}
	go c.consumeQR(qrChan)
	return nil
}

func (c *Client) waitPairingRound(ctx context.Context) {
	c.pairingMu.Lock()
	done := c.pairingDone
	c.pairingMu.Unlock()
	if done == nil {
		return
	}
	select {
	case <-done:
	case <-ctx.Done():
	}
}

func (c *Client) clearPairingDone() {
	c.pairingMu.Lock()
	defer c.pairingMu.Unlock()
	if c.pairingDone != nil {
		close(c.pairingDone)
		c.pairingDone = nil
	}
}

func (c *Client) finishPairingRound() {
	c.pairingMu.Lock()
	defer c.pairingMu.Unlock()
	if c.pairingDone != nil {
		close(c.pairingDone)
		c.pairingDone = nil
	}
}

func (c *Client) Disconnect() {
	if c.wa != nil {
		c.wa.Disconnect()
	}
}

func (c *Client) consumeQR(ch <-chan whatsmeow.QRChannelItem) {
	defer c.finishPairingRound()

	for evt := range ch {
		switch evt.Event {
		case whatsmeow.QRChannelEventCode:
			c.setQR(evt.Code, "code")
			fmt.Printf("Novo QR code (válido por ~%ds). Escaneie no WhatsApp → Aparelhos conectados.\n", int(evt.Timeout.Seconds()))
			qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
		case whatsmeow.QRChannelEventError:
			c.setQR("", "error")
			fmt.Println("Erro ao gerar QR code:", evt.Error)
		case whatsmeow.QRChannelSuccess.Event:
			c.setQR("", "success")
			fmt.Println("Pareado com sucesso.")
		case whatsmeow.QRChannelTimeout.Event:
			c.setQR("", "timeout")
			fmt.Println("Rodada de QR expirou sem pareamento.")
		default:
			c.setQR("", "error")
			fmt.Println("Pareamento encerrado:", evt.Event)
		}
	}
}

func (c *Client) onEvent(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		c.setConnected(true)
		fmt.Println("Conectado ao WhatsApp.")
		go c.syncContactNames(context.Background())
	case *events.Disconnected:
		c.setConnected(false)
		fmt.Println("Desconectado do WhatsApp.")
	case *events.LoggedOut:
		c.setConnected(false)
		c.setLoggedOut(true)
		fmt.Println("Sessão deslogada no aparelho; será preciso parear de novo.")
	case *events.PairSuccess:
		c.setQR("", "success")
		fmt.Println("Pareamento concluído.")
	case *events.HistorySync:
		if e == nil {
			return
		}
		if err := ingest.PersistHistorySync(c.store, e.Data); err != nil {
			fmt.Println("Erro ao persistir history sync:", err)
		}
	case *events.Message:
		if e == nil {
			return
		}
		e.UnwrapRaw()
		displayName := c.resolveChatDisplayName(context.Background(), e)
		if err := ingest.PersistIncomingNamed(c.store, e, displayName); err != nil {
			fmt.Println("Erro ao persistir mensagem:", err)
		}
	case *events.PushName:
		if e != nil && strings.TrimSpace(e.NewPushName) != "" {
			_ = c.store.UpsertContact(e.JID.String(), strings.TrimSpace(e.NewPushName), false)
		}
	}
}

func (c *Client) resolveChatDisplayName(ctx context.Context, e *events.Message) string {
	if e == nil {
		return ""
	}
	chatJID := e.Info.Chat.String()
	isGroup := strings.HasSuffix(chatJID, "@g.us")

	if c.wa != nil && c.wa.Store.Contacts != nil {
		ctx2, cancel := context.WithTimeout(ctx, 4*time.Second)
		defer cancel()
		info, err := c.wa.Store.Contacts.GetContact(ctx2, e.Info.Chat)
		if err == nil {
			if name := ingest.BestContactName(info); name != "" {
				return name
			}
		}
	}

	if isGroup && c.wa != nil {
		ctx2, cancel := context.WithTimeout(ctx, 6*time.Second)
		defer cancel()
		gi, err := c.wa.GetGroupInfo(ctx2, e.Info.Chat)
		if err == nil && strings.TrimSpace(gi.Name) != "" {
			return strings.TrimSpace(gi.Name)
		}
	}

	return ingest.DisplayNameFromMessage(e, chatJID, isGroup)
}

func (c *Client) syncContactNames(ctx context.Context) {
	if c.wa == nil || c.wa.Store.Contacts == nil || c.store == nil {
		return
	}
	ctx2, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	contacts, err := c.wa.Store.Contacts.GetAllContacts(ctx2)
	if err != nil {
		fmt.Println("Erro ao sincronizar contatos:", err)
		return
	}

	for jid, info := range contacts {
		name := ingest.BestContactName(info)
		if name == "" {
			continue
		}
		isGroup := strings.HasSuffix(jid.String(), "@g.us")
		if err := c.store.UpsertContact(jid.String(), name, isGroup); err != nil {
			fmt.Println("Erro ao atualizar contato", jid, err)
		}
	}
}
