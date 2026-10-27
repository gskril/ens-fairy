/**
 * Renders the share image and PNG/ICO icons from og.html and public/logo.svg.
 * Needs Playwright with Chromium, plus Python with Pillow for favicon.ico.
 *
 *   node scripts/brand/render.cjs
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const here = __dirname
const pub = path.join(here, '..', '..', 'public')
const url = (file) => `file://${file}`

;(async () => {
  const browser = await chromium.launch()

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await og.goto(url(path.join(here, 'og.html')), { waitUntil: 'networkidle' })
  await og.evaluate(() => document.fonts.ready)
  await og.screenshot({ path: path.join(pub, 'sharing.png') })

  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fairy-'))
  const icons = {
    16: null,
    32: null,
    48: null,
    180: 'apple-touch-icon.png',
    192: 'icon-192.png',
    512: 'icon-512.png',
  }
  for (const [size, name] of Object.entries(icons)) {
    const html = path.join(tmp, `icon-${size}.html`)
    fs.writeFileSync(
      html,
      `<body style="margin:0;background:transparent"><img src="${url(path.join(pub, 'logo.svg'))}" width="${size}" height="${size}" style="display:block"></body>`
    )
    const page = await browser.newPage({
      viewport: { width: +size, height: +size },
    })
    await page.goto(url(html))
    await page.waitForTimeout(150)
    const out = name ? path.join(pub, name) : path.join(tmp, `icon-${size}.png`)
    await page.screenshot({ path: out, omitBackground: true })
  }
  await browser.close()

  execFileSync('python3', [
    '-c',
    `from PIL import Image
imgs = [Image.open(f"${tmp}/icon-{s}.png").convert("RGBA") for s in (16, 32, 48)]
imgs[2].save("${path.join(pub, 'favicon.ico')}", sizes=[(16, 16), (32, 32), (48, 48)], append_images=imgs[:2])`,
  ])
  console.log(
    'Wrote sharing.png, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png'
  )
})()
