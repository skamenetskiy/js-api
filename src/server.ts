import {
    createServer as createHttpServer,
    ServerOptions as httpServerOptions,
    Server,
    IncomingMessage,
    ServerResponse,
    OutgoingHttpHeaders,
    IncomingHttpHeaders,
} from "http";
import {
    createServer as createHttpsServer,
    ServerOptions as httpsServerOptions,
} from "https";
import {SecureContextOptions} from "tls";

// create new server
export function createServer(props: iConfig): iServer {
    const
        // customer handlers container
        handlers = new Map<string, tHandler>(),
        // logger
        logger: iLogger = props.logger || console,
        // server host to listen
        host: string | undefined = props.host || undefined,
        // server port to listen
        port: number = props.port || defaultPort,
        // is tls server
        tls: boolean = props.tls === true,
        // http(s) server options
        serverOpts: httpServerOptions | httpsServerOptions = {
            ...(tls ? props.tlsOptions || {} : {}),
        };

    const
        // server.handle() definition
        handle = (name: string, handler: tHandler): iServer => {
            if (handlers.has(name)) {
                throw new Error(`handler ${name} already registered`);
            }
            handlers.set(name, handler);
            return server;
        },
        // server.listen() definition
        listen = (): Server => props.tls === true
            ? createHttpsServer(serverOpts, requestHandler)
                .listen(port, host)
            : createHttpServer(serverOpts, requestHandler)
                .listen(port, host);

    const
        // api definition
        server: iServer = {
            handle,
            listen,
        };

    const
        // request handler for all incoming requests
        requestHandler = (req: IncomingMessage, res: ServerResponse) => {
            let
                // request body string
                body: string = "";

            const
                // write response
                write = (
                    data: any,
                    code: number = 200,
                    headers: OutgoingHttpHeaders = defaultHeaders,
                ): void => {
                    try {
                        // write response headers
                        res.writeHead(code, headers);
                        // write response body
                        if (data !== undefined) {
                            res.write(JSON.stringify(data) + "\n");
                        }
                    } catch (err) {
                        // handle write error
                        logger.error(err);
                    } finally {
                        // end the response
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
                            // context.method() definition
                            contextMethod: tContextMethod = (): string => method,
                            // context.data() definition
                            contextData: tContextData = <T>(): T => data,
                            // context.headers() definition
                            contextHeaders: tContextHeaders = (): IncomingHttpHeaders => req.headers,
                            // context.result() definition
                            contextResult: tContextResult = (
                                data: any,
                                code: number = 200,
                                headers: OutgoingHttpHeaders = defaultHeaders,
                            ): iResult => ({
                                code,
                                data,
                                headers,
                            }),
                            // context.error() definition
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
                            // result handler
                            handleResult = (result: Promise<iResult> | iResult): void => {
                                if (result instanceof Promise) {
                                    // handle async result
                                    result
                                        .then(writeResult)
                                        .catch(writeError);
                                } else {
                                    // handle sync result
                                    writeResult(result);
                                }
                            };

                        // find handler
                        const handler = handlers.get(method);
                        if (!handler) {
                            write({error: `unknown method ${method}`}, 500);
                            return;
                        }

                        const
                            // create request context
                            ctx: iContext = {
                                method: contextMethod,
                                data: contextData,
                                headers: contextHeaders,
                                result: contextResult,
                                error: contextError,
                            },
                            // execute handler
                            result = handler(ctx);

                        // handle result
                        handleResult(result);
                    } catch (err) {
                        // handle any error
                        writeError(err as Error);
                    }
                };

            // setup request events
            req.on("data", dataListener);
            req.on("error", errorListener);
            req.on("end", endListener);
        };

    return server;
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
    tls?: boolean;
    tlsOptions: SecureContextOptions,
}

interface iServer {
    handle: tApiHandle;
    listen: tApiListen;
}

type tApiHandle = (name: string, handler: tHandler) => iServer;
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
