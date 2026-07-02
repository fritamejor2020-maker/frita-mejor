import puppeteer from 'puppeteer-core';
import path from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('Conectando a Chrome en el puerto 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });
  
  console.log('Conectado con éxito.');
  const pages = await browser.pages();
  console.log('Páginas abiertas:', pages.map(p => p.url()));
  
  // Buscar si hay una página de OlaClick abierta
  let page = pages.find(p => p.url().includes('olaclick.app'));
  if (!page) {
    console.log('No se encontró pestaña de OlaClick. Abriendo la URL de access-tokens...');
    page = await browser.newPage();
    await page.goto('https://panel.olaclick.app/frita-mejor/access-tokens', { waitUntil: 'networkidle2' });
  } else {
    console.log('Encontrada pestaña de OlaClick:', page.url());
    await page.bringToFront();
    await page.goto('https://panel.olaclick.app/frita-mejor/access-tokens', { waitUntil: 'networkidle2' });
  }

  console.log('Esperando 6 segundos para carga completa...');
  await delay(6000);
  
  const title = await page.title();
  const currentUrl = page.url();
  console.log('Título actual:', title);
  console.log('URL actual:', currentUrl);

  // Tomar captura de pantalla
  const screenshotPath = 'C:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch\\olaclick_screen.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Captura guardada en:', screenshotPath);

  await browser.disconnect();
}

run().catch(err => console.error('Error en la automatización:', err));
