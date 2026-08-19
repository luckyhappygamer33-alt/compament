import type { RefObject } from "react"
import type { InteractionTool } from "./InteractionTool"
import type { Layer } from "../../../types/schema"
import type { SelectionRenderer } from "../Render/SelectionRenderer"

export class InteractionToolController implements InteractionTool {
    readonly type = 'interaction'

    private activeToolRef: RefObject<string>
    private tools: Map<string, InteractionTool>

    constructor(
        activeToolRef: RefObject<string>,
        tools: Map<string, InteractionTool>
    ) {
        this.activeToolRef = activeToolRef
        this.tools = tools
    }

    private getActiveTool() {
        return this.tools.get(this.activeToolRef.current)
    }

    onMouseDown(e: MouseEvent) {
        const tool = this.getActiveTool()
        if (!tool) return false

        tool.onMouseDown(e)
        return true
    }

    onMouseMove(e: MouseEvent) {
        const tool = this.getActiveTool()
        if (!tool) return false

        tool.onMouseMove(e)
        return true
    }

    onMouseUp(e: MouseEvent) {
        const tool = this.getActiveTool()
        if (!tool) return false

        tool.onMouseUp(e)
        return true
    }

    onClick(e: MouseEvent) {
        const tool = this.getActiveTool()
        if (!tool) return

        tool.onClick(e)
        return true
    }

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        this.getActiveTool()?.draw(ctx, layers, zoom, selectionRenderer)
    }
}