'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Session } from '@/types'
import { formatAge, parseTokenUsage } from '@/lib/utils'

interface SessionsListProps {
  sessions: Session[]
}

// ─── Transcript types ────────────────────────────────────────────────────────

interface MessagePart {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
  text?: string
  thinking?: string
  name?: string
  input?: string
  content?: string
  isError?: boolean
}

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system'
  parts: MessagePart[]
  timestamp?: string
}

// ─── Transcript drawer ───────────────────────────────────────────────────────

function TranscriptDrawer({ sessionKey, isActive, onClose }: { sessionKey: string; isActive: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string>('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    fetch(`/api/sessions/transcript/gateway?key=${encodeURIComponent(sessionKey)}&limit=100`)
      .then(r => r.json())
      .then(data => {
        if (data.error && (!data.messages || data.messages.length === 0)) {
          if (!silent) setError(data.error)
        } else {
          setMessages(data.messages || [])
          setSource(data.source || '')
        }
      })
      .catch(e => { if (!silent) setError(e.message) })
      .finally(() => { if (!silent) setLoading(false) })
  }, [sessionKey])

  useEffect(() => { load() }, [load])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = messages.length
  }, [messages.length])

  // Poll while session is active
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => load(true), 4000)
    return () => clearInterval(id)
  }, [isActive, load])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', message: text }),
      })
      setInput('')
      setTimeout(() => load(true), 800)
    } finally {
      setSending(false)
    }
  }, [input, sending, sessionKey, load])

  const renderPart = (part: MessagePart, i: number) => {
    if (part.type === 'text' && part.text) {
      return (
        <p key={i} className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
          {part.text}
        </p>
      )
    }
    if (part.type === 'thinking' && part.thinking) {
      return (
        <details key={i} className="text-xs text-muted-foreground border border-border/50 rounded p-2">
          <summary className="cursor-pointer select-none">Thinking...</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs opacity-70">{part.thinking}</pre>
        </details>
      )
    }
    if (part.type === 'tool_use') {
      return (
        <div key={i} className="font-mono text-xs bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 text-blue-300">
          Tool: {part.name}({part.input})
        </div>
      )
    }
    if (part.type === 'tool_result') {
      return (
        <div key={i} className={`font-mono text-xs rounded px-2 py-1 ${part.isError ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-green-500/10 border border-green-500/20 text-green-300'}`}>
          {part.content}
        </div>
      )
    }
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" />

      {/* Drawer panel */}
      <div
        className="w-full max-w-2xl bg-background border-l border-border flex flex-col h-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Session Chat</h3>
            <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{sessionKey}</p>
          </div>
          <div className="flex items-center gap-2">
            {source && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {source}
              </span>
            )}
            <button
              onClick={() => load()}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
              title="Refresh"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground w-7 h-7 flex items-center justify-center rounded hover:bg-secondary transition-colors"
            >
              x
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading transcript...
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">{error}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">The session may still be starting or the transcript isn&apos;t available yet.</p>
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No messages yet.
            </div>
          )}
          {!loading && messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                msg.role === 'assistant' ? 'bg-primary/20 text-primary' :
                msg.role === 'user' ? 'bg-secondary text-muted-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {msg.role === 'assistant' ? 'A' : msg.role === 'user' ? 'U' : 'S'}
              </div>
              <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {msg.timestamp && (
                  <span className="text-xs text-muted-foreground/50 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
                <div className={`rounded-lg px-3 py-2 space-y-1.5 ${
                  msg.role === 'assistant' ? 'bg-card border border-border' :
                  msg.role === 'user' ? 'bg-primary/10 border border-primary/20' :
                  'bg-muted/50 border border-border text-muted-foreground'
                }`}>
                  {msg.parts.map((part, i) => renderPart(part, i))}
                  {msg.parts.length === 0 && (
                    <span className="text-xs text-muted-foreground/50 italic">empty</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs text-green-400/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Agent is working...
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={isActive ? 'Send a message to the agent...' : 'Session is idle — send a message to resume...'}
              rows={1}
              className="flex-1 resize-none rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground/50">Enter to send, Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: Session
  onViewChat: (key: string) => void
}

function SessionCard({ session, onViewChat }: SessionCardProps) {
  const tokenUsage = parseTokenUsage(session.tokens)

  const getSessionTypeIcon = (key: string) => {
    if (key.includes('main:main')) return '👑'
    if (key.includes('subagent')) return '🤖'
    if (key.includes('cron')) return '⏰'
    if (key.includes('group')) return '👥'
    return '📄'
  }

  const getModelColor = (model: string) => {
    if (model.includes('opus')) return 'text-purple-400'
    if (model.includes('sonnet')) return 'text-blue-400'
    if (model.includes('haiku')) return 'text-green-400'
    if (model.includes('deepseek')) return 'text-orange-400'
    if (model.includes('gemini')) return 'text-cyan-400'
    return 'text-gray-400'
  }

  const getRoleBadge = (key: string) => {
    if (key.includes('main:main')) {
      return { label: 'LEAD', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
    }
    if (key.includes('subagent')) {
      return { label: 'WORKER', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    }
    if (key.includes('cron')) {
      return { label: 'CRON', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
    }
    return { label: 'SESSION', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  }

  const getCurrentTask = (session: Session) => {
    if (session.label && session.label !== session.key.split(':').pop()) {
      return session.label
    }
    const parts = session.key.split(':')
    if (parts.length > 3 && parts[2] === 'subagent') {
      return parts[3] || 'Unknown task'
    }
    return session.active ? 'Active' : 'Idle'
  }

  const roleBadge = getRoleBadge(session.key)
  const currentTask = getCurrentTask(session)
  const hasGatewayKey = session.key?.startsWith('agent:')

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer group"
      onClick={() => onViewChat(session.key)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className={`text-xl ${session.active ? 'working-indicator' : ''}`}>
            {getSessionTypeIcon(session.key)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-foreground truncate">
                {session.key.split(':').pop() || session.key}
              </h4>
              <span className={`px-2 py-0.5 text-xs font-bold border rounded-full ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>

            <div className="text-xs text-muted-foreground mb-1">
              <span className="font-medium">{currentTask}</span>
            </div>

            <p className="text-xs text-muted-foreground/70 truncate">
              {session.key}
            </p>

            <div className="flex items-center space-x-2 mt-2">
              <span className={`text-xs font-mono ${getModelColor(session.model)}`}>
                {session.model}
              </span>
              <span className="text-xs text-muted-foreground">
                • {formatAge(session.age)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1">
          <div className={`px-2 py-1 rounded-full border text-xs font-medium ${
            session.active
              ? 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse'
              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          }`}>
            {session.active ? 'WORKING' : 'IDLE'}
          </div>

          {/* View Chat button — shown on hover or always when gateway session */}
          {hasGatewayKey && (
            <button
              onClick={e => { e.stopPropagation(); onViewChat(session.key) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded hover:bg-primary/20"
            >
              View Chat
            </button>
          )}

          {session.tokens !== '-' && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {session.tokens}
              </div>
              {tokenUsage.total > 0 && (
                <div className="w-16 h-1 bg-secondary rounded-full mt-1">
                  <div
                    className={`h-full rounded-full ${
                      tokenUsage.percentage > 80 ? 'bg-red-400' :
                      tokenUsage.percentage > 60 ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(tokenUsage.percentage, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {session.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.flags.map((flag, index) => (
            <span key={index} className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sessions list ────────────────────────────────────────────────────────────

export function SessionsList({ sessions }: SessionsListProps) {
  const [activeTranscript, setActiveTranscript] = useState<{ key: string; isActive: boolean } | null>(null)

  const activeSessions = sessions.filter(s => s.active)
  const idleSessions = sessions.filter(s => !s.active)

  const openChat = (key: string) => {
    const session = sessions.find(s => s.key === key)
    setActiveTranscript({ key, isActive: session?.active ?? false })
  }

  return (
    <>
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Active Sessions</h3>
          <p className="text-sm text-muted-foreground">
            {sessions.length} total • {activeSessions.length} active • click any session to view chat
          </p>
        </div>

        <div className="p-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">🤖</div>
              <p>No sessions active</p>
              <p className="text-xs">Sessions will appear here when agents start</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                    Active ({activeSessions.length})
                  </h4>
                  <div className="space-y-2">
                    {activeSessions.map(session => (
                      <SessionCard key={session.id} session={session} onViewChat={openChat} />
                    ))}
                  </div>
                </div>
              )}

              {idleSessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                    Idle ({idleSessions.length})
                  </h4>
                  <div className="space-y-2">
                    {idleSessions.map(session => (
                      <SessionCard key={session.id} session={session} onViewChat={openChat} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeTranscript && (
        <TranscriptDrawer
          sessionKey={activeTranscript.key}
          isActive={activeTranscript.isActive}
          onClose={() => setActiveTranscript(null)}
        />
      )}
    </>
  )
}
