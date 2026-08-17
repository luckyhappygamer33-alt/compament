import type { RefObject } from 'react'
import type { Layer } from '../../../../types/schema'
import type { HandleName } from '../../CanvasTypes'
import { SelectionRenderer } from '../SelectionRenderer'

interface SelectToolRefs {
    selectedElementIdRef: RefObject<string | null>
    hoveredHandleRef: RefObject<HandleName | null>
}

export class SelectTool {
    private refs: SelectToolRefs
    private selectionRenderer: SelectionRenderer

    constructor(
        refs: SelectToolRefs,
        selectionRenderer: SelectionRenderer
    ) {
        this.refs = refs
        this.selectionRenderer = selectionRenderer
    }

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number
    ) {
        const selectedElementId = this.refs.selectedElementIdRef.current
        const hoveredHandle = this.refs.hoveredHandleRef.current

        if (!selectedElementId) return

        for (const layer of layers) {
            const element = layer.elements.find(
                el => el.id === selectedElementId
            )

            if (!element) continue

            this.selectionRenderer.drawSelection(
                ctx,
                {
                    x: element.position.x,
                    y: element.position.y,
                    width: element.size.width,
                    height: element.size.height
                },
                zoom,
                {
                    style: 'solid',
                    color: '#7bb4f1',
                    lineWidth: 2,
                    padding: 10,
                    rotation: element.rotation,
                    handles: true,
                    rotateHandle: true,
                    hoveredHandle
                }
            )

            return
        }
    }
}