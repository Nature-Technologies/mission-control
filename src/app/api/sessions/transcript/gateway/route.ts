import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { parseGatewayHistoryTranscript, parseJsonlTranscript } from '@/lib/transcript-parser'
import { callOpenClawGateway } from '@/lib/openclaw-gateway'

/**
 * GET /api/sessions/transcript/gateway?key=<session-key>&limit=50
 *
 * Reads the JSONL transcript file for a gateway session directly from disk.
 * OpenClaw stores session transcripts at:
 *   {OPENCLAW_STATE_DIR}/agents/{agent}/sessions/{sessionId}.jsonl
 *
 * The session key (e.g. "agent:jarv:cron:task-name") is used to look up
 * the sessionId from the agent's sessions.json, then the JSONL file is read.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const sessionKey = searchParams.get('key') || ''
  const sessionId = searchParams.get('sessionId') || ''
  const agentParam = searchParams.get('agent') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

  if (!sessionKey && !sessionId) {
    return NextResponse.json({ error: 'key or sessionId is required' }, { status: 400 })
  }

  const stateDir = config.openclawStateDir
  // In Docker, the gateway's data volume is mounted separately from the host config dir
  const gatewayStateDir = process.env.OPENCLAW_GATEWAY_STATE_DIR || stateDir
  if (!gatewayStateDir && !stateDir) {
    return NextResponse.json({ messages: [], source: 'gateway', error: 'OPENCLAW_STATE_DIR not configured' })
  }

  try {
    // If given a raw sessionId (not a key), scan disk for the JSONL transcript
    if (!sessionKey && sessionId) {
      const tryDirs = [gatewayStateDir, ...(gatewayStateDir !== stateDir ? [stateDir] : [])]

      // If agent is known, check its directory directly first
      if (agentParam) {
        for (const dir of tryDirs) {
          if (!dir) continue
          const jsonlPath = path.join(dir, 'agents', agentParam, 'sessions', `${sessionId}.jsonl`)
          if (existsSync(jsonlPath)) {
            const raw = readFileSync(jsonlPath, 'utf-8')
            return NextResponse.json({ messages: parseJsonlTranscript(raw, limit), source: 'gateway' })
          }
        }
      }

      // Broad scan across all agents as fallback
      const result = readTranscriptBySessionId(gatewayStateDir || stateDir, sessionId, limit)
        ?? (gatewayStateDir !== stateDir ? readTranscriptBySessionId(stateDir, sessionId, limit) : null)
      if (result) return NextResponse.json(result)
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Session not found' })
    }

    try {
      const history = await callOpenClawGateway<{ messages?: unknown[] }>(
        'chat.history',
        { sessionKey, limit },
        15000,
      )
      const liveMessages = parseGatewayHistoryTranscript(Array.isArray(history?.messages) ? history.messages : [], limit)
      if (liveMessages.length > 0) {
        return NextResponse.json({ messages: liveMessages, source: 'gateway-rpc' })
      }
    } catch (rpcErr) {
      logger.warn({ err: rpcErr, sessionKey }, 'Gateway chat.history failed, falling back to disk transcript')
    }

    // Extract agent name from session key (e.g. "agent:jarv:main" -> "jarv")
    const agentName = extractAgentName(sessionKey)
    if (!agentName) {
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Could not determine agent from session key' })
    }

    // Look up the sessionId from the agent's sessions.json, checking gateway volume first
    const tryDirs = [gatewayStateDir, ...(gatewayStateDir !== stateDir ? [stateDir] : [])]
    let sessionsData: Record<string, any> | null = null
    let resolvedStateDir = gatewayStateDir || stateDir

    for (const dir of tryDirs) {
      if (!dir) continue
      const sf = path.join(dir, 'agents', agentName, 'sessions', 'sessions.json')
      if (existsSync(sf)) {
        try { sessionsData = JSON.parse(readFileSync(sf, 'utf-8')); resolvedStateDir = dir; break } catch { /* try next */ }
      }
    }

    if (!sessionsData) {
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Agent sessions file not found' })
    }

    const sessionEntry = sessionsData[sessionKey]
    if (!sessionEntry?.sessionId) {
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Session not found in sessions.json' })
    }

    const resolvedId = sessionEntry.sessionId
    const jsonlPath = path.join(resolvedStateDir, 'agents', agentName, 'sessions', `${resolvedId}.jsonl`)
    if (!existsSync(jsonlPath)) {
      return NextResponse.json({ messages: [], source: 'gateway', error: 'Session JSONL file not found' })
    }

    const raw = readFileSync(jsonlPath, 'utf-8')
    const messages = parseJsonlTranscript(raw, limit)

    return NextResponse.json({ messages, source: 'gateway' })
  } catch (err: any) {
    logger.warn({ err, sessionKey }, 'Gateway session transcript read failed')
    return NextResponse.json({ messages: [], source: 'gateway', error: 'Failed to read session transcript' })
  }
}

/** Scan all agents to find a JSONL by raw session UUID. */
function readTranscriptBySessionId(stateDir: string, sessionId: string, limit: number) {
  const { readdirSync } = require('fs') as typeof import('fs')
  const agentsDir = path.join(stateDir, 'agents')
  if (!existsSync(agentsDir)) return null

  let agentDirs: string[]
  try { agentDirs = readdirSync(agentsDir) } catch { return null }

  for (const agentName of agentDirs) {
    const jsonlPath = path.join(agentsDir, agentName, 'sessions', `${sessionId}.jsonl`)
    if (existsSync(jsonlPath)) {
      try {
        const raw = readFileSync(jsonlPath, 'utf-8')
        const messages = parseJsonlTranscript(raw, limit)
        return { messages, source: 'gateway' }
      } catch { /* try next */ }
    }
  }
  return null
}

function extractAgentName(sessionKey: string): string | null {
  const parts = sessionKey.split(':')
  if (parts.length >= 2 && parts[0] === 'agent') {
    return parts[1]
  }
  return null
}

export const dynamic = 'force-dynamic'
