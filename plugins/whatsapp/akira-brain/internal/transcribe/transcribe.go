package transcribe

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// TranscribeAudio transcreve áudio localmente via CLI openai-whisper (mesmo fluxo do Financeiro).
// Requer ffmpeg no PATH. Configure WHISPER_BIN, WHISPER_MODEL, etc.
func TranscribeAudio(ctx context.Context, audio []byte, mimeType string) (string, error) {
	if !IsEnabled() {
		return "", fmt.Errorf("transcrição local desabilitada ou whisper não encontrado")
	}

	workDir, err := os.MkdirTemp("", "akira-whisper-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(workDir)

	ext := extensionForMime(mimeType)
	inputPath := filepath.Join(workDir, "input"+ext)
	if err := os.WriteFile(inputPath, audio, 0o644); err != nil {
		return "", err
	}

	timeout := timeoutFromEnv()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	wavPath, err := ensureWav(ctx, inputPath, workDir)
	if err != nil {
		return "", err
	}

	bin := envOr("WHISPER_BIN", "/home/akira/.local/bin/whisper")
	model := envOr("WHISPER_MODEL", "tiny")
	language := envOr("WHISPER_LANGUAGE", "Portuguese")
	device := envOr("WHISPER_DEVICE", "cpu")

	args := []string{
		wavPath,
		"--model", model,
		"--language", language,
		"--task", "transcribe",
		"--device", device,
		"--output_dir", workDir,
		"--output_format", "txt",
		"--verbose", "False",
		"--fp16", "False",
	}
	if modelDir := strings.TrimSpace(os.Getenv("WHISPER_MODEL_DIR")); modelDir != "" {
		args = append(args, "--model_dir", modelDir)
	}

	if err := runCommand(ctx, bin, args); err != nil {
		return "", err
	}

	baseName := strings.TrimSuffix(filepath.Base(wavPath), filepath.Ext(wavPath))
	outPath := filepath.Join(workDir, baseName+".txt")
	raw, err := os.ReadFile(outPath)
	if err != nil {
		return "", fmt.Errorf("whisper não gerou saída: %w", err)
	}

	text := strings.TrimSpace(string(raw))
	if text == "" {
		return "", fmt.Errorf("whisper retornou texto vazio")
	}
	return text, nil
}

// IsEnabled reports whether local whisper transcription should run.
func IsEnabled() bool {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("WHISPER_ENABLED")), "false") {
		return false
	}
	bin := envOr("WHISPER_BIN", "/home/akira/.local/bin/whisper")
	if filepath.IsAbs(bin) {
		if _, err := os.Stat(bin); err == nil {
			return true
		}
	}
	if _, err := exec.LookPath(bin); err == nil {
		return true
	}
	return false
}

func ensureWav(ctx context.Context, inputPath, workDir string) (string, error) {
	if strings.EqualFold(filepath.Ext(inputPath), ".wav") {
		return inputPath, nil
	}
	wavPath := filepath.Join(workDir, "audio.wav")
	if err := runCommand(ctx, "ffmpeg", []string{
		"-y", "-i", inputPath, "-ar", "16000", "-ac", "1", wavPath,
	}); err != nil {
		return "", fmt.Errorf("ffmpeg: %w", err)
	}
	return wavPath, nil
}

func runCommand(ctx context.Context, command string, args []string) error {
	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		tail := string(out)
		if len(tail) > 500 {
			tail = tail[len(tail)-500:]
		}
		return fmt.Errorf("%s %v: %s", command, err, tail)
	}
	return nil
}

func extensionForMime(mimeType string) string {
	mt := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.Contains(mt, "mpeg"), strings.Contains(mt, "mp3"):
		return ".mp3"
	case strings.Contains(mt, "wav"):
		return ".wav"
	case strings.Contains(mt, "mp4"), strings.Contains(mt, "m4a"):
		return ".m4a"
	default:
		return ".ogg"
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func timeoutFromEnv() time.Duration {
	ms := 180_000
	if raw := strings.TrimSpace(os.Getenv("WHISPER_TIMEOUT_MS")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			ms = n
		}
	}
	return time.Duration(ms) * time.Millisecond
}
