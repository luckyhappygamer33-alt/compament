import type { RectangleElement } from '../../../../types/schema'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export class RectangleTool {
    draw(
        ctx: CanvasContext,
        element: RectangleElement
    ) {

        ctx.beginPath()
        ctx.roundRect(
            element.position.x,
            element.position.y,
            element.size.width,
            element.size.height,
            element.cornerRadius
        )
        ctx.fill()
    }
}