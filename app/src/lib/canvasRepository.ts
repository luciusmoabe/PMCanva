import { supabase } from './supabase'

export type PersistedCanvas = {
  blocks: unknown
  status: string
  version: number
}

const canvasKey = 'projectly-demo-canvas'

export async function loadCanvas(): Promise<PersistedCanvas | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('project_canvases')
    .select('blocks, status, version')
    .eq('canvas_key', canvasKey)
    .maybeSingle()

  if (error) {
    console.warn('Supabase canvas load failed:', error.message)
    return null
  }

  return data
}

export async function saveCanvas(canvas: PersistedCanvas): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('project_canvases').upsert({
    canvas_key: canvasKey,
    blocks: canvas.blocks,
    status: canvas.status,
    version: canvas.version,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'canvas_key' })

  if (error) console.warn('Supabase canvas save failed:', error.message)
}
