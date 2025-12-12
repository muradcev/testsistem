package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS için tüm originlere izin ver
	},
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	clientID string
	isAdmin  bool
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
			log.Printf("Client connected: %s", client.clientID)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mutex.Unlock()
			log.Printf("Client disconnected: %s", client.clientID)

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
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

	h.mutex.RLock()
	for client := range h.clients {
		if client.isAdmin {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mutex.RUnlock()
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

func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		clientID: r.URL.Query().Get("client_id"),
		isAdmin:  r.URL.Query().Get("type") == "admin",
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

		// Handle incoming messages if needed
		log.Printf("Received message from %s: %s", c.clientID, string(message))
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
