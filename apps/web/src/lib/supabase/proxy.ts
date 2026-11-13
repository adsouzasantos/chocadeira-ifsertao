import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha", "/auth", "/configuracao"];
/** Rotas de autenticação que um usuário já logado não precisa ver. */
const GUEST_ONLY_PATHS = ["/login", "/cadastro", "/recuperar-senha"];

const matches = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Renova a sessão do Supabase a cada requisição e protege as rotas internas.
 * A autorização dos dados continua sendo feita pelo RLS no banco; este passo
 * apenas evita que páginas internas sejam exibidas sem login.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith("/configuracao")) return NextResponse.next();
    return NextResponse.redirect(new URL("/configuracao", request.url));
  }

  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Não inserir código entre a criação do cliente e getUser():
  // é esta chamada que valida e renova o token de acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !matches(pathname, PUBLIC_PATHS)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && matches(pathname, GUEST_ONLY_PATHS)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/painel";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
