import type { Layer, Element } from '../../../types/schema'
import { degToRad } from '../CanvasHelpers'
import { getBuffer } from '../BufferRegistry'
import { RectangleTool } from './Tools/RectangleTool'
import { EllipseTool } from './Tools/EllipseTool'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export class ElementRenderer {
    private rectangleTool = new RectangleTool()
    private ellipseTool = new EllipseTool()
    private imageCache = new Map<string, HTMLImageElement>()
    private onImageLoad: () => void

    constructor(onImageLoad: () => void) {
        this.onImageLoad = onImageLoad
    }

    draw(ctx: CanvasContext, element: Element) {
        ctx.globalAlpha = element.style.opacity

        if (element.style.fill?.type === 'solid') {
            const { r, g, b, a } = element.style.fill.color
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
        } else {
            ctx.fillStyle = 'transparent'
        }

        const centerX = element.position.x + element.size.width / 2
        const centerY = element.position.y + element.size.height / 2

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(degToRad(element.rotation))
        ctx.translate(-centerX, -centerY)

        if (element.type === 'rectangle') {
            this.rectangleTool.draw(ctx, element)
        } else if (element.type === 'ellipse') {
            this.ellipseTool.draw(ctx, element)
        } else if (element.type === 'image') {
            const img = this.getOrLoadImage(element.src)
            if (img) {
                ctx.drawImage(img, element.position.x, element.position.y, element.size.width, element.size.height)
            }

        }
        ctx.restore()
        ctx.globalAlpha = 1
    }

    drawLayer(ctx: CanvasContext, layer: Layer) {
        const buffer = getBuffer(layer.id)
        if (buffer) ctx.drawImage(buffer, 0, 0)
        for (const element of layer.elements) {
            this.draw(ctx, element)
        }
    }

    bake(layerId: string, element: Element) {
        const buffer = getBuffer(layerId)
        if (!buffer) return
        const bufCtx = buffer.getContext('2d')
        if (!bufCtx) return
        this.draw(bufCtx, element)
    }

    private getOrLoadImage(src: string): HTMLImageElement | null {
        if (this.imageCache.has(src)) return this.imageCache.get(src)!

        const img = new Image()
        img.onload = () => {
            this.imageCache.set(src, img)
            this.onImageLoad()
        }
        img.src = src
        return null
    }

}