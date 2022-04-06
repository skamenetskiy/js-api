import {
    IncomingMessage,
    OutgoingHttpHeaders,
    request as doRequest,
    RequestOptions,
} from "http";

export function createClient({host, port}: iConfig): iClient {
    const
        options: RequestOptions = {
            host,
            port,
            method: "POST",
        };

    const
        call = (method: string, data: any): Promise<iResult> => new Promise<iResult>((resolve, reject) => {
            const req = doRequest(options);
            req.on("error", (err: Error) => {
                reject(err);
            })
            req.on("response", (res: IncomingMessage) => {
                let
                    body = "";
                const
                    errorListener = (err: Error) => {
                        reject(err);
                    },
                    dataListener = (chunk: string) => {
                        body += chunk;
                    },
                    endListener = () => {
                        try {
                            const data = JSON.parse(body);
                            resolve({
                                code: () => res.statusCode as number,
                                data: <T>() => data as T,
                                headers: () => res.headers,
                            })
                        } catch (err) {
                            reject(err);
                        }
                    };
                res.on("error", errorListener);
                res.on("data", dataListener);
                res.on("end", endListener);
            });
            try {
                req.write(JSON.stringify({data, method}));
            } catch (err) {
                reject(err);
            } finally {
                req.end();
            }
        });
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
    call(name: string, data: any): Promise<iResult>;
}

interface iResult {
    code: tResultCode;
    data: tResultData;
    headers: tResultHeaders;
}

type tResultCode = () => number;
type tResultData = <T>() => T;
type tResultHeaders = () => OutgoingHttpHeaders;
