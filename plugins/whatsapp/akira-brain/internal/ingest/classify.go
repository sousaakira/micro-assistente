package ingest

// RetentionClass decides how much of a chat's history gets kept.
type RetentionClass string

const (
	// ClassProject means the chat is mapped to a project: keep everything.
	ClassProject RetentionClass = "project"
	// ClassInbox means the chat isn't mapped yet: keep only a capped preview.
	ClassInbox RetentionClass = "inbox_preview"
)

// ProjectLookup resolves whether a chat JID (individual number or group) is mapped
// to a project. Implemented by store.Store.
type ProjectLookup interface {
	ProjectForContact(chatJID string) (projectID int64, ok bool, err error)
}

// Classify decides whether a message belongs fully to a project or should be
// treated as a capped inbox preview. It's a pure function over ProjectLookup so it
// can be tested without a live WhatsApp connection.
func Classify(lookup ProjectLookup, chatJID string) (projectID *int64, class RetentionClass, err error) {
	id, ok, err := lookup.ProjectForContact(chatJID)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, ClassInbox, nil
	}
	return &id, ClassProject, nil
}
