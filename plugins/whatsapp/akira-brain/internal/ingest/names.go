package ingest

import (
	"strings"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// DisplayNameFromMessage extrai o nome exibível de um chat a partir do evento de mensagem.
func DisplayNameFromMessage(e *events.Message, chatJID string, isGroup bool) string {
	if isGroup {
		return ""
	}
	if e != nil && !e.Info.IsFromMe {
		if name := strings.TrimSpace(e.Info.PushName); name != "" && name != "-" && name != "username" {
			return name
		}
	}
	return JIDLocalPart(chatJID)
}

// BestContactName escolhe o melhor nome disponível no cache de contatos do whatsmeow.
func BestContactName(info types.ContactInfo) string {
	for _, candidate := range []string{
		strings.TrimSpace(info.FullName),
		strings.TrimSpace(info.FirstName),
		strings.TrimSpace(info.PushName),
		strings.TrimSpace(info.BusinessName),
	} {
		if candidate != "" && candidate != "-" {
			return candidate
		}
	}
	return ""
}

// DisplayNameFromHistory usa metadados do history sync para grupos e contatos.
func DisplayNameFromHistory(convName, convDisplayName string) string {
	for _, candidate := range []string{
		strings.TrimSpace(convName),
		strings.TrimSpace(convDisplayName),
	} {
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

// JIDLocalPart retorna a parte local do JID (telefone ou id) para fallback visual.
func JIDLocalPart(jid string) string {
	jid = strings.TrimSpace(jid)
	if at := strings.Index(jid, "@"); at > 0 {
		return jid[:at]
	}
	return jid
}
