package store

import (
	"database/sql"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	db *sql.DB
}

type Project struct {
	ID          int64
	Name        string
	Description string
	CreatedAt   int64
}

type Message struct {
	ID              string
	ChatJID         string
	ProjectID       *int64
	SenderJID       string
	IsFromMe        bool
	Timestamp       int64
	Type            string
	Body            string
	Caption         string
	IsMedia         bool
	Mimetype        string
	MediaLocalPath  string
	RetentionClass  string
}

func Open(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", "file:"+dbPath+"?_foreign_keys=on&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) CreateProject(name, description string) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO projects (name, description, created_at) VALUES (?, ?, ?)`,
		name, description, time.Now().Unix(),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) ListProjects() ([]Project, error) {
	rows, err := s.db.Query(`SELECT id, name, description, created_at FROM projects ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ProjectByName(name string) (*Project, error) {
	row := s.db.QueryRow(`SELECT id, name, description, created_at FROM projects WHERE name = ?`, name)
	var p Project
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) ProjectByID(id int64) (*Project, error) {
	row := s.db.QueryRow(`SELECT id, name, description, created_at FROM projects WHERE id = ?`, id)
	var p Project
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) UpsertContact(jid, displayName string, isGroup bool) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(
		`INSERT INTO contacts (jid, display_name, is_group, first_seen_at, last_seen_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(jid) DO UPDATE SET
			display_name = CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE contacts.display_name END,
			last_seen_at = excluded.last_seen_at`,
		jid, displayName, boolToInt(isGroup), now, now,
	)
	return err
}

// MapContact associates a contact JID (individual number or group) with a project.
// Any messages already sitting in that chat's capped inbox preview are promoted to
// the project (retention_class + project_id updated) so nothing captured before the
// mapping is lost or left orphaned in the inbox view.
func (s *Store) MapContact(jid string, isGroup bool, projectID int64) error {
	if err := s.UpsertContact(jid, "", isGroup); err != nil {
		return err
	}
	_, err := s.db.Exec(
		`INSERT INTO contact_projects (contact_jid, project_id, mapped_at, backfill_status)
		 VALUES (?, ?, ?, 'none')
		 ON CONFLICT(contact_jid, project_id) DO NOTHING`,
		jid, projectID, time.Now().Unix(),
	)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		`UPDATE messages SET project_id = ?, retention_class = 'project'
		 WHERE chat_jid = ? AND retention_class = 'inbox_preview'`,
		projectID, jid,
	)
	return err
}

// ProjectForContact implements ingest.ProjectLookup: returns the mapped project for a
// chat JID, if any. A contact mapped to more than one project resolves to the most
// recently mapped one.
func (s *Store) ProjectForContact(chatJID string) (int64, bool, error) {
	row := s.db.QueryRow(
		`SELECT project_id FROM contact_projects WHERE contact_jid = ? ORDER BY mapped_at DESC LIMIT 1`,
		chatJID,
	)
	var projectID int64
	if err := row.Scan(&projectID); err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return projectID, true, nil
}

func (s *Store) MaxInboxMessages() (int, error) {
	row := s.db.QueryRow(`SELECT max_messages_per_contact FROM inbox_retention_config WHERE id = 1`)
	var max int
	if err := row.Scan(&max); err != nil {
		return 50, err
	}
	return max, nil
}

func (s *Store) InsertMessage(m Message) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO messages
			(id, chat_jid, project_id, sender_jid, is_from_me, timestamp, type, body, caption, is_media, mimetype, media_local_path, retention_class)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.ChatJID, m.ProjectID, m.SenderJID, boolToInt(m.IsFromMe), m.Timestamp,
		m.Type, m.Body, m.Caption, boolToInt(m.IsMedia), m.Mimetype, nullIfEmpty(m.MediaLocalPath), m.RetentionClass,
	)
	return err
}

// TrimInbox keeps only the most recent `max` inbox_preview messages for a chat.
func (s *Store) TrimInbox(chatJID string, max int) error {
	_, err := s.db.Exec(
		`DELETE FROM messages
		 WHERE chat_jid = ? AND retention_class = 'inbox_preview'
		   AND id NOT IN (
			SELECT id FROM messages
			WHERE chat_jid = ? AND retention_class = 'inbox_preview'
			ORDER BY timestamp DESC LIMIT ?
		   )`,
		chatJID, chatJID, max,
	)
	return err
}

// ListInboxContacts returns distinct chat JIDs currently sitting in the unmapped inbox,
// most recently active first.
func (s *Store) ListInboxContacts() ([]string, error) {
	rows, err := s.db.Query(
		`SELECT chat_jid FROM messages WHERE retention_class = 'inbox_preview'
		 GROUP BY chat_jid ORDER BY MAX(timestamp) DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var jid string
		if err := rows.Scan(&jid); err != nil {
			return nil, err
		}
		out = append(out, jid)
	}
	return out, rows.Err()
}

// InboxSummary is a per-chat rollup of an unmapped contact's inbox preview, used to
// let the user decide whether to promote it to a project.
type InboxSummary struct {
	ChatJID       string
	IsGroup       bool
	DisplayName   string
	MessageCount  int
	LastTimestamp int64
	LastPreview   string
}

// ListInboxSummaries returns one summary row per unmapped chat, most recently active
// first, including a preview of the latest message so the UI can show enough context
// to decide which chats to promote to a project.
func (s *Store) ListInboxSummaries() ([]InboxSummary, error) {
	rows, err := s.db.Query(
		`SELECT
			m.chat_jid,
			COALESCE(c.is_group, 0),
			COALESCE(c.display_name, ''),
			COUNT(*),
			MAX(m.timestamp)
		 FROM messages m
		 LEFT JOIN contacts c ON c.jid = m.chat_jid
		 WHERE m.retention_class = 'inbox_preview'
		 GROUP BY m.chat_jid
		 ORDER BY MAX(m.timestamp) DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []InboxSummary
	for rows.Next() {
		var sum InboxSummary
		var isGroup int
		if err := rows.Scan(&sum.ChatJID, &isGroup, &sum.DisplayName, &sum.MessageCount, &sum.LastTimestamp); err != nil {
			return nil, err
		}
		sum.IsGroup = isGroup != 0
		if strings.TrimSpace(sum.DisplayName) == "" {
			sum.DisplayName = jidLocalPart(sum.ChatJID)
		}
		out = append(out, sum)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i, sum := range out {
		msgs, err := s.ListMessagesByChat(sum.ChatJID, 1)
		if err != nil {
			return nil, err
		}
		if len(msgs) > 0 {
			text := msgs[0].Body
			if text == "" {
				text = "[" + msgs[0].Type + "]"
			}
			out[i].LastPreview = text
		}
	}
	return out, nil
}

func (s *Store) ListMessagesByChat(chatJID string, limit int) ([]Message, error) {
	return s.queryMessages(`chat_jid = ?`, chatJID, limit)
}

func (s *Store) ListMessagesByProject(projectID int64, limit int) ([]Message, error) {
	return s.queryMessages(`project_id = ?`, projectID, limit)
}

func (s *Store) queryMessages(where string, arg any, limit int) ([]Message, error) {
	rows, err := s.db.Query(
		`SELECT id, chat_jid, project_id, sender_jid, is_from_me, timestamp, type, body, caption, is_media, mimetype, media_local_path, retention_class
		 FROM messages WHERE `+where+` ORDER BY timestamp DESC LIMIT ?`,
		arg, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Message
	for rows.Next() {
		var m Message
		var projectID sql.NullInt64
		var isFromMe, isMedia int
		var mediaPath sql.NullString
		if err := rows.Scan(&m.ID, &m.ChatJID, &projectID, &m.SenderJID, &isFromMe, &m.Timestamp,
			&m.Type, &m.Body, &m.Caption, &isMedia, &m.Mimetype, &mediaPath, &m.RetentionClass); err != nil {
			return nil, err
		}
		if projectID.Valid {
			id := projectID.Int64
			m.ProjectID = &id
		}
		m.IsFromMe = isFromMe != 0
		m.IsMedia = isMedia != 0
		m.MediaLocalPath = mediaPath.String
		out = append(out, m)
	}
	return out, rows.Err()
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func jidLocalPart(jid string) string {
	jid = strings.TrimSpace(jid)
	if at := strings.Index(jid, "@"); at > 0 {
		return jid[:at]
	}
	return jid
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
