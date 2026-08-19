import type { RefObject } from 'react'
import type { DrawingTool } from './DrawingTool'

export class DrawingToolController implements DrawingTool {
    readonly type = 'drawing'

    private activeToolRef: RefObject<string>
    private tools: Map<string, DrawingTool>

    constructor(
        activeToolRef: RefObject<string>,
        tools: Map<string, DrawingTool>
    ) {
        this.activeToolRef = activeToolRef
        this.tools = tools
    }

    private getActiveTool() {
        return this.tools.get(this.activeToolRef.current)
    }

    onMouseDown(e: MouseEvent) {
        this.getActiveTool()?.onMouseDown(e)
    }

    onMouseMove(e: MouseEvent) {
        this.getActiveTool()?.onMouseMove(e)
    }

    onMouseUp(e: MouseEvent) {
        this.getActiveTool()?.onMouseUp(e)
    }
}