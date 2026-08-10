import type { BaseElement } from '../../types/schema'
import { type HandleName, type Handle } from './CanvasTypes'

export {
    degToRad, normalizeDegrees, hitTest, toLocalSpace,
    rotatePoint, computeResize, getHandlePositions,
    getRotateHandlePosition
}

function degToRad(degrees: number) {
    return degrees * Math.PI / 180
}

function normalizeDegrees(degrees: number) {
    return ((degrees % 360) + 360) % 360
}

function hitTest(element: BaseElement, x: number, y: number, padding = 0): boolean {
    const cx = element.position.x + element.size.width / 2
    const cy = element.position.y + element.size.height / 2
    const cos = Math.cos(-degToRad(element.rotation))
    const sin = Math.sin(-degToRad(element.rotation))
    const dx = x - cx
    const dy = y - cy
    const localX = cx + dx * cos - dy * sin
    const localY = cy + dx * sin + dy * cos

    return (
        localX >= element.position.x - padding &&
        localX <= element.position.x + element.size.width + padding &&
        localY >= element.position.y - padding &&
        localY <= element.position.y + element.size.height + padding
    )
}

function toLocalSpace(worldX: number, worldY: number, element: BaseElement) {
    const cx = element.position.x + element.size.width / 2
    const cy = element.position.y + element.size.height / 2

    const rotation = degToRad(element.rotation)

    const cos = Math.cos(-rotation)
    const sin = Math.sin(-rotation)
    const dx = worldX - cx
    const dy = worldY - cy
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
    }
}

function rotatePoint(dx: number, dy: number, angle: number) {
    const radians = degToRad(angle)
    const cos = Math.cos(-radians)
    const sin = Math.sin(-radians)
    return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos,
    }
}

function computeResize(
    handle: HandleName,
    b: { x: number, y: number, width: number, height: number },
    local: { x: number, y: number },
    rotation: number,
    alt: boolean
) {
    const radians = degToRad(rotation)
    const MIN = 1
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    // compute new size
    let nw = b.width
    let nh = b.height

    if (handle === 'e' || handle === 'ne' || handle === 'se')
        nw = Math.max(MIN, b.width + (alt ? local.x * 2 : local.x))
    if (handle === 'w' || handle === 'nw' || handle === 'sw')
        nw = Math.max(MIN, b.width - (alt ? local.x * 2 : local.x))
    if (handle === 's' || handle === 'se' || handle === 'sw')
        nh = Math.max(MIN, b.height + (alt ? local.y * 2 : local.y))
    if (handle === 'n' || handle === 'ne' || handle === 'nw')
        nh = Math.max(MIN, b.height - (alt ? local.y * 2 : local.y))

    // alt: center stays fixed — simple case
    if (alt) {
        const cx = b.x + b.width / 2
        const cy = b.y + b.height / 2
        return { x: cx - nw / 2, y: cy - nh / 2, width: nw, height: nh }
    }

    // for each handle: offset of the FIXED point from element center, in local space
    const bw2 = b.width / 2
    const bh2 = b.height / 2
    const nw2 = nw / 2
    const nh2 = nh / 2

    const fixedOffset: Record<string, [number, number]> = {
        se: [-bw2, -bh2], sw: [bw2, -bh2],
        ne: [-bw2, bh2], nw: [bw2, bh2],
        n: [0, bh2], s: [0, -bh2],
        e: [-bw2, 0], w: [bw2, 0],
    }

    // same fixed point's offset in the NEW element
    const newFixedOffset: Record<string, [number, number]> = {
        se: [-nw2, -nh2], sw: [nw2, -nh2],
        ne: [-nw2, nh2], nw: [nw2, nh2],
        n: [0, nh2], s: [0, -nh2],
        e: [-nw2, 0], w: [nw2, 0],
    }

    const [fx, fy] = fixedOffset[handle]
    const [nfx, nfy] = newFixedOffset[handle]

    // fixed point in world space (using original bounds and rotation)
    const old_cx = b.x + bw2
    const old_cy = b.y + bh2
    const fixed_wx = old_cx + fx * cos - fy * sin
    const fixed_wy = old_cy + fx * sin + fy * cos

    // solve for new center: fixed_world = new_center + rotate(new_fixed_offset)
    const new_cx = fixed_wx - nfx * cos + nfy * sin
    const new_cy = fixed_wy - nfx * sin - nfy * cos

    return { x: new_cx - nw2, y: new_cy - nh2, width: nw, height: nh }
}

function getHandlePositions(element: BaseElement, padding: number): Handle[] {
    const { x, y } = element.position
    const { width, height } = element.size
    const l = x - padding
    const r = x + width + padding
    const t = y - padding
    const b = y + height + padding
    const mx = (l + r) / 2
    const my = (t + b) / 2

    return [
        { name: 'nw', x: l, y: t },
        { name: 'n', x: mx, y: t },
        { name: 'ne', x: r, y: t },
        { name: 'e', x: r, y: my },
        { name: 'se', x: r, y: b },
        { name: 's', x: mx, y: b },
        { name: 'sw', x: l, y: b },
        { name: 'w', x: l, y: my },
    ]
}

function getRotateHandlePosition(element: BaseElement, padding: number, zoom: number) {
    const cx = element.position.x + element.size.width / 2 //center x
    const ty = element.position.y - padding //top y
    const offset = 30 / zoom // constant screen distance regardless of zoom

    return {
        x: cx, y: ty - offset
    }
}