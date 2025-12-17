import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PaperAirplaneIcon,
  BookmarkIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
  FolderIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import {
  PageHeader,
  Badge,
  Button,
  Modal,
  EmptyState,
  LoadingSpinner,
  SearchInput,
} from '../components/ui'
import { questionsApi, driversApi, questionFlowTemplatesApi } from '../services/api'

interface QuestionNodeData {
  questionText: string
  questionType: 'yes_no' | 'multiple_choice' | 'text' | 'number' | 'price' | 'province'
  options?: string[]
  isStart?: boolean
}

interface QuestionTemplate {
  id: string
  name: string
  description?: string
  nodes: Node<QuestionNodeData>[]
  edges: Edge[]
  category?: string
  tags?: string[]
  is_active: boolean
  is_public: boolean
  created_at: string
  updated_at: string
  usage_count: number
}

const questionTypes = [
  { id: 'yes_no', name: 'Evet/Hayir' },
  { id: 'multiple_choice', name: 'Coktan Secmeli' },
  { id: 'text', name: 'Metin' },
  { id: 'number', name: 'Sayi' },
  { id: 'price', name: 'Fiyat (TL)' },
  { id: 'province', name: 'Il Secimi' },
]

// Custom Node Component for Questions
function QuestionNode({ data, selected }: NodeProps<QuestionNodeData>) {
  const isYesNo = data.questionType === 'yes_no'
  const isMultipleChoice = data.questionType === 'multiple_choice'

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg min-w-[250px] max-w-[350px] ${
        data.isStart
          ? 'bg-green-50 border-2 border-green-500'
          : selected
          ? 'bg-blue-50 border-2 border-blue-500'
          : 'bg-white border-2 border-gray-200'
      }`}
    >
      {/* Input Handle */}
      {!data.isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-gray-400"
        />
      )}

      {/* Node Content */}
      <div className="space-y-2">
        {data.isStart && (
          <Badge variant="success" size="sm">Baslangic</Badge>
        )}
        <p className="text-sm font-medium text-gray-900">{data.questionText || 'Soru metni...'}</p>
        <Badge variant="default" size="sm">
          {questionTypes.find(t => t.id === data.questionType)?.name || data.questionType}
        </Badge>

        {isMultipleChoice && data.options && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.options.map((opt, idx) => (
              <span key={idx} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Output Handles for yes/no */}
      {isYesNo ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="w-3 h-3 !bg-green-500 !left-1/4"
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="w-3 h-3 !bg-red-500 !left-3/4"
            style={{ left: '75%' }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
            <span className="text-green-600">Evet</span>
            <span className="text-red-600">Hayir</span>
          </div>
        </>
      ) : isMultipleChoice && data.options ? (
        <>
          {data.options.map((_, idx) => (
            <Handle
              key={idx}
              type="source"
              position={Position.Bottom}
              id={`option-${idx}`}
              className="w-2 h-2 !bg-blue-500"
              style={{ left: `${((idx + 1) / (data.options!.length + 1)) * 100}%` }}
            />
          ))}
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-blue-500"
        />
      )}
    </div>
  )
}

const nodeTypes = {
  question: QuestionNode,
}

// Initial nodes for new flow
const initialNodes: Node<QuestionNodeData>[] = [
  {
    id: 'start',
    type: 'question',
    position: { x: 250, y: 50 },
    data: {
      questionText: 'Baslangic sorusu',
      questionType: 'yes_no',
      isStart: true,
    },
  },
]

const initialEdges: Edge[] = []

export default function QuestionDesignerPage() {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node<QuestionNodeData> | null>(null)
  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')

  // Fetch templates from API
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['question-flow-templates'],
    queryFn: () => questionFlowTemplatesApi.getAll({ limit: 100 }),
    enabled: showTemplates,
  })
  const savedTemplates: QuestionTemplate[] = templatesData?.data?.templates || []

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: {
      name: string
      description?: string
      nodes: Node<QuestionNodeData>[]
      edges: Edge[]
      category?: string
    }) => questionFlowTemplatesApi.create({
      name: data.name,
      description: data.description,
      nodes: data.nodes.map(n => ({
        id: n.id,
        type: n.type || 'question',
        position: n.position,
        data: {
          questionText: n.data.questionText,
          questionType: n.data.questionType,
          options: n.data.options,
          isStart: n.data.isStart,
        },
      })),
      edges: data.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        label: typeof e.label === 'string' ? e.label : undefined,
      })),
      category: data.category || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-flow-templates'] })
      queryClient.invalidateQueries({ queryKey: ['question-flow-categories'] })
      setTemplateName('')
      setTemplateDescription('')
      setTemplateCategory('')
      toast.success('Sablon kaydedildi')
    },
    onError: () => {
      toast.error('Sablon kaydedilemedi')
    },
  })

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => questionFlowTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-flow-templates'] })
      toast.success('Sablon silindi')
    },
    onError: () => {
      toast.error('Sablon silinemedi')
    },
  })

  // Increment usage mutation
  const incrementUsageMutation = useMutation({
    mutationFn: (id: string) => questionFlowTemplatesApi.incrementUsage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-flow-templates'] })
    },
  })

  // Drivers query
  const { data: driversData } = useQuery({
    queryKey: ['all-drivers-for-send'],
    queryFn: () => driversApi.getAll({ limit: 200 }),
    enabled: showSendModal,
  })
  const allDrivers = driversData?.data?.drivers || []

  // Connect nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${connection.sourceHandle || 'default'}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        label: connection.sourceHandle === 'yes' ? 'Evet' : connection.sourceHandle === 'no' ? 'Hayir' : undefined,
        style: {
          stroke: connection.sourceHandle === 'yes' ? '#22c55e' : connection.sourceHandle === 'no' ? '#ef4444' : '#6b7280',
        },
      } as Edge
      setEdges((eds) => addEdge(edge, eds))
    },
    [setEdges]
  )

  // Add new node
  const addNode = () => {
    const newNode: Node<QuestionNodeData> = {
      id: `q-${Date.now()}`,
      type: 'question',
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: {
        questionText: 'Yeni soru',
        questionType: 'yes_no',
      },
    }
    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    setShowNodeEditor(true)
  }

  // Delete selected node
  const deleteSelectedNode = () => {
    if (!selectedNode || selectedNode.data.isStart) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
    setShowNodeEditor(false)
  }

  // Update node data
  const updateNodeData = (updates: Partial<QuestionNodeData>) => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, ...updates } }
          : n
      )
    )
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, ...updates } } : null
    )
  }

  // Save as template
  const saveAsTemplate = () => {
    if (!templateName) {
      toast.error('Sablon adi gerekli')
      return
    }

    createTemplateMutation.mutate({
      name: templateName,
      description: templateDescription || undefined,
      nodes: nodes,
      edges: edges,
      category: templateCategory || undefined,
    })
  }

  // Load template
  const loadTemplate = (template: QuestionTemplate) => {
    // Transform nodes from API format to ReactFlow format
    const loadedNodes: Node<QuestionNodeData>[] = template.nodes.map(n => ({
      id: n.id,
      type: n.type || 'question',
      position: n.position,
      data: {
        questionText: n.data.questionText,
        questionType: n.data.questionType,
        options: n.data.options,
        isStart: n.data.isStart,
      },
    }))

    // Transform edges
    const loadedEdges: Edge[] = template.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: e.sourceHandle === 'yes' ? '#22c55e' : e.sourceHandle === 'no' ? '#ef4444' : '#6b7280',
      },
    }))

    setNodes(loadedNodes)
    setEdges(loadedEdges)
    setShowTemplates(false)

    // Increment usage count
    incrementUsageMutation.mutate(template.id)

    toast.success(`"${template.name}" sablonu yuklendi`)
  }

  // Delete template
  const deleteTemplate = (template: QuestionTemplate) => {
    if (confirm(`"${template.name}" sablonunu silmek istediginize emin misiniz?`)) {
      deleteTemplateMutation.mutate(template.id)
    }
  }

  // Clear canvas
  const clearCanvas = () => {
    if (confirm('Tum sorulari silmek istediginize emin misiniz?')) {
      setNodes(initialNodes)
      setEdges([])
      setSelectedNode(null)
    }
  }

  // Node click handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<QuestionNodeData>) => {
    setSelectedNode(node)
    setShowNodeEditor(true)
  }, [])

  return (
    <div className="h-screen flex flex-col">
      <PageHeader
        title="Soru Akis Tasarimcisi"
        subtitle="Surukle-birak ile algoritmik soru zincirleri olusturun"
        icon={QuestionMarkCircleIcon}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplates(true)} className="gap-2">
              <DocumentDuplicateIcon className="h-5 w-5" />
              Sablonlar
            </Button>
            <Button variant="outline" onClick={clearCanvas} className="gap-2">
              <ArrowPathIcon className="h-5 w-5" />
              Temizle
            </Button>
            <Button onClick={() => setShowSendModal(true)} className="gap-2">
              <PaperAirplaneIcon className="h-5 w-5" />
              Gonder
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex">
        {/* Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
          </ReactFlow>

          {/* Add Node Button */}
          <div className="absolute bottom-4 left-4 z-10">
            <Button onClick={addNode} className="gap-2 shadow-lg">
              <PlusIcon className="h-5 w-5" />
              Soru Ekle
            </Button>
          </div>
        </div>

        {/* Node Editor Sidebar */}
        {showNodeEditor && selectedNode && (
          <div className="w-80 border-l bg-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Soru Duzenle</h3>
              <button onClick={() => setShowNodeEditor(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Question Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni</label>
                <textarea
                  value={selectedNode.data.questionText}
                  onChange={(e) => updateNodeData({ questionText: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Question Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
                <select
                  value={selectedNode.data.questionType}
                  onChange={(e) => updateNodeData({ questionType: e.target.value as QuestionNodeData['questionType'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  disabled={selectedNode.data.isStart}
                >
                  {questionTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Options for multiple choice */}
              {selectedNode.data.questionType === 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secenekler</label>
                  <div className="space-y-2">
                    {(selectedNode.data.options || ['', '']).map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(selectedNode.data.options || ['', ''])]
                          newOptions[idx] = e.target.value
                          updateNodeData({ options: newOptions })
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
                        placeholder={`Secenek ${idx + 1}`}
                      />
                    ))}
                    <button
                      onClick={() => updateNodeData({ options: [...(selectedNode.data.options || []), ''] })}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Secenek Ekle
                    </button>
                  </div>
                </div>
              )}

              {/* Connection Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  {selectedNode.data.questionType === 'yes_no' ? (
                    <>
                      <span className="text-green-600 font-medium">Yesil nokta</span> = Evet cevabi
                      <br />
                      <span className="text-red-600 font-medium">Kirmizi nokta</span> = Hayir cevabi
                    </>
                  ) : (
                    'Alt noktalari surukleyerek sonraki sorulara baglayin'
                  )}
                </p>
              </div>

              {/* Delete Button */}
              {!selectedNode.data.isStart && (
                <Button
                  variant="outline"
                  onClick={deleteSelectedNode}
                  className="w-full gap-2 text-red-600 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Soruyu Sil
                </Button>
              )}
            </div>

            {/* Save as Template */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-gray-900 mb-3">Sablon Olarak Kaydet</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Sablon adi *"
                />
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  placeholder="Aciklama (opsiyonel)"
                />
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Kategori Seciniz</option>
                  <option value="yuk_durumu">Yuk Durumu</option>
                  <option value="musaitlik">Musaitlik</option>
                  <option value="fiyat">Fiyat</option>
                  <option value="konum">Konum</option>
                  <option value="genel">Genel</option>
                </select>
                <Button
                  onClick={saveAsTemplate}
                  className="w-full gap-2"
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <BookmarkIcon className="h-4 w-4" />
                  )}
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <Modal isOpen onClose={() => setShowTemplates(false)} title="Kayitli Sablonlar" size="lg">
          <div className="space-y-3">
            {templatesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : savedTemplates.length === 0 ? (
              <EmptyState
                icon={DocumentDuplicateIcon}
                title="Sablon bulunamadi"
                description="Henuz kayitli sablon yok. Tasarimcinizi kullanarak yeni sablonlar olusturun."
              />
            ) : (
              savedTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{template.name}</p>
                      {!template.is_active && (
                        <Badge variant="warning" size="sm">Pasif</Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-500 truncate">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="default" size="sm">{template.nodes?.length || 0} soru</Badge>
                      <Badge variant="info" size="sm">{template.usage_count} kullanim</Badge>
                      {template.category && (
                        <Badge variant="success" size="sm" className="gap-1">
                          <FolderIcon className="h-3 w-3" />
                          {template.category}
                        </Badge>
                      )}
                      {template.tags?.map((tag, idx) => (
                        <Badge key={idx} variant="default" size="sm" className="gap-1">
                          <TagIcon className="h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTemplate(template)}
                      className="text-red-600 hover:bg-red-50"
                      disabled={deleteTemplateMutation.isPending}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => loadTemplate(template)}>Yukle</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <SendFlowModal
          nodes={nodes}
          edges={edges}
          drivers={allDrivers}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false)
            toast.success('Soru akisi gonderildi')
          }}
        />
      )}
    </div>
  )
}

// Send Flow Modal
function SendFlowModal({
  nodes,
  edges,
  drivers,
  onClose,
  onSuccess,
}: {
  nodes: Node<QuestionNodeData>[]
  edges: Edge[]
  drivers: { id: string; name: string; surname: string; phone: string; province?: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [driverSearch, setDriverSearch] = useState('')
  const [sending, setSending] = useState(false)

  const filteredDrivers = useMemo(() => {
    if (!driverSearch) return drivers
    const search = driverSearch.toLowerCase()
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(search) ||
        d.surname.toLowerCase().includes(search) ||
        d.phone.includes(search)
    )
  }, [drivers, driverSearch])

  const toggleDriver = (id: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const selectAll = () => setSelectedDrivers(filteredDrivers.map((d) => d.id))
  const deselectAll = () => setSelectedDrivers([])

  const handleSend = async () => {
    if (selectedDrivers.length === 0) {
      toast.error('En az bir sofor secin')
      return
    }

    // Get the start node (first question in flow)
    const startNode = nodes.find((n) => n.data.isStart)
    if (!startNode) {
      toast.error('Baslangic sorusu bulunamadi')
      return
    }

    // Build follow-up questions from edges
    const followUpQuestions: Array<{
      condition: Record<string, unknown>
      question: string
      type: string
      options?: string[]
    }> = []

    edges
      .filter((e) => e.source === startNode.id)
      .forEach((e) => {
        const targetNode = nodes.find((n) => n.id === e.target)
        if (!targetNode) return

        followUpQuestions.push({
          condition: {
            answer: e.sourceHandle === 'yes' ? 'true' : e.sourceHandle === 'no' ? 'false' : e.sourceHandle || '',
          },
          question: targetNode.data.questionText,
          type: targetNode.data.questionType,
          options: targetNode.data.options,
        })
      })

    setSending(true)
    try {
      // Send to each driver
      await questionsApi.createBulk({
        driver_ids: selectedDrivers,
        question_text: startNode.data.questionText,
        question_type: startNode.data.questionType,
        options: startNode.data.options,
        follow_up_questions: followUpQuestions,
        send_immediately: true,
      })
      onSuccess()
    } catch {
      toast.error('Gonderilemedi')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Soru Akisini Gonder" size="lg">
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            <strong>{nodes.length}</strong> soru, <strong>{edges.length}</strong> baglanti
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Baslangic: {nodes.find((n) => n.data.isStart)?.data.questionText}
          </p>
        </div>

        {/* Driver Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Sofor Sec</label>
            <Badge variant="info">{selectedDrivers.length} secili</Badge>
          </div>

          <SearchInput
            value={driverSearch}
            onChange={setDriverSearch}
            placeholder="Sofor ara..."
            className="mb-2"
          />

          <div className="flex gap-2 text-sm mb-2">
            <button onClick={selectAll} className="text-primary-600 hover:text-primary-700">
              Tumunu Sec
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={deselectAll} className="text-gray-600 hover:text-gray-700">
              Temizle
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
            {filteredDrivers.map((driver) => (
              <label
                key={driver.id}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  selectedDrivers.includes(driver.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDrivers.includes(driver.id)}
                  onChange={() => toggleDriver(driver.id)}
                  className="rounded border-gray-300 text-primary-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {driver.name} {driver.surname}
                  </p>
                  <p className="text-xs text-gray-500">{driver.phone}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Iptal</Button>
        <Button onClick={handleSend} disabled={sending || selectedDrivers.length === 0}>
          {sending ? <LoadingSpinner size="sm" /> : `${selectedDrivers.length} Sofore Gonder`}
        </Button>
      </div>
    </Modal>
  )
}
