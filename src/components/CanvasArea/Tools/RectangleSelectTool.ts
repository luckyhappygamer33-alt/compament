import type { RefObject } from 'react'

import type {
    Layer,
    Element,
    BaseElement
} from '../../../types/schema'

import type { Renderer } from '../Render/Renderer'
import type { SelectionRenderer } from '../Render/SelectionRenderer'

import { uid } from '../../../store/editorStore'
import { degToRad } from '../CanvasHelpers'
import { getBuffer } from '../BufferRegistry'

import type { InteractionTool } from './InteractionTool'

interface RectangleSelectToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{
        x: number,
        y: number
    }>
    layersRef: RefObject<Layer[]>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<Renderer | null>
}

interface RectangleSelectActions {
    addElement: (
        layerId: string,
        element: Element
    ) => void
}

interface Selection {
    x: number,
    y: number,
    width: number,
    height: number
}

export class RectangleSelectTool implements InteractionTool {
    readonly type = 'restangleSelect'

    private canvas: HTMLCanvasElement
    private refs: RectangleSelectToolRefs
    private actions: RectangleSelectActions

    private isSelecting = false

    private selectionStart = {
        x: 0,
        y: 0
    }

    private selectionCurrent = {
        x: 0,
        y: 0
    }

    private selection: Selection | null = null

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
        const { x, y } = this.getWorldPosition(e)

        this.isSelecting = true

        this.selectionStart = { x, y }
        this.selectionCurrent = { x, y }

        this.selection = null
    }


    onMouseMove(e: MouseEvent) {
        if (!this.isSelecting) return

        this.selectionCurrent = this.getWorldPosition(e)

        const selection = this.getSelectionRect()

        this.selection = selection.width > 1 && selection.height > 1 ? selection : null

        this.refs.rendererRef.current?.requestFrame()
    }

    onMouseUp() {
        if (!this.isSelecting) return

        this.isSelecting = false

        const selection = this.getSelectionRect()

        this.selection = null
        this.refs.rendererRef.current?.requestFrame()

        if (
            selection.width < 1 ||
            selection.height < 1
        ) {
            return
        }

        const layerId =
            this.refs.activeLayerIdRef.current

        if (!layerId) return

        const activeLayer =
            this.refs.layersRef.current.find(
                layer => layer.id === layerId
            )

        if (!activeLayer) return

        const hasOverlap =
            activeLayer.elements.some(element =>
                this.selectionOverlapsElement(
                    selection,
                    element
                )
            )

        if (hasOverlap) return

        this.extractPixels(layerId, selection)
    }

    onClick(_e: MouseEvent) {
        // Rectangle selection uses drag events,
        // not click.
    }

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        if (!this.selection) return

        selectionRenderer.drawSelection(
            ctx,
            this.selection,
            zoom,
            {
                style: 'dashed',
                color: "#ceff1a",
                lineWidth: 1.5,
                fill: 'rgba(206, 255, 26, 0.08)'
            }
        )
    }

    private getWorldPosition(e: MouseEvent) {
        const selection = this.canvas.getBoundingClientRect()

        return {
            x: (e.clientX - selection.left - this.refs.panRef.current.x) / this.refs.zoomRef.current,
            y: (e.clientY - selection.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        }
    }

    private getSelectionRect(): Selection {
        const x = Math.min(this.selectionStart.x, this.selectionCurrent.x)

        const y = Math.min(this.selectionStart.y, this.selectionCurrent.y)

        const width = Math.abs(this.selectionCurrent.x - this.selectionStart.x)

        const height = Math.abs(this.selectionCurrent.y - this.selectionStart.y)

        return {
            x,
            y,
            width,
            height
        }
    }

    private selectionOverlapsElement(
        selection: Selection,
        element: BaseElement
    ): boolean {
        const centerX = element.position.x + element.size.width / 2
        const centerY = element.position.y + element.size.height / 2
        const halfWidth = element.size.width / 2
        const halfHeight = element.size.height / 2

        const cos = Math.abs(Math.cos(degToRad(element.rotation)))
        const sin = Math.abs(Math.sin(degToRad(element.rotation)))

        const boundingBoxHalfWidth = halfWidth * cos + halfHeight * sin

        const boundingBoxHalfHeight = halfWidth * sin + halfHeight * cos

        return !(
            selection.x + selection.width <
            centerX - boundingBoxHalfWidth ||

            selection.x >
            centerX + boundingBoxHalfWidth ||

            selection.y + selection.height <
            centerY - boundingBoxHalfHeight ||

            selection.y >
            centerY + boundingBoxHalfHeight
        )
    }

    private extractPixels(
        layerId: string,
        selection: Selection
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

        bufferCtx.clearRect(selection.x, selection.y, selection.width, selection.height)

        const tempCanvas = document.createElement('canvas')

        tempCanvas.width = Math.ceil(selection.width)

        tempCanvas.height = Math.ceil(selection.height)

        const tempCtx = tempCanvas.getContext('2d')

        if (!tempCtx) return

        tempCtx.putImageData(imageData, 0, 0)

        const src = tempCanvas.toDataURL('image/png')

        this.actions.addElement(
            layerId,
            {
                id: uid(),
                type: 'image',
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
        )

        this.refs.rendererRef.current?.requestFrame()
    }
}