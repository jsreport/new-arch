const PdfManipulator = require('./utils/pdfManipulator')

module.exports = (proxy, defineMethod) => {
  proxy.pdfUtils = {
    parse: defineMethod(async (context, sourcePdfBuf, includeText) => {
      const originalReq = context.request
      const manipulator = PdfManipulator(sourcePdfBuf)

      const parsedPdf = await manipulator.parse({
        includeText,
        hiddenPageFields: originalReq.context.shared.pdfUtilsHiddenPageFields
      })

      return parsedPdf
    }),
    prepend: defineMethod(async (context, sourcePdfBuf, extraPdfBuf) => {
      const manipulator = PdfManipulator(sourcePdfBuf)

      await manipulator.prepend(extraPdfBuf)

      const resultPdfBuf = await manipulator.toBuffer()

      return resultPdfBuf
    }),
    append: defineMethod(async (context, sourcePdfBuf, extraPdfBuf) => {
      const manipulator = PdfManipulator(sourcePdfBuf)

      await manipulator.append(extraPdfBuf)

      const resultPdfBuf = await manipulator.toBuffer()

      return resultPdfBuf
    }),
    merge: defineMethod(async (context, sourcePdfBuf, extraPdfBufOrPages, mergeToFront) => {
      const originalReq = context.request
      const manipulator = PdfManipulator(sourcePdfBuf)

      // merge needs to have information about total of pages in source pdf
      await manipulator.parse({
        hiddenPageFields: originalReq.context.shared.pdfUtilsHiddenPageFields
      })

      await manipulator.merge(extraPdfBufOrPages, mergeToFront)

      const resultPdfBuf = await manipulator.toBuffer()

      return resultPdfBuf
    }),
    removePages: defineMethod(async (context, sourcePdfBuf, pageNumbers) => {
      const manipulator = PdfManipulator(sourcePdfBuf)

      await manipulator.parse()
      await manipulator.removePages(pageNumbers)

      const resultPdfBuf = await manipulator.toBuffer()

      return resultPdfBuf
    }),
    outlines: defineMethod(async (context, sourcePdfBuf, outlines) => {
      const originalReq = context.request
      const manipulator = PdfManipulator(sourcePdfBuf, { outlines })

      await manipulator.postprocess({
        hiddenPageFields: originalReq.context.shared.pdfUtilsHiddenPageFields
      })

      const resultPdfBuf = await manipulator.toBuffer()

      return resultPdfBuf
    })
  }
}
