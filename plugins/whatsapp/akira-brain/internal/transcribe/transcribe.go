package transcribe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// TranscribeAudio sends audio bytes to a Whisper-compatible API and returns text.
// Configure via WHISPER_URL (OpenAI /v1/audio/transcriptions) or Ollama-style endpoint.
func TranscribeAudio(ctx context.Context, audio []byte, mimeType string) (string, error) {
	url := strings.TrimSpace(os.Getenv("WHISPER_URL"))
	if url == "" {
		url = strings.TrimSpace(os.Getenv("LLM_BASE_URL"))
		if url != "" {
			url = strings.TrimRight(url, "/") + "/v1/audio/transcriptions"
		}
	}
	if url == "" {
		return "", fmt.Errorf("WHISPER_URL não configurado")
	}

	body := &bytes.Buffer{}
	boundary := "akira-audio-boundary"
	body.WriteString("--" + boundary + "\r\n")
	body.WriteString(`Content-Disposition: form-data; name="file"; filename="audio.ogg"` + "\r\n")
	if mimeType == "" {
		mimeType = "audio/ogg"
	}
	body.WriteString("Content-Type: " + mimeType + "\r\n\r\n")
	body.Write(audio)
	body.WriteString("\r\n--" + boundary + "\r\n")
	body.WriteString(`Content-Disposition: form-data; name="model"` + "\r\n\r\n")
	model := strings.TrimSpace(os.Getenv("WHISPER_MODEL"))
	if model == "" {
		model = "whisper-1"
	}
	body.WriteString(model + "\r\n")
	body.WriteString("--" + boundary + "--\r\n")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+boundary)
	if key := strings.TrimSpace(os.Getenv("LLM_API_KEY")); key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	client := &http.Client{Timeout: 120 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("whisper HTTP %d: %s", res.StatusCode, string(raw[:min(len(raw), 200)]))
	}

	var parsed struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return strings.TrimSpace(string(raw)), nil
	}
	return strings.TrimSpace(parsed.Text), nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
