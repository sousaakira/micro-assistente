# Checklist — Paridade `whatsmeow-api` vs `venon-js`

Objetivo: garantir que o `whatsmeow-api` entregue as mesmas capacidades práticas do `venon-js` no ecossistema Wapix.

## 1) Socket.io (opcional no `venon-js`)

- [ ] Conectar no Socket.io da API quando `SOCKET=true`
- [ ] Emitir `bot-attach` com `{ bot: socket.id, type: 'bot', bot_id: BOT }` (mesmo payload do `venon-js`)

## 2) Recebimento — “unread/catch-up”

- [ ] Implementar varredura de mensagens não lidas no start (equivalente ao `unreadMessages`)
- [ ] Marcar mensagens como “vistas/lidas” (equivalente ao `markMarkSeenMessage`)
- [ ] Deduplicar por ID com janela de tempo (equivalente ao `_seenIds` do `Botstrap`)

## 3) Recebimento — mídia (paridade operacional)

- [ ] Definir estratégia de mídia recebida (recomendado escolher 1):
  - [ ] Upload em S3 e enviar URL no `/file-message` (igual `venon-js`)
  - [ ] Base64/data-url no `/file-message` (já existe, mas pode estourar limites)
- [ ] Garantir suporte a arquivos grandes (limite de body/timeout/fallback)

## 4) Envio — edge cases do provedor

- [ ] Implementar retry quando o provedor retornar `@lid` no envio de texto (mesma lógica do `venon-js`)
- [ ] Alinhar retorno HTTP (`st`, `warning`, etc.) nos casos de erro “soft”

## 5) Grupos — fidelidade de payload

- [ ] Garantir que `/group-message` envie todos os campos esperados:
  - [ ] `quotedMsg`
  - [ ] `isMedia`
  - [ ] `mimetype`
  - [ ] `timestamp`
  - [ ] `selectedId`
  - [ ] `listResponse`
- [ ] Manter gatilhos e resposta do “resumo do dia” iguais ao `venon-js` (texto e `selectedId`)

## 6) Admin/UX (validação prática)

- [ ] Confirmar que o Admin renderiza corretamente mídia recebida no formato escolhido (S3 URL ou data-url)
- [ ] Confirmar que “trocar bot de envio” não quebra envio/recebimento (multi-bot)

## 7) Operação

- [ ] Garantir que o PM2 roda sempre o binário correto após rebuild/restart
- [ ] Logs mínimos (sem dados sensíveis): “recebi mensagem” + “POST para API ok/erro”
