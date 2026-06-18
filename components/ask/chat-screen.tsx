'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
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

const CLIENT_TOOLS = ['addItems', 'updateItem', 'deleteItem', 'markAsBought']

const QUICK_PROMPTS = [
  "What should I carry today?",
  "Check my packing gaps",
  "Weather at Chandratal?",
  "AMS prevention tips",
]

const INPUT_BAR_H = 60
const NAV_H       = 56

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
    // suppress raw anchor rendering
    a:      ({ children, href }: any) => <span className="underline decoration-dotted">{children ?? href}</span>,
  }
}

export default function ChatScreen({
  briefing,
  defaultCategoryId,
  initialMessages,
  onSaveMessages,
  onShowHistory,
}: ChatScreenProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')

  // Build seed messages: loaded history takes precedence over fresh briefing
  const seedMessages: any[] = initialMessages
    ? (initialMessages as any[])
    : briefing
      ? [{ id: 'briefing', role: 'assistant' as const, parts: [{ type: 'text' as const, text: briefing }] }]
      : []

  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    messages: seedMessages,
  })

  // Save conversation to parent whenever messages settle (status becomes idle)
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

  const isLoading  = status === 'streaming' || status === 'submitted'
  const isStreaming = status === 'streaming'
  const isEmpty    = messages.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Find the first pending client-side tool call
  const pendingToolPart = (messages as any[])
    .flatMap((m: any) => m.parts ?? [])
    .find((p: any) =>
      p.type === 'tool-invocation' &&
      CLIENT_TOOLS.includes(p.toolInvocation?.toolName) &&
      p.toolInvocation?.state === 'input-available'
    )
  const pendingToolName    = pendingToolPart?.toolInvocation?.toolName as string | undefined
  const pendingToolInput   = pendingToolPart?.toolInvocation?.input   ?? null
  const pendingToolCallId  = pendingToolPart?.toolInvocation?.toolCallId ?? null

  async function resolveToolCall(output: object) {
    if (!pendingToolPart) return
    await (addToolResult as any)({
      tool:        pendingToolName,
      toolCallId:  pendingToolCallId,
      output,
    })
  }

  // addItems confirmation
  const addItemsInput = pendingToolName === 'addItems' ? pendingToolInput as AddItemsInput : null

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
    await resolveToolCall({ success: true, added, message: `Added ${added} item${added !== 1 ? 's' : ''}.` })
  }

  // updateItem / deleteItem / markAsBought confirmation
  const actionType  = (pendingToolName && pendingToolName !== 'addItems') ? pendingToolName as ActionType : null
  const actionInput = actionType ? pendingToolInput as UpdateItemInput | DeleteItemInput | MarkAsBoughtInput : null

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
        style={{ paddingBottom: NAV_H + INPUT_BAR_H + 16 }}
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
            {(messages as any[]).map((m: any, msgIdx: number) => {
              const isLastMsg     = msgIdx === messages.length - 1
              const textParts     = (m.parts ?? []).filter((p: any) => p.type === 'text' && p.text)
              const lastTextPart  = textParts[textParts.length - 1]

              return (
                <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">
                      🐂
                    </div>
                  )}
                  <div className={`max-w-[78%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {(m.parts ?? []).map((part: any, i: number) => {
                      if (part.type === 'text' && part.text) {
                        const isUser       = m.role === 'user'
                        const showCursor   = isStreaming && isLastMsg && part === lastTextPart && !isUser
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

                      if (part.type === 'tool-invocation') {
                        const inv = part.toolInvocation
                        // Hide client-confirmed tools from the bubble stream
                        if (CLIENT_TOOLS.includes(inv?.toolName)) return null
                        if (inv?.state === 'input-streaming' || inv?.state === 'input-available') {
                          return (
                            <div key={i} className="px-3.5 py-2 rounded-2xl rounded-bl-sm bg-surface border border-border">
                              <p className="font-mono text-[11px] text-text-muted">
                                Checking {(inv.toolName as string).replace(/([A-Z])/g, ' $1').trim().toLowerCase()}…
                              </p>
                            </div>
                          )
                        }
                      }
                      return null
                    })}
                  </div>
                </div>
              )
            })}

            {/* Typing dots — waiting for first token OR streaming with only tool calls so far */}
            {(() => {
              if (!isLoading) return null
              const lastMsg = (messages as any[]).at(-1)
              // Show dots when: last message is from user (submitted, not yet responded)
              // OR last message is assistant with no visible text yet (tool calls in flight)
              const noVisibleText = !lastMsg || lastMsg.role === 'user' ||
                !(lastMsg.parts ?? []).some((p: any) => p.type === 'text' && p.text?.trim())
              if (!noVisibleText) return null
              return (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">🐂</div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-surface border border-border flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:120ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
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
