declare module "../dist/server/server.js" {
  const server: {
    fetch: (request: Request) => Promise<Response> | Response;
    default?: unknown;
  };
  export default server;
}
