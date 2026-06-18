'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ConfirmAddSheet from './confirm-add-sheet'
import ConfirmActionSheet, { type ActionType, type UpdateItemInput, type DeleteItemInput, type MarkAsBoughtInput } from './confirm-action-sheet'
import { addItem, updateItem as updateItemAction, deleteItem as deleteItemAction } from '@/app/actions/items'

import type { StoredMessage } from './chat-wrapper'

interface ChatScreenProps {
  briefing:          string | null
  defaultCategoryId: number
  initialMessages?:  StoredMessage[]
  initialInput?:     string
  onSaveMessages?:   (messages: StoredMessage[]) => void
  onShowHistory?:    () => void
}

interface AddItemsInput {
  items: {
    name: string
    qty?: string
    status?: 'owned' | 'to_buy' | 'standard'
    assigned_to?: 'kritish' | 'partner' | 'shared'
    category_id?: number
  }[]
  reason: string
}

// Tools that require a client-side confirmation sheet before they take effect.
const CLIENT_TOOLS = ['addItems', 'updateItem', 'deleteItem', 'markAsBought'] as const

// Human-readable label for read-tool progress chips.
const READ_TOOL_LABEL: Record<string, string> = {
  getCurrentLeg:   'checking today’s leg',
  getItinerary:    'reading the itinerary',
  getWeather:      'fetching weather',
  getCategories:   'loading categories',
  getPackingState: 'reviewing your packing list',
}

const QUICK_PROMPTS = [
  "What should I carry today?",
  "Check my packing gaps",
  "Weather at Chandratal?",
  "AMS prevention tips",
]

const INPUT_BAR_H = 60
const NAV_H       = 56

// In AI SDK v6, tool parts are typed `tool-<name>`; the tool name is the suffix.
function toolNameOf(part: any): string | null {
  if (typeof part?.type !== 'string') return null
  if (part.type === 'dynamic-tool') return part.toolName ?? null
  return part.type.startsWith('tool-') ? part.type.slice('tool-'.length) : null
}

// Markdown component factories — different colours for user vs assistant bubbles
function mkComponents(isUser: boolean) {
  const baseCode = isUser ? 'bg-bg/20 text-bg' : 'bg-border/30 text-text'
  return {
    p:      ({ children }: any) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    em:     ({ children }: any) => <em className="italic">{children}</em>,
    ul:     ({ children }: any) => <ul className="list-disc list-inside mb-1.5 space-y-0.5 pl-1">{children}</ul>,
    ol:     ({ children }: any) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5 pl-1">{children}</ol>,
    li:     ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    code:   ({ children }: any) => <code className={`font-mono text-[11px] px-1 py-0.5 rounded ${baseCode}`}>{children}</code>,
    hr:     () => <hr className="border-border/40 my-2" />,
    a:      ({ children, href }: any) => <span className="underline decoration-dotted">{children ?? href}</span>,
  }
}

export default function ChatScreen({
  briefing,
  defaultCategoryId,
  initialMessages,
  initialInput,
  onSaveMessages,
}: ChatScreenProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState(initialInput ?? '')

  // Build seed messages: loaded history takes precedence over fresh briefing
  const seedMessages: any[] = initialMessages
    ? (initialMessages as any[])
    : briefing
      ? [{ id: 'briefing', role: 'assistant' as const, parts: [{ type: 'text' as const, text: briefing }] }]
      : []

  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    messages: seedMessages,
    // After the client resolves a confirmation tool, automatically send the
    // result back so Pemba can acknowledge and continue the conversation.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  // Save conversation to parent whenever messages settle
  const prevStatus = useRef(status)
  useEffect(() => {
    const wasActive = prevStatus.current === 'streaming' || prevStatus.current === 'submitted'
    const isIdle    = status === 'ready' || status === 'error'
    if (wasActive && isIdle && messages.length > 0 && onSaveMessages) {
      onSaveMessages(messages as any as StoredMessage[])
    }
    prevStatus.current = status
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const isLoading   = status === 'streaming' || status === 'submitted'
  const isStreaming = status === 'streaming'
  const isEmpty     = messages.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, status])

  // ── Find the first pending client-side tool call (state: input-available) ──
  const pending = useMemo(() => {
    for (const m of messages as any[]) {
      if (m.role !== 'assistant') continue
      for (const part of m.parts ?? []) {
        const name = toolNameOf(part)
        if (name && (CLIENT_TOOLS as readonly string[]).includes(name) && part.state === 'input-available') {
          return { name, input: part.input, toolCallId: part.toolCallId }
        }
      }
    }
    return null
  }, [messages])

  async function resolveToolCall(output: object) {
    if (!pending) return
    await (addToolResult as any)({
      tool:       pending.name,
      toolCallId: pending.toolCallId,
      output,
    })
  }

  // addItems confirmation
  const addItemsInput = pending?.name === 'addItems' ? pending.input as AddItemsInput : null

  async function handleConfirmAdd(items: AddItemsInput['items']) {
    let added = 0
    for (const item of items) {
      try {
        await addItem({
          category_id: item.category_id ?? defaultCategoryId,
          name:        item.name,
          qty:         item.qty,
          status:      item.status ?? 'standard',
          assigned_to: item.assigned_to ?? 'shared',
          scope:       (item.assigned_to ?? 'shared') === 'shared' ? 'shared' : 'each',
        })
        added++
      } catch (e) { console.error(e) }
    }
    await resolveToolCall({ success: true, added, message: `Added ${added} item${added !== 1 ? 's' : ''} to the list.` })
  }

  // updateItem / deleteItem / markAsBought confirmation
  const actionType  = (pending && pending.name !== 'addItems') ? pending.name as ActionType : null
  const actionInput = actionType ? pending!.input as UpdateItemInput | DeleteItemInput | MarkAsBoughtInput : null

  async function handleConfirmAction() {
    if (!actionType || !actionInput) return
    try {
      if (actionType === 'updateItem') {
        const u = actionInput as UpdateItemInput
        await updateItemAction(u.id, u.changes)
      } else if (actionType === 'deleteItem') {
        const d = actionInput as DeleteItemInput
        await deleteItemAction(d.id)
      } else if (actionType === 'markAsBought') {
        const m = actionInput as MarkAsBoughtInput
        await updateItemAction(m.id, { status: 'owned' })
      }
      await resolveToolCall({ success: true, message: 'Done.' })
    } catch (e) {
      await resolveToolCall({ success: false, message: String(e) })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage({ text })
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>

      {/* ── Messages ── */}
      <div
        className="flex-1 flex flex-col px-4 pt-4"
        style={{ paddingBottom: NAV_H + INPUT_BAR_H + 32 }}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 py-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl">
              🐂
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-base uppercase tracking-tight text-text">Ask Pemba</p>
              <p className="font-mono text-xs text-text-muted mt-1 leading-relaxed max-w-[260px]">
                Weather · packing gaps · altitude tips · anything about the trip
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => { sendMessage({ text: p }); inputRef.current?.focus() }}
                  className="text-left px-3 py-2.5 rounded-xl bg-surface border border-border text-text-muted font-body text-xs leading-snug hover:border-accent/40 hover:text-text active:scale-95 transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(() => {
              const msgs = messages as any[]
              const lastMsg = msgs.at(-1)

              // Does the in-flight assistant turn already own a visible bubble?
              // True when the last message is an assistant with renderable text
              // or a visible read-tool chip — in that case its dots live inside it.
              const hasRenderable = (m: any) => {
                const parts = m?.parts ?? []
                const hasText = parts.some((p: any) => p.type === 'text' && p.text?.trim())
                const hasReadChip = parts.some((p: any) => {
                  const name = toolNameOf(p)
                  return name
                    && !(CLIENT_TOOLS as readonly string[]).includes(name)
                    && (p.state === 'input-streaming' || p.state === 'input-available')
                })
                return hasText || hasReadChip
              }

              // The active assistant turn is "bubble-less" when loading and the
              // last message is a user turn, or an assistant turn that currently
              // renders nothing (all client-tool parts → null). In that case we
              // emit a single standalone assistant bubble holding the dots.
              const needsStandaloneDots =
                isLoading && (!lastMsg || lastMsg.role === 'user' || !hasRenderable(lastMsg))

              return (
                <>
                  {msgs.map((m: any, msgIdx: number) => {
                    const isLastMsg    = msgIdx === messages.length - 1
                    const textParts    = (m.parts ?? []).filter((p: any) => p.type === 'text' && p.text)
                    const lastTextPart = textParts[textParts.length - 1]

                    // 1a/1d: never render a lone assistant avatar+empty bubble.
                    // Skip any assistant row with zero renderable content — its
                    // dots (if it's the active turn) come from the standalone block.
                    if (m.role === 'assistant' && !hasRenderable(m)) return null

                    // 1b: this assistant turn is active + visible → show dots
                    // inside its own bubble until the first text token arrives.
                    const showInlineDots =
                      m.role === 'assistant' && isLastMsg && isLoading && textParts.length === 0

                    return (
                      <div key={m.id ?? msgIdx} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">
                            🐂
                          </div>
                        )}
                        <div className={`max-w-[78%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                          {(m.parts ?? []).map((part: any, i: number) => {
                            // ── Text ──
                            if (part.type === 'text' && part.text) {
                              const isUser     = m.role === 'user'
                              const showCursor = isStreaming && isLastMsg && part === lastTextPart && !isUser
                              return (
                                <div
                                  key={i}
                                  className={`px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed ${
                                    isUser
                                      ? 'bg-accent text-bg rounded-br-sm'
                                      : 'bg-surface border border-border rounded-bl-sm text-text'
                                  }`}
                                >
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mkComponents(isUser)}>
                                    {part.text}
                                  </ReactMarkdown>
                                  {showCursor && (
                                    <span className="inline-block w-0.5 h-[1em] bg-accent/70 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
                                  )}
                                </div>
                              )
                            }

                            // ── Tool parts (v6: type `tool-<name>`) ──
                            const toolName = toolNameOf(part)
                            if (toolName) {
                              // Client-confirmed tools are surfaced via the sheet, not the stream.
                              if ((CLIENT_TOOLS as readonly string[]).includes(toolName)) return null
                              // Read tools: show a small progress chip while running.
                              if (part.state === 'input-streaming' || part.state === 'input-available') {
                                return (
                                  <div key={i} className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-surface border border-border">
                                    <p className="font-mono text-[11px] text-text-muted flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
                                      {READ_TOOL_LABEL[toolName] ?? `running ${toolName}`}…
                                    </p>
                                  </div>
                                )
                              }
                              return null
                            }
                            return null
                          })}

                          {/* 1b: dots inside this same bubble (read-chip visible
                              but no text yet) → one avatar, dots become text. */}
                          {showInlineDots && (
                            <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-surface border border-border flex gap-1.5 items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:120ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:240ms]" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* 1b: single standalone assistant bubble with dots when the
                      active turn has no visible bubble of its own yet. */}
                  {needsStandaloneDots && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">🐂</div>
                      <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-surface border border-border flex gap-1.5 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:120ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:240ms]" />
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div
        className="fixed inset-x-0 z-40 bg-bg/95 backdrop-blur-sm border-t border-border px-3 py-2.5"
        style={{ bottom: NAV_H, height: INPUT_BAR_H }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-center h-full">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Pemba anything…"
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 h-10 bg-surface border border-border rounded-xl px-3.5 text-sm text-text font-body outline-none focus:border-accent/60 transition-colors placeholder:text-text-dim disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center disabled:opacity-35 active:scale-90 transition-all shrink-0"
            aria-label="Send"
          >
            {isLoading
              ? <Sparkles size={15} className="text-bg animate-pulse" />
              : <Send size={15} className="text-bg" />}
          </button>
        </form>
      </div>

      {/* ── Confirmation sheets ── */}
      {addItemsInput && (
        <ConfirmAddSheet
          items={addItemsInput.items}
          reason={addItemsInput.reason}
          onConfirm={handleConfirmAdd}
          onDismiss={() => resolveToolCall({ success: false, message: 'User declined.' })}
        />
      )}

      {actionType && actionInput && (
        <ConfirmActionSheet
          type={actionType}
          input={actionInput}
          onConfirm={handleConfirmAction}
          onDismiss={() => resolveToolCall({ success: false, message: 'User declined.' })}
        />
      )}
    </div>
  )
}
