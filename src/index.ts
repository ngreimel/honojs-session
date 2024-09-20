export { sessionStart } from './sessionStart'
export { SessionObject } from './types'

import { SessionObject } from './types'

declare module 'hono' {
    interface ContextVariableMap {
        session: SessionObject | undefined
    }
}
