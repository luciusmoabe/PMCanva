import { supabase } from './supabase'

export type PersistedCanvas = {
  blocks: unknown
  status: string
  version: number
  project_name?: string
  manager_name?: string
}

const canvasKey = 'projectly-demo-canvas'

export async function loadCanvas(): Promise<PersistedCanvas | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('project_canvases')
    .select('blocks, status, version, project_name, manager_name')
    .eq('canvas_key', canvasKey)
    .maybeSingle()

  if (error) {
    console.warn('Supabase canvas load failed:', error.message)
    return null
  }

  if (!data || !Array.isArray(data.blocks) || data.blocks.length === 0) return null

  return data
}

export async function saveCanvas(canvas: PersistedCanvas): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('project_canvases').upsert({
    canvas_key: canvasKey,
    blocks: canvas.blocks,
    status: canvas.status,
    version: canvas.version,
    project_name: canvas.project_name,
    manager_name: canvas.manager_name,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'canvas_key' })

  if (error) console.warn('Supabase canvas save failed:', error.message)
}

export function subscribeToCanvas(onChange: (canvas: PersistedCanvas) => void, onStatus?: (status: 'online' | 'offline') => void) {
  if (!supabase) {
    onStatus?.('offline')
    return () => undefined
  }
  const client = supabase

  const channel = client
    .channel('projectly-demo-canvas-realtime')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_canvases',
      filter: `canvas_key=eq.${canvasKey}`,
    }, (payload) => {
      const record = payload.new as PersistedCanvas
      if (Array.isArray(record.blocks) && record.blocks.length > 0) onChange(record)
    })
    .subscribe((status) => {
      onStatus?.(status === 'SUBSCRIBED' ? 'online' : 'offline')
    })

  return () => { void client.removeChannel(channel) }
}
