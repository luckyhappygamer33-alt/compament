import { useRef, useEffect, useState } from 'react'
import { useEditorStore, uid } from '../store/editorStore'
import Breadcrumb from './Breadcrumb'
import './CanvasArea.css'
import { type BaseElement } from '../types/schema'

const degToRad = (degrees: number) => degrees * Math.PI / 180

const normalizeDegrees = (degrees: number) => {
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

type HandleName = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

interface Handle {
    name: HandleName
    x: number
    y: number
}

function getHandles(element: BaseElement, padding: number): Handle[] {
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

function getRotateHandle(element: BaseElement, padding: number, zoom: number) {
    const cx = element.position.x + element.size.width / 2 //center x
    const ty = element.position.y - padding //top y
    const offset = 30 / zoom  // constant screen distance regardless of zoom
    return { x: cx, y: ty - offset }
}

const HANDLE_CURSORS: Record<HandleName, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    rotate: 'crosshair'
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

export default function CanvasArea() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const artboardSize = useEditorStore(state => state.artboardSize)

    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [initZoom, setInitZoom] = useState(1)

    const zoomRef = useRef(zoom)
    const panRef = useRef(pan)

    const isPanningRef = useRef(false)
    const lastMouseRef = useRef({ x: 0, y: 0 })
    ///-----///

    const activeTool = useEditorStore(state => state.activeTool)
    const activeLayerId = useEditorStore(state => state.activeLayerId)
    const addElement = useEditorStore(state => state.addElement)

    const activeToolRef = useRef(activeTool)
    const activeLayerIdRef = useRef(activeLayerId)

    const layers = useEditorStore(state => state.layers)

    const setSelectedElement = useEditorStore(state => state.setSelectedElement)
    const selectedElementId = useEditorStore(state => state.selectedElementId)
    const selectedElementIdRef = useRef(selectedElementId)
    const layersRef = useRef(layers)

    /////

    const isDraggingRef = useRef(false)
    const dragStartMouseRef = useRef({ x: 0, y: 0 })
    const dragStartPosRef = useRef({ x: 0, y: 0 })
    const updateElement = useEditorStore(state => state.updateElement)
    const didDragRef = useRef(false)

    /////
    const [hoveredHandle, setHoveredHandle] = useState<HandleName | null>(null)
    const hoveredHandleRef = useRef<HandleName | null>(null)

    const isResizingRef = useRef(false)
    const activeHandleRef = useRef<HandleName | null>(null)
    const resizeStartMouseRef = useRef({ x: 0, y: 0 })
    const resizeStartBoundsRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
    const isRotatingRef = useRef(false)
    const rotateStartAngleRef = useRef(0)
    const rotateStartElementAngleRef = useRef(0)

    useEffect(() => {
        zoomRef.current = zoom
        panRef.current = pan
        activeToolRef.current = activeTool
        activeLayerIdRef.current = activeLayerId
        layersRef.current = layers
        selectedElementIdRef.current = selectedElementId
        hoveredHandleRef.current = hoveredHandle
    })

    // when a project is created, fit the artboard to screen
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !artboardSize) return

        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight

        const padding = 40
        const scaleX = (canvas.width - padding * 2) / artboardSize.width
        const scaleY = (canvas.height - padding * 2) / artboardSize.height
        const initialZoom = Math.min(scaleX, scaleY)

        setZoom(initialZoom)
        setInitZoom(initialZoom)
        setPan({
            x: (canvas.width - artboardSize.width * initialZoom) / 2,
            y: (canvas.height - artboardSize.height * initialZoom) / 2,
        })
    }, [artboardSize])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !artboardSize) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        ctx.save()
        ctx.translate(pan.x, pan.y)
        ctx.scale(zoom, zoom)

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
        ctx.shadowBlur = 20 / zoom

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, artboardSize.width, artboardSize.height)

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        //drawing the elements
        for (const layer of [...layers].reverse()) {
            if (!layer.visible) continue
            for (const element of layer.elements) {
                ctx.globalAlpha = element.style.opacity

                if (element.style.fill?.type === 'solid') {
                    const { r, g, b, a } = element.style.fill.color
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
                } else {
                    ctx.fillStyle = 'transparent'
                }

                // rotate around element center
                const cx = element.position.x + element.size.width / 2
                const cy = element.position.y + element.size.height / 2

                ctx.save()
                ctx.translate(cx, cy)
                ctx.rotate(degToRad(element.rotation))
                ctx.translate(-cx, -cy)

                if (element.type === 'rectangle') {
                    ctx.beginPath()
                    ctx.roundRect(
                        element.position.x,
                        element.position.y,
                        element.size.width,
                        element.size.height,
                        element.cornerRadius
                    )
                    ctx.fill()
                } else if (element.type === 'ellipse') {
                    ctx.beginPath()
                    ctx.ellipse(
                        element.position.x + element.size.width / 2,
                        element.position.y + element.size.height / 2,
                        element.size.width / 2,
                        element.size.height / 2,
                        0, 0, Math.PI * 2
                    )
                    ctx.fill()
                }

                ctx.restore()
                ctx.globalAlpha = 1
            }
        }

        // draw selection box
        if (selectedElementId) {
            for (const layer of layers) {
                const element = layer.elements.find(e => e.id === selectedElementId)
                if (element) {
                    const PADDING = 10
                    const cx = element.position.x + element.size.width / 2
                    const cy = element.position.y + element.size.height / 2

                    ctx.save()
                    ctx.translate(cx, cy)
                    ctx.rotate(degToRad(element.rotation))
                    ctx.translate(-cx, -cy)

                    const handles = getHandles(element, PADDING)
                    const handleSize = 8 / zoom

                    //selection outline
                    ctx.strokeStyle = '#7bb4f1'
                    ctx.lineWidth = 2 / zoom  // stays 2px regardless of zoom level
                    ctx.strokeRect(
                        element.position.x - PADDING,
                        element.position.y - PADDING,
                        element.size.width + (2 * PADDING),
                        element.size.height + (2 * PADDING)
                    )

                    // handles
                    for (const handle of handles) {
                        const isHovered = hoveredHandle === handle.name
                        const hs = isHovered ? handleSize * 1.3 : handleSize

                        ctx.fillStyle = isHovered ? '#4a90d9' : '#ffffff'
                        ctx.strokeStyle = '#4a90d9'
                        ctx.lineWidth = 1.5 / zoom

                        ctx.beginPath()
                        ctx.rect(handle.x - hs / 2, handle.y - hs / 2, hs, hs)
                        ctx.fill()
                        ctx.stroke()
                    }

                    // rotate handle
                    const rotHandle = getRotateHandle(element, PADDING, zoom)
                    const nHandle = handles.find(h => h.name === 'n')!
                    const isRotHovered = hoveredHandle === 'rotate'
                    const rotRadius = isRotHovered ? 6 / zoom : 5 / zoom

                    // line from n handle to rotate handle
                    ctx.strokeStyle = '#4a90d9'
                    ctx.lineWidth = 1.5 / zoom
                    ctx.beginPath()
                    ctx.moveTo(nHandle.x, nHandle.y)
                    ctx.lineTo(rotHandle.x, rotHandle.y)
                    ctx.stroke()

                    // circle
                    ctx.beginPath()
                    ctx.arc(rotHandle.x, rotHandle.y, rotRadius, 0, Math.PI * 2)
                    ctx.fillStyle = isRotHovered ? '#4a90d9' : '#ffffff'
                    ctx.fill()
                    ctx.strokeStyle = '#4a90d9'
                    ctx.lineWidth = 1.5 / zoom
                    ctx.stroke()

                    ctx.restore()
                    break
                }
            }
        }

        ctx.restore()
    }, [artboardSize, zoom, pan, layers, selectedElementId, hoveredHandle])

    // event listeners — registered once, use refs for current values
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault()
            const factor = e.deltaY < 0 ? 1.1 : 0.9
            const currentZoom = zoomRef.current
            const currentPan = panRef.current
            const newZoom = Math.max(0.05, Math.min(50, currentZoom * factor))

            // keep the point under the cursor fixed while zooming
            const mouseX = e.offsetX
            const mouseY = e.offsetY
            const worldX = (mouseX - currentPan.x) / currentZoom
            const worldY = (mouseY - currentPan.y) / currentZoom

            setZoom(newZoom)
            setPan({
                x: mouseX - worldX * newZoom,
                y: mouseY - worldY * newZoom,
            })
        }

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 1) {  // middle mouse button
                e.preventDefault()
                isPanningRef.current = true
                lastMouseRef.current = { x: e.clientX, y: e.clientY }
            }

            if (e.button === 0 && activeToolRef.current === 'select') {
                didDragRef.current = false
                const worldX = (e.offsetX - panRef.current.x) / zoomRef.current
                const worldY = (e.offsetY - panRef.current.y) / zoomRef.current

                const selected = selectedElementIdRef.current
                if (!selected) return

                if (selected) {
                    const hitSize = 10 / zoomRef.current
                    for (const layer of layersRef.current) {
                        if (layer.locked) continue
                        const element = layer.elements.find((el: Element) => el.id === selected)
                        if (element) {
                            const local = toLocalSpace(worldX, worldY, element)
                            // check rotate handle first
                            const rotHandle = getRotateHandle(element, 10, zoomRef.current)
                            const rotHitSize = 12 / zoomRef.current
                            if (
                                local.x >= rotHandle.x - rotHitSize / 2 &&
                                local.x <= rotHandle.x + rotHitSize / 2 &&
                                local.y >= rotHandle.y - rotHitSize / 2 &&
                                local.y <= rotHandle.y + rotHitSize / 2
                            ) {
                                isRotatingRef.current = true
                                const cx = element.position.x + element.size.width / 2
                                const cy = element.position.y + element.size.height / 2
                                rotateStartAngleRef.current =
                                    Math.atan2(
                                        worldY - cy,
                                        worldX - cx
                                    ) * 180 / Math.PI
                                rotateStartElementAngleRef.current = element.rotation
                                return
                            }
                            const handles = getHandles(element, 10)
                            for (const handle of handles) {
                                if (
                                    local.x >= handle.x - hitSize / 2 &&
                                    local.x <= handle.x + hitSize / 2 &&
                                    local.y >= handle.y - hitSize / 2 &&
                                    local.y <= handle.y + hitSize / 2
                                ) {
                                    isResizingRef.current = true
                                    activeHandleRef.current = handle.name
                                    resizeStartMouseRef.current = { x: worldX, y: worldY }
                                    resizeStartBoundsRef.current = {
                                        x: element.position.x,
                                        y: element.position.y,
                                        width: element.size.width,
                                        height: element.size.height,
                                    }
                                    return
                                }
                            }
                        }
                    }
                }

                // find the element
                for (const layer of layersRef.current) {
                    if (layer.locked) continue
                    const element = layer.elements.find(e => e.id === selected)
                    if (element && hitTest(element, worldX, worldY)) {
                        isDraggingRef.current = true
                        dragStartMouseRef.current = { x: worldX, y: worldY }
                        dragStartPosRef.current = { ...element.position }
                        break
                    }
                }
            }
        }

        const handleMouseMove = (e: MouseEvent) => {
            // handle hover detection
            const selected = selectedElementIdRef.current
            if (selected && activeToolRef.current === 'select' && !isDraggingRef.current) {
                const worldX = (e.offsetX - panRef.current.x) / zoomRef.current
                const worldY = (e.offsetY - panRef.current.y) / zoomRef.current
                const hitSize = 10 / zoomRef.current

                let found: HandleName | null = null

                for (const layer of layersRef.current) {
                    const element = layer.elements.find((e: Element) => e.id === selected)
                    if (element) {
                        const local = toLocalSpace(worldX, worldY, element) //accounts for elements rotation
                        const handles = getHandles(element, 10)
                        for (const handle of handles) {
                            if (
                                local.x >= handle.x - hitSize / 2 &&
                                local.x <= handle.x + hitSize / 2 &&
                                local.y >= handle.y - hitSize / 2 &&
                                local.y <= handle.y + hitSize / 2
                            ) {
                                found = handle.name
                                break
                            }
                        }
                        // check rotate handle
                        const rotHandle = getRotateHandle(element, 10, zoomRef.current)
                        const rotHitSize = 12 / zoomRef.current
                        if (
                            local.x >= rotHandle.x - rotHitSize / 2 &&
                            local.x <= rotHandle.x + rotHitSize / 2 &&
                            local.y >= rotHandle.y - rotHitSize / 2 &&
                            local.y <= rotHandle.y + rotHitSize / 2
                        ) {
                            found = 'rotate'
                        }
                        break
                    }
                }

                if (found !== hoveredHandleRef.current) {
                    setHoveredHandle(found)
                    canvas.style.cursor = found ? HANDLE_CURSORS[found] : 'default'
                }
            }
            if (isPanningRef.current) {
                const dx = e.clientX - lastMouseRef.current.x
                const dy = e.clientY - lastMouseRef.current.y
                lastMouseRef.current = { x: e.clientX, y: e.clientY }
                setPan(p => ({ x: p.x + dx, y: p.y + dy }))
            }
            if (isDraggingRef.current) {
                didDragRef.current = true
                const rect = canvas.getBoundingClientRect()
                const offsetX = e.clientX - rect.left
                const offsetY = e.clientY - rect.top
                const worldX = (offsetX - panRef.current.x) / zoomRef.current
                const worldY = (offsetY - panRef.current.y) / zoomRef.current

                const dx = worldX - dragStartMouseRef.current.x
                const dy = worldY - dragStartMouseRef.current.y

                const selected = selectedElementIdRef.current
                if (!selected) return

                for (const layer of layersRef.current) {
                    const element = layer.elements.find(e => e.id === selected)
                    if (element) {
                        updateElement(layer.id, selected, {
                            position: {
                                x: dragStartPosRef.current.x + dx,
                                y: dragStartPosRef.current.y + dy,
                            }
                        })
                        break
                    }
                }
            }
            if (isResizingRef.current) {
                didDragRef.current = true
                const rect = canvas.getBoundingClientRect()
                const worldX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current
                const worldY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current

                const dx = worldX - resizeStartMouseRef.current.x
                const dy = worldY - resizeStartMouseRef.current.y

                const selected = selectedElementIdRef.current
                if (!selected) return

                for (const layer of layersRef.current) {
                    const element = layer.elements.find((el: Element) => el.id === selected)
                    if (element) {
                        const local = rotatePoint(dx, dy, element.rotation)
                        const result = computeResize(
                            activeHandleRef.current!,
                            resizeStartBoundsRef.current,
                            local,
                            element.rotation,
                            e.altKey
                        )
                        updateElement(layer.id, selected, {
                            position: { x: result.x, y: result.y },
                            size: { width: result.width, height: result.height },
                        })
                        break
                    }
                }
            }
            if (isRotatingRef.current) {
                didDragRef.current = true
                const rect = canvas.getBoundingClientRect()
                const worldX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current
                const worldY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current

                const selected = selectedElementIdRef.current
                if (!selected) return

                for (const layer of layersRef.current) {
                    const element = layer.elements.find((el: Element) => el.id === selected)
                    if (element) {
                        const cx = element.position.x + element.size.width / 2
                        const cy = element.position.y + element.size.height / 2
                        const angle = Math.atan2(worldY - cy, worldX - cx)
                        const angleDegrees = angle * 180 / Math.PI
                        const delta = angleDegrees - rotateStartAngleRef.current
                        updateElement(layer.id, selected, {
                            rotation: normalizeDegrees(
                                rotateStartElementAngleRef.current + delta
                            )
                        })
                        break
                    }
                }
            }
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) isPanningRef.current = false
            if (e.button === 0) {
                isDraggingRef.current = false
                isResizingRef.current = false
                isRotatingRef.current = false
                activeHandleRef.current = null
            }
        }

        // passive: false lets us call preventDefault on wheel
        canvas.addEventListener('wheel', handleWheel, { passive: false })
        canvas.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        const handleClick = (e: MouseEvent) => {
            if (didDragRef.current) { //to prevent instant selection other object when moving over another one
                didDragRef.current = false
                return
            }

            const tool = activeToolRef.current
            if (tool === 'select') {
                const worldX = (e.offsetX - panRef.current.x) / zoomRef.current
                const worldY = (e.offsetY - panRef.current.y) / zoomRef.current

                // collect all hits across all visible unlocked layers
                const hits: string[] = []
                for (const layer of layersRef.current) {
                    if (!layer.visible || layer.locked) continue
                    for (let i = layer.elements.length - 1; i >= 0; i--) {
                        if (hitTest(layer.elements[i], worldX, worldY)) {
                            hits.push(layer.elements[i].id)
                        }
                    }
                }

                if (hits.length === 0) {
                    setSelectedElement(null)
                    return
                }

                if (hits.length === 1) {
                    setSelectedElement(hits[0])
                    return
                }

                // multiple hits — cycle from current selection
                const currentIndex = hits.indexOf(selectedElementIdRef.current ?? '')
                const nextIndex = (currentIndex + 1) % hits.length
                setSelectedElement(hits[nextIndex])
                return
            }

            const layerId = activeLayerIdRef.current
            if (!layerId) return

            // convert screen coordinates to world coordinates
            const worldX = (e.offsetX - panRef.current.x) / zoomRef.current
            const worldY = (e.offsetY - panRef.current.y) / zoomRef.current

            const size = 100
            const base = {
                id: uid(),
                position: { x: worldX - size / 2, y: worldY - size / 2 },
                size: { width: size, height: size },
                rotation: 0,
                style: {
                    opacity: 1,
                    fill: { type: 'solid' as const, color: { r: 74, g: 144, b: 217, a: 1 } }
                }
            }

            const element = tool === 'rectangle'
                ? { ...base, type: 'rectangle' as const, cornerRadius: 0 }
                : { ...base, type: 'ellipse' as const }

            addElement(layerId, element)
        }

        canvas.addEventListener('click', handleClick)

        return () => {
            canvas.removeEventListener('wheel', handleWheel)
            canvas.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            canvas.removeEventListener('click', handleClick)
        }

    }, [])

    const handleResetZoom = () => {
        const canvas = canvasRef.current
        if (!canvas || !artboardSize) return

        const padding = 40
        const scaleX = (canvas.width - padding * 2) / artboardSize.width
        const scaleY = (canvas.height - padding * 2) / artboardSize.height
        const fitZoom = Math.min(scaleX, scaleY)

        setZoom(fitZoom)
        setPan({
            x: (canvas.width - artboardSize.width * fitZoom) / 2,
            y: (canvas.height - artboardSize.height * fitZoom) / 2,
        })
    }

    return (
        <div className="canvas-area">
            <div className="canvas-breadcrumb-bar">
                <Breadcrumb />
            </div>
            <div className="canvas-viewport">
                <canvas ref={canvasRef} className="editor-canvas" />
                {artboardSize && (
                    <div className="zoom-indicator" onClick={handleResetZoom}>
                        {Math.round((zoom / initZoom) * 100)}%
                    </div>
                )}
            </div>
        </div>
    )
}