# Session Middleware

Session middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for session management with [Cloudflare Workers KV](https://developers.cloudflare.com/kv/).

## Installation

You can install `hono` and `ngreimel/hono-session` via npm.

```txt
npm i hono ngreimel/hono-session
```

## Usage

Hono Session simplifies persisting state across requests, enabling you to utilize session management with just a single method.

The simplest implementation is to attach the middleware to all requests.

```ts
app.use(sessionStart({ ... }))
```

However, Hono supports multiple ways to [register middleware](https://hono.dev/docs/guides/middleware).


```ts
app.use('/hello', sessionStart())

app.get('/hello', (c) => {
  const session = c.get('session')
  return c.json({
    name: session.data.name || 'John Doe',
  })
})
```

Or

```ts
app.post('/login', sessionStart(), async (c) => {
  // ...
  const session = c.get('session')
  session.data.lastLogin = new Date()
  await session.save()
  return c.redirect('/dashboard')
})

app.get('/last-login', sessionStart(), (c) => {
  const session = c.get('session')
  return c.json({
    last_login: session.data.lastLogin,
  })
})
```

### Session Start

```ts
import { Hono } from 'hono'
import { sessionStart } from 'ngreimel/hono-session'

const app = new Hono()

app.use(
  '/session',
  sessionStart({
    cookie_name: '__session',
    kvNamespace: 'SESSION_DATASTORE',
    prefix: 'session',
    ttl: 300, // 5 minutes
  })
)
```

#### Parameters

- `cookie_name`:
  - Type: `string`.
  - `Optional`.
  - The name of the cookie which is used to store the user's session id. Defaults to `__session`.
- `kvNamespace`:
  - Type: `string | KVNamespace`.
  - `Optional`.
  - The binding name used to refer to the KV namespace from `wrangler.toml`, or the KVNamespace itself (e.g. `c.env.SESSIONS`).
- `prefix`:
  - Type: `string`.
  - `Optional`.
  - Prefix used for the session key. Keys are generated using `${prefix}:${session_id}`. Defaults to `session`. 
- `ttl`:
  - Type: `number`.
  - `Optional`.
  - The number of seconds after which an idle session will be destroyed. Maximum of `34,560,000` (400 days). `ttl` of less than `60` will never expire. Defaults to `2,592,000` (30 days).
    > A session's idle time is defined as the time since last `save()`.

#### Session Flow

After the session middleware has run, a cookie will be added to the HTTP request handler's Response to allow subsequent Requests to continue the session.

The `sessionStart` method provides a single session object:

- `session`:
  - Session object which can be used to preserve information across multiple Requests.
  - Type:
    ```
    {
      id: string
      data: {
        [key: string]: any
      }
      save: () => Promise<boolean>
    }
    ```
- `session.id`:
  - The session cookie value.
  - Type: `string`.
- `session.data`:
  - Container for data read from or to be written to session storage.
  - Type:
    ```
    {
      [key: string]: any
    }
    ```
- `session.save()`:
  - Asynchronous method to write `session.data` to session storage.
  - Return: `Promise<boolean>` resolves to `true` if data was saved successfully.
    > Data is not guaranteed to be saved until this method resolves to `true`.

To access the session, use the `c.get` method within the callback of the HTTP request handler.

```ts
app.get('/visit', async (c) => {
  const session = c.get('session')
  session.data.visits = (session.data.visits || 0) + 1
  if (await session.save()) {
    return c.text(`You've visited ${session.data.visits} time(s).`)
  }

  throw new HTTPException(500, {
    message: 'Error saving session.',
  })
})
```

#### Destroy Session

@todo 


## Author

ngreimel https://github.com/ngreimel

## License

MIT

## Contribute

If you want to add new features or solve some bugs please create an issue or make a PR.
