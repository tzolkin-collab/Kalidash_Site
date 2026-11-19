#!/usr/bin/env bash
# Converte o filme do Google Flow (1 arquivo, ou os 3 takes separados) na sequência de quadros que a /spectra desenha no scroll.
#
# Uso (da raiz do repo kalidash):
#   bash docs/spectra-video/quadros.sh desktop filme.mp4
#   bash docs/spectra-video/quadros.sh desktop take1.mp4 take2.mp4 take3.mp4
#   TRECHOS="0-5.5:2,5.5-8:12" bash docs/spectra-video/quadros.sh desktop filme.mp4
#
# O que faz, na ordem:
#   1. com 3 takes, junta os três; o 1º quadro do take 2 e do take 3 sai (é o último do take anterior, usado como quadro inicial no Flow);
#   2. TRECHOS escolhe os quadros: "início-fim:passo" em segundos, passo em quadros do vídeo original
#      (24 fps: passo 2 = 12 por segundo, passo 12 = 2 por segundo). Trechos parados levam passo grande e o scroll não fica "morto".
#      Sem TRECHOS: passo 2 no filme inteiro;
#   3. tira o som e redimensiona (desktop: largura do original, sem ampliar; mobile 720 px);
#   4. fecha o branco olhando os três canais juntos (o branco do Veo fica em 244-246 e não emendava com o #fff da página);
#   5. grava WebP numerados em apps/site/public/spectra/filme/<formato>/ e um manifest.json.
# Variáveis opcionais: FFMPEG (caminho do ffmpeg), QUALIDADE (WebP, padrão 74), LARGURA (força a largura).
set -euo pipefail

FORMATO="${1:?formato: desktop ou mobile}"; shift
[ "$#" -eq 1 ] || [ "$#" -eq 3 ] || { echo "passe 1 filme ou os 3 takes, na ordem" >&2; exit 1; }
FF="${FFMPEG:-$(command -v ffmpeg || python -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')}"
QUALIDADE="${QUALIDADE:-74}"
case "$FORMATO" in
  desktop) LARGURA="${LARGURA:-1600}" ;;
  mobile) LARGURA="${LARGURA:-720}" ;;
  *) echo "formato inválido: $FORMATO" >&2; exit 1 ;;
esac

# Trechos -> expressão do select do ffmpeg (t em segundos, n = número do quadro no original).
TRECHOS="${TRECHOS:-0-999:2}"
SEL=$(python -c "
import sys
partes=[]
for tr in sys.argv[1].split(','):
    faixa,passo=tr.split(':'); ini,fim=faixa.split('-')
    partes.append(f'between(t\\\\,{ini}\\\\,{float(fim)-0.001})*not(mod(n\\\\,{int(passo)}))')
print('+'.join(partes))" "$TRECHOS")

# Branco fechado pelos três canais juntos: k = (menor canal - 226) / 12, de 0 a 1; cada canal sobe k do caminho até 255.
# Pixel com algum canal abaixo de 226 (Imperial, mármore, dourado) fica exatamente igual; o branco do Veo (244-246) vira #fff
# sem amarelar (subir canal por canal deixava a transição creme).
M="min(min(r(X,Y),g(X,Y)),b(X,Y))"
K="clip(($M-226)/12,0,1)"
BRANCO="geq=r='r(X,Y)+(255-r(X,Y))*$K':g='g(X,Y)+(255-g(X,Y))*$K':b='b(X,Y)+(255-b(X,Y))*$K'"
# Não amplia: se o original é menor que LARGURA, fica no tamanho original.
ESCALA="scale='min($LARGURA,iw)':-2:flags=lanczos"

SAIDA="apps/site/public/spectra/filme/$FORMATO"
mkdir -p "$SAIDA"
rm -f "$SAIDA"/*.webp "$SAIDA"/manifest.json

if [ "$#" -eq 3 ]; then
  ENTRADA=(-i "$1" -i "$2" -i "$3")
  JUNTA="[0:v]setpts=PTS-STARTPTS[a];[1:v]trim=start_frame=1,setpts=PTS-STARTPTS[b];[2:v]trim=start_frame=1,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,"
else
  ENTRADA=(-i "$1")
  JUNTA="[0:v]"
fi

"$FF" -hide_banner -loglevel error -y "${ENTRADA[@]}" -filter_complex "${JUNTA}select='$SEL',setpts=N/12/TB,$ESCALA,format=rgb24,$BRANCO[v]" \
  -map "[v]" -an -fps_mode passthrough -c:v libwebp -quality "$QUALIDADE" -compression_level 6 "$SAIDA/%04d.webp"

QTD=$(ls "$SAIDA"/*.webp | wc -l | tr -d ' ')
DIM=$(python -c "from PIL import Image;im=Image.open('$SAIDA/0001.webp');print(im.width,im.height)")
read -r W H <<<"$DIM"
printf '{ "count": %s, "width": %s, "height": %s, "trechos": "%s" }\n' "$QTD" "$W" "$H" "$TRECHOS" > "$SAIDA/manifest.json"
TAM=$(du -sh "$SAIDA" | cut -f1)
echo "$FORMATO: $QTD quadros de ${W}x${H}, $TAM em $SAIDA"
