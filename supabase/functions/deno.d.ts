// Solo para que tsc revise las funciones sin Deno instalado; Deno trae sus propios tipos.
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
  env: { get(name: string): string | undefined }
}
