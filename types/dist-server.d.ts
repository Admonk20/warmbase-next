declare module "../dist/server/server.js" {
  const server: {
    fetch: (request: Request) => Promise<Response> | Response;
    default?: any;
  };
  export default server;
}
