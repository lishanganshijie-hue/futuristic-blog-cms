import type MermaidAPI from 'mermaid'
import type { MermaidConfig } from 'mermaid'

let mermaidInstance: typeof MermaidAPI | null = null
let loadingPromise: Promise<typeof MermaidAPI> | null = null

const getMermaidConfig = (isDark: boolean): MermaidConfig => ({
  startOnLoad: false,
  theme: isDark ? 'dark' : 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis'
  },
  sequence: {
    useMaxWidth: false,
    actorFontSize: 22,
    messageFontSize: 22,
    noteFontSize: 22
  },
  gantt: {
    useMaxWidth: false,
    fontSize: 12,
    sectionFontSize: 12,
    axisFormat: '%Y-%m-%d'
  },
  class: { useMaxWidth: false },
  state: { useMaxWidth: false },
  er: { useMaxWidth: false },
  pie: { useMaxWidth: false, textPosition: 0.7 },
  journey: { useMaxWidth: false },
  mindmap: { useMaxWidth: false, padding: 4 },
  timeline: { useMaxWidth: false },
  gitGraph: { useMaxWidth: false },
  sankey: { useMaxWidth: false },
  xyChart: { useMaxWidth: false },
  themeVariables: {
    fontSize: '22px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    pieTitleTextSize: '24px',
    pieSectionTextSize: '22px',
    pieLabelTextSize: '22px',
    actorTextSize: '22px',
    actorFontSize: '22px',
    messageTextSize: '22px',
    messageFontSize: '22px',
    noteTextSize: '22px',
    noteFontSize: '22px',
    labelTextSize: '22px',
    labelFontSize: '22px',
    loopTextSize: '22px',
    loopFontSize: '22px',
    classTextSize: '22px',
    stateTextSize: '22px',
    erFontSize: '22px',
    edgeLabelBackground: 'transparent',
    clusterBkg: 'rgba(0,0,0,0.03)',
    clusterBorder: 'rgba(0,0,0,0.1)'
  }
})

const loadMermaid = async (): Promise<typeof MermaidAPI> => {
  if (mermaidInstance) return mermaidInstance
  if (loadingPromise) return loadingPromise

  loadingPromise = import('mermaid').then(mod => {
    mermaidInstance = mod.default
    return mermaidInstance
  })

  return loadingPromise
}

export const initMermaid = async (isDark: boolean) => {
  const m = await loadMermaid()
  m.initialize(getMermaidConfig(isDark))
  return m
}

export const renderMermaidDiagrams = async (
  container: HTMLElement,
  selector: string,
  isDark: boolean
) => {
  const m = await initMermaid(isDark)
  const mermaidElements = container.querySelectorAll(selector)
  const unrendered = Array.from(mermaidElements).filter(
    el => !(el as HTMLElement).hasAttribute('data-rendered')
  )

  if (unrendered.length === 0) return

  await Promise.all(
    unrendered.map(async (el, i) => {
      const htmlEl = el as HTMLElement
      htmlEl.setAttribute('data-rendered', 'true')

      const id = `mermaid-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const { svg } = await m.render(id, htmlEl.textContent || '')
        htmlEl.innerHTML = svg
      } catch {
        const errorEl = document.getElementById('d' + id) || document.getElementById(id)
        if (errorEl) {
          htmlEl.innerHTML = ''
          htmlEl.appendChild(errorEl)
          errorEl.style.display = 'block'
        } else {
          htmlEl.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:8px;">Mermaid 语法错误</div>`
        }
      }
    })
  )
}

export const rerenderMermaidOnThemeChange = async (
  container: HTMLElement,
  selector: string,
  isDark: boolean
) => {
  const m = await initMermaid(isDark)
  const mermaidElements = container.querySelectorAll(selector)

  if (mermaidElements.length === 0) return

  await Promise.all(
    Array.from(mermaidElements).map(async (el) => {
      const pre = el as HTMLElement
      const oldSvg = pre.querySelector('svg')
      const encodedCode = pre.getAttribute('data-mermaid-code')

      if (oldSvg && encodedCode) {
        oldSvg.style.opacity = '0.6'

        const tempDiv = document.createElement('div')
        tempDiv.style.position = 'absolute'
        tempDiv.style.visibility = 'hidden'
        tempDiv.style.pointerEvents = 'none'
        document.body.appendChild(tempDiv)

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        try {
          const { svg } = await m.render(id, decodeURIComponent(encodedCode))
          pre.innerHTML = svg
          const finalSvg = pre.querySelector('svg')
          if (finalSvg) {
            finalSvg.style.opacity = '0'
            requestAnimationFrame(() => {
              if (finalSvg) {
                finalSvg.style.transition = 'opacity 0.15s ease'
                finalSvg.style.opacity = '1'
              }
            })
          }
        } catch {
          const errorEl = document.getElementById('d' + id) || document.getElementById(id)
          if (errorEl) {
            pre.innerHTML = ''
            pre.appendChild(errorEl)
            errorEl.style.display = 'block'
          } else {
            pre.innerHTML = `<div style="color:#ef4444;font-size:12px;padding:8px;">Mermaid 语法错误</div>`
          }
        } finally {
          if (tempDiv.parentNode) {
            document.body.removeChild(tempDiv)
          }
        }
      }
    })
  )
}

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
