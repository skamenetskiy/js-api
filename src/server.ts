import {
    createServer as createHttpServer,
    Server,
    IncomingMessage,
    ServerResponse,
    OutgoingHttpHeaders,
    IncomingHttpHeaders,
} from "http";


export function createServer(props: iConfig): iApi {
    const
        handlers = new Map<string, tHandler>(),
        logger: iLogger = props.logger || console,
        host: string | undefined = props.host || undefined,
        port: number = props.port || defaultPort;

    const
        handle = (name: string, handler: tHandler): iApi => {
            if (handlers.has(name)) {
                throw new Error(`handler ${name} already registered`);
            }
            handlers.set(name, handler);
            return api;
        },
        listen = (): Server => createHttpServer(requestHandler)
            .listen(port, host);

    const api: iApi = {
        handle,
        listen,
    };

    const requestHandler = (req: IncomingMessage, res: ServerResponse) => {
        let body: string = "";

        const
            // write response
            write = (
                data: any,
                code: number = 200,
                headers: OutgoingHttpHeaders = defaultHeaders,
            ): void => {
                try {
                    res.writeHead(code, headers);
                    if (data !== undefined) {
                        res.write(JSON.stringify(data));
                    }
                } catch (err) {
                    logger.error(err);
                } finally {
                    res.end();
                }
            },
            // write result to response
            writeResult = (result: iResult): void => {
                if (!result) {
                    write(undefined, 200);
                    return
                }
                const {code, data, headers} = result;
                write(data, code || 200, headers || defaultHeaders);
            },
            // write error to response
            writeError = (err: Error): void =>
                write({error: err.message}, 500);

        const
            // "error" event listener
            errorListener = (err: Error): void => {
                write({error: err.message}, 500);
            },
            // "data" event listener
            dataListener = (chunk: string): void => {
                body += chunk;
            },
            // "end" event listener
            endListener = (): void => {
                try {
                    const
                        // parse request body
                        {method, data}: iRequest = JSON.parse(body || "{}");

                    const

                        contextMethod: tContextMethod = (): string => method,
                        contextData: tContextData = <T>(): T => data,
                        contextHeaders: tContextHeaders = (): IncomingHttpHeaders => req.headers,
                        contextResult: tContextResult = (
                            data: any,
                            code: number = 200,
                            headers: OutgoingHttpHeaders = defaultHeaders,
                        ): iResult => ({
                            code,
                            data,
                            headers,
                        }),
                        contextError: tContextError = (
                            err: Error,
                            code: number = 500,
                            headers: OutgoingHttpHeaders = defaultHeaders,
                        ): iResult => ({
                            code,
                            data: {error: err.message},
                            headers,
                        });

                    const
                        handleResult = (result: Promise<iResult> | iResult): void => {
                            if (result instanceof Promise) {
                                result
                                    .then(writeResult)
                                    .catch(writeError);
                            } else {
                                writeResult(result);
                            }
                        };


                    const handler = handlers.get(method);
                    if (!handler) {
                        write({error: `unknown method ${method}`}, 500);
                        return;
                    }

                    const
                        ctx: iContext = {
                            method: contextMethod,
                            data: contextData,
                            headers: contextHeaders,
                            result: contextResult,
                            error: contextError,
                        },
                        result = handler(ctx);

                    handleResult(result);
                } catch (err) {
                    writeError(err as Error);
                }
            };

        req.on("data", dataListener);
        req.on("error", errorListener);
        req.on("end", endListener);
    };

    return api;
}

const
    // default listen port
    defaultPort: number = 3000,
    // default response headers
    defaultHeaders: OutgoingHttpHeaders = {
        "content-type": "application/json",
    };

interface iConfig {
    port?: number;
    host?: string;
    logger?: iLogger;
}

interface iApi {
    handle: tApiHandle;
    listen: tApiListen;
}

type tApiHandle = (name: string, handler: tHandler) => iApi;
type tApiListen = () => void;

interface iRequest {
    method: string;
    data?: any;
}

interface iContext {
    method: tContextMethod;
    data: tContextData;
    headers: tContextHeaders;
    result: tContextResult;
    error: tContextError;
}

type tContextMethod = () => string;
type tContextData = <T>() => T;
type tContextHeaders = () => IncomingHttpHeaders;
type tContextResult = (data: any, code?: number, headers?: OutgoingHttpHeaders) => iResult;
type tContextError = (err: Error, code?: number, headers?: OutgoingHttpHeaders) => iResult;

interface iLogger {
    log: tLoggerMethod;
    error: tLoggerMethod;
    warn: tLoggerMethod;
}

type tLoggerMethod = (...v: any[]) => void;

interface iResult {
    code?: number;
    data?: any;
    headers?: OutgoingHttpHeaders;
}

type tHandler = (ctx: iContext) => Promise<iResult> | iResult;
