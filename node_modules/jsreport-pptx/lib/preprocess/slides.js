module.exports = (files) => {
  for (const doc of files.filter(f => f.path.includes('ppt/slides/slide')).map(f => f.doc)) {
    const elements = doc.getElementsByTagName('a:t')

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]

      if (el.textContent.includes('{{pptxSlides')) {
        const startFake = doc.createElement('pptxRemove')
        startFake.textContent = el.textContent.replace('{{', '{{#')

        const endFake = doc.createElement('pptxRemove')
        endFake.textContent = '{{/pptxSlides}}'

        doc.appendChild(endFake)
        const pSld = doc.getElementsByTagName('p:sld')[0]
        pSld.parentNode.insertBefore(startFake, pSld)

        const toRemove = el.parentNode.parentNode.parentNode.parentNode
        toRemove.parentNode.removeChild(toRemove)
      }
    }
  }
}
