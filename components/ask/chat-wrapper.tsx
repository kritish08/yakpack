'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Plus, Trash2, X, MessageSquare } from 'lucide-react'
import ChatScreen from './chat-screen'

const STORAGE_KEY = 'yakpack_chats_v1'
const MAX_CONVS   = 30

export interface StoredMessage {
  id:   string
  role: 'user' | 'assistant'
  parts: { type: string; text?: string }[]
}

export interface Conversation {
  id:        string
  title:     string
  createdAt: number
  updatedAt: number
  messages:  StoredMessage[]
}

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVS)))
  } catch { /* storage full — silently skip */ }
}

function titleFrom(messages: StoredMessage[]): string {
  const first = messages.find(m => m.role === 'user')
  const text = first?.parts.find(p => p.type === 'text')?.text ?? ''
  return text.length > 45 ? text.slice(0, 43) + '…' : text || 'New conversation'
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  const d = new Date(ts)
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`
}

// ── History panel ─────────────────────────────────────────────────────────────
interface HistoryPanelProps {
  conversations: Conversation[]
  currentId:     string
  onLoad:        (c: Conversation) => void
  onNew:         () => void
  onDelete:      (id: string) => void
  onClose:       () => void
}

function HistoryPanel({ conversations, currentId, onLoad, onNew, onDelete, onClose }: HistoryPanelProps) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl border-t border-border w-full flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>
        {/* Drag handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-0 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-text-muted" />
            <h2 className="font-display font-bold text-sm uppercase tracking-tight text-text">Chat History</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onNew(); onClose() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-bg font-display font-bold text-xs uppercase tracking-tight"
            >
              <Plus size={12} /> New
            </button>
            <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-border/40">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
              <MessageSquare size={24} className="text-text-dim" />
              <p className="font-mono text-xs text-text-muted">No saved conversations yet.</p>
              <p className="font-mono text-[10px] text-text-dim">Start chatting and it&apos;ll appear here.</p>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === currentId
              const msgCount = conv.messages.filter(m => m.role === 'user').length
              return (
                <div
                  key={conv.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    isActive ? 'bg-accent/5' : 'hover:bg-surface-2'
                  }`}
                  onClick={() => { onLoad(conv); onClose() }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-body text-sm truncate ${isActive ? 'text-accent' : 'text-text'}`}>
                      {conv.title}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim mt-0.5">
                      {timeAgo(conv.updatedAt)} · {msgCount} message{msgCount !== 1 ? 's' : ''}
                      {isActive && <span className="ml-1.5 text-accent">· current</span>}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
                    className="shrink-0 p-1.5 text-text-dim hover:text-accent-3 transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── ChatWrapper ───────────────────────────────────────────────────────────────
interface ChatWrapperProps {
  briefing:          string | null
  defaultCategoryId: number
}

export default function ChatWrapper({ briefing, defaultCategoryId }: ChatWrapperProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId,     setCurrentId]     = useState(() => crypto.randomUUID())
  const [loadedMessages, setLoadedMessages] = useState<StoredMessage[] | null>(null)
  const [showHistory,   setShowHistory]   = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setConversations(loadConversations())
  }, [])

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleSaveMessages = useCallback((messages: StoredMessage[]) => {
    if (messages.length === 0) return
    setConversations(prev => {
      const title  = titleFrom(messages)
      const now    = Date.now()
      const exists = prev.find(c => c.id === currentId)
      let updated: Conversation[]
      if (exists) {
        updated = prev.map(c => c.id === currentId ? { ...c, title, updatedAt: now, messages } : c)
      } else {
        updated = [{ id: currentId, title, createdAt: now, updatedAt: now, messages }, ...prev]
      }
      saveConversations(updated)
      return updated
    })
  }, [currentId])

  function handleNew() {
    setCurrentId(crypto.randomUUID())
    setLoadedMessages(null)
    setShowHistory(false)
  }

  function handleLoad(conv: Conversation) {
    setCurrentId(conv.id)
    setLoadedMessages(conv.messages)
    setShowHistory(false)
  }

  function handleDelete(id: string) {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id)
      saveConversations(updated)
      return updated
    })
    if (id === currentId) handleNew()
  }

  const isLoaded = loadedMessages !== null

  return (
    <>
      {/* Header bar — history + new chat buttons */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
          {isLoaded ? 'Loaded conversation' : 'Ask Pemba'}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-text-muted hover:text-text hover:border-accent/30 transition-colors font-mono text-[10px]"
          >
            <Clock size={11} />
            History
            {conversations.length > 0 && (
              <span className="ml-0.5 font-bold text-accent">{conversations.length}</span>
            )}
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-text-muted hover:text-text hover:border-accent/30 transition-colors font-mono text-[10px]"
          >
            <Plus size={11} />
            New
          </button>
        </div>
      </div>

      {/* The actual chat — key forces re-mount on conversation switch */}
      <ChatScreen
        key={currentId}
        briefing={isLoaded ? null : briefing}
        initialMessages={loadedMessages ?? undefined}
        defaultCategoryId={defaultCategoryId}
        onSaveMessages={handleSaveMessages}
        onShowHistory={() => setShowHistory(true)}
      />

      {showHistory && (
        <HistoryPanel
          conversations={conversations}
          currentId={currentId}
          onLoad={handleLoad}
          onNew={handleNew}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}
