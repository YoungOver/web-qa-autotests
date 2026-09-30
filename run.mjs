import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(path.join(execSync('npm root -g').toString().trim(), '@playwright/mcp/package.json'))
const { chromium } = require('playwright-core')
const DIST = 'C:/Users/dadas/Documents/freelance/sites/studio/dist'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.glb': 'model/gltf-binary' }
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]))
  if (p.endsWith(path.sep) || p === DIST) p = path.join(p, 'index.html')
  fs.readFile(p, (err, buf) => { if (err) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(buf) })
}).listen(0)
const base = `http://localhost:${server.address().port}`
const pages = fs.readdirSync(DIST).filter(f => f.endsWith('.html'))
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
const rec = (page, id, name, ok, detail = '') => results.push({ page, id, name, ok, detail })

for (const f of pages) {
  for (const vp of [{ w: 1440, h: 900, tag: 'desktop' }, { w: 390, h: 844, tag: 'mobile' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const p = await ctx.newPage()
    const errors = []; let bytes = 0; const bad = []
    p.on('pageerror', e => errors.push(e.message.slice(0, 120)))
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })
    p.on('response', async r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(base, '')); try { const b = await r.body(); bytes += b.length } catch {} })
    const t0 = Date.now()
    await p.goto(`${base}/${f}`, { waitUntil: 'load', timeout: 60000 }).catch(e => errors.push('goto ' + e.message.slice(0, 60)))
    const load = Date.now() - t0
    await p.waitForTimeout(1500)
    if (vp.tag === 'desktop') {
      rec(f, 'LOAD', 'Страница загружается без ошибок JS', errors.length === 0, errors.slice(0, 2).join(' | '))
      rec(f, 'NET', 'Нет ответов 4xx/5xx', bad.length === 0, bad.slice(0, 3).join(', '))
      rec(f, 'WEIGHT', 'Вес страницы до 3 МБ', bytes < 3e6, (bytes / 1e6).toFixed(2) + ' МБ, загрузка ' + load + ' мс')
      const a11y = await p.evaluate(() => ({ noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length, imgs: document.images.length,
        h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, title: document.title,
        emptyLinks: [...document.querySelectorAll('a')].filter(a => !a.getAttribute('href') || a.getAttribute('href') === '#').length,
        noLabel: [...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(i => !(i.labels && i.labels.length) && !i.getAttribute('aria-label') && !i.getAttribute('placeholder')).length,
        desc: !!document.querySelector('meta[name=description]') }))
      rec(f, 'ALT', 'У всех изображений есть alt', a11y.noAlt === 0, `${a11y.noAlt} из ${a11y.imgs} без alt`)
      rec(f, 'H1', 'Ровно один заголовок H1', a11y.h1 === 1, `H1: ${a11y.h1}`)
      rec(f, 'LANG', 'Указан язык документа', !!a11y.lang, a11y.lang || 'нет атрибута lang')
      rec(f, 'META', 'Есть meta description', a11y.desc, a11y.desc ? '' : 'нет description')
      rec(f, 'LINKS', 'Нет пустых ссылок href="#"', a11y.emptyLinks === 0, `пустых ссылок: ${a11y.emptyLinks}`)
      rec(f, 'LABEL', 'Поля форм подписаны', a11y.noLabel === 0, `без подписи: ${a11y.noLabel}`)
    } else {
      const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('a,button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && getComputedStyle(b).visibility !== 'hidden' }).length }))
      rec(f, 'MOB-SCROLL', 'Нет горизонтального скролла на 390 px', ov.sw <= ov.cw + 1, `ширина контента ${ov.sw} px при экране ${ov.cw} px`)
      rec(f, 'MOB-TAP', 'Кнопки и ссылки не меньше 32 px для пальца', ov.small === 0, `мелких целей: ${ov.small}`)
    }
    await ctx.close()
  }
}
await browser.close(); server.close()
fs.writeFileSync(path.join(import.meta.dirname, 'results.json'), JSON.stringify(results, null, 1))
const pass = results.filter(r => r.ok).length
console.log(`checks ${results.length}, passed ${pass}, failed ${results.length - pass}`)
