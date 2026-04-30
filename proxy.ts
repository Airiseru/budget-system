import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    // Get current session if available
    const response = await fetch(`${request.nextUrl.origin}/api/auth/get-session`, {
        headers: {
            cookie: request.headers.get("cookie") || "",
        },
    });

    const session = await response.json();

    // Redirect to login page if no session
    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect to a different page if user is unverified
    if (session.user.role === 'unverified') {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
    }

    return NextResponse.next();
}

// Only run middleware on specific routes
export const config = {
    matcher: [
        /* Match all request paths */
        '/paps/:path*',
        '/forms/:path*',
        '/home/:path*',
        '/dbm/:path*',
        '/admin/:path*',
    ],
};