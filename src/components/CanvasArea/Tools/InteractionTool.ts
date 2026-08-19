import type { Layer } from "../../../types/schema"
import type { SelectionRenderer } from "../Render/SelectionRenderer"

export interface InteractionTool {
    readonly type: string

    onMouseDown(e: MouseEvent): void
    onMouseMove(e: MouseEvent): void
    onMouseUp(e: MouseEvent): void
    onClick(e: MouseEvent): void

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ): void
}