import type { Element } from '../../../types/schema'
import { degToRad } from '../CanvasHelpers'
import type { CanvasContext } from '../CanvasTypes'

export function beginElement(
    ctx: CanvasContext,
    element: Element
) {
    ctx.save()

    ctx.globalAlpha = element.style.opacity

    if (element.style.fill?.type === 'solid') {
        const { r, g, b, a } = element.style.fill.color
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
    } else {
        ctx.fillStyle = 'transparent'
    }

    const centerX = element.position.x + element.size.width / 2
    const centerY = element.position.y + element.size.height / 2

    ctx.translate(centerX, centerY)
    ctx.rotate(degToRad(element.rotation))
    ctx.translate(-centerX, -centerY)
}

export function endElement(
    ctx: CanvasContext
) {
    ctx.restore()
}