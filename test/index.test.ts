import { Hono } from 'hono'
import type { SessionObject } from '../src/types'
import { sessionStart } from '../src/sessionStart'
import { MockKV } from '../src/utils/mockKv'

type Bindings = {
  SESSION_DATASTORE: KVNamespace
}

const kv = new MockKV()

function getSessionCookie(response: Response, name = '__session'): string {
  const allCookies = response.headers.getSetCookie()
  const sessionCookies = allCookies.filter((cookie) => {
    return name === cookie.split(';')[0].split('=')[0]
  })

  return sessionCookies.length ? sessionCookies[0] : ''
}

function getCookies(response: Response, name = '__session'): {
  value: string,
  attrs: {
    [k: string]: string
  }[],
  raw: string,
}[] {
  const allCookies = response.headers.getSetCookie()
  const matchingCookies = allCookies.filter((cookie) => {
    return name === cookie.split(';')[0].split('=')[0]
  })

  return matchingCookies.map((cookie) => {
    return {
      value: cookie.split(';')[0].split('=')[1],
      attrs: Object.fromEntries(
          cookie.split(';').slice(1).map((attr) => {
            return attr.split('=')
          })
      ),
      raw: cookie,
    }
  })
}


describe('Session KV Middleware', () => {
  const app = new Hono<{ Bindings: Bindings }>()

  // Google
  app.use(
    '/session/default/*',
    sessionStart({
      kvNamespace: kv.namespace,
    })
  )
  app.use('/session/test/*', (c, next) => {
    return sessionStart({
      kvNamespace: kv.namespace,
      cookie_name: 'test',
    })(c, next)
  })
  app.use('/session/ttl/*', (c, next) => {
    return sessionStart({
      kvNamespace: kv.namespace,
      cookie_name: 'ttl',
      ttl: 300,
    })(c, next)
  })

  app.get('/session/default/destroy', async (c) => {
    const session = c.get('session') as SessionObject
    await session.destroy()

    return c.json({
      id: session.id,
      data: session.data,
    })
  })

  app.get('/session/default/double-save', async (c) => {
    const session = c.get('session') as SessionObject
    session.data.visits = (session.data.visits || 0) + 1
    await session.save()

    session.data.visits = (session.data.visits || 0) + 1
    await session.save()

    return c.json({
      id: session.id,
      data: session.data,
    })
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
      const res = await app.request('/session/default/visit')

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)

      const cookies = getCookies(res)
      expect(cookies.length).toEqual(1)
      expect(cookies[0].value).not.toHaveLength(0)
    })

    it('Should create custom cookie', async () => {
      const res = await app.request('/session/test/visit')

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)

      const cookies = getCookies(res, 'test')
      expect(cookies.length).toEqual(1)
      expect(cookies[0].value).not.toHaveLength(0)
    })

    it('Should allow multiple calls to Session.save()', async () => {
      const res = await app.request('/session/default/double-save')
      const data = (await res.json()) as Partial<SessionObject>

      expect(res).not.toBeNull()
      expect(res.status).toBe(200)
      expect(data.data!.visits).toEqual(2)
    })

    it('Should persist data across requests with same cookie', async () => {
      const one = await app.request('/session/default/visit-1')
      const cookie = getCookies(one).pop()
      const two = await app.request('/session/default/visit-2', {
        headers: [
          ['cookie', cookie!.raw]
        ],
      })
      const first = (await one.json()) as Partial<SessionObject>
      const second = (await two.json()) as Partial<SessionObject>

      expect(one).not.toBeNull()
      expect(one.status).toBe(200)
      expect(first.data!.visits).toEqual(1)
      expect(two).not.toBeNull()
      expect(two.status).toBe(200)
      expect(second.data!.visits).toEqual(2)
    })

    it('Should not persist data across requests with no cookies', async () => {
      const one = await app.request('/session/default/visit-1')
      const two = await app.request('/session/default/visit-2')
      const first = (await one.json()) as Partial<SessionObject>
      const second = (await two.json()) as Partial<SessionObject>
      const firstCookie = getCookies(one).pop()
      const secondCookie = getCookies(two).pop()

      expect(one).not.toBeNull()
      expect(one.status).toBe(200)
      expect(first.data!.visits).toEqual(1)
      expect(two).not.toBeNull()
      expect(two.status).toBe(200)
      expect(second.data!.visits).toEqual(1)
      expect(secondCookie!.value).not.toEqual(firstCookie!.value)
    })

    it('Should not persist data after a session has been destroyed', async () => {
      const one = await app.request('/session/default/visit-1')
      const cookie = getCookies(one).pop()
      const two = await app.request('/session/default/destroy', {
        headers: [
          ['cookie', cookie!.raw]
        ],
      })
      const emptyCookie = getCookies(two).pop()
      const first = (await one.json()) as Partial<SessionObject>
      const second = (await two.json()) as Partial<SessionObject>

      expect(one).not.toBeNull()
      expect(one.status).toBe(200)
      expect(first.data!.visits).toEqual(1)
      expect(two).not.toBeNull()
      expect(two.status).toBe(200)
      expect(second).toEqual({ id: '', data: {} })
      expect(emptyCookie!.value).toBe('')
    })

    it('Should maintain sessions which are unexpired', async () => {
      const one = await app.request('/session/ttl/visit-1')
      const cookie = getCookies(one, 'ttl').pop()

      kv.now = new Date(Date.now() + 299 * 1000)
      const two = await app.request('/session/ttl/visit-2', {
        headers: [
          ['cookie', cookie!.raw]
        ],
      })
      kv.now = undefined

      const first = (await one.json()) as Partial<SessionObject>
      const second = (await two.json()) as Partial<SessionObject>

      expect(one).not.toBeNull()
      expect(one.status).toBe(200)
      expect(first.data!.visits).toEqual(1)
      expect(two).not.toBeNull()
      expect(two.status).toBe(200)
      expect(second.data!.visits).toEqual(2)
    })

    it('Should not find expired sessions', async () => {
      const one = await app.request('/session/ttl/visit-1')
      const cookie = getCookies(one, 'ttl').pop()

      kv.now = new Date(Date.now() + 300 * 1000)
      const two = await app.request('/session/ttl/visit-2', {
        headers: [
          ['cookie', cookie!.raw]
        ],
      })
      kv.now = undefined

      const first = (await one.json()) as Partial<SessionObject>
      const second = (await two.json()) as Partial<SessionObject>

      expect(one).not.toBeNull()
      expect(one.status).toBe(200)
      expect(first.data!.visits).toEqual(1)
      expect(two).not.toBeNull()
      expect(two.status).toBe(200)
      expect(second.data!.visits).toEqual(1)
    })
  })
})
