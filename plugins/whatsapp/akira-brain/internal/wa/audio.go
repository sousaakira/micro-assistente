package wa

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/types/events"

	"github.com/akira/akira-brain/internal/transcribe"
)

func (c *Client) maybeTranscribeAudio(e *events.Message) {
	if c == nil || c.wa == nil || c.store == nil || e == nil || e.Message == nil {
		return
	}
	audio := e.Message.GetAudioMessage()
	if audio == nil {
		return
	}
	if !transcribe.IsEnabled() {
		return
	}

	go func() {
		timeout := 3 * time.Minute
		if raw := strings.TrimSpace(os.Getenv("WHISPER_TIMEOUT_MS")); raw != "" {
			if ms, err := strconv.Atoi(raw); err == nil && ms > 0 {
				timeout = time.Duration(ms) * time.Millisecond
			}
		}
		ctx, cancel := context.WithTimeout(context.Background(), timeout+30*time.Second)
		defer cancel()

		data, err := c.wa.Download(ctx, audio)
		if err != nil {
			fmt.Println("Erro ao baixar áudio:", err)
			return
		}

		text, err := transcribe.TranscribeAudio(ctx, data, audio.GetMimetype())
		if err != nil {
			fmt.Println("Erro ao transcrever áudio:", err)
			return
		}
		if text == "" {
			return
		}

		transcript := "[áudio] " + text
		if err := c.store.UpdateMessageBody(string(e.Info.ID), transcript); err != nil {
			fmt.Println("Erro ao salvar transcrição:", err)
		}
	}()
}
