import { useRef, useEffect, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import Breadcrumb from './Breadcrumb'
import './CanvasArea.css'

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

    useEffect(() => {
        zoomRef.current = zoom
        panRef.current = pan
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

        ctx.restore()
    }, [artboardSize, zoom, pan])

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
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!isPanningRef.current) return
            const dx = e.clientX - lastMouseRef.current.x
            const dy = e.clientY - lastMouseRef.current.y
            lastMouseRef.current = { x: e.clientX, y: e.clientY }
            setPan(p => ({ x: p.x + dx, y: p.y + dy }))
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) isPanningRef.current = false
        }

        // passive: false lets us call preventDefault on wheel
        canvas.addEventListener('wheel', handleWheel, { passive: false })
        canvas.addEventListener('mousedown', handleMouseDown)
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            canvas.removeEventListener('wheel', handleWheel)
            canvas.removeEventListener('mousedown', handleMouseDown)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
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