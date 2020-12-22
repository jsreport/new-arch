module.exports = (files) => {
  const contentTypeDoc = files.find(f => f.path === '[Content_Types].xml').doc
  const persentationRels = files.find(f => f.path === 'ppt/_rels/presentation.xml.rels').doc
  const persentation = files.find(f => f.path === 'ppt/presentation.xml').doc

  // we start with slide ids at very high value to avoid collision with existing
  let slideNumber = 5000

  for (const file of files.filter(f => f.path.includes('ppt/slides/slide'))) {
    const doc = file.doc
    const slides = doc.getElementsByTagName('p:sld')
    const originalSlideNumber = parseInt(file.path.replace('ppt/slides/slide', '').replace('.xml', ''))

    if (slides.length <= 1) {
      continue
    }

    for (let i = 1; i < slides.length; i++) {
      slideNumber++
      files.push({
        path: `ppt/slides/slide${slideNumber}.xml`,
        doc: slides[i]
      })
      files.push({
        path: `ppt/slides/_rels/slide${slideNumber}.xml.rels`,
        doc: files.find(f => f.path === `ppt/slides/_rels/slide${originalSlideNumber}.xml.rels`).doc
      })
      doc.removeChild(slides[i])

      const sldIdEl = persentation.createElement('p:sldId')
      sldIdEl.setAttribute('id', slideNumber)// I have no clue what is this id, so I put there also slideNumber
      sldIdEl.setAttribute('r:id', `rId${slideNumber}`)
      persentation.getElementsByTagName('p:sldIdLst')[0].appendChild(sldIdEl)

      const overrideEl = contentTypeDoc.createElement('Override')
      overrideEl.setAttribute('PartName', `/ppt/slides/slide${slideNumber}.xml`)
      overrideEl.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
      contentTypeDoc.getElementsByTagName('Types')[0].appendChild(overrideEl)

      const relationship = contentTypeDoc.createElement('Relationship')
      relationship.setAttribute('Id', `rId${slideNumber}`)
      relationship.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide')
      relationship.setAttribute('Target', `slides/slide${slideNumber}.xml`)
      persentationRels.getElementsByTagName('Relationships')[0].appendChild(relationship)
    }
  }
}
