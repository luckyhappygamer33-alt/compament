import type { RefObject } from 'react'
import type { Element } from '../../../../types/schema'
import { uid } from '../../../../store/editorStore'

interface RectangleToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
    activeLayerIdRef: RefObject<string | null>
}

interface RectangleToolActions {
    addElement: (layerId: string, element: Element) => void
}

const RECTANGLE_SIZE = 100

export class RectangleTool {
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

        const element = {
            id: uid(),
            type: 'rectangle' as const,
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