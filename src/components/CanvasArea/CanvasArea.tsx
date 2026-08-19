import './CanvasArea.css'

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { useEditorStore } from '../../store/editorStore'
import Breadcrumb from '../Breadcrumb/Breadcrumb'
import { type HandleName } from './CanvasTypes'

import { Renderer } from './Render/Renderer'
import { InputHandler } from './InputHandling/InputHandler'

import type { ElementTool } from './Tools/ElementTool'
import type { InteractionTool } from './Tools/InteractionTool'
import type { DrawingTool } from './Tools/DrawingTool'

import { InteractionToolController } from './Tools/InteractionToolController'
import { ElementToolController } from './Tools/ElementToolController'
import { DrawingToolController } from './Tools/DrawingToolController'

import { RectangleTool } from './Tools/RectangleTool'
import { EllipseTool } from './Tools/EllipseTool'
import { SelectTool } from './Tools/SelectTool'
import { BrushTool } from './Tools/BrushTool'

export interface CanvasAreaHandler {
    handleBake: () => void
}

const CanvasArea = forwardRef<CanvasAreaHandler>((_, ref) => {

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<Renderer | null>(null)
    const handlerRef = useRef<InputHandler | null>(null)

    const artboardSize = useEditorStore(state => state.artboardSize)
    const activeTool = useEditorStore(state => state.activeTool)
    const activeLayerId = useEditorStore(state => state.activeLayerId)
    const addElement = useEditorStore(state => state.addElement)
    const layers = useEditorStore(state => state.layers)
    const setSelectedElement = useEditorStore(state => state.setSelectedElement)
    const selectedElementId = useEditorStore(state => state.selectedElementId)
    const updateElement = useEditorStore(state => state.updateElement)
    const deleteElement = useEditorStore(state => state.deleteElement)

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
        const overlayCanvas = overlayCanvasRef.current
        if (!canvas || !overlayCanvas) return

        const rectangleTool = new RectangleTool(
            {
                activeLayerIdRef,
                panRef,
                zoomRef,
            },
            {
                addElement,
            }
        )

        const ellipseTool = new EllipseTool(
            {
                activeLayerIdRef,
                panRef,
                zoomRef,
            },
            {
                addElement,
            }
        )

        const selectTool = new SelectTool(
            canvas,
            {
                zoomRef,
                panRef,
                activeLayerIdRef,
                layersRef,
                selectedElementIdRef,
                hoveredHandleRef,
                rendererRef
            },
            {
                updateElement,
                setSelectedElement,
            },
        )

        const brushTool = new BrushTool(
            canvas,
            {
                zoomRef,
                panRef,
                activeLayerIdRef,
                rendererRef
            }
        )

        const elementTools = new Map<string, ElementTool>([
            ['rectangle', rectangleTool],
            ['ellipse', ellipseTool],
        ])

        const elementTool = new ElementToolController(
            activeToolRef,
            elementTools
        )

        const interactionTools = new Map<string, InteractionTool>([
            ['select', selectTool]
        ])

        const interactionTool = new InteractionToolController(
            activeToolRef,
            interactionTools
        )

        const drawingTools = new Map<string, DrawingTool>([
            ['brush', brushTool]
        ])

        const drawingTool = new DrawingToolController(
            activeToolRef,
            drawingTools
        )

        rendererRef.current = new Renderer(
            canvas,
            overlayCanvas,
            {
                panRef,
                zoomRef,
                artboardSizeRef,
                layersRef,
                selectedElementIdRef,
                hoveredHandleRef,
                activeLayerIdRef
            },
            elementTool,
            interactionTool
        )

        handlerRef.current = new InputHandler(
            canvas,
            {
                zoomRef,
                panRef,
                layersRef,
                selectedElementIdRef,
                activeToolRef,
                activeLayerIdRef,
                rendererRef,
                hoveredHandleRef,   // shared ref — InputHandler writes, renderer reads
            },
            {
                setZoom,
                setPan,
                updateElement,
                setSelectedElement,
                addElement
            },
            elementTool,
            interactionTool,
            drawingTool
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

    // Request a redraw whenever visible state changes.
    // No invalidation call here — the renderer detects internally whether the
    // background composite needs rebuilding (via reference equality on layer objects).
    // This means drag frames never trigger an unnecessary composite rebuild.
    useEffect(() => {
        rendererRef.current?.requestFrame()
    }, [artboardSize, zoom, pan, layers, selectedElementId])

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ro = new ResizeObserver(() => {
            const w = Math.round(canvas.offsetWidth);
            const h = Math.round(canvas.offsetHeight);
            if (w !== canvas.width || h !== canvas.height) {
                canvas.width = w;
                canvas.height = h;
                rendererRef.current?.resizeOverlay(w, h) //overlay resizing
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

    const handleBake = () => {
        if (!selectedElementId || !activeLayerId) return
        const layer = layers.find(l => l.id === activeLayerId)
        const element = layer?.elements.find(e => e.id === selectedElementId)
        if (!element) return
        rendererRef.current?.bakeElement(activeLayerId, element)
        deleteElement(activeLayerId, selectedElementId)
        setSelectedElement(null)
    }

    useImperativeHandle(ref, () => ({ handleBake: handleBake }))

    return (
        <div className="canvas-area">
            <div className="canvas-breadcrumb-bar">
                <Breadcrumb />
            </div>
            <div className="canvas-viewport">
                <canvas ref={canvasRef} className="editor-canvas" />
                <canvas
                    ref={overlayCanvasRef} className="overlay-canvas"
                />
                {artboardSize && (
                    <div className="zoom-indicator" onClick={handleResetZoom}>
                        {Math.round((zoom / fitZoom) * 100)}%
                    </div>
                )}
            </div>
        </div>
    )
})

export default CanvasArea