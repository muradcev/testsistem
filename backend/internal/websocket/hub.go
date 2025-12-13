package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"nakliyeo-mobil/internal/middleware"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Production'da origin kontrolü yapılmalı
		return true
	},
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	clientID string
	isAdmin  bool
	closed   bool
	mu       sync.Mutex
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

type LocationUpdate struct {
	Type         string  `json:"type"`
	DriverID     string  `json:"driver_id"`
	Name         string  `json:"name"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Speed        float64 `json:"speed,omitempty"`
	IsMoving     bool    `json:"is_moving"`
	Status       string  `json:"status"`
	BatteryLevel float64 `json:"battery_level,omitempty"`
	Heading      float64 `json:"heading,omitempty"`
	Accuracy     float64 `json:"accuracy,omitempty"`
	Timestamp    int64   `json:"timestamp"`
}

type DriverStatusUpdate struct {
	Type     string `json:"type"`
	DriverID string `json:"driver_id"`
	Name     string `json:"name"`
	Status   string `json:"status"`
}

type SystemMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			fmt.Printf("[WS] Client connected: %s (admin: %v)\n", client.clientID, client.isAdmin)
			os.Stdout.Sync()

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.safeClose()
			}
			h.mutex.Unlock()
			fmt.Printf("[WS] Client disconnected: %s\n", client.clientID)
			os.Stdout.Sync()

		case message := <-h.broadcast:
			h.mutex.Lock()
			for client := range h.clients {
				// Sadece admin istemcilere konum güncellemesi gönder
				if client.isAdmin {
					select {
					case client.send <- message:
					default:
						delete(h.clients, client)
						client.safeClose()
					}
				}
			}
			h.mutex.Unlock()
		}
	}
}

// safeClose kanal zaten kapalıysa panic olmadan kapatır
func (c *Client) safeClose() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.send)
	}
}

func (h *Hub) BroadcastLocationUpdate(update *LocationUpdate) {
	update.Type = "location_update"
	update.Timestamp = time.Now().Unix()

	data, err := json.Marshal(update)
	if err != nil {
		log.Printf("Failed to marshal location update: %v", err)
		return
	}

	h.broadcast <- data
}

// BroadcastToAdmins sadece admin istemcilere mesaj gönderir
func (h *Hub) BroadcastToAdmins(message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	h.mutex.Lock()
	defer h.mutex.Unlock()

	for client := range h.clients {
		if client.isAdmin {
			select {
			case client.send <- data:
			default:
				delete(h.clients, client)
				client.safeClose()
			}
		}
	}
}

// BroadcastDriverStatus şoför durum değişikliği yayınlar
func (h *Hub) BroadcastDriverStatus(driverID, name, status string) {
	update := &DriverStatusUpdate{
		Type:     "driver_status",
		DriverID: driverID,
		Name:     name,
		Status:   status,
	}

	h.BroadcastToAdmins(update)
}

// GetConnectedClientsCount bağlı istemci sayısını döner
func (h *Hub) GetConnectedClientsCount() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// GetAdminClientsCount bağlı admin istemci sayısını döner
func (h *Hub) GetAdminClientsCount() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	count := 0
	for client := range h.clients {
		if client.isAdmin {
			count++
		}
	}
	return count
}

// HandleWebSocket WebSocket bağlantısını işler - JWT doğrulaması ile
func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Token'ı query parametresinden veya header'dan al
	token := r.URL.Query().Get("token")
	if token == "" {
		// Authorization header'dan dene
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	// Admin bağlantısı için token zorunlu
	clientType := r.URL.Query().Get("type")
	isAdmin := clientType == "admin"

	if isAdmin && token == "" {
		http.Error(w, "Yetkilendirme gerekli", http.StatusUnauthorized)
		return
	}

	// Admin için token doğrula
	if isAdmin {
		claims, err := middleware.ValidateToken(token)
		if err != nil {
			http.Error(w, "Geçersiz token", http.StatusUnauthorized)
			return
		}

		// Admin rolünü kontrol et
		if claims.Role != "admin" && claims.Role != "super_admin" {
			http.Error(w, "Admin yetkisi gerekli", http.StatusForbidden)
			return
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		clientID = fmt.Sprintf("client-%d", time.Now().UnixNano())
	}

	client := &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		clientID: clientID,
		isAdmin:  isAdmin,
		closed:   false,
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Ping mesajlarını işle
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err == nil {
			if msg["type"] == "ping" {
				// Pong yanıtı gönder
				pong, _ := json.Marshal(map[string]string{"type": "pong"})
				select {
				case c.send <- pong:
				default:
				}
				continue
			}
		}

		fmt.Printf("[WS] Message from %s: %s\n", c.clientID, string(message))
		os.Stdout.Sync()
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
