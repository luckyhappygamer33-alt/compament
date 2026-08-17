import type { EllipseElement } from '../../../../types/schema'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export class EllipseTool {
    draw(
        ctx: CanvasContext,
        element: EllipseElement
    ) {

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
    }
}