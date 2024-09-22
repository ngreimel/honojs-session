import { MiddlewareHandler } from 'hono';

declare function sessionStart(options?: {
    cookie_name?: string;
    kvNamespace?: KVNamespace | string;
    prefix?: string;
    ttl?: number;
}): MiddlewareHandler;

type SessionObject = {
    id: string;
    data: SessionData;
    save: () => Promise<boolean>;
    destroy: () => Promise<boolean>;
};
type SessionData = {
    [key: string]: any;
};

declare module 'hono' {
    interface ContextVariableMap {
        session: SessionObject | undefined;
    }
}

export { type SessionObject, sessionStart };
