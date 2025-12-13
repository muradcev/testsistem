package websocket

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("NewHub returned nil")
	}

	if hub.clients == nil {
		t.Error("clients map should not be nil")
	}

	if hub.broadcast == nil {
		t.Error("broadcast channel should not be nil")
	}

	if hub.register == nil {
		t.Error("register channel should not be nil")
	}

	if hub.unregister == nil {
		t.Error("unregister channel should not be nil")
	}
}

func TestHub_RegisterClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Give the hub time to start
	time.Sleep(10 * time.Millisecond)

	client := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "test-client-1",
		isAdmin:  false,
		closed:   false,
	}

	hub.register <- client

	// Give time for registration
	time.Sleep(10 * time.Millisecond)

	hub.mutex.RLock()
	_, exists := hub.clients[client]
	hub.mutex.RUnlock()

	if !exists {
		t.Error("Client should be registered")
	}
}

func TestHub_UnregisterClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	client := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "test-client-2",
		isAdmin:  false,
		closed:   false,
	}

	hub.register <- client
	time.Sleep(10 * time.Millisecond)

	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	hub.mutex.RLock()
	_, exists := hub.clients[client]
	hub.mutex.RUnlock()

	if exists {
		t.Error("Client should be unregistered")
	}
}

func TestHub_BroadcastToAdmins(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	// Create admin client
	adminClient := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "admin-client",
		isAdmin:  true,
		closed:   false,
	}

	// Create non-admin client
	driverClient := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "driver-client",
		isAdmin:  false,
		closed:   false,
	}

	hub.register <- adminClient
	hub.register <- driverClient
	time.Sleep(10 * time.Millisecond)

	// Broadcast message
	testMessage := map[string]string{"type": "test", "message": "hello"}
	hub.BroadcastToAdmins(testMessage)

	// Check admin received message
	select {
	case msg := <-adminClient.send:
		var received map[string]string
		json.Unmarshal(msg, &received)
		if received["type"] != "test" {
			t.Errorf("Admin should receive test message, got %v", received)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Admin client should receive message")
	}

	// Check driver did NOT receive message
	select {
	case <-driverClient.send:
		t.Error("Driver client should NOT receive admin broadcast")
	case <-time.After(50 * time.Millisecond):
		// Expected - no message for driver
	}
}

func TestHub_GetConnectedClientsCount(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	if hub.GetConnectedClientsCount() != 0 {
		t.Error("Initial client count should be 0")
	}

	client1 := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "client-1",
		isAdmin:  false,
		closed:   false,
	}

	client2 := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "client-2",
		isAdmin:  true,
		closed:   false,
	}

	hub.register <- client1
	hub.register <- client2
	time.Sleep(20 * time.Millisecond)

	if hub.GetConnectedClientsCount() != 2 {
		t.Errorf("Expected 2 clients, got %d", hub.GetConnectedClientsCount())
	}
}

func TestHub_GetAdminClientsCount(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	client1 := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "driver-1",
		isAdmin:  false,
		closed:   false,
	}

	client2 := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "admin-1",
		isAdmin:  true,
		closed:   false,
	}

	client3 := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "admin-2",
		isAdmin:  true,
		closed:   false,
	}

	hub.register <- client1
	hub.register <- client2
	hub.register <- client3
	time.Sleep(20 * time.Millisecond)

	if hub.GetAdminClientsCount() != 2 {
		t.Errorf("Expected 2 admin clients, got %d", hub.GetAdminClientsCount())
	}
}

func TestClient_SafeClose(t *testing.T) {
	client := &Client{
		send:   make(chan []byte, 256),
		closed: false,
	}

	// First close should succeed
	client.safeClose()

	if !client.closed {
		t.Error("Client should be marked as closed")
	}

	// Second close should not panic
	client.safeClose() // Should not panic
}

func TestClient_SafeClose_Concurrent(t *testing.T) {
	client := &Client{
		send:   make(chan []byte, 256),
		closed: false,
		mu:     sync.Mutex{},
	}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			client.safeClose()
		}()
	}

	wg.Wait()

	if !client.closed {
		t.Error("Client should be marked as closed")
	}
}

func TestHub_BroadcastLocationUpdate(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	adminClient := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "admin-client",
		isAdmin:  true,
		closed:   false,
	}

	hub.register <- adminClient
	time.Sleep(10 * time.Millisecond)

	update := &LocationUpdate{
		DriverID:  "driver-123",
		Name:      "Test Driver",
		Latitude:  41.0082,
		Longitude: 28.9784,
		Speed:     60.5,
		IsMoving:  true,
		Status:    "driving",
	}

	hub.BroadcastLocationUpdate(update)

	select {
	case msg := <-adminClient.send:
		var received LocationUpdate
		json.Unmarshal(msg, &received)
		if received.Type != "location_update" {
			t.Errorf("Expected type 'location_update', got %s", received.Type)
		}
		if received.DriverID != "driver-123" {
			t.Errorf("Expected driver ID 'driver-123', got %s", received.DriverID)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Admin should receive location update")
	}
}

func TestHub_BroadcastDriverStatus(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	adminClient := &Client{
		hub:      hub,
		send:     make(chan []byte, 256),
		clientID: "admin-client",
		isAdmin:  true,
		closed:   false,
	}

	hub.register <- adminClient
	time.Sleep(10 * time.Millisecond)

	hub.BroadcastDriverStatus("driver-456", "Test Driver", "online")

	select {
	case msg := <-adminClient.send:
		var received DriverStatusUpdate
		json.Unmarshal(msg, &received)
		if received.Type != "driver_status" {
			t.Errorf("Expected type 'driver_status', got %s", received.Type)
		}
		if received.Status != "online" {
			t.Errorf("Expected status 'online', got %s", received.Status)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Admin should receive driver status update")
	}
}
