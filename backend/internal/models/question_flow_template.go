package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// FlowNode - ReactFlow node yapisi
type FlowNode struct {
	ID       string            `json:"id"`
	Type     string            `json:"type"`
	Position FlowNodePosition  `json:"position"`
	Data     FlowNodeData      `json:"data"`
}

// FlowNodePosition - Node pozisyonu
type FlowNodePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// FlowNodeData - Node verileri
type FlowNodeData struct {
	QuestionText string   `json:"questionText"`
	QuestionType string   `json:"questionType"` // yes_no, multiple_choice, text, number, price, province
	Options      []string `json:"options,omitempty"`
	IsStart      bool     `json:"isStart,omitempty"`
}

// FlowEdge - ReactFlow edge yapisi
type FlowEdge struct {
	ID           string      `json:"id"`
	Source       string      `json:"source"`
	Target       string      `json:"target"`
	SourceHandle *string     `json:"sourceHandle,omitempty"`
	TargetHandle *string     `json:"targetHandle,omitempty"`
	Label        *string     `json:"label,omitempty"`
	MarkerEnd    interface{} `json:"markerEnd,omitempty"`
	Style        interface{} `json:"style,omitempty"`
}

// QuestionFlowTemplate - Soru akis sablonu
type QuestionFlowTemplate struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	Name        string      `json:"name" db:"name"`
	Description *string     `json:"description,omitempty" db:"description"`
	FlowNodes   string      `json:"-" db:"flow_nodes"`           // DB'de JSON string
	FlowEdges   string      `json:"-" db:"flow_edges"`           // DB'de JSON string
	Nodes       []FlowNode  `json:"nodes"`                       // API response icin
	Edges       []FlowEdge  `json:"edges"`                       // API response icin
	Category    *string     `json:"category,omitempty" db:"category"`
	Tags        []string    `json:"tags,omitempty" db:"tags"`
	UsageCount  int         `json:"usage_count" db:"usage_count"`
	LastUsedAt  *time.Time  `json:"last_used_at,omitempty" db:"last_used_at"`
	IsActive    bool        `json:"is_active" db:"is_active"`
	IsPublic    bool        `json:"is_public" db:"is_public"`
	CreatedBy   *uuid.UUID  `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

// ParseFlowData - JSON string'lerini struct'lara donusturur
func (t *QuestionFlowTemplate) ParseFlowData() error {
	if t.FlowNodes != "" {
		if err := json.Unmarshal([]byte(t.FlowNodes), &t.Nodes); err != nil {
			return err
		}
	}
	if t.FlowEdges != "" {
		if err := json.Unmarshal([]byte(t.FlowEdges), &t.Edges); err != nil {
			return err
		}
	}
	return nil
}

// QuestionFlowTemplateCreateRequest - Yeni sablon olusturma istegi
type QuestionFlowTemplateCreateRequest struct {
	Name        string     `json:"name" binding:"required"`
	Description *string    `json:"description,omitempty"`
	Nodes       []FlowNode `json:"nodes" binding:"required"`
	Edges       []FlowEdge `json:"edges"`
	Category    *string    `json:"category,omitempty"`
	Tags        []string   `json:"tags,omitempty"`
	IsPublic    *bool      `json:"is_public,omitempty"`
}

// QuestionFlowTemplateUpdateRequest - Sablon guncelleme istegi
type QuestionFlowTemplateUpdateRequest struct {
	Name        *string    `json:"name,omitempty"`
	Description *string    `json:"description,omitempty"`
	Nodes       []FlowNode `json:"nodes,omitempty"`
	Edges       []FlowEdge `json:"edges,omitempty"`
	Category    *string    `json:"category,omitempty"`
	Tags        []string   `json:"tags,omitempty"`
	IsActive    *bool      `json:"is_active,omitempty"`
	IsPublic    *bool      `json:"is_public,omitempty"`
}

// QuestionFlowTemplateStats - Sablon istatistikleri
type QuestionFlowTemplateStats struct {
	TotalTemplates   int64 `json:"total_templates"`
	ActiveTemplates  int64 `json:"active_templates"`
	TotalUsageCount  int64 `json:"total_usage_count"`
	AvgNodesPerFlow  float64 `json:"avg_nodes_per_flow"`
	MostUsedCategory string `json:"most_used_category"`
}
