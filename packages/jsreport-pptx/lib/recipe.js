const fs = require('fs')
const { response } = require('jsreport-office')
const pptxProcessing = require('./pptxProcessing')

module.exports = (reporter, definition) => async (req, res) => {
  if (!req.template.pptx || (!req.template.pptx.templateAsset && !req.template.pptx.templateAssetShortid)) {
    throw reporter.createError(`pptx requires template.pptx.templateAsset or template.pptx.templateAssetShortid to be set`, {
      statusCode: 400
    })
  }

  if (req.template.engine !== 'handlebars') {
    throw reporter.createError(`pptx recipe can run only with handlebars`, {
      statusCode: 400
    })
  }

  let templateAsset = req.template.pptx.templateAsset

  if (req.template.pptx.templateAssetShortid) {
    templateAsset = await reporter.documentStore.collection('assets').findOne({ shortid: req.template.pptx.templateAssetShortid }, req)

    if (!templateAsset) {
      throw reporter.createError(`Asset with shortid ${req.template.pptx.templateAssetShortid} was not found`, {
        statusCode: 400
      })
    }
  } else {
    if (!Buffer.isBuffer(templateAsset.content)) {
      templateAsset.content = Buffer.from(templateAsset.content, templateAsset.encoding || 'utf8')
    }
  }

  reporter.logger.info('pptx generation is starting', req)

  const { pathToFile: outputPath } = await reporter.writeTempFile((uuid) => `${uuid}.pptx`, '')

  const result = await pptxProcessing(
    {
      pptxTemplateContent: templateAsset.content,
      outputPath
    },
    reporter,
    req
  )

  reporter.logger.info('pptx generation was finished', req)

  res.stream = fs.createReadStream(result.pptxFilePath)

  await response({
    previewOptions: definition.options.preview,
    officeDocumentType: 'pptx',
    stream: res.stream,
    logger: reporter.logger
  }, req, res)
}
