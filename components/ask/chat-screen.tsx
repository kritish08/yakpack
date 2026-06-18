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

export default function ChatScreen({ briefing, defaultCategoryId }: ChatScreenProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Find pending addItems tool call (no execute on server → state stays 'input-available')
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
      } catch (e) {
        console.error('Failed to add item:', e)
      }
    }
    await (addToolResult as any)({
      tool: 'addItems',
      toolCallId: pendingAddPart.toolInvocation.toolCallId,
      output: { success: true, added, message: `Added ${added} item${added !== 1 ? 's' : ''} to your pack.` },
    })
  }

  async function handleDismissAdd() {
    if (!pendingAddPart) return
    await (addToolResult as any)({
      tool: 'addItems',
      toolCallId: pendingAddPart.toolInvocation.toolCallId,
      output: { success: false, message: 'User declined to add items.' },
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage({ text })
  }

  const QUICK_PROMPTS = [
    "What should I carry today?",
    "Am I missing anything critical?",
    "What's the weather like at Chandratal?",
    "Tell me about altitude sickness",
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-8 pb-4 gap-3">
            <span className="text-5xl">🐂</span>
            <p className="font-display font-bold text-lg uppercase tracking-tight text-text">Ask Pemba</p>
            <p className="font-mono text-xs text-text-muted text-center leading-relaxed max-w-xs">
              Your AI yak for Spiti. Ask about weather, what to pack, altitude tips, or anything trip-related.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => { setInput(''); sendMessage({ text: p }) }}
                  className="text-left px-3 py-2.5 rounded-xl bg-surface border border-border text-text-muted font-body text-sm hover:border-accent/40 hover:text-text transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {(messages as any[]).map((m: any) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {m.role === 'assistant' && (
              <span className="text-xl shrink-0 mt-1">🐂</span>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              m.role === 'user'
                ? 'bg-accent text-bg rounded-br-sm'
                : 'bg-surface border border-border rounded-bl-sm'
            }`}>
              {(m.parts ?? []).map((part: any, i: number) => {
                if (part.type === 'text') {
                  return (
                    <p key={i} className={`font-body text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-bg' : 'text-text'}`}>
                      {part.text}
                    </p>
                  )
                }
                if (part.type === 'tool-invocation') {
                  const inv = part.toolInvocation
                  if (inv?.toolName === 'addItems') return null // handled by confirm sheet
                  if (inv?.state === 'input-streaming' || inv?.state === 'input-available') {
                    return (
                      <p key={i} className="font-mono text-xs text-text-muted italic">
                        Checking {(inv.toolName as string).replace(/([A-Z])/g, ' $1').toLowerCase()}…
                      </p>
                    )
                  }
                  return null
                }
                return null
              })}
            </div>
          </div>
        ))}

        {isLoading && (messages as any[])[(messages as any[]).length - 1]?.role === 'user' && (
          <div className="flex justify-start gap-2">
            <span className="text-xl">🐂</span>
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-20 pt-2 border-t border-border/50">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Pemba anything…"
            disabled={isLoading}
            className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-text font-body outline-none focus:border-accent transition-colors placeholder:text-text-dim disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-accent text-bg flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
            aria-label="Send"
          >
            {isLoading ? <Sparkles size={16} className="animate-pulse" /> : <Send size={16} />}
          </button>
        </form>
      </div>

      {/* Confirm add sheet */}
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
