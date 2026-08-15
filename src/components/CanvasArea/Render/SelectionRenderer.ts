import type { HandleName, Handle } from "../CanvasTypes";
import { degToRad, getHandlePositions, getRotateHandlePosition } from "../CanvasHelpers";

interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

interface SelectionDrawOptions {
    style: 'solid' | 'dashed'
    color: string
    lineWidth: number
    fill?: string
    padding?: number
    rotation?: number
    handles?: boolean
    rotateHandle?: boolean
    hoveredHandle?: HandleName | null
}

const HANDLE_SIZE = 8
const ROTATE_HANDLE_RADIUS = 5
const HANDLE_HOVER_SCALE = 1.3

export class SelectionRenderer {

    private drawHandles(
        ctx: CanvasRenderingContext2D,
        element: { position: { x: number; y: number }; size: { width: number; height: number }; rotation: number },
        padding: number,
        zoom: number,
        hoveredHandle: HandleName | null
    ): Handle[] {
        const handles = getHandlePositions(element, padding)
        const handleSize = HANDLE_SIZE / zoom

        for (const handle of handles) {
            const isHovered = hoveredHandle === handle.name
            const finalHandleSize = isHovered ? handleSize * HANDLE_HOVER_SCALE : handleSize
            ctx.fillStyle = isHovered ? '#4a90d9' : '#ffffff'
            ctx.strokeStyle = '#4a90d9'
            ctx.lineWidth = 1.5 / zoom //used later in ctx.stroke
            ctx.beginPath()
            ctx.rect(handle.x - finalHandleSize / 2, handle.y - finalHandleSize / 2, finalHandleSize, finalHandleSize)
            ctx.fill()
            ctx.stroke()
        }

        return handles
    }

    private drawRotateHandle(
        ctx: CanvasRenderingContext2D,
        element: { position: { x: number; y: number }; size: { width: number; height: number }; rotation: number },
        padding: number,
        zoom: number,
        hoveredHandle: HandleName | null,
        nHandle: Handle
    ) {
        const rotateHandle = getRotateHandlePosition(element, padding, zoom)
        const isHovered = hoveredHandle === 'rotate'
        const handleSize = ROTATE_HANDLE_RADIUS / zoom
        const finalHandleSize = isHovered ? handleSize * HANDLE_HOVER_SCALE : handleSize

        ctx.strokeStyle = '#4a90d9'
        ctx.lineWidth = 1.5 / zoom
        ctx.beginPath()
        ctx.moveTo(nHandle.x, nHandle.y)
        ctx.lineTo(rotateHandle.x, rotateHandle.y)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(rotateHandle.x, rotateHandle.y, finalHandleSize, 0, Math.PI * 2)
        ctx.fillStyle = isHovered ? '#4a90d9' : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = '#4a90d9'
        ctx.lineWidth = 1.5 / zoom
        ctx.stroke()
    }

    drawSelection(
        ctx: CanvasRenderingContext2D,
        bounds: Bounds,
        zoom: number,
        options: SelectionDrawOptions
    ) {
        const { style,
            color,
            lineWidth,
            fill,
            padding = 0,
            rotation = 0,
            handles = 0,
            rotateHandle = false,
            hoveredHandle = null,
        } = options

        const centerX = bounds.x + bounds.width / 2
        const centerY = bounds.y + bounds.height / 2

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(degToRad(rotation))
        ctx.translate(-centerX, -centerY)

        const x = bounds.x - padding
        const y = bounds.y - padding
        const width = bounds.width + 2 * padding
        const height = bounds.height + 2 * padding

        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth / zoom

        if (style === 'dashed') {
            ctx.setLineDash([6 / zoom, 3 / zoom])
        }

        ctx.strokeRect(x, y, width, height)
        ctx.setLineDash([])

        if (fill) {
            ctx.fillStyle = fill
            ctx.fillRect(x, y, width, height)
        }

        if (handles) {
            const element = { position: { x: bounds.x, y: bounds.y }, size: { width: bounds.width, height: bounds.height }, rotation }
            const drawnHandles = this.drawHandles(ctx, element, padding, zoom, hoveredHandle,)
            if (rotateHandle) {
                const nHandle = drawnHandles.find(h => h.name === 'n')!
                this.drawRotateHandle(ctx, element, padding, zoom, hoveredHandle, nHandle)
            }
        }

        ctx.restore()
    }
}