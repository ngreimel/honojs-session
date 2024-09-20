import { Hono } from 'hono'
import type { SessionData, SessionObject } from '../src/types'
import { sessionStart } from '../src/sessionStart'

const client_id = '1jsdsldjkssd-4343dsasdsd34ghhn4-dummyid'
const client_secret = 'SDJS943hS_jj45dummysecret'

const map = {} as SessionData

const KV = {
  async get(key: string, options?: any): Promise<string | null> {
    options = options || {}
    if (map[key]?.expiration) {
      return Date.now() < map[key].expiration ? map[key].value : null
    }
    return map[key]?.value || null
  },
  async put(name: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    map[name] = {
      value: value,
      ...(options?.expirationTtl ? { expiration: new Date(Date.now() + options.expirationTtl * 1000) } : {}),
    }
  },
  async list(): Promise<KVNamespaceListResult<any, any>> {
    return {
      list_complete: true,
      keys: [] as KVNamespaceListKey<any, any>[],
      cacheStatus: null
    }
  },
  async getWithMetadata(key: string): Promise<any> {
    return key
  },
  async delete(key: string): Promise<any> {
    return key
  }
} as KVNamespace

type Bindings = {
  SESSION_DATASTORE: KVNamespace
}

describe('Session KV Middleware', () => {
  const app = new Hono<{ Bindings: Bindings }>()

  // Google
  app.use(
    '/session/defaults/visits',
    sessionStart({
      kvNamespace: KV,
    })
  )
  app.use('/session/cookie-test/visits', (c, next) => {
    return sessionStart({
      cookie_name: 'test',
    })(c, next)
  })
  app.use('/session/ttl-five-minutes/visits', (c, next) => {
    return sessionStart({
      cookie_name: 'ttl',
      ttl: 300,
    })(c, next)
  })

  app.get('/session/*', async (c) => {
    const session = c.get('session') as SessionObject
    session.data.visits = (session.data.visits || 0) + 1
    await session.save()

    return c.json({
      id: session.id,
      data: session.data,
    })
  })

  describe('sessionStart middleware', () => {
    it('Should create cookie', async () => {
      const res = await app.request('/session/defaults/visits')

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(res.headers.get('set-cookie')).toContain('__session=')
    })

    it('Should save to the KV', async () => {
      const res = await app.request('/session/defaults/visits')
      const response = (await res.json()) as Partial<SessionObject>
      const id = res.headers.get('set-cookie')!.split(';')[0].split('=')[1]
      const kvValue = JSON.parse((await KV.get(`session:${id}`)) || '{}') || {}

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(response.data!.visits).toEqual(kvValue.visits)
    })
  })
})
