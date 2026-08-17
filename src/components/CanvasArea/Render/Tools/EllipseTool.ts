import type { Element } from '../../../../types/schema'
import { degToRad } from '../../CanvasHelpers'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export class EllipseTool {
    draw(
        ctx: CanvasContext,
        element: Element
    ) {
        const centerX = element.position.x + element.size.width / 2
        const centerY = element.position.y + element.size.height / 2

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(degToRad(element.rotation))
        ctx.translate(-centerX, -centerY)

        ctx.beginPath()
        ctx.ellipse(
            centerX,
            centerY,
            element.size.width / 2,
            element.size.height / 2,
            0,
            0,
            Math.PI * 2
        )

        ctx.restore()
        ctx.fill()
    }
}