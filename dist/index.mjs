// src/sessionStart.ts
import { env } from "hono/adapter";

// src/session.ts
import { HTTPException } from "hono/http-exception";

// src/utils/getRandomId.ts
function getRandomId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const hexValues = [];
  array.map((i) => hexValues.push(i.toString(16)));
  return hexValues.join("");
}

// src/session.ts
var Session = class {
  cookie;
  cookie_name;
  kvNamespace;
  prefix;
  ttl;
  id;
  is_new;
  data;
  constructor({
    cookie,
    cookie_name,
    kvNamespace,
    prefix,
    ttl
  }) {
    this.cookie = cookie;
    this.cookie_name = cookie_name;
    this.kvNamespace = kvNamespace;
    this.prefix = prefix;
    this.ttl = ttl;
    this.data = void 0;
    this.id = "";
    this.is_new = true;
    if (this.kvNamespace === void 0) {
      throw new HTTPException(500, {
        message: "Session datastore was not found."
      });
    }
    this.initialize();
  }
  initialize() {
    const id = this.cookie.get(this.cookie_name);
    this.is_new = id === void 0;
    this.id = id || getRandomId();
    this.updateCookie();
  }
  updateCookie() {
    this.cookie.set(this.cookie_name, this.id, {
      httpOnly: true,
      path: "/",
      ...this.ttl >= 60 ? { expires: new Date(Date.now() + this.ttl * 1e3) } : {}
    });
  }
  getKey() {
    return `${this.prefix}:${this.id}`;
  }
  async getData() {
    const key = this.getKey();
    const datastore = this.kvNamespace;
    const ttl = this.ttl;
    this.data = {};
    if (!this.is_new) {
      try {
        this.data = JSON.parse(await datastore.get(key) || "{}") || {};
      } catch (err) {
        console.error(`KV returned error: ${err}`);
      }
    }
    return {
      id: this.id,
      data: this.data,
      save: async function() {
        return await saveSession(key, this.data, datastore, ttl);
      }
    };
  }
};
async function saveSession(key, data, datastore, ttl) {
  const expiration = {
    ...ttl >= 60 ? { expirationTtl: ttl } : {}
  };
  try {
    await datastore.put(key, JSON.stringify(data), expiration);
  } catch (err) {
    console.error(`KV returned error: ${err}`);
    return false;
  }
  return true;
}

// src/utils/cookieWithContext.ts
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
var CookieWithContext = class {
  context;
  constructor(context) {
    this.context = context;
  }
  get(name) {
    return getCookie(this.context, name);
  }
  set(name, value, opt) {
    return setCookie(this.context, name, value, opt);
  }
  delete(name, opt) {
    return deleteCookie(this.context, name, opt);
  }
};

// src/sessionStart.ts
function sessionStart(options) {
  return async (c, next) => {
    const cookie = new CookieWithContext(c);
    const opts = options || {};
    const kvNamespace = opts.kvNamespace || env(c).SESSION_DATASTORE;
    const session = new Session({
      cookie,
      cookie_name: opts.cookie_name || "__session",
      kvNamespace: typeof kvNamespace === "string" ? env(c)[kvNamespace] : kvNamespace,
      prefix: opts.prefix || "session",
      ttl: opts.ttl || 2592e3
      // 30 days in seconds
    });
    const sessionObject = await session.getData();
    c.set("session", sessionObject);
    await next();
  };
}
export {
  sessionStart
};
