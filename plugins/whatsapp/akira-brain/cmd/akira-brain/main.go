// Command akira-brain is a personal tool that connects your own WhatsApp
// account(s), captures conversations from contacts/groups you explicitly map to a
// project, and keeps everything else in a capped inbox preview until you decide
// what to do with it. This is Fase 1: pairing, text ingestion, project/contact
// management. Audio transcription and semantic search come in later phases.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/akira/akira-brain/internal/api"
	"github.com/akira/akira-brain/internal/store"
	"github.com/akira/akira-brain/internal/wa"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	dataDir := os.Getenv("AKIRA_BRAIN_DATA")
	if dataDir == "" {
		dataDir = "data"
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		fatal(err)
	}

	s, err := store.Open(filepath.Join(dataDir, "akira-brain.db"))
	if err != nil {
		fatal(err)
	}
	defer s.Close()

	switch os.Args[1] {
	case "connect":
		cmdConnect(dataDir, s)
	case "serve":
		cmdServe(dataDir, s)
	case "project":
		cmdProject(s, os.Args[2:])
	case "map":
		cmdMap(s, os.Args[2:])
	case "inbox":
		cmdInbox(s, os.Args[2:])
	case "messages":
		cmdMessages(s, os.Args[2:])
	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Println(`akira-brain — segundo cérebro pessoal sobre WhatsApp

Uso:
  akira-brain connect                          conecta (pareia via QR se necessário) e fica escutando mensagens
  akira-brain serve                            igual a 'connect', e também sobe a API local (para a interface Neutralino)
  akira-brain project add <nome> [descrição]   cria um projeto
  akira-brain project list                     lista projetos
  akira-brain map <jid> <projeto>              associa um contato/grupo (JID) a um projeto
  akira-brain inbox list                       lista contatos não mapeados (inbox geral)
  akira-brain messages project <projeto> [N]   mostra as últimas N mensagens do projeto (padrão 50)
  akira-brain messages chat <jid> [N]          mostra as últimas N mensagens de um chat (mapeado ou inbox)`)
}

func cmdConnect(dataDir string, s *store.Store) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if _, err := wa.Connect(ctx, dataDir, s); err != nil {
		fatal(err)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	fmt.Println("Escutando mensagens. Ctrl+C para sair.")
	<-sig
}

// cmdServe runs the same WhatsApp connection as cmdConnect, plus a local-only
// HTTP API (used by the Neutralino UI in ../../ui) in the same process, so
// both share one SQLite connection instead of two processes racing on the
// same file.
func cmdServe(dataDir string, s *store.Store) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	waClient, err := wa.Connect(ctx, dataDir, s)
	if err != nil {
		fatal(err)
	}

	port := os.Getenv("AKIRA_BRAIN_API_PORT")
	if port == "" {
		port = "8765"
	}
	srv := api.New(s, waClient)
	go func() {
		fmt.Printf("API local em http://127.0.0.1:%s\n", port)
		if err := srv.ListenAndServe(port); err != nil {
			fmt.Println("Erro na API local:", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	fmt.Println("Escutando mensagens e servindo a API. Ctrl+C para sair.")
	<-sig
}

func cmdProject(s *store.Store, args []string) {
	if len(args) == 0 {
		usage()
		os.Exit(1)
	}
	switch args[0] {
	case "add":
		if len(args) < 2 {
			fmt.Println("uso: akira-brain project add <nome> [descrição]")
			os.Exit(1)
		}
		name := args[1]
		description := strings.Join(args[2:], " ")
		id, err := s.CreateProject(name, description)
		if err != nil {
			fatal(err)
		}
		fmt.Printf("Projeto %q criado (id=%d)\n", name, id)
	case "list":
		projects, err := s.ListProjects()
		if err != nil {
			fatal(err)
		}
		if len(projects) == 0 {
			fmt.Println("Nenhum projeto cadastrado ainda.")
			return
		}
		for _, p := range projects {
			fmt.Printf("%d\t%s\t%s\n", p.ID, p.Name, p.Description)
		}
	default:
		usage()
		os.Exit(1)
	}
}

func cmdMap(s *store.Store, args []string) {
	if len(args) < 2 {
		fmt.Println("uso: akira-brain map <jid> <projeto>")
		os.Exit(1)
	}
	jid := args[0]
	projectName := args[1]

	project, err := s.ProjectByName(projectName)
	if err != nil {
		fatal(err)
	}
	if project == nil {
		fmt.Printf("projeto %q não existe; crie com: akira-brain project add %s\n", projectName, projectName)
		os.Exit(1)
	}

	isGroup := strings.HasSuffix(jid, "@g.us")
	if err := s.MapContact(jid, isGroup, project.ID); err != nil {
		fatal(err)
	}
	fmt.Printf("%s mapeado para o projeto %q\n", jid, projectName)
}

func cmdInbox(s *store.Store, args []string) {
	if len(args) == 0 || args[0] != "list" {
		fmt.Println("uso: akira-brain inbox list")
		os.Exit(1)
	}
	contacts, err := s.ListInboxContacts()
	if err != nil {
		fatal(err)
	}
	if len(contacts) == 0 {
		fmt.Println("Inbox vazio.")
		return
	}
	for _, jid := range contacts {
		fmt.Println(jid)
	}
}

func cmdMessages(s *store.Store, args []string) {
	if len(args) < 2 {
		fmt.Println("uso: akira-brain messages project <projeto> [N] | akira-brain messages chat <jid> [N]")
		os.Exit(1)
	}
	limit := 50
	if len(args) >= 3 {
		if n, err := strconv.Atoi(args[2]); err == nil {
			limit = n
		}
	}

	var msgs []store.Message
	var err error
	switch args[0] {
	case "project":
		project, perr := s.ProjectByName(args[1])
		if perr != nil {
			fatal(perr)
		}
		if project == nil {
			fmt.Printf("projeto %q não existe\n", args[1])
			os.Exit(1)
		}
		msgs, err = s.ListMessagesByProject(project.ID, limit)
	case "chat":
		msgs, err = s.ListMessagesByChat(args[1], limit)
	default:
		usage()
		os.Exit(1)
	}
	if err != nil {
		fatal(err)
	}
	if len(msgs) == 0 {
		fmt.Println("Nenhuma mensagem encontrada.")
		return
	}
	for i := len(msgs) - 1; i >= 0; i-- {
		m := msgs[i]
		who := m.SenderJID
		if m.IsFromMe {
			who = "eu"
		}
		text := m.Body
		if text == "" {
			text = fmt.Sprintf("[%s]", m.Type)
		}
		fmt.Printf("%d\t%s\t%s\n", m.Timestamp, who, text)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "erro:", err)
	os.Exit(1)
}
