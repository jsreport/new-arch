const PdfManipulator = require('./utils/pdfManipulator')

module.exports = async (inputs, reporter, req) => {
  const { pdfContent, operations, pdfMeta, pdfPassword, pdfSign, outlines, removeHiddenMarks } = inputs

  const runRender = async (shortidOrTemplate, data) => {
    let templateToUse

    if (typeof shortidOrTemplate === 'string') {
      templateToUse = { shortid: shortidOrTemplate }
    } else {
      templateToUse = { ...shortidOrTemplate }
    }

    const res = await reporter.render({ template: templateToUse, data, options: { pdfUtils: { removeHiddenMarks: false } } }, req)
    return res.content
  }

  try {
    const pdfBuf = Buffer.from(pdfContent, 'base64')
    const manipulator = PdfManipulator(pdfBuf, { pdfMeta, pdfPassword, pdfSign, outlines, removeHiddenMarks, hiddenPageFields: req.context.shared.pdfUtilsHiddenPageFields })
    const operationsToProcess = operations.filter(o => o.templateShortid || o.template)

    reporter.logger.debug(`pdf-utils detected ${operationsToProcess.length} pdf operation(s) to process`, req)

    for (const operation of operationsToProcess) {
      if (operation.enabled === false) {
        reporter.logger.debug(`Skipping disabled pdf operation ${operation.type}`, req)
        continue
      }

      await manipulator.parse({
        hiddenPageFields: req.context.shared.pdfUtilsHiddenPageFields
      })

      let templateDef

      if (operation.templateShortid) {
        templateDef = operation.templateShortid
      } else {
        templateDef = operation.template
      }

      reporter.logger.debug(`pdf-utils running pdf operation ${operation.type}`, req)

      if (operation.type === 'append') {
        await manipulator.append(await runRender(templateDef, { $pdf: { pages: manipulator.parsedPdf.pages } }))
        continue
      }

      if (operation.type === 'prepend') {
        await manipulator.prepend(await runRender(templateDef, { $pdf: { pages: manipulator.parsedPdf.pages } }))
        continue
      }

      if (operation.type === 'merge') {
        if (operation.mergeWholeDocument) {
          const mergeBuffer = await runRender(templateDef, { $pdf: { pages: manipulator.parsedPdf.pages } })
          await manipulator.merge(mergeBuffer, operation.mergeToFront)
          continue
        }

        const singleMergeBuffer = !operation.renderForEveryPage
          ? await runRender(templateDef, { $pdf: { pages: manipulator.parsedPdf.pages } })
          : null

        const pagesBuffers = []

        for (let i = 0; i < manipulator.parsedPdf.pages.length; i++) {
          if (!singleMergeBuffer && manipulator.parsedPdf.pages[i].group) {
            reporter.logger.debug(`pdf-utils invokes merge with group ${manipulator.parsedPdf.pages[i].group}`, req)
          }

          pagesBuffers[i] = singleMergeBuffer || await runRender(templateDef, {
            $pdf: {
              pages: manipulator.parsedPdf.pages,
              pageIndex: i,
              pageNumber: i + 1
            }
          })
        }

        await manipulator.merge(pagesBuffers, operation.mergeToFront)
        continue
      }
    }

    reporter.logger.debug('pdf-utils postproces start', req)
    await manipulator.postprocess({
      hiddenPageFields: req.context.shared.pdfUtilsHiddenPageFields
    })
    reporter.logger.debug('pdf-utils postproces end', req)

    const resultPdfBuffer = await manipulator.toBuffer()

    return {
      pdfContent: resultPdfBuffer.toString('base64')
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
