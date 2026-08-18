import type { RefObject } from 'react'
import type { Element, EllipseElement } from '../../../types/schema'
import { uid } from '../../../store/editorStore'
import { beginElement, endElement } from '../Render/ElementRenderHelpers'
import type { ElementTool } from './ElementTool'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

interface EllipseToolRefs {
    activeLayerIdRef: RefObject<string | null>
    panRef: RefObject<{ x: number; y: number }>
    zoomRef: RefObject<number>
}

interface EllipseToolActions {
    addElement: (layerId: string, element: Element) => void
}

const ELLIPSE_DIAMETER = 100

export class EllipseTool implements ElementTool {
    readonly type = 'ellipse'

    private refs: EllipseToolRefs
    private actions: EllipseToolActions

    constructor(
        refs: EllipseToolRefs,
        actions: EllipseToolActions
    ) {
        this.refs = refs
        this.actions = actions
    }

    onClick(e: MouseEvent) {
        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) return

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const size = ELLIPSE_DIAMETER

        this.actions.addElement(layerId, {
            id: uid(),
            type: 'ellipse',
            position: {
                x: worldX - size / 2,
                y: worldY - size / 2,
            },
            size: {
                width: size,
                height: size,
            },
            rotation: 0,
            style: {
                opacity: 1,
                fill: {
                    type: 'solid',
                    color: {
                        r: 74,
                        g: 144,
                        b: 217,
                        a: 1,
                    },
                },
            },
        })
    }

    draw(
        ctx: CanvasContext,
        element: EllipseElement
    ) {
        beginElement(ctx, element)

        ctx.beginPath()
        ctx.ellipse(
            element.position.x + element.size.width / 2,
            element.position.y + element.size.height / 2,
            element.size.width / 2,
            element.size.height / 2,
            0,
            0,
            Math.PI * 2
        )
        ctx.fill()

        endElement(ctx)
    }
}