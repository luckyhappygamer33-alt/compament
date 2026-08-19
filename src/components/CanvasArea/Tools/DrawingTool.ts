export interface DrawingTool {
    readonly type: string

    onMouseDown(e: MouseEvent): void
    onMouseMove(e: MouseEvent): void
    onMouseUp(e: MouseEvent): void
}