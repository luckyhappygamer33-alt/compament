export {
    HANDLE_CURSORS, type HandleName, type Handle
}

type HandleName = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

interface Handle {
    name: HandleName
    x: number
    y: number
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