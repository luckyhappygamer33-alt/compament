import type { SelectionRenderer } from "../SelectionRenderer"

type Selection = {
    x: number,
    y: number,
    width: number,
    height: number
}

export class RectangleSelectTool {
    private selectionRenderer: SelectionRenderer
    private selection: Selection | null = null

    constructor(
        selectionRenderer: SelectionRenderer
    ) {
        this.selectionRenderer = selectionRenderer
    }

    setSelection(selection: Selection | null) {
        this.selection = selection
    }

    draw(
        ctx: CanvasRenderingContext2D,
        zoom: number
    ) {
        if (!this.selection) return
        this.selectionRenderer.drawSelection(
            ctx, this.selection, zoom, {
            style: 'dashed',
            color: '#ceff1a',
            lineWidth: 1.5,
            fill: 'rgba(206, 255, 26, 0.08)'
        }
        )
    }
}