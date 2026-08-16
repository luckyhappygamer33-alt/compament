import type { RefObject } from 'react'
import type { Element } from '../../../types/schema'
import { uid } from '../../../store/editorStore'

interface EllipseToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
    activeLayerIdRef: RefObject<string | null>
}

interface EllipseToolActions {
    addElement: (layerId: string, element: Element) => void
}

const ELLIPSE_DIAMETER = 100

export class EllipseTool {
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

        const element = {
            id: uid(),
            type: 'ellipse' as const,
            position: {
                x: worldX - size / 2,
                y: worldY - size / 2
            },
            size: {
                width: size,
                height: size
            },
            rotation: 0,
            style: {
                opacity: 1,
                fill: {
                    type: 'solid' as const,
                    color: {
                        r: 74,
                        g: 144,
                        b: 217,
                        a: 1
                    }
                }
            }
        }

        this.actions.addElement(layerId, element)
    }
}