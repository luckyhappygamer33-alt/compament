import { useRef, useEffect, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import Breadcrumb from '../Breadcrumb'
import './CanvasArea.css'
import { type HandleName } from './CanvasTypes'
import { CanvasRenderer } from './CanvasRenderer'
import { InputHandler } from './InputHandler'

export default function CanvasArea() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<CanvasRenderer | null>(null)
    const handlerRef = useRef<InputHandler | null>(null)

    const artboardSize = useEditorStore(state => state.artboardSize)
    const activeTool = useEditorStore(state => state.activeTool)
    const activeLayerId = useEditorStore(state => state.activeLayerId)
    const addElement = useEditorStore(state => state.addElement)
    const layers = useEditorStore(state => state.layers)
    const setSelectedElement = useEditorStore(state => state.setSelectedElement)
    const selectedElementId = useEditorStore(state => state.selectedElementId)
    const updateElement = useEditorStore(state => state.updateElement)

    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

    //stale closure solution for React - owned values
    const artboardSizeRef = useRef(artboardSize)
    const zoomRef = useRef(zoom)
    const panRef = useRef(pan)
    const activeToolRef = useRef(activeTool)
    const activeLayerIdRef = useRef(activeLayerId)
    const selectedElementIdRef = useRef(selectedElementId)
    const layersRef = useRef(layers)

    //persistent mutable variables that don't belong to React at all
    const hoveredHandleRef = useRef<HandleName | null>(null)

    const fitZoom = artboardSize && canvasSize.width > 0 && canvasSize.height > 0
        ? Math.min(
            (canvasSize.width - 80) / artboardSize.width,
            (canvasSize.height - 80) / artboardSize.height
        )
        : 1

    //sync refs every render so event handlers always read current values
    useEffect(() => {
        zoomRef.current = zoom
        panRef.current = pan
        activeToolRef.current = activeTool
        activeLayerIdRef.current = activeLayerId
        layersRef.current = layers
        selectedElementIdRef.current = selectedElementId
        artboardSizeRef.current = artboardSize
    })

    // instantiate renderer + handler once
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        rendererRef.current = new CanvasRenderer(canvas, {
            panRef, zoomRef, artboardSizeRef,
            layersRef, selectedElementIdRef, hoveredHandleRef
        })

        handlerRef.current = new InputHandler(
            canvas,
            {
                zoomRef, panRef, layersRef, selectedElementIdRef,
                activeToolRef, activeLayerIdRef, rendererRef
            },
            {
                setZoom, setPan, updateElement, setSelectedElement,
                addElement
            }
        )

        const handler = handlerRef.current
        //passive: false lets us call preventDefault on wheel
        canvas.addEventListener('wheel', handler.handleWheel, { passive: false })
        canvas.addEventListener('mousedown', handler.handleMouseDown)
        window.addEventListener('mousemove', handler.handleMouseMove)
        window.addEventListener('mouseup', handler.handleMouseUp)
        canvas.addEventListener('click', handler.handleMouseClick)

        return () => {
            canvas.removeEventListener('wheel', handler.handleWheel)
            canvas.removeEventListener('mousedown', handler.handleMouseDown)
            window.removeEventListener('mousemove', handler.handleMouseMove)
            window.removeEventListener('mouseup', handler.handleMouseUp)
            canvas.removeEventListener('click', handler.handleMouseClick)
        }
    }, [])

    //fit artboard to viewport on project init
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !artboardSize) return

        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
        setCanvasSize({ width: canvas.offsetWidth, height: canvas.offsetHeight })

        const padding = 40
        const scaleX = (canvas.width - padding * 2) / artboardSize.width
        const scaleY = (canvas.height - padding * 2) / artboardSize.height
        const initialZoom = Math.min(scaleX, scaleY)

        setZoom(initialZoom)
        setPan({
            x: (canvas.width - artboardSize.width * initialZoom) / 2,
            y: (canvas.height - artboardSize.height * initialZoom) / 2,
        })
    }, [artboardSize])

    //draw canvas and canvas elements
    useEffect(() => {
        rendererRef.current?.drawFrame() //if current is null, skip the call entirely
    }, [artboardSize, zoom, pan, layers, selectedElementId])

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ro = new ResizeObserver(() => {
            const w = Math.round(canvas.offsetWidth);
            const h = Math.round(canvas.offsetHeight);
            if (w !== canvas.width || h !== canvas.height) {
                canvas.width = w;   // ← updates buffer resolution
                canvas.height = h;
                setCanvasSize({ width: w, height: h })
                rendererRef.current?.drawFrame()
            }
        });

        ro.observe(canvas);
        return () => ro.disconnect();
    }, []);

    const handleResetZoom = () => {
        const canvas = canvasRef.current
        if (!canvas || !artboardSize) return

        const padding = 40
        const fit = Math.min(
            (canvas.width - padding * 2) / artboardSize.width,
            (canvas.height - padding * 2) / artboardSize.height
        )
        setZoom(fit)
        setPan({
            x: (canvas.width - artboardSize.width * fit) / 2,
            y: (canvas.height - artboardSize.height * fit) / 2,
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
                        {Math.round((zoom / fitZoom) * 100)}%
                    </div>
                )}
            </div>
        </div>
    )
}