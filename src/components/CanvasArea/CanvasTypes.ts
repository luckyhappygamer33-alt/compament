export {
    type HandleName, type Handle
}

type HandleName = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate'

interface Handle {
    name: HandleName
    x: number
    y: number
}