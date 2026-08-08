import { useRef, useEffect, useState } from 'react'
import { useEditorStore, uid } from '../store/editorStore'
import Breadcrumb from './Breadcrumb'
import './CanvasArea.css'
import { type BaseElement } from '../types/schema'

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

    function hitTest(element: BaseElement, x: number, y: number): boolean {
        return (
            x >= element.position.x &&
            x <= element.position.x + element.size.width &&
            y >= element.position.y &&
            y <= element.position.y + element.size.height
        )
    }

    useEffect(() => {
        zoomRef.current = zoom
        panRef.current = pan
        activeToolRef.current = activeTool
        activeLayerIdRef.current = activeLayerId
        layersRef.current = layers
        selectedElementIdRef.current = selectedElementId

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
        for (const layer of layers) {
            if (!layer.visible) continue
            for (const element of layer.elements) {
                ctx.globalAlpha = element.style.opacity

                if (element.style.fill?.type === 'solid') {
                    const { r, g, b, a } = element.style.fill.color
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
                } else {
                    ctx.fillStyle = 'transparent'
                }

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

                ctx.globalAlpha = 1
            }
        }

        // draw selection outline
        if (selectedElementId) {
            for (const layer of layers) {
                const element = layer.elements.find(e => e.id === selectedElementId)
                if (element) {
                    ctx.strokeStyle = '#4a90d9'
                    ctx.lineWidth = 2 / zoom  // stays 2px regardless of zoom level
                    ctx.strokeRect(
                        element.position.x - 10,
                        element.position.y - 10,
                        element.size.width + 20,
                        element.size.height + 20
                    )
                    break
                }
            }
        }

        ctx.restore()
    }, [artboardSize, zoom, pan, layers, selectedElementId])

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

                // find the element
                for (const layer of layersRef.current) {
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
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) isPanningRef.current = false
            if (e.button === 0) isDraggingRef.current = false
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