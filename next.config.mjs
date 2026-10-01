// Cabeçalhos de segurança em todas as páginas: impedem que o site seja embutido em outro (clickjacking),
// que o navegador "adivinhe" tipos de arquivo e que o endereço completo vaze para outros sites; bloqueiam câmera, microfone e localização.
const seguranca = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]
export default {
  images: {},
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  async headers() { return [{ source: '/:path*', headers: seguranca }] },
}
