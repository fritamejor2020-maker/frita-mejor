import puppeteer from 'puppeteer-core';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('Conectando a Chrome en el puerto 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  console.log('Navegando a la página de login de OlaClick...');
  await page.goto('https://panel.olaclick.app/es/login', { waitUntil: 'networkidle2' });
  
  await delay(3000);
  
  // Inspeccionar elementos de input de tipo email y password
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(el => ({
      type: el.type,
      name: el.name,
      id: el.id,
      className: el.className,
      placeholder: el.placeholder
    }));
  });

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.innerText.trim(),
      type: el.type,
      className: el.className
    }));
  });

  console.log('Inputs encontrados:', inputs);
  console.log('Buttons encontrados:', buttons);

  await browser.disconnect();
}

run().catch(err => console.error(err));
