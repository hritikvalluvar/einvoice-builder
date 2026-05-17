// Register Unicode-capable fonts for ₹ symbol support.
// Helvetica (PDFKit default) lacks ₹. Roboto carries Latin + ₹.
//
// Fonts come from the @fontsource/* npm packages and are bundled by vite
// via ?url imports — vite hashes them and serves from /assets/.

import { Font } from '@react-pdf/renderer'

import robotoRegular from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url'
import robotoBold from '@fontsource/roboto/files/roboto-latin-700-normal.woff?url'
import robotoItalic from '@fontsource/roboto/files/roboto-latin-400-italic.woff?url'
import robotoMonoRegular from '@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff?url'
import robotoMonoBold from '@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff?url'
import playfairBold from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff?url'

let registered = false

export function registerFonts() {
  if (registered) return

  Font.register({
    family: 'Roboto',
    fonts: [
      { src: robotoRegular, fontWeight: 'normal' },
      { src: robotoBold, fontWeight: 'bold' },
      { src: robotoItalic, fontWeight: 'normal', fontStyle: 'italic' },
    ],
  })

  Font.register({
    family: 'RobotoMono',
    fonts: [
      { src: robotoMonoRegular, fontWeight: 'normal' },
      { src: robotoMonoBold, fontWeight: 'bold' },
    ],
  })

  Font.register({
    family: 'PlayfairDisplay',
    src: playfairBold,
  })

  // Disable word hyphenation so amount-in-words doesn't break weirdly.
  Font.registerHyphenationCallback((word) => [word])

  registered = true
}
