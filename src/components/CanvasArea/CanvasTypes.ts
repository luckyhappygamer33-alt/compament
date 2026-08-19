export {
    type HandleName, type CanvasContext, type Handle
}

type HandleName = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

type CanvasContext =
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D

interface Handle {
    name: HandleName
    x: number
    y: number
}