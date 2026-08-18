import type { Element } from '../../../types/schema'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

export interface ElementTool {
    readonly type: Element['type']

    onClick?(e: MouseEvent): void

    draw(
        ctx: CanvasContext,
        element: Element
    ): void
}