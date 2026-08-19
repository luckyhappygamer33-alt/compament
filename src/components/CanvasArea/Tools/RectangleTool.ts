import type { RefObject } from 'react'
import type { Element, RectangleElement } from '../../../types/schema'
import { uid } from '../../../store/editorStore'
import { beginElement, endElement } from '../Render/ElementRenderHelpers'
import type { ElementTool } from './ElementTool'
import type { CanvasContext } from '../CanvasTypes'

interface RectangleToolRefs {
    activeLayerIdRef: RefObject<string | null>
    panRef: RefObject<{ x: number; y: number }>
    zoomRef: RefObject<number>
}

const RECTANGLE_SIZE = 100

interface RectangleToolActions {
    addElement: (layerId: string, element: Element) => void
}

export class RectangleTool implements ElementTool {
    readonly type = 'rectangle'

    private refs: RectangleToolRefs
    private actions: RectangleToolActions

    constructor(
        refs: RectangleToolRefs,
        actions: RectangleToolActions
    ) {
        this.refs = refs
        this.actions = actions
    }

    onClick(e: MouseEvent) {
        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) return

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const size = RECTANGLE_SIZE

        this.actions.addElement(layerId, {
            id: uid(),
            type: 'rectangle',
            position: {
                x: worldX - size / 2,
                y: worldY - size / 2
            },
            size: {
                width: size,
                height: size
            },
            rotation: 0,
            cornerRadius: 0,
            style: {
                opacity: 1,
                fill: {
                    type: 'solid',
                    color: { r: 74, g: 144, b: 217, a: 1 }
                }
            }
        })
    }

    draw(
        ctx: CanvasContext,
        element: RectangleElement
    ) {
        beginElement(ctx, element)

        ctx.beginPath()
        ctx.roundRect(
            element.position.x,
            element.position.y,
            element.size.width,
            element.size.height,
            element.cornerRadius)
        ctx.fill()

        endElement(ctx)
    }
}