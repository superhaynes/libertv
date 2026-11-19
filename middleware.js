import { sha256 } from './js/sha256.js'; // 需新建或引入SHA-256实现


// Vercel Middleware to inject environment variables
export default async function middleware(request) {
  // 内部取回原始响应时带上标记，避免再次触发中间件导致无限循环（Vercel 508 INFINITE_LOOP）
  if (request.headers.get('x-libretv-internal-fetch')) {
    return; // Let the internal fetch pass through unchanged
  }

  // Get the URL from the request
  const url = new URL(request.url);

  // Only process HTML pages
  const isHtmlPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (!isHtmlPage) {
    return; // Let the request pass through unchanged
  }

  // Fetch the original response
  // 注意：直接 fetch(request) 会再次经过中间件，造成无限循环；用请求头标记内部请求
  const response = await fetch(request, {
    headers: {
      'x-libretv-internal-fetch': '1',
    },
  });

  // Check if it's an HTML response
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response; // Return the original response if not HTML
  }

  // Get the HTML content
  const originalHtml = await response.text();

  // Replace the placeholder with actual environment variable
  // If PASSWORD is not set, replace with empty string
  const password = process.env.PASSWORD || '';
  let passwordHash = '';
  if (password) {
    passwordHash = await sha256(password);
  }

  const adminpassword = process.env.ADMINPASSWORD || '';
  let adminpasswordHash = '';
  if (adminpassword) {
    adminpasswordHash = await sha256(adminpassword);
  }

  // 合并两次替换为一次操作
  const modifiedHtml = originalHtml
    .replace('{{PASSWORD_HASH}}', passwordHash)
    .replace('{{ADMINPASSWORD_HASH}}', adminpasswordHash);

  // 修复Response构造
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    },
  });
}

export const config = {
  matcher: ['/', '/((?!api|_next/static|_vercel|favicon.ico).*)'],
};
