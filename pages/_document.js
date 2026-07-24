import { Html, Head, Main, NextScript } from 'next/document'

// Apply the saved theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{if(localStorage.getItem('arc_theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
