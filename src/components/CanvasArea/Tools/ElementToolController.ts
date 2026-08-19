import type { RefObject } from 'react'

import type { Element } from '../../../types/schema'
import type { ElementTool } from './ElementTool'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export class ElementToolController implements ElementTool {
    readonly type = 'element'

    private activeToolRef: RefObject<string>
    private tools: Map<string, ElementTool>


    constructor(
        activeToolRef: RefObject<string>,
        tools: Map<string, ElementTool>
    ) {
        this.activeToolRef = activeToolRef
        this.tools = tools
    }

    onClick(e: MouseEvent): boolean {
        const tool = this.tools.get(
            this.activeToolRef.current
        )

        if (!tool) return false

        tool.onClick(e)
        return true
    }

    draw(
        ctx: CanvasContext,
        element: Element
    ): boolean {
        const tool = this.tools.get(element.type)

        if (!tool) return false

        tool.draw(ctx, element)
        return true
    }
}