"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  sessionStart: () => sessionStart
});
module.exports = __toCommonJS(src_exports);

// src/sessionStart.ts
var import_adapter = require("hono/adapter");

// src/session.ts
var import_http_exception = require("hono/http-exception");

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
      throw new import_http_exception.HTTPException(500, {
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
  deleteCookie() {
    this.cookie.delete(this.cookie_name, {
      httpOnly: true,
      path: "/"
    });
  }
  getKey() {
    return `${this.prefix}:${this.id}`;
  }
  async getData() {
    const key = this.getKey();
    const datastore = this.kvNamespace;
    const ttl = this.ttl;
    const id = this.id;
    const deleteCookie2 = this.deleteCookie.bind(this);
    this.data = {};
    if (!this.is_new) {
      try {
        this.data = JSON.parse(await datastore.get(key) || "{}") || {};
      } catch (err) {
        console.error(`KV returned error: ${err}`);
      }
    }
    return {
      id,
      data: this.data,
      save: async function() {
        return await saveSession(key, this.data, datastore, ttl);
      },
      destroy: async function() {
        this.id = "";
        this.data = {};
        this.save = async () => false;
        deleteCookie2();
        return await destroySession(key, datastore);
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
async function destroySession(key, datastore) {
  try {
    await datastore.delete(key);
  } catch (err) {
    console.error(`KV returned error: ${err}`);
    return false;
  }
  return true;
}

// src/utils/cookieWithContext.ts
var import_cookie = require("hono/cookie");
var CookieWithContext = class {
  context;
  constructor(context) {
    this.context = context;
  }
  get(name) {
    return (0, import_cookie.getCookie)(this.context, name);
  }
  set(name, value, opt) {
    return (0, import_cookie.setCookie)(this.context, name, value, opt);
  }
  delete(name, opt) {
    return (0, import_cookie.deleteCookie)(this.context, name, opt);
  }
};

// src/sessionStart.ts
function sessionStart(options) {
  return async (c, next) => {
    const cookie = new CookieWithContext(c);
    const opts = options || {};
    const kvNamespace = opts.kvNamespace || (0, import_adapter.env)(c).SESSION_DATASTORE;
    const session = new Session({
      cookie,
      cookie_name: opts.cookie_name || "__session",
      kvNamespace: typeof kvNamespace === "string" ? (0, import_adapter.env)(c)[kvNamespace] : kvNamespace,
      prefix: opts.prefix || "session",
      ttl: opts.ttl || 2592e3
      // 30 days in seconds
    });
    const sessionObject = await session.getData();
    c.set("session", sessionObject);
    await next();
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  sessionStart
});
