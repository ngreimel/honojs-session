import type { MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { Session } from './session'
import { CookieWithContext } from './utils/cookieWithContext'

export function sessionStart(options?: {
    cookie_name?: string
    kvNamespace?: KVNamespace | string
    prefix?: string
    ttl?: number
}): MiddlewareHandler {
    return async (c, next) => {
        const cookie = new CookieWithContext(c)
        const opts = options || {}
        const kvNamespace = opts.kvNamespace || (env(c).SESSION_DATASTORE as KVNamespace)

        // Create new Session instance
        const session = new Session({
            cookie: cookie,
            cookie_name: opts.cookie_name || '__session',
            kvNamespace: ((typeof kvNamespace === 'string') ? env(c)[kvNamespace] : kvNamespace) as KVNamespace,
            prefix: opts.prefix || 'session',
            ttl: opts.ttl || 2592000, // 30 days in seconds
        })

        // Retrieve data from session
        const sessionObject = await session.getData()

        // Set return info
        c.set('session', sessionObject)

        await next()
    }
}
