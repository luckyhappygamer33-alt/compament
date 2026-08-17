import type { RefObject } from 'react'
import type { Layer, Element, BaseElement } from '../../../../types/schema'
import type { Renderer } from '../../Render/Renderer'
import { uid } from '../../../../store/editorStore'
import { degToRad } from '../../CanvasHelpers'
import { getBuffer } from '../../BufferRegistry'

interface RectangleSelectToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
    layersRef: RefObject<Layer[]>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<Renderer | null>
}

interface RectangleSelectActions {
    addElement: (layerId: string, element: Element) => void
}

export class RectangleSelectTool {
    private canvas: HTMLCanvasElement
    private refs: RectangleSelectToolRefs
    private actions: RectangleSelectActions

    private isSelecting = false
    private selectionStart = { x: 0, y: 0 }
    private selectionCurrent = { x: 0, y: 0 }

    constructor(
        canvas: HTMLCanvasElement,
        refs: RectangleSelectToolRefs,
        actions: RectangleSelectActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions
    }

    onMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()

        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current

        this.isSelecting = true
        this.selectionStart = { x: worldX, y: worldY }
        this.selectionCurrent = { x: worldX, y: worldY }
    }

    onMouseMove(e: MouseEvent) {
        if (!this.isSelecting) return

        const rect = this.canvas.getBoundingClientRect()

        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current

        this.selectionCurrent = { x: worldX, y: worldY }
        const selection = this.getSelectionRect()

        this.refs.rendererRef.current?.setRectSelection(
            selection.width > 1 && selection.height > 1 ? selection : null
        )

        this.refs.rendererRef.current?.requestFrame()
    }

    onMouseUp() {
        if (!this.isSelecting) return
        this.isSelecting = false

        const selection = this.getSelectionRect()

        this.refs.rendererRef.current?.setRectSelection(null)

        if (selection.width < 1 || selection.height < 1) {
            this.refs.rendererRef.current?.requestFrame()
            return
        }

        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) {
            this.refs.rendererRef.current?.requestFrame()
            return
        }

        const activeLayer = this.refs.layersRef.current.find(layer => layer.id === layerId)
        if (!activeLayer) {
            this.refs.rendererRef.current?.requestFrame()
            return
        }

        const hasOverlap = activeLayer.elements.some(element =>
            this.selectionOverlapsElement(selection, element)
        )

        if (hasOverlap) {
            this.refs.rendererRef.current?.requestFrame()
            return
        }

        this.extractPixels(layerId, selection)
    }

    private getSelectionRect() {
        const x = Math.min(this.selectionStart.x, this.selectionCurrent.x)
        const y = Math.min(this.selectionStart.y, this.selectionCurrent.y)
        const width = Math.abs(this.selectionCurrent.x - this.selectionStart.x)
        const height = Math.abs(this.selectionCurrent.y - this.selectionStart.y)

        return { x, y, width, height }
    }

    private selectionOverlapsElement(
        selection: { x: number, y: number, width: number, height: number },
        element: BaseElement
    ): boolean {
        const centerX = element.position.x + element.size.width / 2
        const centerY = element.position.y + element.size.height / 2

        const halfWidth = element.size.width / 2
        const halfHeight = element.size.height / 2

        const cos = Math.abs(Math.cos(degToRad(element.rotation)))
        const sin = Math.abs(Math.sin(degToRad(element.rotation)))

        const axisAlligneBoundingBoxWidth = halfWidth * cos + halfHeight * sin
        const axisAlligneBoundingBoxHeight = halfWidth * sin + halfHeight * cos

        return !(
            selection.x + selection.width < centerX - axisAlligneBoundingBoxWidth ||
            selection.x > centerX + axisAlligneBoundingBoxWidth ||
            selection.y + selection.height < centerY - axisAlligneBoundingBoxHeight ||
            selection.y > centerY + axisAlligneBoundingBoxHeight
        )
    }

    private extractPixels(
        layerId: string,
        selection: { x: number, y: number, width: number, height: number }
    ) {
        const buffer = getBuffer(layerId)
        if (!buffer) return

        const bufferCtx = buffer.getContext('2d')
        if (!bufferCtx) return

        const imageData = bufferCtx.getImageData(
            Math.floor(selection.x),
            Math.floor(selection.y),
            Math.ceil(selection.width),
            Math.ceil(selection.height)
        )

        bufferCtx.clearRect(
            selection.x,
            selection.y,
            selection.width,
            selection.height
        )

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.ceil(selection.width)
        tempCanvas.height = Math.ceil(selection.height)

        const tempCtx = tempCanvas.getContext('2d')!
        tempCtx.putImageData(imageData, 0, 0)

        const src = tempCanvas.toDataURL('image/png')

        const element = {
            id: uid(),
            type: 'image' as const,
            src,
            position: {
                x: selection.x,
                y: selection.y
            },
            size: {
                width: selection.width,
                height: selection.height
            },
            rotation: 0,
            style: {
                opacity: 1
            }
        }

        this.actions.addElement(layerId, element)

        this.refs.rendererRef.current?.requestFrame()
    }
}