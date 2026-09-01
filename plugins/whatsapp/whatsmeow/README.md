# whatsmeow

[![Go Reference](https://pkg.go.dev/badge/go.mau.fi/whatsmeow.svg)](https://pkg.go.dev/go.mau.fi/whatsmeow)

Package whatsmeow implements a client for interacting with the WhatsApp web multidevice API.
## Installation

To use this package in your Go project, you'll need [Go](https://go.dev/doc/install) 1.25 or later installed on your system.

```console
go get go.mau.fi/whatsmeow
```

Then import it in your code:

```go
import "go.mau.fi/whatsmeow"
```

## Constants

```go
const (
	// WantedPreKeyCount is the number of prekeys that the client should upload to the WhatsApp servers in a single batch.
	WantedPreKeyCount = 50
	// MinPreKeyCount is the number of prekeys when the client will upload a new batch of prekeys to the WhatsApp servers.
	MinPreKeyCount = 5
)
```

```go
const (
	NackParsingError                 = 487
	NackUnrecognizedStanza           = 488
	NackUnrecognizedStanzaClass      = 489
	NackUnrecognizedStanzaType       = 490
	NackInvalidProtobuf              = 491
	NackInvalidHostedCompanionStanza = 493
	NackMissingMessageSecret         = 495
	NackSignalErrorOldCounter        = 496
	NackMessageDeletedOnPeer         = 499
	NackUnhandledError               = 500
	NackUnsupportedAdminRevoke       = 550
	NackUnsupportedLIDGroup          = 551
	NackDBOperationFailed            = 552
)
```

```go
const (
	DisappearingTimerOff     = time.Duration(0)
	DisappearingTimer24Hours = 24 * time.Hour
	DisappearingTimer7Days   = 7 * 24 * time.Hour
	DisappearingTimer90Days  = 90 * 24 * time.Hour
)
```

```go
const (
	BusinessMessageLinkPrefix       = "https://wa.me/message/"
	ContactQRLinkPrefix             = "https://wa.me/qr/"
	BusinessMessageLinkDirectPrefix = "https://api.whatsapp.com/message/"
	ContactQRLinkDirectPrefix       = "https://api.whatsapp.com/qr/"
	NewsletterLinkPrefix            = "https://whatsapp.com/channel/"
)
```

```go
const EditWindow = 20 * time.Minute
```

EditWindow specifies how long a message can be edited for after it was sent.

```go
const FBArmadilloMessageVersion = 1
```

```go
const FBConsumerMessageVersion = 1
```

```go
const FBMessageApplicationVersion = 2
```

```go
const FBMessageVersion = 3
```

```go
const IGMessageApplicationVersion = 3
```

```go
const InviteLinkPrefix = "https://chat.whatsapp.com/"
```

```go
const NoiseHandshakeResponseTimeout = 20 * time.Second
```

```go
const QRChannelEventCode = "code"
```

```go
const QRChannelEventError = "error"
```

```go
const RemoveReactionText = ""
```

```go
const WACertIssuerSerial = 0
```

```go
const WebMessageIDPrefix = "3EB0"
```

## Variables

```go
var (
	ErrClientIsNil     = errors.New("client is nil")
	ErrNoSession       = errors.New("can't encrypt message for device: no signal session established")
	ErrIQTimedOut      = errors.New("info query timed out")
	ErrNotConnected    = errors.New("websocket not connected")
	ErrNotLoggedIn     = errors.New("the store doesn't contain a device JID")
	ErrMessageTimedOut = errors.New("timed out waiting for message send response")

	ErrAlreadyConnected = errors.New("websocket is already connected")

	ErrPhoneNumberTooShort           = errors.New("phone number too short")
	ErrPhoneNumberIsNotInternational = errors.New("international phone number required (must not start with 0)")

	ErrQRAlreadyConnected = errors.New("GetQRChannel must be called before connecting")
	ErrQRStoreContainsID  = errors.New("GetQRChannel can only be called when there's no user ID in the client's Store")

	ErrNoPushName = errors.New("can't send presence without PushName set")

	ErrNoPrivacyToken = errors.New("no privacy token stored")

	ErrAppStateUpdate = errors.New("server returned error updating app state")
)
```

Miscellaneous errors

```go
var (
	ErrPairInvalidDeviceIdentityHMAC = errors.New("invalid device identity HMAC in pair success message")
	ErrPairInvalidDeviceSignature    = errors.New("invalid device signature in pair success message")
	ErrPairRejectedLocally           = errors.New("local PrePairCallback rejected pairing")
)
```

Errors that happen while confirming device pairing

```go
var (
	// ErrProfilePictureUnauthorized is returned by GetProfilePictureInfo when trying to get the profile picture of a user
	// whose privacy settings prevent you from seeing their profile picture (status code 401).
	ErrProfilePictureUnauthorized = errors.New("the user has hidden their profile picture from you")
	// ErrProfilePictureNotSet is returned by GetProfilePictureInfo when the given user or group doesn't have a profile
	// picture (status code 404).
	ErrProfilePictureNotSet = errors.New("that user or group does not have a profile picture")
	// ErrGroupInviteLinkUnauthorized is returned by GetGroupInviteLink if you don't have the permission to get the link (status code 401).
	ErrGroupInviteLinkUnauthorized = errors.New("you don't have the permission to get the group's invite link")
	// ErrNotInGroup is returned by group info getting methods if you're not in the group (status code 403).
	ErrNotInGroup = errors.New("you're not participating in that group")
	// ErrGroupNotFound is returned by group info getting methods if the group doesn't exist (status code 404).
	ErrGroupNotFound = errors.New("that group does not exist")
	// ErrInviteLinkInvalid is returned by methods that use group invite links if the invite link is malformed.
	ErrInviteLinkInvalid = errors.New("that group invite link is not valid")
	// ErrInviteLinkRevoked is returned by methods that use group invite links if the invite link was valid, but has been revoked and can no longer be used.
	ErrInviteLinkRevoked = errors.New("that group invite link has been revoked")
	// ErrBusinessMessageLinkNotFound is returned by ResolveBusinessMessageLink if the link doesn't exist or has been revoked.
	ErrBusinessMessageLinkNotFound = errors.New("that business message link does not exist or has been revoked")
	// ErrContactQRLinkNotFound is returned by ResolveContactQRLink if the link doesn't exist or has been revoked.
	ErrContactQRLinkNotFound = errors.New("that contact QR link does not exist or has been revoked")
	// ErrInvalidImageFormat is returned by SetGroupPhoto if the given photo is not in the correct format.
	ErrInvalidImageFormat = errors.New("the given data is not a valid image")
	// ErrMediaNotAvailableOnPhone is returned by DecryptMediaRetryNotification if the given event contains error code 2.
	ErrMediaNotAvailableOnPhone = errors.New("media no longer available on phone")
	// ErrUnknownMediaRetryError is returned by DecryptMediaRetryNotification if the given event contains an unknown error code.
	ErrUnknownMediaRetryError = errors.New("unknown media retry error")
	// ErrInvalidDisappearingTimer is returned by SetDisappearingTimer if the given timer is not one of the allowed values.
	ErrInvalidDisappearingTimer = errors.New("invalid disappearing timer provided")
)
```

```go
var (
	ErrBroadcastListUnsupported = errors.New("sending to non-status broadcast lists is not yet supported")
	ErrUnknownServer            = errors.New("can't send message to unknown server")
	ErrRecipientADJID           = errors.New("message recipient must be a user JID with no device part")
	ErrServerReturnedError      = errors.New("server returned error")
	ErrInvalidInlineBotID       = errors.New("invalid inline bot ID")
)
```

Some errors that Client.SendMessage can return

```go
var (
	ErrMediaDownloadFailedWith403 = DownloadHTTPError{Response: &http.Response{StatusCode: 403}}
	ErrMediaDownloadFailedWith404 = DownloadHTTPError{Response: &http.Response{StatusCode: 404}}
	ErrMediaDownloadFailedWith410 = DownloadHTTPError{Response: &http.Response{StatusCode: 410}}
	ErrNoURLPresent               = errors.New("no url present")
	ErrFileLengthMismatch         = errors.New("file length does not match")
	ErrTooShortFile               = errors.New("file too short")
	ErrInvalidMediaHMAC           = errors.New("invalid media hmac")
	ErrInvalidMediaEncSHA256      = errors.New("hash of media ciphertext doesn't match")
	ErrInvalidMediaSHA256         = errors.New("hash of media plaintext doesn't match")
	ErrUnknownMediaType           = errors.New("unknown media type")
	ErrNothingDownloadableFound   = errors.New("didn't find any attachments in message")
)
```

Some errors that Client.Download can return

```go
var (
	ErrOriginalMessageSecretNotFound = errors.New("original message secret key not found")
	ErrNotEncryptedReactionMessage   = errors.New("given message isn't an encrypted reaction message")
	ErrNotEncryptedCommentMessage    = errors.New("given message isn't an encrypted comment message")
	ErrNotSecretEncryptedMessage     = errors.New("given message isn't a secret encrypted message")
	ErrNotPollUpdateMessage          = errors.New("given message isn't a poll update message")
)
```

```go
var (
	ErrIQBadRequest          error = &IQError{Code: 400, Text: "bad-request"}
	ErrIQNotAuthorized       error = &IQError{Code: 401, Text: "not-authorized"}
	ErrIQForbidden           error = &IQError{Code: 403, Text: "forbidden"}
	ErrIQNotFound            error = &IQError{Code: 404, Text: "item-not-found"}
	ErrIQNotAllowed          error = &IQError{Code: 405, Text: "not-allowed"}
	ErrIQNotAcceptable       error = &IQError{Code: 406, Text: "not-acceptable"}
	ErrIQGone                error = &IQError{Code: 410, Text: "gone"}
	ErrIQResourceLimit       error = &IQError{Code: 419, Text: "resource-limit"}
	ErrIQLocked              error = &IQError{Code: 423, Text: "locked"}
	ErrIQRateOverLimit       error = &IQError{Code: 429, Text: "rate-overlimit"}
	ErrIQInternalServerError error = &IQError{Code: 500, Text: "internal-server-error"}
	ErrIQServiceUnavailable  error = &IQError{Code: 503, Text: "service-unavailable"}
	ErrIQPartialServerError  error = &IQError{Code: 530, Text: "partial-server-error"}
)
```

Common errors returned by info queries for use with errors.Is

```go
var (
	// KeepAliveResponseDeadline specifies the duration to wait for a response to websocket keepalive pings.
	KeepAliveResponseDeadline = 10 * time.Second
	// KeepAliveIntervalMin specifies the minimum interval for websocket keepalive pings.
	KeepAliveIntervalMin = 20 * time.Second
	// KeepAliveIntervalMax specifies the maximum interval for websocket keepalive pings.
	KeepAliveIntervalMax = 30 * time.Second

	// KeepAliveMaxFailTime specifies the maximum time to wait before forcing a reconnect if keepalives fail repeatedly.
	KeepAliveMaxFailTime = 3 * time.Minute
)
```

```go
var (
	AdvAccountSignaturePrefix = []byte{6, 0}
	AdvDeviceSignaturePrefix  = []byte{6, 1}

	AdvHostedAccountSignaturePrefix = []byte{6, 5}
	AdvHostedDeviceSignaturePrefix  = []byte{6, 6}
)
```

```go
var (
	// QRChannelSuccess is emitted from GetQRChannel when the pairing is successful.
	QRChannelSuccess = QRChannelItem{Event: "success"}
	// QRChannelTimeout is emitted from GetQRChannel if the socket gets disconnected by the server before the pairing is successful.
	QRChannelTimeout = QRChannelItem{Event: "timeout"}
	// QRChannelErrUnexpectedEvent is emitted from GetQRChannel if an unexpected connection event is received,
	// as that likely means that the pairing has already happened before the channel was set up.
	QRChannelErrUnexpectedEvent = QRChannelItem{Event: "err-unexpected-state"}
	// QRChannelClientOutdated is emitted from GetQRChannel if events.ClientOutdated is received.
	QRChannelClientOutdated = QRChannelItem{Event: "err-client-outdated"}
	// QRChannelScannedWithoutMultidevice is emitted from GetQRChannel if events.QRScannedWithoutMultidevice is received.
	QRChannelScannedWithoutMultidevice = QRChannelItem{Event: "err-scanned-without-multidevice"}
)
```

Possible final items in the QR channel. In addition to these, an \`error\` event may be emitted, in which case the Error field will have the error that occurred during pairing.

```go
var DefaultStatusPrivacy = []types.StatusPrivacy{{
	Type:      types.StatusPrivacyTypeContacts,
	IsDefault: true,
}}
```

```go
var ErrIQDisconnected = &DisconnectedError{Action: "info query"}
```

```go
var EventAlreadyProcessed = errors.New("event was already processed")
```

```go
var RequestFromPhoneDelay = 5 * time.Second
```

RequestFromPhoneDelay specifies how long to wait for the sender to resend the message before requesting from your phone. This is only used if Client.AutomaticMessageRerequestFromPhone is true.

```go
var ReturnDownloadWarnings = true
```

ReturnDownloadWarnings controls whether the Download function returns non-fatal validation warnings. Currently, these include \[ErrFileLengthMismatch] and \[ErrInvalidMediaSHA256].

```go
var WACertPubKey = [...]byte{0x14, 0x23, 0x75, 0x57, 0x4d, 0xa, 0x58, 0x71, 0x66, 0xaa, 0xe7, 0x1e, 0xbe, 0x51, 0x64, 0x37, 0xc4, 0xa2, 0x8b, 0x73, 0xe3, 0x69, 0x5c, 0x6c, 0xe1, 0xf7, 0xf9, 0x54, 0x5d, 0xa8, 0xee, 0x6b}
```

## Functions

### BuildAppStateRecoveryRequest

```go
func BuildAppStateRecoveryRequest *waE2E.Message
```

BuildAppStateRecoveryRequest builds a message to request the user's primary device to send an unencrypted copy of the given app state collection.

The built message can be sent using Client.SendPeerMessage. The response will come as a ProtocolMessage with type \`PEER\_DATA\_OPERATION\_RESPONSE\_MESSAGE\`.

### BuildFatalAppStateExceptionNotification

```go
func BuildFatalAppStateExceptionNotification *waE2E.Message
```

BuildFatalAppStateExceptionNotification builds a message to request the user's primary device to reset specific app state collections. This will cause all linked devices to be logged out.

The built message can be sent using Client.SendPeerMessage. There is no response, as the client will get logged out.

### DecryptMediaRetryNotification

```go
func DecryptMediaRetryNotification 
```

DecryptMediaRetryNotification decrypts a media retry notification using the media key. See Client.SendMediaRetryReceipt for more info on how to use this.

### GenerateFacebookMessageID

```go
func GenerateFacebookMessageID int64
```

### GenerateMessageID

```go
func GenerateMessageID types.MessageID
```

GenerateMessageID generates a random string that can be used as a message ID on WhatsApp.

	msgID := whatsmeow.GenerateMessageID()
	cli.SendMessage(context.Background(), targetJID, &waE2E.Message{...}, whatsmeow.SendRequestExtra{ID: msgID})

Deprecated: WhatsApp web has switched to using a hash of the current timestamp, user id and random bytes. Use Client.GenerateMessageID instead.

### GetLatestVersion

```go
func GetLatestVersion 
```

GetLatestVersion returns the latest version number from web.whatsapp.com.

After fetching, you can update the version to use using store.SetWAVersion, e.g.

	latestVer, err := GetLatestVersion(nil)
	if err != nil {
		return err
	}
	store.SetWAVersion(*latestVer)

### HashPollOptions

```go
func HashPollOptions [][]byte
```

HashPollOptions hashes poll option names using SHA-256 for voting. This is used by BuildPollVote to convert selected option names to hashes.

### ParseDisappearingTimerString

```go
func ParseDisappearingTimerString 
```

ParseDisappearingTimerString parses common human-readable disappearing message timer strings into Duration values. If the string doesn't look like one of the allowed values (0, 24h, 7d, 90d), the second return value is false.

## Types

### APNsPushConfig

```go
type APNsPushConfig struct {
	Token       string `json:"token"`
	VoIPToken   string `json:"voip_token"`
	MsgIDEncKey []byte `json:"msg_id_enc_key"`
}
```

#### Methods

##### GetPushConfigAttrs

```go
func (apc *APNsPushConfig) GetPushConfigAttrs waBinary.Attrs
```

### Client

```go
type Client struct {
	Store *store.Device
	Log   waLog.Logger

	EnableAutoReconnect   bool
	InitialAutoReconnect  bool
	LastSuccessfulConnect time.Time
	AutoReconnectErrors   int
	// AutoReconnectHook is called when auto-reconnection fails. If the function returns false,
	// the client will not attempt to reconnect. The number of retries can be read from AutoReconnectErrors.
	AutoReconnectHook func(error) bool
	// If SynchronousAck is set, acks for messages will only be sent after all event handlers return.
	SynchronousAck             bool
	EnableDecryptedEventBuffer bool

	DisableLoginAutoReconnect bool

	// EmitAppStateEventsOnFullSync can be set to true if you want to get app state events emitted
	// even when re-syncing the whole state.
	EmitAppStateEventsOnFullSync bool
	AppStateDebugLogs            bool

	AutomaticMessageRerequestFromPhone bool

	ManualHistorySyncDownload       bool
	DisableManualHistorySyncReceipt bool

	// GetMessageForRetry is used to find the source message for handling retry receipts
	// when the message is not found in the recently sent message cache.
	// Note: in DMs, the "to" field may be different from what you originally sent to (LID vs phone number),
	// make sure to check both if necessary.
	GetMessageForRetry func(requester, to types.JID, id types.MessageID) *waE2E.Message
	// PreRetryCallback is called before a retry receipt is accepted.
	// If it returns false, the accepting will be cancelled and the retry receipt will be ignored.
	PreRetryCallback func(receipt *events.Receipt, id types.MessageID, retryCount int, msg *waE2E.Message) bool
	// Should whatsmeow store recently sent messages in the database so that retry receipts can be accepted
	// even if the process is restarted? If false, only the in-memory cache and GetMessageForRetry will be used.
	UseRetryMessageStore bool

	// PrePairCallback is called before pairing is completed. If it returns false, the pairing will be cancelled and
	// the client will disconnect.
	PrePairCallback func(jid types.JID, platform, businessName string) bool

	// GetClientPayload is called to get the client payload for connecting to the server.
	// This should NOT be used for WhatsApp (to change the OS name, update fields in store.BaseClientPayload directly).
	GetClientPayload func() *waWa6.ClientPayload

	// Should untrusted identity errors be handled automatically? If true, the stored identity and existing signal
	// sessions will be removed on untrusted identity errors, and an events.IdentityChange will be dispatched.
	// If false, decrypting a message from untrusted devices will fail.
	AutoTrustIdentity bool

	// Should SubscribePresence return an error if no privacy token is stored for the user?
	ErrorOnSubscribePresenceWithoutToken bool

	SendReportingTokens bool

	BackgroundEventCtx context.Context

	// This field changes the client to act like a Messenger client instead of a WhatsApp one.
	//
	// Note that you cannot use a Messenger account just by setting this field, you must use a
	// separate library for all the non-e2ee-related stuff like logging in.
	// The library is currently embedded in mautrix-meta (https://github.com/mautrix/meta), but may be separated later.
	MessengerConfig *MessengerConfig
	RefreshCAT      func(context.Context) error
	// contains filtered or unexported fields
}
```

Client contains everything necessary to connect to and interact with the WhatsApp web API.

#### Methods

##### AcceptTOSNotice

```go
func (cli *Client) AcceptTOSNotice error
```

AcceptTOSNotice accepts a ToS notice.

To accept the terms for creating newsletters, use

	cli.AcceptTOSNotice("20601218", "5")

##### AddEventHandler

```go
func (cli *Client) AddEventHandler uint32
```

AddEventHandler registers a new function to receive all events emitted by this client.

The returned integer is the event handler ID, which can be passed to RemoveEventHandler to remove it.

All registered event handlers will receive all events. You should use a type switch statement to filter the events you want:

	func myEventHandler(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			fmt.Println("Received a message!")
		case *events.Receipt:
			fmt.Println("Received a receipt!")
		}
	}

If you want to access the Client instance inside the event handler, the recommended way is to wrap the whole handler in another struct:

	type MyClient struct {
		WAClient *whatsmeow.Client
		eventHandlerID uint32
	}

	func (mycli *MyClient) register() {
		mycli.eventHandlerID = mycli.WAClient.AddEventHandler(mycli.myEventHandler)
	}

	func (mycli *MyClient) myEventHandler(evt interface{}) {
		// Handle event and access mycli.WAClient
	}

##### AddEventHandlerWithSuccessStatus

```go
func (cli *Client) AddEventHandlerWithSuccessStatus uint32
```

##### BuildEdit

```go
func (cli *Client) BuildEdit *waE2E.Message
```

BuildEdit builds a message edit message using the given variables. The built message can be sent normally using Client.SendMessage.

	resp, err := cli.SendMessage(context.Background(), chat, cli.BuildEdit(chat, originalMessageID, &waE2E.Message{
		Conversation: proto.String("edited message"),
	})

##### BuildHistorySyncRequest

```go
func (cli *Client) BuildHistorySyncRequest *waE2E.Message
```

BuildHistorySyncRequest builds a message to request additional history from the user's primary device.

The built message can be sent using Client.SendPeerMessage. The response will come as an \*events.HistorySync with type \`ON\_DEMAND\`.

The response will contain to \`count\` messages immediately before the given message. The recommended number of messages to request at a time is 50.

##### BuildMessageKey

```go
func (cli *Client) BuildMessageKey *waCommon.MessageKey
```

BuildMessageKey builds a MessageKey object, which is used to refer to previous messages for things such as replies, revocations and reactions.

##### BuildPollCreation

```go
func (cli *Client) BuildPollCreation *waE2E.Message
```

BuildPollCreation builds a poll creation message with the given poll name, options and maximum number of selections. The built message can be sent normally using Client.SendMessage.

	resp, err := cli.SendMessage(context.Background(), chat, cli.BuildPollCreation("meow?", []string{"yes", "no"}, 1))

##### BuildPollVote

```go
func (cli *Client) BuildPollVote 
```

BuildPollVote builds a poll vote message using the given poll message info and option names. The built message can be sent normally using Client.SendMessage.

For example, to vote for the first option after receiving a message event (\*events.Message):

	if evt.Message.GetPollCreationMessage() != nil {
		pollVoteMsg, err := cli.BuildPollVote(&evt.Info, []string{evt.Message.GetPollCreationMessage().GetOptions()[0].GetOptionName()})
		if err != nil {
			fmt.Println(":(", err)
			return
		}
		resp, err := cli.SendMessage(context.Background(), evt.Info.Chat, pollVoteMsg)
	}

##### BuildReaction

```go
func (cli *Client) BuildReaction *waE2E.Message
```

BuildReaction builds a message reaction message using the given variables. The built message can be sent normally using Client.SendMessage.

	resp, err := cli.SendMessage(context.Background(), chat, cli.BuildReaction(chat, senderJID, targetMessageID, "🐈️")

Note that for newsletter messages, you need to use NewsletterSendReaction instead of BuildReaction + SendMessage.

##### BuildRevoke

```go
func (cli *Client) BuildRevoke *waE2E.Message
```

BuildRevoke builds a message revocation message using the given variables. The built message can be sent normally using Client.SendMessage.

To revoke your own messages, pass your JID or an empty JID as the second parameter (sender).

	resp, err := cli.SendMessage(context.Background(), chat, cli.BuildRevoke(chat, types.EmptyJID, originalMessageID)

To revoke someone else's messages when you are group admin, pass the message sender's JID as the second parameter.

	resp, err := cli.SendMessage(context.Background(), chat, cli.BuildRevoke(chat, senderJID, originalMessageID)

##### BuildUnavailableMessageRequest

```go
func (cli *Client) BuildUnavailableMessageRequest *waE2E.Message
```

BuildUnavailableMessageRequest builds a message to request the user's primary device to send the copy of a message that this client was unable to decrypt.

The built message can be sent using Client.SendPeerMessage. The full response will come as a ProtocolMessage with type \`PEER\_DATA\_OPERATION\_REQUEST\_RESPONSE\_MESSAGE\`. The response events will also be dispatched as normal \*events.Message's with UnavailableRequestID set to the request message ID.

##### Connect

```go
func (cli *Client) Connect error
```

Connect connects the client to the WhatsApp web websocket. After connection, it will either authenticate if there's data in the device store, or emit a QREvent to set up a new link.

##### ConnectContext

```go
func (cli *Client) ConnectContext error
```

##### CreateGroup

```go
func (cli *Client) CreateGroup 
```

CreateGroup creates a group on WhatsApp with the given name and participants.

See ReqCreateGroup for parameters.

##### CreateNewsletter

```go
func (cli *Client) CreateNewsletter 
```

CreateNewsletter creates a new WhatsApp channel.

##### DangerousInternals

```go
func (cli *Client) DangerousInternals *DangerousInternalClient
```

DangerousInternals allows access to all unexported methods in Client.

Deprecated: dangerous

##### DecryptComment

```go
func (cli *Client) DecryptComment 
```

DecryptComment decrypts a reply/comment message in a community announcement group.

	if evt.Message.GetEncCommentMessage() != nil {
		comment, err := cli.DecryptComment(evt)
		if err != nil {
			fmt.Println(":(", err)
			return
		}
		fmt.Printf("Comment message: %+v\n", comment)
	}

##### DecryptPollVote

```go
func (cli *Client) DecryptPollVote 
```

DecryptPollVote decrypts a poll update message. The vote itself includes SHA-256 hashes of the selected options.

	if evt.Message.GetPollUpdateMessage() != nil {
		pollVote, err := cli.DecryptPollVote(evt)
		if err != nil {
			fmt.Println(":(", err)
			return
		}
		fmt.Println("Selected hashes:")
		for _, hash := range pollVote.GetSelectedOptions() {
			fmt.Printf("- %X\n", hash)
		}
	}

##### DecryptReaction

```go
func (cli *Client) DecryptReaction 
```

DecryptReaction decrypts a reaction message in a community announcement group.

	if evt.Message.GetEncReactionMessage() != nil {
		reaction, err := cli.DecryptReaction(evt)
		if err != nil {
			fmt.Println(":(", err)
			return
		}
		fmt.Printf("Reaction message: %+v\n", reaction)
	}

##### DecryptSecretEncryptedMessage

```go
func (cli *Client) DecryptSecretEncryptedMessage 
```

##### DeleteMedia

```go
func (cli *Client) DeleteMedia error
```

DeleteMedia deletes the media at the given direct path from WhatsApp servers.

This is only used for things like history syncs, which should be deleted after processing.

##### Disconnect

```go
func (cli *Client) Disconnect
```

Disconnect disconnects from the WhatsApp web websocket.

This will not emit any events, the Disconnected event is only used when the connection is closed by the server or a network error.

##### Download

```go
func (cli *Client) Download 
```

Download downloads the attachment from the given protobuf message.

The attachment is a specific part of a Message protobuf struct, not the message itself, e.g.

	var msg *waE2E.Message
	...
	imageData, err := cli.Download(msg.GetImageMessage())

You can also use DownloadAny to download the first non-nil sub-message.

##### DownloadAny

```go
func (cli *Client) DownloadAny 
```

DownloadAny loops through the downloadable parts of the given message and downloads the first non-nil item.

Deprecated: it's recommended to find the specific message type you want to download manually and use the Download method instead.

##### DownloadFB

```go
func (cli *Client) DownloadFB 
```

##### DownloadFBToFile

```go
func (cli *Client) DownloadFBToFile error
```

##### DownloadHistorySync

```go
func (cli *Client) DownloadHistorySync 
```

DownloadHistorySync will download and parse the history sync blob from the given history sync notification.

You only need to call this manually if you set \[Client.ManualHistorySyncDownload] to true. By default, whatsmeow will call this automatically and dispatch an \[events.HistorySync] with the parsed data.

##### DownloadMediaWithPath

```go
func (cli *Client) DownloadMediaWithPath 
```

DownloadMediaWithPath downloads an attachment by manually specifying the path and encryption details.

##### DownloadMediaWithPathToFile

```go
func (cli *Client) DownloadMediaWithPathToFile error
```

##### DownloadThumbnail

```go
func (cli *Client) DownloadThumbnail 
```

DownloadThumbnail downloads a thumbnail from a message.

This is primarily intended for downloading link preview thumbnails, which are in ExtendedTextMessage:

	var msg *waE2E.Message
	...
	thumbnailImageBytes, err := cli.DownloadThumbnail(msg.GetExtendedTextMessage())

##### DownloadToFile

```go
func (cli *Client) DownloadToFile error
```

DownloadToFile downloads the attachment from the given protobuf message.

This is otherwise identical to \[Download], but writes the attachment to a file instead of returning it as a byte slice.

##### EncryptComment

```go
func (cli *Client) EncryptComment 
```

##### EncryptPollVote

```go
func (cli *Client) EncryptPollVote 
```

EncryptPollVote encrypts a poll vote message. This is a slightly lower-level function, using BuildPollVote is recommended.

##### EncryptReaction

```go
func (cli *Client) EncryptReaction 
```

##### FetchAppState

```go
func (cli *Client) FetchAppState error
```

FetchAppState fetches updates to the given type of app state. If fullSync is true, the current cached state will be removed and all app state patches will be re-fetched from the server.

##### FollowNewsletter

```go
func (cli *Client) FollowNewsletter error
```

FollowNewsletter makes the user follow (join) a WhatsApp channel.

##### GenerateMessageID

```go
func (cli *Client) GenerateMessageID types.MessageID
```

GenerateMessageID generates a random string that can be used as a message ID on WhatsApp.

	msgID := cli.GenerateMessageID()
	cli.SendMessage(context.Background(), targetJID, &waE2E.Message{...}, whatsmeow.SendRequestExtra{ID: msgID})

##### GetBlocklist

```go
func (cli *Client) GetBlocklist 
```

GetBlocklist gets the list of users that this user has blocked.

##### GetBotListV2

```go
func (cli *Client) GetBotListV2 
```

##### GetBotProfiles

```go
func (cli *Client) GetBotProfiles 
```

##### GetBusinessProfile

```go
func (cli *Client) GetBusinessProfile 
```

GetBusinessProfile gets the profile info of a WhatsApp business account

##### GetContactQRLink

```go
func (cli *Client) GetContactQRLink 
```

GetContactQRLink gets your own contact share QR link that can be resolved using ResolveContactQRLink (or scanned with the official apps when encoded as a QR code).

If the revoke parameter is set to true, it will ask the server to revoke the previous link and generate a new one.

##### GetGroupInfo

```go
func (cli *Client) GetGroupInfo 
```

GetGroupInfo requests basic info about a group chat from the WhatsApp servers.

##### GetGroupInfoFromInvite

```go
func (cli *Client) GetGroupInfoFromInvite 
```

GetGroupInfoFromInvite gets the group info from an invite message.

Note that this is specifically for invite messages, not invite links. Use GetGroupInfoFromLink for resolving chat.whatsapp.com links.

##### GetGroupInfoFromLink

```go
func (cli *Client) GetGroupInfoFromLink 
```

GetGroupInfoFromLink resolves the given invite link and asks the WhatsApp servers for info about the group. This will not cause the user to join the group.

##### GetGroupInviteLink

```go
func (cli *Client) GetGroupInviteLink 
```

GetGroupInviteLink requests the invite link to the group from the WhatsApp servers.

If reset is true, then the old invite link will be revoked and a new one generated.

##### GetGroupRequestParticipants

```go
func (cli *Client) GetGroupRequestParticipants 
```

GetGroupRequestParticipants gets the list of participants that have requested to join the group.

##### GetJoinedGroups

```go
func (cli *Client) GetJoinedGroups 
```

GetJoinedGroups returns the list of groups the user is participating in.

##### GetLinkedGroupsParticipants

```go
func (cli *Client) GetLinkedGroupsParticipants 
```

GetLinkedGroupsParticipants gets all the participants in the groups of the given community.

##### GetNewsletterInfo

```go
func (cli *Client) GetNewsletterInfo 
```

GetNewsletterInfo gets the info of a newsletter that you're joined to.

##### GetNewsletterInfoWithInvite

```go
func (cli *Client) GetNewsletterInfoWithInvite 
```

GetNewsletterInfoWithInvite gets the info of a newsletter with an invite link.

You can either pass the full link ([https://whatsapp.com/channel/](https://whatsapp.com/channel/)...) or just the \`...\` part.

Note that the ViewerMeta field of the returned NewsletterMetadata will be nil.

##### GetNewsletterMessageUpdates

```go
func (cli *Client) GetNewsletterMessageUpdates 
```

GetNewsletterMessageUpdates gets updates in a WhatsApp channel.

These are the same kind of updates that NewsletterSubscribeLiveUpdates triggers (reaction and view counts).

##### GetNewsletterMessages

```go
func (cli *Client) GetNewsletterMessages 
```

GetNewsletterMessages gets messages in a WhatsApp channel.

##### GetPrivacySettings

```go
func (cli *Client) GetPrivacySettings 
```

GetPrivacySettings will get the user's privacy settings. If an error occurs while fetching them, the error will be logged, but the method will just return an empty struct.

##### GetProfilePictureInfo

```go
func (cli *Client) GetProfilePictureInfo 
```

GetProfilePictureInfo gets the URL where you can download a WhatsApp user's profile picture or group's photo.

Optionally, you can pass the last known profile picture ID. If the profile picture hasn't changed, this will return nil with no error.

To get a community photo, you should pass \`IsCommunity: true\`, as otherwise you may get a 401 error.

##### GetQRChannel

```go
func (cli *Client) GetQRChannel 
```

GetQRChannel returns a channel that automatically outputs a new QR code when the previous one expires.

This must be called \*before\* Connect(). It will then listen to all the relevant events from the client.

The last value to be emitted will be a special event like "success", "timeout" or another error code depending on the result of the pairing. The channel will be closed immediately after one of those.

##### GetServerPushNotificationConfig

```go
func (cli *Client) GetServerPushNotificationConfig 
```

##### GetStatusPrivacy

```go
func (cli *Client) GetStatusPrivacy 
```

GetStatusPrivacy gets the user's status privacy settings (who to send status broadcasts to).

There can be multiple different stored settings, the first one is always the default.

##### GetSubGroups

```go
func (cli *Client) GetSubGroups 
```

GetSubGroups gets the subgroups of the given community.

##### GetSubscribedNewsletters

```go
func (cli *Client) GetSubscribedNewsletters 
```

GetSubscribedNewsletters gets the info of all newsletters that you're joined to.

##### GetUserDevices

```go
func (cli *Client) GetUserDevices 
```

GetUserDevices gets the list of devices that the given user has. The input should be a list of regular JIDs, and the output will be a list of AD JIDs. The local device will not be included in the output even if the user's JID is included in the input. All other devices will be included.

##### GetUserDevicesContext

```go
func (cli *Client) GetUserDevicesContext 
```

##### GetUserInfo

```go
func (cli *Client) GetUserInfo 
```

GetUserInfo gets basic user info (avatar, status, verified business name, device list).

##### IsConnected

```go
func (cli *Client) IsConnected bool
```

IsConnected checks if the client is connected to the WhatsApp web websocket. Note that this doesn't check if the client is authenticated. See the IsLoggedIn field for that.

##### IsLoggedIn

```go
func (cli *Client) IsLoggedIn bool
```

IsLoggedIn returns true after the client is successfully connected and authenticated on WhatsApp.

##### IsOnWhatsApp

```go
func (cli *Client) IsOnWhatsApp 
```

IsOnWhatsApp checks if the given phone numbers are registered on WhatsApp. The phone numbers should be in international format, including the \`+\` prefix.

##### JoinGroupWithInvite

```go
func (cli *Client) JoinGroupWithInvite error
```

JoinGroupWithInvite joins a group using an invite message.

Note that this is specifically for invite messages, not invite links. Use JoinGroupWithLink for joining with chat.whatsapp.com links.

##### JoinGroupWithLink

```go
func (cli *Client) JoinGroupWithLink 
```

JoinGroupWithLink joins the group using the given invite link.

##### LeaveGroup

```go
func (cli *Client) LeaveGroup error
```

LeaveGroup leaves the specified group on WhatsApp.

##### LinkGroup

```go
func (cli *Client) LinkGroup error
```

LinkGroup adds an existing group as a child group in a community.

To create a new group within a community, set LinkedParentJID in the CreateGroup request.

##### Logout

```go
func (cli *Client) Logout error
```

Logout sends a request to unlink the device, then disconnects from the websocket and deletes the local device store.

If the logout request fails, the disconnection and local data deletion will not happen either. If an error is returned, but you want to force disconnect/clear data, call Client.Disconnect() and Client.Store.Delete() manually.

Note that this will not emit any events. The LoggedOut event is only used for external logouts (triggered by the user from the main device or by WhatsApp servers).

##### MarkNotDirty

```go
func (cli *Client) MarkNotDirty error
```

##### MarkRead

```go
func (cli *Client) MarkRead error
```

MarkRead sends a read receipt for the given message IDs including the given timestamp as the read at time.

The first JID parameter (chat) must always be set to the chat ID (user ID in DMs and group ID in group chats). The second JID parameter (sender) must be set in group chats and must be the user ID who sent the message.

You can mark multiple messages as read at the same time, but only if the messages were sent by the same user. To mark messages by different users as read, you must call MarkRead multiple times (once for each user).

To mark a voice message as played, specify types.ReceiptTypePlayed as the last parameter. Providing more than one receipt type will panic: the parameter is only a vararg for backwards compatibility.

##### NewsletterMarkViewed

```go
func (cli *Client) NewsletterMarkViewed error
```

NewsletterMarkViewed marks a channel message as viewed, incrementing the view counter.

This is not the same as marking the channel as read on your other devices, use the usual MarkRead function for that.

##### NewsletterSendReaction

```go
func (cli *Client) NewsletterSendReaction error
```

NewsletterSendReaction sends a reaction to a channel message. To remove a reaction sent earlier, set reaction to an empty string.

The last parameter is the message ID of the reaction itself. It can be left empty to let whatsmeow generate a random one.

##### NewsletterSubscribeLiveUpdates

```go
func (cli *Client) NewsletterSubscribeLiveUpdates 
```

NewsletterSubscribeLiveUpdates subscribes to receive live updates from a WhatsApp channel temporarily (for the duration returned).

##### NewsletterToggleMute

```go
func (cli *Client) NewsletterToggleMute error
```

NewsletterToggleMute changes the mute status of a newsletter.

##### PairPhone

```go
func (cli *Client) PairPhone 
```

PairPhone generates a pairing code that can be used to link to a phone without scanning a QR code.

You must connect the client normally before calling this (which means you'll also receive a QR code event, but that can be ignored when doing code pairing). You should also wait for \`\*events.QR\` before calling this to ensure the connection is fully established. If using \[Client.GetQRChannel], wait for the first item in the channel. Alternatively, sleeping for a second after calling Connect will probably work too.

The exact expiry of pairing codes is unknown, but QR codes are always generated and the login websocket is closed after the QR codes run out, which means there's a 160-second time limit. It is recommended to generate the pairing code immediately after connecting to the websocket to have the maximum time.

The clientType parameter must be one of the PairClient\* constants, but which one doesn't matter. The client display name must be formatted as \`Browser (OS)\`, and only common browsers/OSes are allowed (the server will validate it and return 400 if it's wrong).

See [https://faq.whatsapp.com/1324084875126592](https://faq.whatsapp.com/1324084875126592) for more info

##### ParseWebMessage

```go
func (cli *Client) ParseWebMessage 
```

ParseWebMessage parses a WebMessageInfo object into \*events.Message to match what real-time messages have.

The chat JID can be found in the Conversation data:

	chatJID, err := types.ParseJID(conv.GetId())
	for _, historyMsg := range conv.GetMessages() {
		evt, err := cli.ParseWebMessage(chatJID, historyMsg.GetMessage())
		yourNormalEventHandler(evt)
	}

##### RegisterForPushNotifications

```go
func (cli *Client) RegisterForPushNotifications error
```

RegisterForPushNotifications registers a token to receive push notifications for new WhatsApp messages.

This is generally not necessary for anything. Don't use this if you don't know what you're doing.

##### RejectCall

```go
func (cli *Client) RejectCall error
```

RejectCall reject an incoming call.

##### RemoveEventHandler

```go
func (cli *Client) RemoveEventHandler bool
```

RemoveEventHandler removes a previously registered event handler function. If the function with the given ID is found, this returns true.

N.B. Do not run this directly from an event handler. That would cause a deadlock because the event dispatcher holds a read lock on the event handler list, and this method wants a write lock on the same list. Instead run it in a goroutine:

	func (mycli *MyClient) myEventHandler(evt interface{}) {
		if noLongerWantEvents {
			go mycli.WAClient.RemoveEventHandler(mycli.eventHandlerID)
		}
	}

##### RemoveEventHandlers

```go
func (cli *Client) RemoveEventHandlers
```

RemoveEventHandlers removes all event handlers that have been registered with AddEventHandler

##### ResetConnection

```go
func (cli *Client) ResetConnection
```

ResetConnection disconnects from the WhatsApp web websocket and forces an automatic reconnection. This will not do anything if the socket is already disconnected or if EnableAutoReconnect is false.

##### ResolveBusinessMessageLink

```go
func (cli *Client) ResolveBusinessMessageLink 
```

ResolveBusinessMessageLink resolves a business message short link and returns the target JID, business name and text to prefill in the input field (if any).

The links look like [https://wa.me/message/](https://wa.me/message/)\<code> or [https://api.whatsapp.com/message/](https://api.whatsapp.com/message/)\<code>. You can either provide the full link, or just the \<code> part.

##### ResolveContactQRLink

```go
func (cli *Client) ResolveContactQRLink 
```

ResolveContactQRLink resolves a link from a contact share QR code and returns the target JID and push name.

The links look like [https://wa.me/qr/](https://wa.me/qr/)\<code> or [https://api.whatsapp.com/qr/](https://api.whatsapp.com/qr/)\<code>. You can either provide the full link, or just the \<code> part.

##### RevokeMessage

```go
func (cli *Client) RevokeMessage 
```

RevokeMessage deletes the given message from everyone in the chat.

This method will wait for the server to acknowledge the revocation message before returning. The return value is the timestamp of the message from the server.

Deprecated: This method is deprecated in favor of BuildRevoke

##### SendAppState

```go
func (cli *Client) SendAppState error
```

SendAppState sends the given app state patch, then triggers a background resync of that app state type to update local caches and send events for the updates.

You can use the Build methods in the appstate package to build the parameter for this method, e.g.

	cli.SendAppState(ctx, appstate.BuildMute(targetJID, true, 24 * time.Hour))

##### SendChatPresence

```go
func (cli *Client) SendChatPresence error
```

SendChatPresence updates the user's typing status in a specific chat.

The media parameter can be set to indicate the user is recording media (like a voice message) rather than typing a text message.

##### SendFBMessage

```go
func (cli *Client) SendFBMessage 
```

SendFBMessage sends the given v3 message to the given JID.

##### SendHistorySyncServerErrorReceipt

```go
func (cli *Client) SendHistorySyncServerErrorReceipt error
```

SendHistorySyncServerErrorReceipt sends a history sync server-error receipt, which asks the phone to re-upload the referenced history sync payload.

##### SendMediaRetryReceipt

```go
func (cli *Client) SendMediaRetryReceipt error
```

SendMediaRetryReceipt sends a request to the phone to re-upload the media in a message.

This is mostly relevant when handling history syncs and getting a 404 or 410 error downloading media. Rough example on how to use it (will not work out of the box, you must adjust it depending on what you need exactly):

	var mediaRetryCache map[types.MessageID]*waE2E.ImageMessage

	evt, err := cli.ParseWebMessage(chatJID, historyMsg.GetMessage())
	imageMsg := evt.Message.GetImageMessage() // replace this with the part of the message you want to download
	data, err := cli.Download(imageMsg)
	if errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith404) || errors.Is(err, whatsmeow.ErrMediaDownloadFailedWith410) {
	  err = cli.SendMediaRetryReceipt(&evt.Info, imageMsg.GetMediaKey())
	  // You need to store the event data somewhere as it's necessary for handling the retry response.
	  mediaRetryCache[evt.Info.ID] = imageMsg
	}

The response will come as an \*events.MediaRetry. The response will then have to be decrypted using DecryptMediaRetryNotification and the same media key passed here. If the media retry was successful, the decrypted notification should contain an updated DirectPath, which can be used to download the file.

	func eventHandler(rawEvt interface{}) {
	  switch evt := rawEvt.(type) {
	  case *events.MediaRetry:
	    imageMsg := mediaRetryCache[evt.MessageID]
	    retryData, err := whatsmeow.DecryptMediaRetryNotification(evt, imageMsg.GetMediaKey())
	    if err != nil || retryData.GetResult != waMmsRetry.MediaRetryNotification_SUCCESS {
	      return
	    }
	    // Use the new path to download the attachment
	    imageMsg.DirectPath = retryData.DirectPath
	    data, err := cli.Download(imageMsg)
	    // Alternatively, you can use cli.DownloadMediaWithPath and provide the individual fields manually.
	  }
	}

##### SendMessage

```go
func (cli *Client) SendMessage 
```

SendMessage sends the given message.

This method will wait for the server to acknowledge the message before returning. The return value is the timestamp of the message from the server.

Optional parameters like the message ID can be specified with the SendRequestExtra struct. Only one extra parameter is allowed, put all necessary parameters in the same struct.

The message itself can contain anything you want (within the protobuf schema). e.g. for a simple text message, use the Conversation field:

	cli.SendMessage(context.Background(), targetJID, &waE2E.Message{
		Conversation: proto.String("Hello, World!"),
	})

Things like replies, mentioning users and the "forwarded" flag are stored in ContextInfo, which can be put in ExtendedTextMessage and any of the media message types.

For uploading and sending media/attachments, see the Upload method.

For other message types, you'll have to figure it out yourself. Looking at the protobuf schema in binary/proto/def.proto may be useful to find out all the allowed fields. Printing the RawMessage field in incoming message events to figure out what it contains is also a good way to learn how to send the same kind of message.

##### SendPeerMessage

```go
func (cli *Client) SendPeerMessage 
```

##### SendPresence

```go
func (cli *Client) SendPresence error
```

SendPresence updates the user's presence status on WhatsApp.

You should call this at least once after connecting so that the server has your pushname. Otherwise, other users will see "-" as the name.

##### SendProtocolMessageReceipt

```go
func (cli *Client) SendProtocolMessageReceipt error
```

SendProtocolMessageReceipt sends a receipt for a protocol message back to the phone.

##### SetDefaultDisappearingTimer

```go
func (cli *Client) SetDefaultDisappearingTimer 
```

SetDefaultDisappearingTimer will set the default disappearing message timer.

##### SetDisappearingTimer

```go
func (cli *Client) SetDisappearingTimer 
```

SetDisappearingTimer sets the disappearing timer in a chat. Both private chats and groups are supported, but they're set with different methods.

Note that while this function allows passing non-standard durations, official WhatsApp apps will ignore those, and in groups the server will just reject the change. You can use the DisappearingTimer\<Duration> constants for convenience.

In groups, the server will echo the change as a notification, so it'll show up as a \*events.GroupInfo update.

##### SetForceActiveDeliveryReceipts

```go
func (cli *Client) SetForceActiveDeliveryReceipts
```

SetForceActiveDeliveryReceipts will force the client to send normal delivery receipts (which will show up as the two gray ticks on WhatsApp), even if the client isn't marked as online.

By default, clients that haven't been marked as online will send delivery receipts with type="inactive", which is transmitted to the sender, but not rendered in the official WhatsApp apps. This is consistent with how WhatsApp web works when it's not in the foreground.

To mark the client as online, use

	cli.SendPresence(types.PresenceAvailable)

Note that if you turn this off (i.e. call SetForceActiveDeliveryReceipts(false)), receipts will act like the client is offline until SendPresence is called again.

##### SetGroupAnnounce

```go
func (cli *Client) SetGroupAnnounce error
```

SetGroupAnnounce changes whether the group is in announce mode (i.e. whether only admins can send messages).

##### SetGroupDescription

```go
func (cli *Client) SetGroupDescription error
```

SetGroupDescription updates the group description.

##### SetGroupJoinApprovalMode

```go
func (cli *Client) SetGroupJoinApprovalMode error
```

SetGroupJoinApprovalMode sets the group join approval mode to 'on' or 'off'.

##### SetGroupLocked

```go
func (cli *Client) SetGroupLocked error
```

SetGroupLocked changes whether the group is locked (i.e. whether only admins can modify group info).

##### SetGroupMemberAddMode

```go
func (cli *Client) SetGroupMemberAddMode error
```

SetGroupMemberAddMode sets the group member add mode to 'admin\_add' or 'all\_member\_add'.

##### SetGroupName

```go
func (cli *Client) SetGroupName error
```

SetGroupName updates the name (subject) of the given group on WhatsApp.

##### SetGroupPhoto

```go
func (cli *Client) SetGroupPhoto 
```

SetGroupPhoto updates the group picture/icon of the given group on WhatsApp. The avatar should be a JPEG photo, other formats may be rejected with ErrInvalidImageFormat. The bytes can be nil to remove the photo. Returns the new picture ID.

##### SetGroupTopic

```go
func (cli *Client) SetGroupTopic error
```

SetGroupTopic updates the topic (description) of the given group on WhatsApp.

The previousID and newID fields are optional. If the previous ID is not specified, this will automatically fetch the current group info to find the previous topic ID. If the new ID is not specified, one will be generated with Client.GenerateMessageID().

##### SetMaxParallelRetryReceiptHandling

```go
func (cli *Client) SetMaxParallelRetryReceiptHandling
```

SetMaxParallelRetryReceiptHandling sets how many retry receipts can be handled in parallel. Defaults to unlimited. This should only be set before connecting, changing it afterwards can cause data races.

##### SetMediaHTTPClient

```go
func (cli *Client) SetMediaHTTPClient
```

SetMediaHTTPClient sets the HTTP client used to download media. This will overwrite any set proxy calls.

##### SetPassive

```go
func (cli *Client) SetPassive error
```

SetPassive tells the WhatsApp server whether this device is passive or not.

This seems to mostly affect whether the device receives certain events. By default, whatsmeow will automatically do SetPassive(false) after connecting.

##### SetPreLoginHTTPClient

```go
func (cli *Client) SetPreLoginHTTPClient
```

SetPreLoginHTTPClient sets the HTTP client used to establish the websocket connection before login. This will overwrite any set proxy calls.

##### SetPrivacySetting

```go
func (cli *Client) SetPrivacySetting 
```

SetPrivacySetting will set the given privacy setting to the given value. The privacy settings will be fetched from the server after the change and the new settings will be returned. If an error occurs while fetching the new settings, will return an empty struct.

##### SetProxy

```go
func (cli *Client) SetProxy
```

SetProxy sets a HTTP proxy to use for WhatsApp web websocket connections and media uploads/downloads.

Must be called before Connect() to take effect in the websocket connection. If you want to change the proxy after connecting, you must call Disconnect() and then Connect() again manually.

By default, the client will find the proxy from the https\_proxy environment variable like Go's net/http does.

To disable reading proxy info from environment variables, explicitly set the proxy to nil:

	cli.SetProxy(nil)

To use a different proxy for the websocket and media, pass a function that checks the request path or headers:

	cli.SetProxy(func(r *http.Request) (*url.URL, error) {
		if r.URL.Host == "web.whatsapp.com" && r.URL.Path == "/ws/chat" {
			return websocketProxyURL, nil
		} else {
			return mediaProxyURL, nil
		}
	})

##### SetProxyAddress

```go
func (cli *Client) SetProxyAddress error
```

SetProxyAddress is a helper method that parses a URL string and calls SetProxy or SetSOCKSProxy based on the URL scheme.

Returns an error if url.Parse fails to parse the given address.

##### SetSOCKSProxy

```go
func (cli *Client) SetSOCKSProxy
```

SetSOCKSProxy sets a SOCKS5 proxy to use for WhatsApp web websocket connections and media uploads/downloads.

Same details as SetProxy apply, but using a different proxy for the websocket and media is not currently supported.

##### SetStatusMessage

```go
func (cli *Client) SetStatusMessage error
```

SetStatusMessage updates the current user's status text, which is shown in the "About" section in the user profile.

This is different from the ephemeral status broadcast messages. Use SendMessage to types.StatusBroadcastJID to send such messages.

##### SetWebsocketHTTPClient

```go
func (cli *Client) SetWebsocketHTTPClient
```

SetWebsocketHTTPClient sets the HTTP client used to establish the websocket connection for logged-in sessions. This will overwrite any set proxy calls.

##### StoreLIDPNMapping

```go
func (cli *Client) StoreLIDPNMapping
```

##### SubscribePresence

```go
func (cli *Client) SubscribePresence error
```

SubscribePresence asks the WhatsApp servers to send presence updates of a specific user to this client.

After subscribing to this event, you should start receiving \*events.Presence for that user in normal event handlers.

Also, it seems that the WhatsApp servers require you to be online to receive presence status from other users, so you should mark yourself as online before trying to use this function:

	cli.SendPresence(types.PresenceAvailable)

##### TryFetchPrivacySettings

```go
func (cli *Client) TryFetchPrivacySettings 
```

TryFetchPrivacySettings will fetch the user's privacy settings, either from the in-memory cache or from the server.

##### UnfollowNewsletter

```go
func (cli *Client) UnfollowNewsletter error
```

UnfollowNewsletter makes the user unfollow (leave) a WhatsApp channel.

##### UnlinkGroup

```go
func (cli *Client) UnlinkGroup error
```

UnlinkGroup removes a child group from a parent community.

##### UpdateBlocklist

```go
func (cli *Client) UpdateBlocklist 
```

UpdateBlocklist updates the user's block list and returns the updated list.

##### UpdateGroupParticipants

```go
func (cli *Client) UpdateGroupParticipants 
```

UpdateGroupParticipants can be used to add, remove, promote and demote members in a WhatsApp group.

##### UpdateGroupRequestParticipants

```go
func (cli *Client) UpdateGroupRequestParticipants 
```

UpdateGroupRequestParticipants can be used to approve or reject requests to join the group.

##### Upload

```go
func (cli *Client) Upload 
```

Upload uploads the given attachment to WhatsApp servers.

You should copy the fields in the response to the corresponding fields in a protobuf message.

For example, to send an image:

	resp, err := cli.Upload(context.Background(), yourImageBytes, whatsmeow.MediaImage)
	// handle error

	imageMsg := &waE2E.ImageMessage{
		Caption:  proto.String("Hello, world!"),
		Mimetype: proto.String("image/png"), // replace this with the actual mime type
		// you can also optionally add other fields like ContextInfo and JpegThumbnail here

		URL:           &resp.URL,
		DirectPath:    &resp.DirectPath,
		MediaKey:      resp.MediaKey,
		FileEncSHA256: resp.FileEncSHA256,
		FileSHA256:    resp.FileSHA256,
		FileLength:    &resp.FileLength,
	}
	_, err = cli.SendMessage(context.Background(), targetJID, &waE2E.Message{
		ImageMessage: imageMsg,
	})
	// handle error again

The same applies to the other message types like DocumentMessage, just replace the struct type and Message field name.

##### UploadNewsletter

```go
func (cli *Client) UploadNewsletter 
```

UploadNewsletter uploads the given attachment to WhatsApp servers without encrypting it first.

Newsletter media works mostly the same way as normal media, with a few differences: \* Since it's unencrypted, there's no MediaKey or FileEncSHA256 fields. \* There's a "media handle" that needs to be passed in SendRequestExtra.

Example:

	resp, err := cli.UploadNewsletter(context.Background(), yourImageBytes, whatsmeow.MediaImage)
	// handle error

	imageMsg := &waE2E.ImageMessage{
		// Caption, mime type and other such fields work like normal
		Caption:  proto.String("Hello, world!"),
		Mimetype: proto.String("image/png"),

		// URL and direct path are also there like normal media
		URL:        &resp.URL,
		DirectPath: &resp.DirectPath,
		FileSHA256: resp.FileSHA256,
		FileLength: &resp.FileLength,
		// Newsletter media isn't encrypted, so the media key and file enc sha fields are not applicable
	}
	_, err = cli.SendMessage(context.Background(), newsletterJID, &waE2E.Message{
		ImageMessage: imageMsg,
	}, whatsmeow.SendRequestExtra{
		// Unlike normal media, newsletters also include a "media handle" in the send request.
		MediaHandle: resp.Handle,
	})
	// handle error again

##### UploadNewsletterReader

```go
func (cli *Client) UploadNewsletterReader 
```

UploadNewsletterReader uploads the given attachment to WhatsApp servers without encrypting it first.

This is otherwise identical to \[UploadNewsletter], but it reads the plaintext from an [io.Reader](/io#Reader) instead of a byte slice. Unlike \[UploadReader], this does not require a temporary file. However, the data needs to be hashed first, so an [io.ReadSeeker](/io#ReadSeeker) is required to be able to read the data twice.

##### UploadReader

```go
func (cli *Client) UploadReader 
```

UploadReader uploads the given attachment to WhatsApp servers.

This is otherwise identical to \[Upload], but it reads the plaintext from an [io.Reader](/io#Reader) instead of a byte slice. A temporary file is required for the encryption process. If tempFile is nil, a temporary file will be created and deleted after the upload.

To use only one file, pass the same file as both plaintext and tempFile. This will cause the file to be overwritten with encrypted data.

##### WaitForConnection

```go
func (cli *Client) WaitForConnection bool
```

### CreateNewsletterParams

```go
type CreateNewsletterParams struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Picture     []byte `json:"picture,omitempty"`
}
```

### DangerousInfoQuery

```go
type DangerousInfoQuery = infoQuery
```

### DangerousInfoQueryType

```go
type DangerousInfoQueryType = infoQueryType
```

### DangerousInternalClient

```go
type DangerousInternalClient struct {
	// contains filtered or unexported fields
}
```

#### Methods

##### AddRecentMessage

```go
func (int *DangerousInternalClient) AddRecentMessage error
```

##### ApplyAppStatePatches

```go
func (int *DangerousInternalClient) ApplyAppStatePatches 
```

##### AutoReconnect

```go
func (int *DangerousInternalClient) AutoReconnect
```

##### BackgroundIfAsyncAck

```go
func (int *DangerousInternalClient) BackgroundIfAsyncAck
```

##### BufferedDecrypt

```go
func (int *DangerousInternalClient) BufferedDecrypt 
```

##### CacheGroupInfo

```go
func (int *DangerousInternalClient) CacheGroupInfo 
```

##### CancelDelayedRequestFromPhone

```go
func (int *DangerousInternalClient) CancelDelayedRequestFromPhone
```

##### CancelResponse

```go
func (int *DangerousInternalClient) CancelResponse
```

##### ClearDelayedMessageRequests

```go
func (int *DangerousInternalClient) ClearDelayedMessageRequests
```

##### ClearResponseWaiters

```go
func (int *DangerousInternalClient) ClearResponseWaiters
```

##### ClearUntrustedIdentity

```go
func (int *DangerousInternalClient) ClearUntrustedIdentity error
```

##### CloseSocketWaitChan

```go
func (int *DangerousInternalClient) CloseSocketWaitChan
```

##### CollectEventsToDispatch

```go
func (int *DangerousInternalClient) CollectEventsToDispatch error
```

##### Connect

```go
func (int *DangerousInternalClient) Connect error
```

##### DecryptBotMessage

```go
func (int *DangerousInternalClient) DecryptBotMessage 
```

##### DecryptDM

```go
func (int *DangerousInternalClient) DecryptDM 
```

##### DecryptGroupMsg

```go
func (int *DangerousInternalClient) DecryptGroupMsg 
```

##### DecryptMessages

```go
func (int *DangerousInternalClient) DecryptMessages
```

##### DecryptMsgSecret

```go
func (int *DangerousInternalClient) DecryptMsgSecret 
```

##### DelayedRequestMessageFromPhone

```go
func (int *DangerousInternalClient) DelayedRequestMessageFromPhone
```

##### DispatchAppState

```go
func (int *DangerousInternalClient) DispatchAppState 
```

##### DispatchEvent

```go
func (int *DangerousInternalClient) DispatchEvent 
```

##### DoHandshake

```go
func (int *DangerousInternalClient) DoHandshake error
```

##### DoMediaDownloadRequest

```go
func (int *DangerousInternalClient) DoMediaDownloadRequest 
```

##### DownloadAndDecrypt

```go
func (int *DangerousInternalClient) DownloadAndDecrypt 
```

##### DownloadAndDecryptToFile

```go
func (int *DangerousInternalClient) DownloadAndDecryptToFile error
```

##### DownloadEncryptedMedia

```go
func (int *DangerousInternalClient) DownloadEncryptedMedia 
```

##### DownloadEncryptedMediaToFile

```go
func (int *DangerousInternalClient) DownloadEncryptedMediaToFile 
```

##### DownloadExternalAppStateBlob

```go
func (int *DangerousInternalClient) DownloadExternalAppStateBlob 
```

##### DownloadMedia

```go
func (int *DangerousInternalClient) DownloadMedia 
```

##### DownloadMediaToFile

```go
func (int *DangerousInternalClient) DownloadMediaToFile 
```

##### DownloadPossiblyEncryptedMediaWithRetries

```go
func (int *DangerousInternalClient) DownloadPossiblyEncryptedMediaWithRetries 
```

##### DownloadPossiblyEncryptedMediaWithRetriesToFile

```go
func (int *DangerousInternalClient) DownloadPossiblyEncryptedMediaWithRetriesToFile 
```

##### EncryptMessageForDevice

```go
func (int *DangerousInternalClient) EncryptMessageForDevice 
```

##### EncryptMessageForDeviceAndWrap

```go
func (int *DangerousInternalClient) EncryptMessageForDeviceAndWrap 
```

##### EncryptMessageForDeviceAndWrapV3

```go
func (int *DangerousInternalClient) EncryptMessageForDeviceAndWrapV3 
```

##### EncryptMessageForDeviceV3

```go
func (int *DangerousInternalClient) EncryptMessageForDeviceV3 
```

##### EncryptMessageForDevices

```go
func (int *DangerousInternalClient) EncryptMessageForDevices 
```

##### EncryptMessageForDevicesV3

```go
func (int *DangerousInternalClient) EncryptMessageForDevicesV3 
```

##### EncryptMsgSecret

```go
func (int *DangerousInternalClient) EncryptMsgSecret 
```

##### ExpectDisconnect

```go
func (int *DangerousInternalClient) ExpectDisconnect
```

##### FetchAppState

```go
func (int *DangerousInternalClient) FetchAppState 
```

##### FetchAppStatePatches

```go
func (int *DangerousInternalClient) FetchAppStatePatches 
```

##### FetchPreKeys

```go
func (int *DangerousInternalClient) FetchPreKeys 
```

##### FetchPreKeysNoError

```go
func (int *DangerousInternalClient) FetchPreKeysNoError map[types.JID]*prekey.Bundle
```

##### FilterContacts

```go
func (int *DangerousInternalClient) FilterContacts 
```

##### GenerateRequestID

```go
func (int *DangerousInternalClient) GenerateRequestID string
```

##### GetBroadcastListParticipants

```go
func (int *DangerousInternalClient) GetBroadcastListParticipants 
```

##### GetCachedGroupData

```go
func (int *DangerousInternalClient) GetCachedGroupData 
```

##### GetFBIDDevices

```go
func (int *DangerousInternalClient) GetFBIDDevices 
```

##### GetFBIDDevicesInternal

```go
func (int *DangerousInternalClient) GetFBIDDevicesInternal 
```

##### GetGroupInfo

```go
func (int *DangerousInternalClient) GetGroupInfo 
```

##### GetMessageContent

```go
func (int *DangerousInternalClient) GetMessageContent []waBinary.Node
```

##### GetMessageForRetry

```go
func (int *DangerousInternalClient) GetMessageForRetry 
```

##### GetMessageReportingToken

```go
func (int *DangerousInternalClient) GetMessageReportingToken waBinary.Node
```

##### GetNewsletterInfo

```go
func (int *DangerousInternalClient) GetNewsletterInfo 
```

##### GetOwnID

```go
func (int *DangerousInternalClient) GetOwnID types.JID
```

##### GetOwnLID

```go
func (int *DangerousInternalClient) GetOwnLID types.JID
```

##### GetRecentMessage

```go
func (int *DangerousInternalClient) GetRecentMessage RecentMessage
```

##### GetServerPreKeyCount

```go
func (int *DangerousInternalClient) GetServerPreKeyCount 
```

##### GetSocketWaitChan

```go
func (int *DangerousInternalClient) GetSocketWaitChan <-chan struct{}
```

##### GetStatusBroadcastRecipients

```go
func (int *DangerousInternalClient) GetStatusBroadcastRecipients 
```

##### GetUnifiedSessionID

```go
func (int *DangerousInternalClient) GetUnifiedSessionID string
```

##### HandleAccountSyncNotification

```go
func (int *DangerousInternalClient) HandleAccountSyncNotification
```

##### HandleAppStateNotification

```go
func (int *DangerousInternalClient) HandleAppStateNotification
```

##### HandleAppStateRecovery

```go
func (int *DangerousInternalClient) HandleAppStateRecovery bool
```

##### HandleAppStateSyncKeyShare

```go
func (int *DangerousInternalClient) HandleAppStateSyncKeyShare
```

##### HandleBlocklist

```go
func (int *DangerousInternalClient) HandleBlocklist
```

##### HandleCallEvent

```go
func (int *DangerousInternalClient) HandleCallEvent
```

##### HandleChatState

```go
func (int *DangerousInternalClient) HandleChatState
```

##### HandleCodePairNotification

```go
func (int *DangerousInternalClient) HandleCodePairNotification error
```

##### HandleConnectFailure

```go
func (int *DangerousInternalClient) HandleConnectFailure
```

##### HandleConnectSuccess

```go
func (int *DangerousInternalClient) HandleConnectSuccess
```

##### HandleDecryptedArmadillo

```go
func (int *DangerousInternalClient) HandleDecryptedArmadillo 
```

##### HandleDecryptedMessage

```go
func (int *DangerousInternalClient) HandleDecryptedMessage 
```

##### HandleDeviceNotification

```go
func (int *DangerousInternalClient) HandleDeviceNotification
```

##### HandleEncryptNotification

```go
func (int *DangerousInternalClient) HandleEncryptNotification
```

##### HandleEncryptedMessage

```go
func (int *DangerousInternalClient) HandleEncryptedMessage
```

##### HandleFBDeviceNotification

```go
func (int *DangerousInternalClient) HandleFBDeviceNotification
```

##### HandleFrame

```go
func (int *DangerousInternalClient) HandleFrame
```

##### HandleGroupedReceipt

```go
func (int *DangerousInternalClient) HandleGroupedReceipt
```

##### HandleHistoricalPushNames

```go
func (int *DangerousInternalClient) HandleHistoricalPushNames
```

##### HandleHistorySyncNotificationLoop

```go
func (int *DangerousInternalClient) HandleHistorySyncNotificationLoop
```

##### HandleIB

```go
func (int *DangerousInternalClient) HandleIB
```

##### HandleIQ

```go
func (int *DangerousInternalClient) HandleIQ
```

##### HandleMediaRetryNotification

```go
func (int *DangerousInternalClient) HandleMediaRetryNotification
```

##### HandleMexNotification

```go
func (int *DangerousInternalClient) HandleMexNotification
```

##### HandleNewsletterNotification

```go
func (int *DangerousInternalClient) HandleNewsletterNotification
```

##### HandleNotification

```go
func (int *DangerousInternalClient) HandleNotification
```

##### HandleOwnDevicesNotification

```go
func (int *DangerousInternalClient) HandleOwnDevicesNotification
```

##### HandlePair

```go
func (int *DangerousInternalClient) HandlePair error
```

##### HandlePairDevice

```go
func (int *DangerousInternalClient) HandlePairDevice
```

##### HandlePairSuccess

```go
func (int *DangerousInternalClient) HandlePairSuccess
```

##### HandlePictureNotification

```go
func (int *DangerousInternalClient) HandlePictureNotification
```

##### HandlePlaceholderResendResponse

```go
func (int *DangerousInternalClient) HandlePlaceholderResendResponse 
```

##### HandlePlaintextMessage

```go
func (int *DangerousInternalClient) HandlePlaintextMessage 
```

##### HandlePresence

```go
func (int *DangerousInternalClient) HandlePresence
```

##### HandlePrivacySettingsNotification

```go
func (int *DangerousInternalClient) HandlePrivacySettingsNotification
```

##### HandlePrivacyTokenNotification

```go
func (int *DangerousInternalClient) HandlePrivacyTokenNotification
```

##### HandleProtocolMessage

```go
func (int *DangerousInternalClient) HandleProtocolMessage 
```

##### HandleReceipt

```go
func (int *DangerousInternalClient) HandleReceipt
```

##### HandleRetryReceipt

```go
func (int *DangerousInternalClient) HandleRetryReceipt error
```

##### HandleSenderKeyDistributionMessage

```go
func (int *DangerousInternalClient) HandleSenderKeyDistributionMessage
```

##### HandleStatusNotification

```go
func (int *DangerousInternalClient) HandleStatusNotification
```

##### HandleStreamError

```go
func (int *DangerousInternalClient) HandleStreamError
```

##### HandlerQueueLoop

```go
func (int *DangerousInternalClient) HandlerQueueLoop
```

##### ImmediateRequestMessageFromPhone

```go
func (int *DangerousInternalClient) ImmediateRequestMessageFromPhone
```

##### IsExpectedDisconnect

```go
func (int *DangerousInternalClient) IsExpectedDisconnect bool
```

##### KeepAliveLoop

```go
func (int *DangerousInternalClient) KeepAliveLoop
```

##### MakeDeviceIdentityNode

```go
func (int *DangerousInternalClient) MakeDeviceIdentityNode waBinary.Node
```

##### MakeQRData

```go
func (int *DangerousInternalClient) MakeQRData string
```

##### MaybeDeferredAck

```go
func (int *DangerousInternalClient) MaybeDeferredAck func(...*bool)
```

##### MigrateSessionStore

```go
func (int *DangerousInternalClient) MigrateSessionStore
```

##### OnDisconnect

```go
func (int *DangerousInternalClient) OnDisconnect
```

##### ParseBlocklist

```go
func (int *DangerousInternalClient) ParseBlocklist *types.Blocklist
```

##### ParseBusinessProfile

```go
func (int *DangerousInternalClient) ParseBusinessProfile 
```

##### ParseGroupChange

```go
func (int *DangerousInternalClient) ParseGroupChange 
```

##### ParseGroupCreate

```go
func (int *DangerousInternalClient) ParseGroupCreate 
```

##### ParseGroupNode

```go
func (int *DangerousInternalClient) ParseGroupNode 
```

##### ParseGroupNotification

```go
func (int *DangerousInternalClient) ParseGroupNotification 
```

##### ParseMessageInfo

```go
func (int *DangerousInternalClient) ParseMessageInfo 
```

##### ParseMessageSource

```go
func (int *DangerousInternalClient) ParseMessageSource 
```

##### ParseMsgBotInfo

```go
func (int *DangerousInternalClient) ParseMsgBotInfo 
```

##### ParseMsgMetaInfo

```go
func (int *DangerousInternalClient) ParseMsgMetaInfo 
```

##### ParseNewsletterMessages

```go
func (int *DangerousInternalClient) ParseNewsletterMessages []*types.NewsletterMessage
```

##### ParsePrivacySettings

```go
func (int *DangerousInternalClient) ParsePrivacySettings *events.PrivacySettings
```

##### ParseReceipt

```go
func (int *DangerousInternalClient) ParseReceipt 
```

##### PrepareMessageNode

```go
func (int *DangerousInternalClient) PrepareMessageNode 
```

##### PrepareMessageNodeV3

```go
func (int *DangerousInternalClient) PrepareMessageNodeV3 
```

##### PreparePeerMessageNode

```go
func (int *DangerousInternalClient) PreparePeerMessageNode 
```

##### ProcessProtocolParts

```go
func (int *DangerousInternalClient) ProcessProtocolParts 
```

##### QueryMediaConn

```go
func (int *DangerousInternalClient) QueryMediaConn 
```

##### RawUpload

```go
func (int *DangerousInternalClient) RawUpload error
```

##### ReceiveResponse

```go
func (int *DangerousInternalClient) ReceiveResponse bool
```

##### RefreshMediaConn

```go
func (int *DangerousInternalClient) RefreshMediaConn 
```

##### RequestAppStateKeys

```go
func (int *DangerousInternalClient) RequestAppStateKeys
```

##### RequestMissingAppStateKeys

```go
func (int *DangerousInternalClient) RequestMissingAppStateKeys
```

##### ResetExpectedDisconnect

```go
func (int *DangerousInternalClient) ResetExpectedDisconnect
```

##### RetryFrame

```go
func (int *DangerousInternalClient) RetryFrame 
```

##### SendAck

```go
func (int *DangerousInternalClient) SendAck
```

##### SendAppState

```go
func (int *DangerousInternalClient) SendAppState error
```

##### SendDM

```go
func (int *DangerousInternalClient) SendDM 
```

##### SendDMV3

```go
func (int *DangerousInternalClient) SendDMV3 
```

##### SendGroup

```go
func (int *DangerousInternalClient) SendGroup 
```

##### SendGroupIQ

```go
func (int *DangerousInternalClient) SendGroupIQ 
```

##### SendGroupV3

```go
func (int *DangerousInternalClient) SendGroupV3 
```

##### SendIQ

```go
func (int *DangerousInternalClient) SendIQ 
```

##### SendIQAsync

```go
func (int *DangerousInternalClient) SendIQAsync 
```

##### SendIQAsyncAndGetData

```go
func (int *DangerousInternalClient) SendIQAsyncAndGetData 
```

##### SendKeepAlive

```go
func (int *DangerousInternalClient) SendKeepAlive 
```

##### SendMessageReceipt

```go
func (int *DangerousInternalClient) SendMessageReceipt
```

##### SendMexIQ

```go
func (int *DangerousInternalClient) SendMexIQ 
```

##### SendNewsletter

```go
func (int *DangerousInternalClient) SendNewsletter 
```

##### SendNode

```go
func (int *DangerousInternalClient) SendNode error
```

##### SendNodeAndGetData

```go
func (int *DangerousInternalClient) SendNodeAndGetData 
```

##### SendPairError

```go
func (int *DangerousInternalClient) SendPairError
```

##### SendPeerMessage

```go
func (int *DangerousInternalClient) SendPeerMessage 
```

##### SendRetryReceipt

```go
func (int *DangerousInternalClient) SendRetryReceipt
```

##### SendUnifiedSession

```go
func (int *DangerousInternalClient) SendUnifiedSession
```

##### SetTransport

```go
func (int *DangerousInternalClient) SetTransport
```

##### ShouldIncludeReportingToken

```go
func (int *DangerousInternalClient) ShouldIncludeReportingToken bool
```

##### ShouldRecreateSession

```go
func (int *DangerousInternalClient) ShouldRecreateSession 
```

##### StoreGlobalSettings

```go
func (int *DangerousInternalClient) StoreGlobalSettings
```

##### StoreHistoricalMessageSecrets

```go
func (int *DangerousInternalClient) StoreHistoricalMessageSecrets
```

##### StoreHistoricalPNLIDMappings

```go
func (int *DangerousInternalClient) StoreHistoricalPNLIDMappings
```

##### StoreLIDSyncMessage

```go
func (int *DangerousInternalClient) StoreLIDSyncMessage
```

##### StoreMessageSecret

```go
func (int *DangerousInternalClient) StoreMessageSecret
```

##### TryHandleCodePairNotification

```go
func (int *DangerousInternalClient) TryHandleCodePairNotification
```

##### TryHandleRetryReceipt

```go
func (int *DangerousInternalClient) TryHandleRetryReceipt
```

##### UnlockedConnect

```go
func (int *DangerousInternalClient) UnlockedConnect error
```

##### UnlockedDisconnect

```go
func (int *DangerousInternalClient) UnlockedDisconnect
```

##### UpdateBusinessName

```go
func (int *DangerousInternalClient) UpdateBusinessName
```

##### UpdateGroupParticipantCache

```go
func (int *DangerousInternalClient) UpdateGroupParticipantCache
```

##### UpdatePushName

```go
func (int *DangerousInternalClient) UpdatePushName
```

##### UploadPreKeys

```go
func (int *DangerousInternalClient) UploadPreKeys
```

##### Usync

```go
func (int *DangerousInternalClient) Usync 
```

##### WaitResponse

```go
func (int *DangerousInternalClient) WaitResponse chan *waBinary.Node
```

### DisconnectedError

```go
type DisconnectedError struct {
	Action string
	Node   *waBinary.Node
}
```

DisconnectedError is returned if the websocket disconnects before an info query or other request gets a response.

#### Methods

##### Error

```go
func (err *DisconnectedError) Error string
```

##### Is

```go
func (err *DisconnectedError) Is bool
```

### DownloadHTTPError

```go
type DownloadHTTPError struct {
	*http.Response
}
```

#### Methods

##### Error

```go
func (dhe DownloadHTTPError) Error string
```

##### Is

```go
func (dhe DownloadHTTPError) Is bool
```

### DownloadableMessage

```go
type DownloadableMessage interface {
	GetDirectPath() string
	GetMediaKey() []byte
	GetFileSHA256() []byte
	GetFileEncSHA256() []byte
}
```

DownloadableMessage represents a protobuf message that contains attachment info.

All of the downloadable messages inside a Message struct implement this interface (ImageMessage, VideoMessage, AudioMessage, DocumentMessage, StickerMessage).

### DownloadableThumbnail

```go
type DownloadableThumbnail interface {
	proto.Message
	GetThumbnailDirectPath() string
	GetThumbnailSHA256() []byte
	GetThumbnailEncSHA256() []byte
	GetMediaKey() []byte
}
```

DownloadableThumbnail represents a protobuf message that contains a thumbnail attachment.

This is primarily meant for link preview thumbnails in ExtendedTextMessage.

### ElementMissingError

```go
type ElementMissingError struct {
	Tag string
	In  string
}
```

ElementMissingError is returned by various functions that parse XML elements when a required element is missing.

#### Methods

##### Error

```go
func (eme *ElementMissingError) Error string
```

### EventHandler

```go
type EventHandler func(evt any)
```

EventHandler is a function that can handle events from WhatsApp.

### EventHandlerWithSuccessStatus

```go
type EventHandlerWithSuccessStatus func(evt any) bool
```

### FCMPushConfig

```go
type FCMPushConfig struct {
	Token string `json:"token"`
}
```

#### Methods

##### GetPushConfigAttrs

```go
func (fpc *FCMPushConfig) GetPushConfigAttrs waBinary.Attrs
```

### File

```go
type File interface {
	io.Reader
	io.Writer
	io.Seeker
	io.ReaderAt
	io.WriterAt
	Truncate(size int64) error
	Stat() (os.FileInfo, error)
}
```

### GetNewsletterMessagesParams

```go
type GetNewsletterMessagesParams struct {
	Count  int
	Before types.MessageServerID
}
```

### GetNewsletterUpdatesParams

```go
type GetNewsletterUpdatesParams struct {
	Count int
	Since time.Time
	After types.MessageServerID
}
```

### GetProfilePictureParams

```go
type GetProfilePictureParams struct {
	Preview     bool
	ExistingID  string
	IsCommunity bool
	// This is a common group ID that you share with the target
	CommonGID types.JID
	// use this to query the profile photo of a group you don't have joined, but you have an invite code for
	InviteCode string
	// Persona ID when getting profile of Meta AI bots
	PersonaID string
}
```

### IQError

```go
type IQError struct {
	Code      int
	Text      string
	ErrorNode *waBinary.Node
	RawNode   *waBinary.Node
}
```

IQError is a generic error container for info queries

#### Methods

##### Error

```go
func (iqe *IQError) Error string
```

##### Is

```go
func (iqe *IQError) Is bool
```

### MediaConn

```go
type MediaConn struct {
	Auth       string
	AuthTTL    int
	TTL        int
	MaxBuckets int
	FetchedAt  time.Time
	Hosts      []MediaConnHost
}
```

MediaConn contains a list of WhatsApp servers from which attachments can be downloaded from.

#### Methods

##### Expiry

```go
func (mc *MediaConn) Expiry time.Time
```

Expiry returns the time when the MediaConn expires.

### MediaConnHost

```go
type MediaConnHost struct {
	Hostname string
}
```

MediaConnHost represents a single host to download media from.

### MediaType

```go
type MediaType string
```

MediaType represents a type of uploaded file on WhatsApp. The value is the key which is used as a part of generating the encryption keys.

### MediaTypeable

```go
type MediaTypeable interface {
	GetMediaType() MediaType
}
```

### MessageDebugTimings

```go
type MessageDebugTimings struct {
	LIDFetch time.Duration
	Queue    time.Duration

	Marshal         time.Duration
	GetParticipants time.Duration
	GetDevices      time.Duration
	GroupEncrypt    time.Duration
	PeerEncrypt     time.Duration

	Send  time.Duration
	Resp  time.Duration
	Retry time.Duration
}
```

#### Methods

##### MarshalZerologObject

```go
func (mdt MessageDebugTimings) MarshalZerologObject
```

### MessengerConfig

```go
type MessengerConfig struct {
	UserAgent    string
	BaseURL      string
	WebsocketURL string
}
```

### MsgSecretType

```go
type MsgSecretType string
```

### PairClientType

```go
type PairClientType int
```

PairClientType is the type of client to use with PairCode. The type is automatically filled based on store.DeviceProps.PlatformType (which is what QR login uses).

### PairDatabaseError

```go
type PairDatabaseError struct {
	Message string
	DBErr   error
}
```

PairDatabaseError is included in an events.PairError if the pairing failed due to being unable to save the credentials to the device store.

#### Methods

##### Error

```go
func (err *PairDatabaseError) Error string
```

##### Unwrap

```go
func (err *PairDatabaseError) Unwrap error
```

### PairProtoError

```go
type PairProtoError struct {
	Message  string
	ProtoErr error
}
```

PairProtoError is included in an events.PairError if the pairing failed due to a protobuf error.

#### Methods

##### Error

```go
func (err *PairProtoError) Error string
```

##### Unwrap

```go
func (err *PairProtoError) Unwrap error
```

### ParticipantChange

```go
type ParticipantChange string
```

### ParticipantRequestChange

```go
type ParticipantRequestChange string
```

### Proxy

```go
type Proxy = func(*http.Request) (*url.URL, error)
```

### PushConfig

```go
type PushConfig interface {
	GetPushConfigAttrs() waBinary.Attrs
}
```

### QRChannelItem

```go
type QRChannelItem struct {
	// The type of event, "code" for new QR codes (see Code field) and "error" for pairing errors (see Error) field.
	// For non-code/error events, you can just compare the whole item to the event variables (like QRChannelSuccess).
	Event string
	// If the item is a pair error, then this field contains the error message.
	Error error
	// If the item is a new code, then this field contains the raw data.
	Code string
	// The timeout after which the next code will be sent down the channel.
	Timeout time.Duration
}
```

### RecentMessage

```go
type RecentMessage struct {
	// contains filtered or unexported fields
}
```

#### Methods

##### IsEmpty

```go
func (rm RecentMessage) IsEmpty bool
```

### ReqCreateGroup

```go
type ReqCreateGroup struct {
	// Group names are limited to 25 characters. A longer group name will cause a 406 not acceptable error.
	Name string
	// You don't need to include your own JID in the participants array, the WhatsApp servers will add it implicitly.
	Participants []types.JID
	// A create key can be provided to deduplicate the group create notification that will be triggered
	// when the group is created. If provided, the JoinedGroup event will contain the same key.
	CreateKey types.MessageID

	types.GroupEphemeral
	types.GroupAnnounce
	types.GroupLocked
	types.GroupMembershipApprovalMode
	// Set IsParent to true to create a community instead of a normal group.
	// When creating a community, the linked announcement group will be created automatically by the server.
	types.GroupParent
	// Set LinkedParentJID to create a group inside a community.
	types.GroupLinkedParent
}
```

ReqCreateGroup contains the request data for CreateGroup.

### SendRequestExtra

```go
type SendRequestExtra struct {
	// The message ID to use when sending. If this is not provided, a random message ID will be generated
	ID types.MessageID
	// JID of the bot to be invoked (optional)
	InlineBotJID types.JID
	// Should the message be sent as a peer message (protocol messages to your own devices, e.g. app state key requests)
	Peer bool
	// A timeout for the send request. Unlike timeouts using the context parameter, this only applies
	// to the actual response waiting and not preparing/encrypting the message.
	// Defaults to 75 seconds. The timeout can be disabled by using a negative value.
	Timeout time.Duration
	// When sending media to newsletters, the Handle field returned by the file upload.
	MediaHandle string

	Meta *types.MsgMetaInfo
	// use this only if you know what you are doing
	AdditionalNodes *[]waBinary.Node
}
```

SendRequestExtra contains the optional parameters for SendMessage.

By default, optional parameters don't have to be provided at all, e.g.

	cli.SendMessage(ctx, to, message)

When providing optional parameters, add a single instance of this struct as the last parameter:

	cli.SendMessage(ctx, to, message, whatsmeow.SendRequestExtra{...})

Trying to add multiple extra parameters will return an error.

### SendResponse

```go
type SendResponse struct {
	// The message timestamp returned by the server
	Timestamp time.Time

	// The ID of the sent message
	ID types.MessageID

	// The server-specified ID of the sent message. Only present for newsletter messages.
	ServerID types.MessageServerID

	// Message handling duration, used for debugging
	DebugTimings MessageDebugTimings

	// The identity the message was sent with (LID or PN)
	// This is currently not reliable in all cases.
	Sender types.JID
}
```

### SetProxyOptions

```go
type SetProxyOptions struct {
	// If NoWebsocket is true, the proxy won't be used for the websocket
	NoWebsocket bool
	// If OnlyLogin is true, the proxy will be used for the pre-login websocket, but not the post-login one
	OnlyLogin bool
	// If NoMedia is true, the proxy won't be used for media uploads/downloads
	NoMedia bool
}
```

### UploadResponse

```go
type UploadResponse struct {
	URL        string `json:"url"`
	DirectPath string `json:"direct_path"`
	Handle     string `json:"handle"`
	ObjectID   string `json:"object_id"`

	MediaKey      []byte `json:"-"`
	FileEncSHA256 []byte `json:"-"`
	FileSHA256    []byte `json:"-"`
	FileLength    uint64 `json:"-"`
}
```

UploadResponse contains the data from the attachment upload, which can be put into a message to send the attachment.

### UsyncQueryExtras

```go
type UsyncQueryExtras struct {
	BotListInfo []types.BotListInfo
}
```

### WebPushConfig

```go
type WebPushConfig struct {
	Endpoint string `json:"endpoint"`
	Auth     []byte `json:"auth"`
	P256DH   []byte `json:"p256dh"`
}
```

#### Methods

##### GetPushConfigAttrs

```go
func (wpc *WebPushConfig) GetPushConfigAttrs waBinary.Attrs
```

