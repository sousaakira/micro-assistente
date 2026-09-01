package store_test

import (
	"path/filepath"
	"testing"

	"github.com/akira/akira-brain/internal/ingest"
	"github.com/akira/akira-brain/internal/store"
)

func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestMapContactAndClassify(t *testing.T) {
	s := openTestStore(t)

	id, err := s.CreateProject("ERP", "sistema ERP")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	const mapped = "5511999999999@s.whatsapp.net"
	const unmapped = "5511888888888@s.whatsapp.net"

	if err := s.MapContact(mapped, false, id); err != nil {
		t.Fatalf("MapContact: %v", err)
	}

	projectID, class, err := ingest.Classify(s, mapped)
	if err != nil {
		t.Fatalf("Classify(mapped): %v", err)
	}
	if class != ingest.ClassProject || projectID == nil || *projectID != id {
		t.Fatalf("expected mapped contact to classify as project %d, got class=%v projectID=%v", id, class, projectID)
	}

	projectID, class, err = ingest.Classify(s, unmapped)
	if err != nil {
		t.Fatalf("Classify(unmapped): %v", err)
	}
	if class != ingest.ClassInbox || projectID != nil {
		t.Fatalf("expected unmapped contact to classify as inbox, got class=%v projectID=%v", class, projectID)
	}
}

func TestTrimInboxKeepsOnlyMostRecent(t *testing.T) {
	s := openTestStore(t)
	const chat = "5511888888888@s.whatsapp.net"

	for i := range 10 {
		err := s.InsertMessage(store.Message{
			ID:             "msg-" + string(rune('a'+i)),
			ChatJID:        chat,
			SenderJID:      chat,
			Timestamp:      int64(i),
			Type:           "chat",
			Body:           "oi",
			RetentionClass: "inbox_preview",
		})
		if err != nil {
			t.Fatalf("InsertMessage: %v", err)
		}
	}

	if err := s.TrimInbox(chat, 3); err != nil {
		t.Fatalf("TrimInbox: %v", err)
	}

	msgs, err := s.ListMessagesByChat(chat, 100)
	if err != nil {
		t.Fatalf("ListMessagesByChat: %v", err)
	}
	if len(msgs) != 3 {
		t.Fatalf("expected 3 messages after trim, got %d", len(msgs))
	}
	// most recent (highest timestamp) messages should survive
	for _, m := range msgs {
		if m.Timestamp < 7 {
			t.Fatalf("expected only the 3 most recent messages (ts>=7) to survive, found ts=%d", m.Timestamp)
		}
	}
}

func TestMapContactPromotesExistingInboxMessages(t *testing.T) {
	s := openTestStore(t)
	id, err := s.CreateProject("ERP", "")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	const chat = "5511999990001@s.whatsapp.net"
	if err := s.InsertMessage(store.Message{
		ID: "m1", ChatJID: chat, SenderJID: chat, Timestamp: 1,
		Type: "chat", Body: "oi", RetentionClass: "inbox_preview",
	}); err != nil {
		t.Fatalf("InsertMessage: %v", err)
	}

	if err := s.MapContact(chat, false, id); err != nil {
		t.Fatalf("MapContact: %v", err)
	}

	inbox, err := s.ListInboxContacts()
	if err != nil {
		t.Fatalf("ListInboxContacts: %v", err)
	}
	for _, jid := range inbox {
		if jid == chat {
			t.Fatalf("expected %s to leave the inbox after mapping", chat)
		}
	}

	msgs, err := s.ListMessagesByProject(id, 10)
	if err != nil {
		t.Fatalf("ListMessagesByProject: %v", err)
	}
	if len(msgs) != 1 || msgs[0].ID != "m1" {
		t.Fatalf("expected the previously-inbox message to be promoted to the project, got %+v", msgs)
	}
}

func TestMapContactBothIndividualAndGroup(t *testing.T) {
	s := openTestStore(t)
	id, err := s.CreateProject("ERP", "")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	const dm = "5511999999999@s.whatsapp.net"
	const group = "120363012345678901@g.us"

	if err := s.MapContact(dm, false, id); err != nil {
		t.Fatalf("MapContact(dm): %v", err)
	}
	if err := s.MapContact(group, true, id); err != nil {
		t.Fatalf("MapContact(group): %v", err)
	}

	for _, jid := range []string{dm, group} {
		_, ok, err := s.ProjectForContact(jid)
		if err != nil {
			t.Fatalf("ProjectForContact(%s): %v", jid, err)
		}
		if !ok {
			t.Fatalf("expected %s to be mapped to a project", jid)
		}
	}
}
