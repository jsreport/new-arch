
// powerpoint splits strings like {{#each people}} into multiple xml nodes
// here we concat values from these splitted node and put it to one node
// so handlebars can correctly run
module.exports = (files) => {
  for (const doc of files.filter(f => f.path.includes('ppt/slides/slide')).map(f => f.doc)) {
    const elements = doc.getElementsByTagName('a:t')

    const toRemove = []
    let startIndex = -1
    let tag = ''

    for (let i = 0; i < elements.length; i++) {
      const value = elements[i].textContent

      if (startIndex !== -1) {
        tag += value

        if (!value && elements[i].getAttribute('xml:space') === 'preserve') {
          tag += ' '
        }

        if (tag.endsWith('}}')) {
          elements[startIndex].textContent = tag
          startIndex = -1
        }

        toRemove.push(i)
        continue
      }

      const indexStart = value.indexOf('{')
      if (indexStart !== -1) {
        if (value.endsWith('}}')) {
          elements[i].textContent = value + '$$$tag$$$'
          continue
        }
        startIndex = i
        tag = value
      }
    }

    for (const r of toRemove) {
      // in docx we for now remove w:t, so the text block, however in pptx we remove a:r, so the parent of the a:t text block
      // pptx fails to load slide if there are a:r without a:t
      elements[r].parentNode.parentNode.removeChild(elements[r].parentNode)
    }
  }
}
