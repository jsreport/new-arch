const fs = require('fs')
const { response } = require('jsreport-office')
const processDocx = require('./processDocx')

module.exports = (reporter, definition) => async (req, res) => {
  if (!req.template.docx || (!req.template.docx.templateAsset && !req.template.docx.templateAssetShortid)) {
    throw reporter.createError('docx requires template.docx.templateAsset or template.docx.templateAssetShortid to be set', {
      statusCode: 400
    })
  }

  if (req.template.engine !== 'handlebars') {
    throw reporter.createError('docx recipe can run only with handlebars', {
      statusCode: 400
    })
  }

  let templateAsset = req.template.docx.templateAsset

  if (req.template.docx.templateAssetShortid) {
    templateAsset = await reporter.documentStore.collection('assets').findOne({ shortid: req.template.docx.templateAssetShortid }, req)

    if (!templateAsset) {
      throw reporter.createError(`Asset with shortid ${req.template.docx.templateAssetShortid} was not found`, {
        statusCode: 400
      })
    }
  } else {
    if (!Buffer.isBuffer(templateAsset.content)) {
      templateAsset.content = Buffer.from(templateAsset.content, templateAsset.encoding || 'utf8')
    }
  }

  reporter.logger.info('docx generation is starting', req)

  const { pathToFile: outputPath } = await reporter.writeTempFile((uuid) => `${uuid}.docx`, '')

  const { docxFilePath } = await processDocx(reporter)({
    docxTemplateContent: templateAsset.content,
    options: {
      imageFetchParallelLimit: definition.options.imageFetchParallelLimit
    },
    outputPath
  }, req)

  reporter.logger.info('docx generation was finished', req)

  res.stream = fs.createReadStream(docxFilePath)

  await response({
    previewOptions: definition.options.preview,
    officeDocumentType: 'docx',
    stream: res.stream,
    logger: reporter.logger
  }, req, res)
}
