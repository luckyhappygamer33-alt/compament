import type { Layer, Size } from '../../../types/schema'
import type { ElementRenderer } from './ElementRenderer'

export class CompositeManager {
    private below: OffscreenCanvas | null = null
    private above: OffscreenCanvas | null = null

    private lastActiveLayerId: string | null = null
    private lastArtboardSize: Size | null = null
    private lastLayerRefsBelow: Layer[] = []
    private lastLayerRefsAbove: Layer[] = []

    needsRebuild(layers: Layer[], activeLayerId: string | null, artboardSize: Size): boolean {
        if (this.lastActiveLayerId !== activeLayerId) return true
        if (
            !this.lastArtboardSize ||
            this.lastArtboardSize.width !== artboardSize.width ||
            this.lastArtboardSize.height !== artboardSize.height
        ) {
            return true
        }

        const activeIndex = layers.findIndex(l => l.id === activeLayerId)
        const below = layers.slice(activeIndex + 1)
        const above = layers.slice(0, activeIndex)

        if (below.length !== this.lastLayerRefsBelow.length) return true
        if (above.length !== this.lastLayerRefsAbove.length) return true
        if (below.some((l, i) => l !== this.lastLayerRefsBelow[i])) return true
        if (above.some((l, i) => l !== this.lastLayerRefsAbove[i])) return true

        return false
    }

    rebuild(layers: Layer[], activeLayerId: string | null, artboardSize: Size, elementRenderer: ElementRenderer) {
        const needsNew = (c: OffscreenCanvas | null) =>
            !c || c.width !== artboardSize.width || c.height !== artboardSize.height

        if (needsNew(this.below)) this.below = new OffscreenCanvas(artboardSize.width, artboardSize.height)
        if (needsNew(this.above)) this.above = new OffscreenCanvas(artboardSize.width, artboardSize.height)

        const ctxBelow = this.below!.getContext('2d')!
        const ctxAbove = this.above!.getContext('2d')!
        ctxBelow?.clearRect(0, 0, artboardSize.width, artboardSize.height)
        ctxAbove?.clearRect(0, 0, artboardSize.width, artboardSize.height)

        const activeIndex = layers.findIndex(l => l.id === activeLayerId)

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i]
            if (!layer.visible || layer.id === activeLayerId) continue
            const target = i > activeIndex ? ctxBelow : ctxAbove
            elementRenderer.drawLayer(target, layer)
        }

        this.lastActiveLayerId = activeLayerId
        this.lastArtboardSize = artboardSize
        this.lastLayerRefsBelow = layers.slice(activeIndex + 1)
        this.lastLayerRefsAbove = layers.slice(0, activeIndex)
    }

    getBelow(): OffscreenCanvas | null { return this.below }
    getAbove(): OffscreenCanvas | null { return this.above }
}
