const { DOMParser, XMLSerializer } = require('xmldom')
const { decompress, saveXmlsToOfficeFile } = require('jsreport-office')
const preprocess = require('./preprocess/preprocess.js')
const postprocess = require('./postprocess/postprocess.js')
const { contentIsXML } = require('./utils')

module.exports = async function scriptPptxProcessing (inputs, renderCallbackAsync) {
  const { pptxTemplateContent, logger, outputPath } = inputs

  try {
    const files = await decompress()(pptxTemplateContent)

    for (const f of files) {
      if (contentIsXML(f.data)) {
        f.doc = new DOMParser().parseFromString(f.data.toString())
        f.data = f.data.toString()
      }
    }

    await preprocess(files)

    const filesToRender = files.filter(f => contentIsXML(f.data))

    const contentToRender = (
      filesToRender
        .map(f => new XMLSerializer().serializeToString(f.doc).replace(/<pptxRemove>/g, '').replace(/<\/pptxRemove>/g, ''))
        .join('$$$docxFile$$$')
    )

    logger.debug('Starting child request to render pptx dynamic parts')

    const { content: newContent } = await renderCallbackAsync({
      content: contentToRender
    })

    const contents = newContent.split('$$$docxFile$$$')

    for (let i = 0; i < filesToRender.length; i++) {
      filesToRender[i].data = contents[i]
      filesToRender[i].doc = new DOMParser().parseFromString(contents[i])
    }

    await postprocess(files)

    for (const f of files) {
      let isXML = false

      if (f.data == null) {
        isXML = f.path.includes('.xml')
      } else {
        isXML = contentIsXML(f.data)
      }

      if (isXML) {
        f.data = Buffer.from(new XMLSerializer().serializeToString(f.doc))
      }
    }

    await saveXmlsToOfficeFile({
      outputPath,
      files
    })

    logger.debug('pptx successfully zipped')

    return {
      pptxFilePath: outputPath
    }
  } catch (e) {
    return {
      error: {
        message: e.message,
        stack: e.stack
      }
    }
  }
}
