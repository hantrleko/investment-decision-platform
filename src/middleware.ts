import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginRoute = req.nextUrl.pathname.startsWith("/auth/login");
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuthRoute) return NextResponse.next();

  if (!isLoggedIn && !isLoginRoute) {
    return NextResponse.redirect(new URL("/auth/login", req.nextUrl));
  }

  if (isLoggedIn && isLoginRoute) {
    return NextResponse.redirect(new URL("/research", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
