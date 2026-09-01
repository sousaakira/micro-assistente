package wa

import (
	"context"
	"fmt"
	"os"
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
	if strings.TrimSpace(os.Getenv("WHISPER_URL")) == "" && strings.TrimSpace(os.Getenv("LLM_BASE_URL")) == "" {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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
