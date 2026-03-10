import { useState } from 'react'
import type { AiAgentConfig, AiAgentId, AiLayout } from '../../shared/contracts'
import { termidiuApi } from '../lib/termidiu-api'
import type { FontSizes } from '../hooks/use-font-sizes'
import { FONT_MIN, FONT_MAX } from '../hooks/use-font-sizes'

const AI_META: Record<AiAgentId, { name: string; color: string; web?: boolean }> = {
  claude:     { name: 'Claude',     color: '#d4915c' },
  gemini:     { name: 'Gemini',     color: '#4285f4' },
  codex:      { name: 'Codex',      color: '#10a37f' },
  perplexity: { name: 'Perplexity', color: '#20b2aa', web: true },
}

type SettingsModalProps = {
  agents: AiAgentConfig[]
  fontSizes: FontSizes
  onFontSizeChange: (key: keyof FontSizes, delta: number) => void
  onClose: () => void
  onSaved: (agents: AiAgentConfig[]) => void
}

export function SettingsModal({ agents: initial, fontSizes, onFontSizeChange, onClose, onSaved }: SettingsModalProps) {
  const [agents, setAgents] = useState<AiAgentConfig[]>(initial)
  const [saving, setSaving] = useState(false)

  function toggle(id: AiAgentId) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  function setLayout(id: AiAgentId, layout: AiLayout) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, layout } : a))
  }

  async function handleSave() {
    setSaving(true)
    const state = await termidiuApi.saveAiAgents(agents)
    onSaved(state.aiAgents)
    setSaving(false)
    onClose()
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" type="button" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          <div className="settings-section-title">Display</div>
          <div className="settings-font-list">
            {([
              { key: 'tree',     label: 'File tree' },
              { key: 'editor',   label: 'Editor' },
              { key: 'terminal', label: 'Terminal' },
            ] as { key: keyof FontSizes; label: string }[]).map(({ key, label }) => (
              <div key={key} className="settings-font-row">
                <span className="settings-font-label">{label}</span>
                <div className="settings-font-controls">
                  <button
                    className="settings-font-btn"
                    type="button"
                    disabled={fontSizes[key] <= FONT_MIN}
                    onClick={() => onFontSizeChange(key, -1)}
                  >−</button>
                  <span className="settings-font-value">{fontSizes[key]}px</span>
                  <button
                    className="settings-font-btn"
                    type="button"
                    disabled={fontSizes[key] >= FONT_MAX}
                    onClick={() => onFontSizeChange(key, +1)}
                  >+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="settings-section-title" style={{ marginTop: 20 }}>AI Agents</div>
          <div className="settings-ai-list">
            {agents.map(agent => {
              const meta = AI_META[agent.id]
              return (
                <div key={agent.id} className={`settings-ai-row ${agent.enabled ? 'enabled' : ''}`}>
                  <div className="settings-ai-header">
                    <button
                      className={`settings-toggle ${agent.enabled ? 'on' : 'off'}`}
                      type="button"
                      onClick={() => toggle(agent.id)}
                      aria-label={agent.enabled ? 'Disable' : 'Enable'}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                    <span className="settings-ai-dot" style={{ background: meta.color }} />
                    <span className="settings-ai-name">{meta.name}</span>
                  </div>

                  {agent.enabled && !meta.web && (
                    <div className="settings-ai-options">
                      <span className="settings-option-label">Layout</span>
                      <div className="settings-layout-pills">
                        {(['1', '1+1', '1+2', '2+2'] as AiLayout[]).map(l => (
                          <button
                            key={l}
                            className={`settings-pill ${agent.layout === l ? 'active' : ''}`}
                            type="button"
                            onClick={() => setLayout(agent.id, l)}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <span className="settings-option-hint">
                        {{ '1': '1 instance', '1+1': '2 instances · 1 + 1', '1+2': '3 instances · 1 + 2', '2+2': '4 instances · 2 + 2' }[agent.layout]}
                      </span>
                      <span className="settings-option-label" style={{ marginLeft: 8 }}>Yolo</span>
                      <button
                        className={`settings-toggle ${agent.yolo ? 'on' : 'off'}`}
                        type="button"
                        onClick={() => setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, yolo: !a.yolo } : a))}
                        aria-label={agent.yolo ? 'Disable yolo' : 'Enable yolo'}
                      >
                        <span className="settings-toggle-knob" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn cancel" type="button" onClick={onClose}>Cancel</button>
          <button className="settings-btn save" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
