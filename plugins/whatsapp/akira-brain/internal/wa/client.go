// Package wa wires a single personal WhatsApp session (pairing, connection,
// event dispatch) using whatsmeow. It's adapted from the pairing/connection
// pattern in ../../whatsmeow-api/main.go, stripped of the multi-tenant bot
// concepts (BotID, HTTP forwarding, S3) that don't apply to a personal tool.
package wa

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
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
	wa    *whatsmeow.Client
	store *store.Store

	mu        sync.Mutex
	qrCode    string
	qrStatus  string // "", "code", "success", "timeout", "error"
	connected bool
	loggedOut bool
}

// Status is a point-in-time, thread-safe snapshot of the pairing/connection
// state, polled by the local API (GET /api/status) so the Neutralino UI can
// render the live QR code instead of the terminal-only ASCII version.
type Status struct {
	Connected bool   `json:"connected"`
	LoggedOut bool   `json:"logged_out"`
	QRCode    string `json:"qr_code"`
	QRStatus  string `json:"qr_status"`
}

func (c *Client) Status() Status {
	c.mu.Lock()
	defer c.mu.Unlock()
	return Status{
		Connected: c.connected,
		LoggedOut: c.loggedOut,
		QRCode:    c.qrCode,
		QRStatus:  c.qrStatus,
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
func Connect(ctx context.Context, dataDir string, s *store.Store) (*Client, error) {
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
	c := &Client{wa: waClient, store: s}
	waClient.AddEventHandler(c.onEvent)

	if waClient.Store.ID == nil {
		qrChan, err := waClient.GetQRChannel(ctx)
		if err != nil {
			return nil, err
		}
		go c.consumeQR(qrChan)
	} else {
		fmt.Println("Sessão existente encontrada, reconectando...")
	}

	go func() {
		for {
			if err := waClient.Connect(); err != nil {
				fmt.Println("Erro ao conectar:", err)
				time.Sleep(3 * time.Second)
				continue
			}
			return
		}
	}()

	return c, nil
}

func (c *Client) Disconnect() {
	if c.wa != nil {
		c.wa.Disconnect()
	}
}

func (c *Client) consumeQR(ch <-chan whatsmeow.QRChannelItem) {
	for evt := range ch {
		switch evt.Event {
		case whatsmeow.QRChannelEventCode:
			c.setQR(evt.Code, "code")
			fmt.Println("Escaneie o QR code abaixo no WhatsApp (Aparelhos conectados) ou pela interface gráfica:")
			qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
		case whatsmeow.QRChannelEventError:
			c.setQR("", "error")
			fmt.Println("Erro ao gerar QR code:", evt.Error)
		case "success":
			c.setQR("", "success")
			fmt.Println("Pareado com sucesso.")
		case "timeout":
			c.setQR("", "timeout")
			fmt.Println("Tempo esgotado para escanear o QR code; rode 'akira-brain connect' de novo.")
		}
	}
}

func (c *Client) onEvent(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		c.setConnected(true)
		fmt.Println("Conectado ao WhatsApp.")
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
		if err := ingest.PersistIncoming(c.store, e); err != nil {
			fmt.Println("Erro ao persistir mensagem:", err)
		}
	}
}
