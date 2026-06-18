'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Sparkles } from 'lucide-react'
import ConfirmAddSheet from './confirm-add-sheet'
import { addItem } from '@/app/actions/items'

interface ChatScreenProps {
  briefing: string | null
  defaultCategoryId: number
}

interface AddItemsInput {
  items: {
    name: string
    qty?: string
    status?: 'owned' | 'to_buy' | 'standard'
    assigned_to?: 'kritish' | 'partner' | 'shared'
  }[]
  reason: string
}

const QUICK_PROMPTS = [
  "What should I carry today?",
  "Check my packing gaps",
  "What's the weather at Chandratal?",
  "Tell me about altitude sickness",
]

const INPUT_BAR_H = 60   // px — input bar height
const NAV_H       = 56   // px — bottom nav height

export default function ChatScreen({ briefing, defaultCategoryId }: ChatScreenProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')

  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    messages: briefing ? [{
      id: 'briefing',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: briefing }],
    }] : [],
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const isEmpty   = messages.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Pending addItems tool call (no execute on server)
  const pendingAddPart = (messages as any[])
    .flatMap((m: any) => m.parts ?? [])
    .find((p: any) =>
      p.type === 'tool-invocation' &&
      p.toolInvocation?.toolName === 'addItems' &&
      p.toolInvocation?.state === 'input-available'
    )
  const pendingInput: AddItemsInput | null = pendingAddPart?.toolInvocation?.input ?? null

  async function handleConfirmAdd(items: AddItemsInput['items']) {
    if (!pendingAddPart) return
    let added = 0
    for (const item of items) {
      try {
        await addItem({
          category_id: defaultCategoryId,
          name: item.name,
          qty: item.qty,
          status: item.status ?? 'standard',
          assigned_to: item.assigned_to ?? 'shared',
          scope: (item.assigned_to ?? 'shared') === 'shared' ? 'shared' : 'each',
        })
        added++
      } catch (e) { console.error(e) }
    }
    await (addToolResult as any)({
      tool: 'addItems',
      toolCallId: pendingAddPart.toolInvocation.toolCallId,
      output: { success: true, added, message: `Added ${added} item${added !== 1 ? 's' : ''}.` },
    })
  }

  async function handleDismissAdd() {
    if (!pendingAddPart) return
    await (addToolResult as any)({
      tool: 'addItems',
      toolCallId: pendingAddPart.toolInvocation.toolCallId,
      output: { success: false, message: 'User declined.' },
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage({ text })
  }

  return (
    // Fills the page, but does NOT position fixed — lets the parent layout handle outer scroll.
    // Bottom padding = nav (56) + input bar (60) so messages scroll above both.
    <div className="flex flex-col" style={{ minHeight: '100%' }}>

      {/* ── Messages / empty state ── */}
      <div
        className="flex-1 flex flex-col px-4 pt-4"
        style={{ paddingBottom: NAV_H + INPUT_BAR_H + 12 }}
      >
        {isEmpty ? (
          /* Empty state */
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
          /* Conversation */
          <div className="flex flex-col gap-3">
            {(messages as any[]).map((m: any) => (
              <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">
                    🐂
                  </div>
                )}
                <div className={`max-w-[78%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {(m.parts ?? []).map((part: any, i: number) => {
                    if (part.type === 'text' && part.text) {
                      return (
                        <div key={i} className={`px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-accent text-bg rounded-br-sm'
                            : 'bg-surface border border-border rounded-bl-sm text-text'
                        }`}>
                          {part.text}
                        </div>
                      )
                    }
                    if (part.type === 'tool-invocation') {
                      const inv = part.toolInvocation
                      if (inv?.toolName === 'addItems') return null
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
            ))}

            {/* Typing dots */}
            {isLoading && (messages as any[]).at(-1)?.role === 'user' && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-sm shrink-0 mt-0.5">🐂</div>
                <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-surface border border-border flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar — fixed, sits exactly above the bottom nav ── */}
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

      {pendingAddPart && pendingInput && (
        <ConfirmAddSheet
          items={pendingInput.items}
          reason={pendingInput.reason}
          onConfirm={handleConfirmAdd}
          onDismiss={handleDismissAdd}
        />
      )}
    </div>
  )
}
