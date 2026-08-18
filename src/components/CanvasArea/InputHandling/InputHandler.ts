import type { RefObject } from 'react'

import type { Layer, Element } from '../../../types/schema'
import { type HandleName } from '../CanvasTypes'
import { Renderer } from '../Render/Renderer'

import { ViewportController } from './ViewportController'

import { SelectTool } from './Tools/SelectTool'
import { RectangleSelectTool } from './Tools/RectangleSelectTool'
import { BrushTool } from './Tools/BrushTool'
import type { ElementTool } from '../Tools/ElementTool'

interface InputRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number; y: number }>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    activeToolRef: RefObject<string>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<Renderer | null>
    hoveredHandleRef: RefObject<HandleName | null>  // shared with renderer so it reads the live value
}

interface InputActions {
    setZoom: (z: number) => void
    setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void
    updateElement: (layerId: string, elementId: string, patch: Partial<Element>) => void
    setSelectedElement: (id: string | null) => void
    addElement: (layerId: string, element: Element) => void
}

export class InputHandler {
    private canvas: HTMLCanvasElement
    private refs: InputRefs
    private actions: InputActions

    private viewportController: ViewportController

    private selectTool: SelectTool

    private tools: Map<Element['type'], ElementTool>

    private rectangleSelectTool: RectangleSelectTool
    private brushTool: BrushTool

    constructor(
        canvas: HTMLCanvasElement,
        refs: InputRefs,
        actions: InputActions,
        tools: Map<Element['type'], ElementTool>
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions

        this.viewportController = new ViewportController(refs, actions)

        this.selectTool = new SelectTool(canvas, refs, actions)

        this.tools = tools

        this.rectangleSelectTool = new RectangleSelectTool(canvas, refs, actions)
        this.brushTool = new BrushTool(canvas, refs)
    }

    handleWheel = (e: WheelEvent) => {
        this.viewportController.onWheel(e)
    }

    handleMouseDown = (e: MouseEvent) => {
        if (e.button === 1) this.viewportController.onMouseDown(e)  // middle mouse button  
        if (e.button === 0 && this.refs.activeToolRef.current === 'select') this.selectTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'brush') this.brushTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseDown(e)
    }

    handleMouseMove = (e: MouseEvent) => {
        const tool = this.refs.activeToolRef.current
        this.viewportController.onMouseMove(e)
        if (tool === 'select') this.selectTool.onMouseMove(e)
        if (tool === 'rectangleSelect') this.rectangleSelectTool.onMouseMove(e)
        if (tool === 'brush') this.brushTool.onMouseMove(e)

    }

    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.viewportController.onMouseUp()
        if (e.button === 0) {
            this.selectTool.onMouseUp()
            if (this.refs.activeToolRef.current === 'rectangleSelect') {
                this.rectangleSelectTool.onMouseUp()
            }
            if (this.refs.activeToolRef.current === 'brush') {
                this.brushTool.onMouseUp()
            }
        }
    }

    handleMouseClick = (e: MouseEvent) => {
        const activeTool = this.refs.activeToolRef.current

        if (activeTool === 'select') { this.selectTool.onClick(e); return }

        const tool = this.tools.get(activeTool as Element['type'])
        tool?.onClick?.(e)
    }
}