import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Imagem da prévia do link (WhatsApp, redes sociais): o logo grifado, o nome e a frase do app, nas cores da marca.
// Gerada uma vez no build. A fonte do logo (Bricolage Grotesque, licença OFL em src/app/_fontes) vai junto no projeto: sem internet no build.
export const alt = 'R1TMO — estudos para residência médica no ritmo do seu dia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Imagem() {
  const pasta = join(process.cwd(), 'src/app/_fontes')
  const [negrito, normal] = await Promise.all([readFile(join(pasta, 'BricolageGrotesque-Bold.ttf')), readFile(join(pasta, 'BricolageGrotesque-Regular.ttf'))])
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 96px', background: '#0A0F0D', color: '#E8F0EC', fontFamily: 'Bricolage' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 132, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
          <div style={{ display: 'flex', background: '#2FD27F', color: '#06140D', padding: '6px 18px', borderRadius: 20, transform: 'rotate(-2deg)' }}>R1</div>
          <div style={{ display: 'flex', paddingLeft: 10 }}>TMO</div>
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 54, fontWeight: 700, lineHeight: 1.15, maxWidth: 960 }}>Estudos para residência médica no ritmo do seu dia</div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 32, fontWeight: 400, color: '#8FA39A', maxWidth: 960 }}>Plano pelo tempo que você tem, revisões automáticas e as questões que você errou de volta.</div>
        <div style={{ display: 'flex', position: 'absolute', top: 64, right: 96, fontSize: 30, fontWeight: 700, color: '#2FD27F' }}>r1tmo.com.br</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Bricolage', data: negrito, weight: 700, style: 'normal' }, { name: 'Bricolage', data: normal, weight: 400, style: 'normal' }] },
  )
}
