import type { Element } from '../../../types/schema'
import type { CanvasContext } from '../CanvasTypes'

export interface ElementTool {
    readonly type: string

    onClick(e: MouseEvent): void

    draw(
        ctx: CanvasContext,
        element: Element
    ): void
}