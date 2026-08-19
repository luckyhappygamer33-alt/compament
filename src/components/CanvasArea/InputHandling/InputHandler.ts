import type { RefObject } from 'react'

import type { Layer, Element } from '../../../types/schema'
import { type HandleName } from '../CanvasTypes'
import { Renderer } from '../Render/Renderer'

import { ViewportController } from './ViewportController'

import { RectangleSelectTool } from './Tools/RectangleSelectTool'
import { BrushTool } from './Tools/BrushTool'
import type { ElementTool } from '../Tools/ElementTool'
import type { InteractionTool } from '../Tools/InteractionTool'

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

    private elementTool: ElementTool
    private interactionTool: InteractionTool

    private rectangleSelectTool: RectangleSelectTool
    private brushTool: BrushTool

    constructor(
        canvas: HTMLCanvasElement,
        refs: InputRefs,
        actions: InputActions,
        elementTool: ElementTool,
        interactionTool: InteractionTool
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions

        this.viewportController = new ViewportController(refs, actions)

        this.elementTool = elementTool
        this.interactionTool = interactionTool

        this.rectangleSelectTool = new RectangleSelectTool(canvas, refs, actions)
        this.brushTool = new BrushTool(canvas, refs)
    }

    handleWheel = (e: WheelEvent) => {
        this.viewportController.onWheel(e)
    }

    handleMouseDown = (e: MouseEvent) => {
        if (e.button === 1) this.viewportController.onMouseDown(e)  // middle mouse button  
        if (e.button === 0) this.interactionTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'brush') this.brushTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseDown(e)
    }

    handleMouseMove = (e: MouseEvent) => {
        this.viewportController.onMouseMove(e)

        const activeTool = this.refs.activeToolRef.current

        this.interactionTool.onMouseMove(e)
        if (activeTool === 'rectangleSelect') this.rectangleSelectTool.onMouseMove(e)
        if (activeTool === 'brush') this.brushTool.onMouseMove(e)

    }

    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.viewportController.onMouseUp()

        if (e.button === 0) {
            const activeTool = this.refs.activeToolRef.current
            this.interactionTool.onMouseUp(e)
            if (activeTool === 'rectangleSelect') {
                this.rectangleSelectTool.onMouseUp()
            }
            if (activeTool === 'brush') {
                this.brushTool.onMouseUp()
            }
        }
    }

    handleMouseClick = (e: MouseEvent) => {
        this.interactionTool.onClick(e)
        this.elementTool.onClick(e)
    }
}