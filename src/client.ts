import {
    request as doHttpRequest,
    IncomingMessage,
    OutgoingHttpHeaders,
    RequestOptions,
} from "http";
import {
    request as doHttpsRequest,
} from "https";

// create new client
export function createClient({host, port, tls}: iConfig): iClient {
    const
        // is tls request
        isTls: boolean = tls === true,
        // request options
        options: RequestOptions = {
            host,
            port,
            method: "POST",
            protocol: (isTls ? "https" : "http") + ":",
        };

    const
        // client.call() definition
        call = (method: string, data: any): Promise<iResult> =>
            new Promise<iResult>((resolve, reject) => {
                const
                    // create request
                    req = isTls
                        ? doHttpsRequest(options)
                        : doHttpRequest(options);

                const
                    // "error" event listener
                    errorListener = (err: Error) => {
                        reject(err);
                    },
                    // "response" event listener
                    responseListener = (res: IncomingMessage) => {
                        let
                            // body string container
                            body = "";

                        const
                            // "data" event listener
                            dataListener = (chunk: string) => {
                                body += chunk;
                            },
                            // "end" event listener
                            endListener = () => {
                                try {
                                    const
                                        // parse response body
                                        data = JSON.parse(body);

                                    // resolve response
                                    resolve({
                                        code: () => res.statusCode as number,
                                        data: <T>() => data as T,
                                        headers: () => res.headers,
                                    })
                                } catch (err) {
                                    // handle any error
                                    reject(err);
                                }
                            };

                        // setup response events
                        res.on("error", errorListener);
                        res.on("data", dataListener);
                        res.on("end", endListener);
                    };

                try {
                    // write request body
                    req.write(JSON.stringify({data, method}));
                } catch (err) {
                    // handle any error
                    reject(err);
                } finally {
                    // setup request events and end the request
                    req.on("error", errorListener);
                    req.on("response", responseListener);
                    req.end();
                }
            });

    // return the client
    return {
        call,
    };
}

interface iConfig {
    host: string;
    port: string;
    tls?: boolean;
}

interface iClient {
    call: tClientCall;
}

type tClientCall = (name: string, data: any) => Promise<iResult>;

interface iResult {
    code: tResultCode;
    data: tResultData;
    headers: tResultHeaders;
}

type tResultCode = () => number;
type tResultData = <T>() => T;
type tResultHeaders = () => OutgoingHttpHeaders;
