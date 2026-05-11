import { NextResponse } from 'next/server'
import fs from 'node:fs'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { MODEL_CATALOG, type ModelConfig } from '@/lib/models'
import { logger } from '@/lib/logger'

/**
 * Read models directly from openclaw.json agents.defaults.models — these are
 * the models the user explicitly configured, guaranteed to have working auth.
 * Falls back to MODEL_CATALOG if the config is unavailable.
 */
function readConfiguredModels(): ModelConfig[] | null {
  const configPath = config.openclawConfigPath
  if (!configPath || !fs.existsSync(configPath)) return null

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, any>
    const modelsMap: Record<string, any> = parsed?.agents?.defaults?.models ?? {}
    const primaryModel: string = parsed?.agents?.defaults?.model?.primary ?? ''

    const entries = Object.entries(modelsMap)
    if (entries.length === 0) return null

    const models: ModelConfig[] = entries.map(([id, meta]) => {
      const parts = id.split('/')
      const alias = (meta as any)?.alias ?? parts[parts.length - 1]
      const provider = parts[0] ?? 'unknown'
      return {
        alias,
        name: id,
        provider,
        description: '',
        costPer1k: 0,
      }
    })

    // Sort: primary model first
    if (primaryModel) {
      models.sort((a, b) => (a.name === primaryModel ? -1 : b.name === primaryModel ? 1 : 0))
    }

    return models
  } catch (err) {
    logger.warn({ err }, 'models: failed to read openclaw.json configured models')
    return null
  }
}

export async function GET(request: Request) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const models = readConfiguredModels()
  if (models && models.length > 0) {
    return NextResponse.json({ models, source: 'openclaw-config' })
  }

  return NextResponse.json({ models: MODEL_CATALOG, source: 'catalog' })
}
